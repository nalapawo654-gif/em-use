//! Read-only DongDong calendar and native-time reminder scheduler, independent of quota auth.
use crate::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
const MINUTE: i64 = 60_000;
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub key: String,
    pub title: String,
    pub start: i64,
    pub end: i64,
    pub rooms: Vec<String>,
    pub all_day: bool,
}
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Mark {
    end: i64,
    #[serde(default)]
    acknowledged: bool,
    #[serde(default)]
    delivered: bool,
    #[serde(default)]
    start_sent: bool,
    snooze: Option<i64>,
}
pub struct Hub {
    pub epoch: String,
    fingerprint: String,
    pub account: Value,
    pub status: String,
    pub message: String,
    pub items: Vec<Event>,
    pub active: Vec<String>,
    pub fetched_at: i64,
    pub date: String,
    marks: HashMap<String, Mark>,
    pub blocked: bool,
    pub refresh_requested: bool,
}
impl Default for Hub {
    fn default() -> Self {
        Self {
            epoch: uuid::Uuid::new_v4().to_string(),
            fingerprint: String::new(),
            account: Value::Null,
            status: "waiting".into(),
            message: "等待本机咚咚登录".into(),
            items: vec![],
            active: vec![],
            fetched_at: 0,
            date: String::new(),
            marks: HashMap::new(),
            blocked: false,
            refresh_requested: false,
        }
    }
}
fn hash(s: &str) -> String {
    format!("{:x}", Sha256::digest(s.as_bytes()))
}
fn text(v: &Value, max: usize) -> String {
    v.as_str()
        .unwrap_or("")
        .chars()
        .filter(|c| !c.is_control())
        .take(max)
        .collect()
}
fn number(v: &Value) -> Option<i64> {
    v.as_i64().or_else(|| v.as_str()?.parse().ok())
}
pub fn normalize(body: &Value, identity: &str) -> Result<Vec<Event>, String> {
    if number(&body["code"]) != Some(200) {
        return Err(match number(&body["code"]) {
            Some(401 | 403) => "咚咚日程登录已失效或无权限，请重新登录咚咚",
            _ => "咚咚暂未返回日程，请稍后重试",
        }
        .into());
    }
    let rows = body["data"].as_array().ok_or("咚咚日程数据格式暂不支持")?;
    if rows.len() > 2000 {
        return Err("日程数量超出本次读取范围".into());
    }
    let mut items = vec![];
    for r in rows {
        // Confirmed against the installed 3.4.1 accept/reject and disabled-state code.
        if number(&r["acceptStatus"]) == Some(0)
            || number(&r["isEnabled"]) == Some(1)
            || number(&r["isDisable"]) == Some(1)
        {
            continue;
        }
        let parse = |v: &Value| {
            v.as_str()
                .and_then(|s| model::parse_time(&s.replace(' ', "T")))
        };
        let (Some(start), Some(end)) = (parse(&r["startTime"]), parse(&r["endTime"])) else {
            return Err("日程时间格式暂不支持，未更新旧安排".into());
        };
        if end <= start {
            continue;
        }
        let id = r["uuid"]
            .as_str()
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
            .or_else(|| r["id"].as_i64().map(|n| n.to_string()))
            .ok_or("日程缺少标识")?;
        let key = hash(&format!("{identity}:{id}:{start}"));
        if items.iter().any(|e: &Event| e.key == key) {
            continue;
        }
        let mut rooms: Vec<String> = r["rooms"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|r| text(&r["roomName"], 160))
            .filter(|s| !s.is_empty())
            .collect();
        if rooms.is_empty() {
            let room = text(&r["room"]["roomName"], 160);
            if !room.is_empty() {
                rooms.push(room);
            }
        }
        rooms.sort();
        rooms.dedup();
        rooms.truncate(20);
        let title = text(&r["title"], 500);
        let all_day = r["allDay"] == true
            || r["isAllDay"] == true
            || (start + 8 * 3600_000).rem_euclid(86400_000) == 0 && end - start >= 86400_000 - 1000;
        items.push(Event {
            key,
            title: if title.is_empty() {
                "未命名日程".into()
            } else {
                title
            },
            start,
            end,
            rooms,
            all_day,
        });
    }
    items.sort_by_key(|e| e.start);
    Ok(items)
}
impl Hub {
    fn bind(&mut self, fingerprint: &str, account: Value) {
        if self.fingerprint != fingerprint {
            self.epoch = uuid::Uuid::new_v4().to_string();
            self.fingerprint = fingerprint.into();
            self.items.clear();
            self.active.clear();
            self.fetched_at = 0;
            self.date.clear();
        }
        self.account = account;
    }
    fn accept(&mut self, items: Vec<Event>, time: i64) {
        self.active.retain(|k| items.iter().any(|e| &e.key == k));
        self.items = items;
        self.fetched_at = time;
        self.date = model::day(time);
        self.status = "ready".into();
        self.message = "已同步本机咚咚日程".into();
        self.marks.retain(|_, m| m.end > time - 2 * 86400_000);
    }
    pub fn due(&self, time: i64, lead: i64, at_start: bool) -> Vec<String> {
        if !["ready", "stale"].contains(&self.status.as_str())
            || self.date != model::day(time)
            || time - self.fetched_at > 15 * MINUTE
        {
            return vec![];
        }
        self.items
            .iter()
            .filter(|e| {
                if e.all_day || e.end <= time || time > e.start + 5 * MINUTE {
                    return false;
                }
                let m = self.marks.get(&e.key).cloned().unwrap_or_default();
                if m.acknowledged {
                    return false;
                }
                if let Some(snooze) = m.snooze {
                    return time >= snooze;
                }
                (!m.delivered && time >= e.start - lead * MINUTE)
                    || (at_start && m.delivered && !m.start_sent && time >= e.start)
            })
            .map(|e| e.key.clone())
            .collect()
    }
    fn delivered(&mut self, keys: &[String], time: i64) {
        for e in &self.items {
            if keys.contains(&e.key) {
                let m = self.marks.entry(e.key.clone()).or_default();
                m.end = e.end;
                m.delivered = true;
                m.snooze = None;
                if time >= e.start {
                    m.start_sent = true;
                }
            }
        }
    }
    pub fn view(&self, preview: bool) -> Value {
        let items: Vec<_> = self
            .items
            .iter()
            .map(|e| {
                let mut e = e.clone();
                if !preview {
                    e.title = "一项日程".into();
                    e.rooms.clear();
                }
                e
            })
            .collect();
        json!({"epoch":self.epoch,"account":self.account,"status":self.status,"message":self.message,"items":items,"active":self.active,"fetchedAt":self.fetched_at,"date":self.date})
    }
    fn save(&self, app: &tauri::AppHandle) -> Result<(), String> {
        // No event text, native calendar IDs, names or session tokens on disk.
        storage::write(app, "calendar-reminders.json", &json!(self.marks))
    }
}
pub fn ui(app: &tauri::AppHandle, blocked: bool) {
    shared(app).calendar.lock().unwrap().blocked = blocked;
}
pub fn refresh(app: &tauri::AppHandle) {
    shared(app).calendar.lock().unwrap().refresh_requested = true;
}
pub fn dismiss(app: &tauri::AppHandle) {
    shared(app).calendar.lock().unwrap().active.clear();
    windows::hide_calendar_toast(app);
    publish(app);
}
pub fn respond(app: &tauri::AppHandle, p: &Value) -> Result<(), String> {
    let sh = shared(app);
    let mut h = sh.calendar.lock().unwrap();
    if p["epoch"] != h.epoch {
        return Err("咚咚账户已变化，请重新打开日程".into());
    }
    let key = p["key"].as_str().ok_or("请选择日程")?;
    let e = h
        .items
        .iter()
        .find(|e| e.key == key)
        .cloned()
        .ok_or("这项日程已变更，请刷新后查看")?;
    let time = now();
    if time >= e.end {
        return Err("这项日程已过计划结束时间".into());
    }
    let before = h.marks.clone();
    let m = h.marks.entry(key.into()).or_default();
    m.end = e.end;
    match p["choice"].as_str() {
        Some("ack") => {
            m.acknowledged = true;
            m.snooze = None;
        }
        Some("snooze") if time < e.start => {
            m.snooze = Some((time + 2 * MINUTE).min(e.start));
            m.acknowledged = false;
        }
        _ => return Err("这项日程已经开始，可选择知道了".into()),
    }
    if h.save(app).is_err() {
        h.marks = before;
        return Err("提醒设置未能保存，请重试".into());
    }
    h.active.retain(|k| k != key);
    let empty = h.active.is_empty();
    drop(h);
    if empty {
        windows::hide_calendar_toast(app);
    }
    publish(app);
    Ok(())
}
pub fn start(app: tauri::AppHandle) {
    if let Some(saved) = storage::read(&app, "calendar-reminders.json") {
        if let Ok(m) = serde_json::from_value::<HashMap<String, Mark>>(saved) {
            if m.len() < 10000 {
                shared(&app).calendar.lock().unwrap().marks = m;
            }
        }
    }
    tauri::async_runtime::spawn(watch(app));
}
async fn watch(app: tauri::AppHandle) {
    let mut session = None;
    let mut stamp = String::new();
    let mut next_session = 0;
    let mut next_fetch = 0;
    let mut previous = now();
    let mut requested_day = model::day(previous);
    let mut last = Value::Null;
    loop {
        let time = now();
        let sh = shared(&app);
        let settings = sh.inner.lock().unwrap().state["settings"].clone();
        let enabled = settings["calendarEnabled"] == true;
        let current = message_source::stamp();
        if !enabled {
            let mut h = sh.calendar.lock().unwrap();
            h.bind("", Value::Null);
            h.status = "disabled".into();
            h.message = "日程提醒已关闭".into();
            session = None;
            stamp.clear();
            next_fetch = 0;
        } else {
            if current != stamp || session.is_none() && time >= next_session {
                session = dongdong::read_session().ok();
                stamp = current.clone();
                next_session = time + 5000;
                next_fetch = 0;
                let mut h = sh.calendar.lock().unwrap();
                if let Some(s) = &session {
                    h.bind(&s.fingerprint, json!({"name":s.name,"id":s.badge}));
                    h.status = "connecting".into();
                    h.message = "正在同步今日日程".into();
                } else {
                    h.bind("", Value::Null);
                    h.status = "waiting".into();
                    h.message = "等待本机咚咚登录".into();
                }
            }
            if let Some(s) = &session {
                {
                    let mut h = sh.calendar.lock().unwrap();
                    if requested_day != model::day(time) {
                        requested_day = model::day(time);
                        h.date = requested_day.clone();
                        h.fetched_at = 0;
                        h.status = "connecting".into();
                        h.message = "正在同步新一天的安排".into();
                        h.items.clear();
                        h.active.clear();
                        next_fetch = 0;
                    }
                    if h.refresh_requested || time - previous > 30_000 || time < previous {
                        h.refresh_requested = false;
                        next_fetch = 0;
                    }
                }
                if time >= next_fetch {
                    let date = model::day(time);
                    let result = dongdong::calendar_day(&sh.http, s, &date)
                        .await
                        .and_then(|v| normalize(&v, &s.calendar_identity()));
                    if current != message_source::stamp() {
                        session = None;
                        stamp.clear();
                        let mut h = sh.calendar.lock().unwrap();
                        h.bind("", Value::Null);
                        h.status = "waiting".into();
                        h.message = "咚咚账户正在切换".into();
                    } else {
                        let mut h = sh.calendar.lock().unwrap();
                        match result {
                            Ok(items) => h.accept(items, now()),
                            Err(e) => {
                                h.status = if e.contains("登录") || e.contains("权限") {
                                    h.items.clear();
                                    h.active.clear();
                                    "expired"
                                } else {
                                    "stale"
                                }
                                .into();
                                h.message = e;
                            }
                        }
                        next_fetch = now() + 60_000;
                    }
                }
            }
        }
        // Native clock owns scheduling: suspended or throttled webviews do not own timers.
        let now = now();
        previous = now;
        {
            let mut h = sh.calendar.lock().unwrap();
            let items = h.items.clone();
            h.active.retain(|k| {
                items
                    .iter()
                    .any(|e| &e.key == k && e.end > now && now <= e.start + 5 * MINUTE)
            });
        }
        if sh.calendar.lock().unwrap().active.is_empty() {
            windows::hide_calendar_toast(&app);
        }
        let lead = settings["calendarLeadMinutes"].as_i64().unwrap_or(5);
        let due = sh
            .calendar
            .lock()
            .unwrap()
            .due(now, lead, settings["calendarAtStart"] == true);
        let (blocked, active) = {
            let h = sh.calendar.lock().unwrap();
            (h.blocked, !h.active.is_empty())
        };
        let visible = app
            .get_webview_window("widget")
            .is_some_and(|w| w.is_visible().unwrap_or(false));
        let supported_scene = matches!(
            settings["scene"].as_str(),
            Some(
                "buddy"
                    | "aquarium"
                    | "beaver"
                    | "hamster"
                    | "cultivation"
                    | "battery"
                    | "feidudu"
                    | "dinosaur"
                    | "fox"
                    | "luckycat"
                    | "skadi"
            )
        );
        let can_toast = visible
            && supported_scene
            && settings["clickThrough"] != true
            && !blocked
            && !windows::calendar_panel_open(&app);
        if enabled && !due.is_empty() && !active {
            if can_toast {
                {
                    sh.calendar.lock().unwrap().active = due.clone();
                }
                publish(&app);
                match windows::calendar_popup(&app, false) {
                    Ok(()) => {
                        let mut h = sh.calendar.lock().unwrap();
                        h.delivered(&due, now);
                        if h.save(&app).is_err() {
                            h.message = "提醒已显示，但去重记录未能保存；重启后可能再次提醒".into();
                        }
                    }
                    Err(_) => {
                        let mut h = sh.calendar.lock().unwrap();
                        h.active.clear();
                        h.message = "日程气泡未能显示，可点击翻页历查看".into();
                    }
                }
            } else if (!visible || settings["clickThrough"] == true || !supported_scene)
                && settings["calendarSystemNotifications"] == true
            {
                use tauri_plugin_notification::NotificationExt;
                let h = sh.calendar.lock().unwrap();
                let first = h.items.iter().find(|e| e.key == due[0]);
                let body = if settings["calendarPreview"] == true {
                    first
                        .map(|e| {
                            format!(
                                "{} · {}",
                                e.title,
                                chrono::DateTime::from_timestamp_millis(e.start + 8 * 3600_000)
                                    .unwrap()
                                    .format("%H:%M")
                            )
                        })
                        .unwrap_or_default()
                } else {
                    "你有即将开始的日程".into()
                };
                drop(h);
                if app
                    .notification()
                    .builder()
                    .title(if due.len() > 1 {
                        "有多项日程即将开始"
                    } else {
                        "咚咚日程提醒"
                    })
                    .body(body)
                    .show()
                    .is_ok()
                {
                    let mut h = sh.calendar.lock().unwrap();
                    h.delivered(&due, now);
                    let _ = h.save(&app);
                }
            }
        }
        if !can_toast {
            sh.calendar.lock().unwrap().active.clear();
            windows::hide_calendar_toast(&app);
        }
        let current = sh
            .calendar
            .lock()
            .unwrap()
            .view(settings["calendarPreview"] != false);
        if current != last {
            last = current;
            publish(&app);
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn event(start: i64) -> Event {
        Event {
            key: "one".into(),
            title: "private title".into(),
            start,
            end: start + 60 * MINUTE,
            rooms: vec!["private room".into()],
            all_day: false,
        }
    }
    fn hub(start: i64) -> Hub {
        let mut h = Hub::default();
        h.accept(vec![event(start)], start - 10 * MINUTE);
        h
    }
    #[test]
    fn exact_due_ack_snooze_and_restart() {
        let t = model::parse_time("2026-09-15T15:00:00").unwrap();
        let mut h = hub(t);
        assert!(h.due(t - 5 * MINUTE - 1, 5, false).is_empty());
        let keys = h.due(t - 5 * MINUTE, 5, false);
        assert_eq!(keys.len(), 1);
        h.delivered(&keys, t - 5 * MINUTE);
        assert!(h.due(t - 4 * MINUTE, 5, false).is_empty());
        assert_eq!(h.due(t, 5, true).len(), 1);
        let saved = serde_json::to_string(&h.marks).unwrap();
        let mut restarted = hub(t);
        restarted.marks = serde_json::from_str(&saved).unwrap();
        assert!(restarted.due(t - 4 * MINUTE, 5, false).is_empty());
        let m = h.marks.get_mut("one").unwrap();
        m.snooze = Some(t - 2 * MINUTE);
        assert!(h.due(t - 3 * MINUTE, 5, false).is_empty());
        assert_eq!(h.due(t - 2 * MINUTE, 5, false).len(), 1);
        h.marks.get_mut("one").unwrap().acknowledged = true;
        assert!(h.due(t, 5, true).is_empty());
    }
    #[test]
    fn wake_cancel_reschedule_privacy_and_source() {
        let t = model::parse_time("2026-09-15T15:00:00").unwrap();
        let mut h = hub(t);
        h.fetched_at = t;
        assert_eq!(h.due(t + 2 * MINUTE, 5, false).len(), 1);
        assert!(h.due(t + 6 * MINUTE, 5, false).is_empty());
        assert!(!h.view(false).to_string().contains("private"));
        h.active = vec!["one".into()];
        h.accept(vec![], t);
        assert!(h.active.is_empty());
        assert!(h.due(t, 5, false).is_empty());
        h.bind("A", json!({"id":"A"}));
        let epoch = h.epoch.clone();
        h.accept(vec![event(t)], t);
        h.bind("B", json!({"id":"B"}));
        assert_ne!(epoch, h.epoch);
        assert!(h.items.is_empty());
    }
    #[test]
    fn normalize_rejected_cancelled_dates_duplicates() {
        let r = json!({"id":1,"title":"meeting","startTime":"2026-09-15 15:00:00","endTime":"2026-09-15 16:00:00","acceptStatus":1});
        let mut rejected = r.clone();
        rejected["acceptStatus"] = json!(0);
        let mut cancelled = r.clone();
        cancelled["isEnabled"] = json!(1);
        let list = normalize(
            &json!({"code":"200","data":[r.clone(),r,rejected,cancelled]}),
            "A",
        )
        .unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(
            list[0].start,
            model::parse_time("2026-09-15T15:00:00").unwrap()
        );
        assert_ne!(list[0].key,normalize(&json!({"code":200,"data":[{"id":1,"startTime":"2026-09-15 16:00:00","endTime":"2026-09-15 17:00:00"}]}),"A").unwrap()[0].key);
    }
    #[test]
    fn stale_all_day_and_concurrent_events() {
        let t = model::parse_time("2026-09-15T15:00:00").unwrap();
        let mut h = hub(t);
        let mut second = event(t);
        second.key = "two".into();
        let mut all_day = event(t);
        all_day.key = "all-day".into();
        all_day.all_day = true;
        h.accept(vec![event(t), second, all_day], t - MINUTE);
        assert_eq!(h.due(t, 5, false).len(), 2);
        h.status = "expired".into();
        assert!(h.due(t, 5, false).is_empty());
        h.status = "stale".into();
        h.fetched_at = t - 16 * MINUTE;
        assert!(h.due(t, 5, false).is_empty());
        h.fetched_at = t;
        h.date = "2026-09-14".into();
        assert!(h.due(t, 5, false).is_empty());
        assert!(normalize(
            &json!({"code":200,"data":[{"id":1,"startTime":"invalid"}]}),
            "A"
        )
        .is_err());
    }
    #[test]
    #[ignore = "Reads current user's calendar; outputs only counts, never titles or credentials"]
    fn live_calendar_read() {
        tauri::async_runtime::block_on(async {
            let s = dongdong::read_session().map_err(|_| "No session").unwrap();
            let http = reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .unwrap();
            let body = dongdong::calendar_day(&http, &s, &model::day(now()))
                .await
                .unwrap();
            let items = normalize(&body, &s.calendar_identity()).unwrap();
            println!("Live calendar readable; count={}", items.len());
        });
    }
}
