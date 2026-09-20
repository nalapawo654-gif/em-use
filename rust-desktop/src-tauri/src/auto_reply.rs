//! Explicit, session-only private-chat autoresponder. Never accepts a renderer-supplied recipient.
use crate::{
    message_source::{Contact, Record},
    *,
};
use std::collections::{HashMap, HashSet, VecDeque};
const COOLDOWN: i64 = 30 * 60_000;
#[derive(Clone)]
pub struct Pending {
    pub peer: String,
    pub message: String,
    pub chat: String,
    due: i64,
    at: i64,
}
#[derive(Default)]
pub struct Engine {
    epoch: String,
    pub contacts: Vec<Contact>,
    selected: HashSet<String>,
    directory: HashMap<String, dongdong::DirectoryUser>,
    text: String,
    until: i64,
    since: i64,
    pending: HashMap<String, Pending>,
    cooldown: HashMap<String, i64>,
    handled: HashSet<String>,
    sent: HashSet<String>,
    paused: HashSet<String>,
    logs: VecDeque<Value>,
}
impl Engine {
    pub fn bind(&mut self, epoch: &str) {
        if self.epoch != epoch {
            *self = Self {
                epoch: epoch.into(),
                ..Self::default()
            };
        }
    }
    pub fn cancel_read(&mut self, ids: &[String]) {
        self.pending.retain(|_, p| !ids.contains(&p.message));
        self.handled.extend(ids.iter().cloned());
    }
    pub fn stop(&mut self) {
        self.until = 0;
        self.pending.clear();
    }
    pub fn configure(&mut self, p: &Value, now: i64) -> Result<(), String> {
        if p["enabled"] == false {
            self.stop();
            return Ok(());
        }
        if p["enabled"] != true {
            return Err("请选择开启或关闭自动回复".into());
        }
        if p["epoch"].as_str() != Some(&self.epoch) {
            return Err("消息账户已变化，请重新选择联系人".into());
        }
        let keys: Vec<String> =
            serde_json::from_value(p["contacts"].clone()).map_err(|_| "请选择私聊联系人")?;
        let text = p["text"].as_str().unwrap_or("").trim();
        if text.is_empty()
            || text.chars().count() > 300
            || text.chars().any(|c| c.is_control() && c != '\n')
        {
            return Err("请输入 1–300 字回复内容".into());
        }
        if keys.is_empty() || keys.len() > 20 {
            return Err("请选择 1–20 位私聊联系人".into());
        }
        let selected: HashSet<_> = keys
            .iter()
            .map(|key| {
                self.contacts
                    .iter()
                    .find(|c| &c.key == key)
                    .map(|c| c.peer.clone())
                    .or_else(|| self.directory.get(key).map(|u| u.id.clone()))
                    .ok_or("联系人已变化，请重新选择")
            })
            .collect::<Result<_, _>>()?;
        for c in self.contacts.iter().filter(|c| selected.contains(&c.peer)) {
            self.directory
                .entry(c.key.clone())
                .or_insert_with(|| dongdong::DirectoryUser {
                    id: c.peer.clone(),
                    name: c.name.clone(),
                    department: String::new(),
                });
        }
        self.selected = selected;
        self.text = text.into();
        self.since = now;
        self.until = now + 60 * 60_000;
        self.pending.clear();
        self.paused.clear();
        // Keep cooldown/dedupe across stop/start and edits. Restart is OFF and reader baselines history.
        Ok(())
    }
    pub fn ingest(&mut self, rows: &[Record], now: i64) {
        if self.until <= now {
            self.stop();
            return;
        }
        for r in rows {
            if r.own && r.private_peer.is_some() && r.at >= self.since && !self.sent.contains(&r.id)
            {
                let peer = r.private_peer.as_ref().unwrap();
                self.pending.remove(peer);
                self.paused.insert(peer.clone());
                continue;
            }
            let Some(peer) = &r.private_peer else {
                continue;
            };
            if r.own
                || !r.eligible
                || r.muted
                || r.kind != "text"
                || r.at < self.since
                || now - r.at > 60_000
                || r.at > now + 5000
                || !self.selected.contains(peer)
                || self.paused.contains(peer)
                || self.handled.contains(&r.id)
                || self
                    .cooldown
                    .get(peer)
                    .is_some_and(|last| now - last < COOLDOWN)
            {
                continue;
            }
            if self.handled.len() >= 4096 {
                self.stop();
                return;
            }
            self.handled.insert(r.id.clone());
            self.pending.insert(
                peer.clone(),
                Pending {
                    peer: peer.clone(),
                    message: r.id.clone(),
                    chat: r.chat.clone(),
                    due: now + 5000,
                    at: r.at,
                },
            );
        }
    }
    pub fn due(&mut self, now: i64) -> Vec<Pending> {
        if self.until <= now {
            self.stop();
            return vec![];
        }
        let due: Vec<_> = self
            .pending
            .values()
            .filter(|p| p.due <= now)
            .cloned()
            .collect();
        for p in &due {
            self.pending.remove(&p.peer);
        }
        due
    }
    pub fn reserve(&mut self, p: &Pending, now: i64) -> Option<String> {
        if self.until <= now
            || p.at < self.since
            || now - p.at > 60_000
            || !self.selected.contains(&p.peer)
            || self.paused.contains(&p.peer)
            || self
                .cooldown
                .get(&p.peer)
                .is_some_and(|last| now - last < COOLDOWN)
        {
            return None;
        }
        // Reserve before network. Ambiguous failures are never automatically retried.
        self.cooldown.insert(p.peer.clone(), now);
        Some(format!("「自动回复」{}", self.text))
    }
    pub fn finish(&mut self, epoch: &str, peer: &str, result: Result<String, String>) {
        if self.epoch != epoch {
            return;
        }
        if result.is_err() {
            self.stop();
        }
        if let Ok(id) = &result {
            self.sent.insert(id.clone());
        }
        let name = self
            .contacts
            .iter()
            .find(|c| c.peer == peer)
            .map(|c| c.name.as_str())
            .or_else(|| {
                self.directory
                    .values()
                    .find(|u| u.id == peer)
                    .map(|u| u.name.as_str())
            })
            .unwrap_or("联系人");
        self.logs.push_front(json!({"at":now(),"name":name,"ok":result.is_ok(),"message":result.err().unwrap_or_else(|| "咚咚已确认发送".into())}));
        self.logs.truncate(20);
    }
    fn register_users(
        &mut self,
        epoch: &str,
        users: Vec<dongdong::DirectoryUser>,
    ) -> Result<Vec<Value>, String> {
        if epoch != self.epoch {
            return Err("咚咚账户已变化，请重新搜索".into());
        }
        if self.directory.len() + users.len() > 1000 {
            return Err("搜索缓存已满，请重启桌宠后再搜索".into());
        }
        let mut result = vec![];
        for u in users {
            use sha2::{Digest, Sha256};
            let key = format!("{:x}", Sha256::digest(format!("{}:{}", self.epoch, u.id)));
            result.push(json!({"key":key,"name":u.name,"id":u.id,"department":u.department,"selected":self.selected.contains(&u.id),"paused":self.paused.contains(&u.id)}));
            self.directory.insert(key, u);
        }
        Ok(result)
    }
    pub fn view(&self, preview: bool) -> Value {
        let mut contacts: Vec<_> = self.contacts.iter().map(|c| json!({"key":c.key,"name":if preview {&c.name} else {"私聊联系人"},"id":if preview {&c.peer} else {""},"selected":self.selected.contains(&c.peer),"paused":self.paused.contains(&c.peer)})).collect();
        for (key, u) in &self.directory {
            if !self.contacts.iter().any(|c| c.peer == u.id) {
                contacts.push(json!({"key":key,"name":if preview {&u.name} else {"私聊联系人"},"id":if preview {&u.id} else {""},"department":if preview {&u.department} else {""},"selected":self.selected.contains(&u.id),"paused":self.paused.contains(&u.id)}));
            }
        }
        json!({"epoch":self.epoch,"enabled":self.until > now(),"until":self.until,"text":self.text,"contacts":contacts,"logs":if preview {self.logs.iter().cloned().collect::<Vec<_>>()} else {vec![]}})
    }
}
pub fn configure(app: &tauri::AppHandle, p: &Value) -> Result<(), String> {
    let sh = shared(app);
    if p["enabled"] == true && sh.inner.lock().unwrap().state["settings"]["messagePreview"] == false
    {
        return Err("请先开启显示消息正文并核对联系人".into());
    }
    let h = sh.messages.lock().unwrap();
    if p["enabled"] != false && (h.status != "ready" || p["epoch"] != h.epoch) {
        return Err("请先连接咚咚并恢复消息提醒".into());
    }
    sh.auto_reply.lock().unwrap().configure(p, now())?;
    drop(h);
    publish(app);
    Ok(())
}

/// Search only; selecting or looking up a person never creates a chat or sends anything.
pub async fn search(app: &tauri::AppHandle, p: &Value) -> Result<Value, String> {
    let epoch = p["epoch"].as_str().ok_or("缺少消息账户")?;
    let keyword = p["keyword"].as_str().ok_or("请输入姓名或账号")?;
    let page = p["page"]
        .as_u64()
        .filter(|n| (1..=20).contains(n))
        .ok_or("查询页码无效")? as u32;
    let sh = shared(app);
    if sh.inner.lock().unwrap().state["settings"]["messagePreview"] == false {
        return Err("请先开启显示消息正文，以便核对联系人身份".into());
    }
    let stamp = crate::message_source::stamp();
    let session = dongdong::read_session().map_err(|_| "请先登录本机咚咚")?;
    {
        let h = sh.messages.lock().unwrap();
        if h.epoch != epoch
            || !h.is_source(&session.fingerprint)
            || !crate::message_source::running()
        {
            return Err("咚咚账户已变化，请稍后重新搜索".into());
        }
    }
    let (users, more) = dongdong::search_users(&sh.http, &session, keyword, page).await?;
    if stamp != crate::message_source::stamp() || !crate::message_source::running() {
        return Err("咚咚账户已变化，请重新搜索".into());
    }
    let h = sh.messages.lock().unwrap();
    if h.epoch != epoch || !h.is_source(&session.fingerprint) {
        return Err("咚咚账户已变化，请重新搜索".into());
    }
    if sh.inner.lock().unwrap().state["settings"]["messagePreview"] == false {
        return Err("已隐藏联系人，请开启消息正文后重试".into());
    }
    let result = sh.auto_reply.lock().unwrap().register_users(epoch, users)?;
    drop(h);
    publish(app);
    Ok(json!({"epoch":epoch,"items":result,"hasMore":more}))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn engine() -> Engine {
        let mut e = Engine::default();
        e.bind("account-a");
        e.contacts = vec![Contact {
            key: "person".into(),
            peer: "alice".into(),
            name: "A".into(),
        }];
        e
    }
    fn enable(e: &mut Engine, at: i64) {
        e.configure(
            &json!({"epoch":"account-a","enabled":true,"contacts":["person"],"text":"稍后联系"}),
            at,
        )
        .unwrap();
    }
    fn row(id: &str, at: i64) -> Record {
        Record {
            id: id.into(),
            chat: "private".into(),
            sender: "A".into(),
            title: "A".into(),
            body: "hi".into(),
            kind: "text".into(),
            at,
            eligible: true,
            muted: false,
            mentioned: false,
            private_peer: Some("alice".into()),
            own: false,
        }
    }
    #[test]
    fn directory_selection_survives_local_refresh_without_creating_a_chat() {
        let mut e = engine();
        let users = vec![dongdong::DirectoryUser {
            id: "remote-person".into(),
            name: "远程同事".into(),
            department: "部门".into(),
        }];
        let found = e.register_users("account-a", users.clone()).unwrap();
        let key = found[0]["key"].as_str().unwrap();
        e.configure(
            &json!({"epoch":"account-a","enabled":true,"contacts":[key],"text":"稍后联系"}),
            100,
        )
        .unwrap();
        e.contacts.clear();
        assert!(e.due(6000).is_empty());
        let mut incoming = row("private-new", 101);
        incoming.private_peer = Some("remote-person".into());
        incoming.chat = "new-private".into();
        e.ingest(&[incoming], 101);
        let pending = e.due(6000).pop().unwrap();
        assert!(e.reserve(&pending, 6000).is_some());
        assert_eq!(e.view(false)["contacts"][0]["name"], "私聊联系人");
        e.bind("account-b");
        assert!(e.register_users("account-a", users).is_err());
        assert!(e.directory.is_empty());
    }
    #[test]
    fn default_off_unknown_contacts_and_stale_epoch_rejected() {
        let mut e = engine();
        e.ingest(&[row("1", 100)], 100);
        assert!(e.due(6000).is_empty());
        for p in [
            json!({"epoch":"old","enabled":true,"contacts":["person"],"text":"hi"}),
            json!({"epoch":"account-a","enabled":true,"contacts":["group-or-forged"],"text":"hi"}),
        ] {
            assert!(e.configure(&p, 100).is_err());
        }
    }
    #[test]
    fn group_mentions_unknown_self_muted_history_and_nontext_never_trigger() {
        let mut e = engine();
        enable(&mut e, 100);
        let mut group = row("group", 101);
        group.private_peer = None;
        group.mentioned = true;
        let mut muted = row("muted", 101);
        muted.muted = true;
        let mut image = row("image", 101);
        image.kind = "image".into();
        let mut unknown = row("unknown", 101);
        unknown.private_peer = Some("other".into());
        let mut own = row("own", 101);
        own.own = true;
        own.eligible = false;
        e.ingest(&[group, muted, image, unknown, row("old", 99), own], 102);
        assert!(e.due(6000).is_empty());
    }
    #[test]
    fn burst_debounce_cooldown_survives_toggle_and_auto_echo() {
        let mut e = engine();
        enable(&mut e, 100);
        e.ingest(&[row("1", 101)], 101);
        e.ingest(&[row("2", 4000)], 4000);
        assert!(e.due(8000).is_empty());
        let p = e.due(9000).pop().unwrap();
        assert_eq!(p.message, "2");
        assert!(e.reserve(&p, 9000).is_some());
        e.finish("account-a", "alice", Ok("auto-1".into()));
        let mut echo = row("auto-1", 9001);
        echo.own = true;
        echo.eligible = false;
        e.ingest(&[echo], 9001);
        assert!(e.paused.is_empty());
        e.stop();
        enable(&mut e, 10000);
        e.ingest(&[row("3", 10001)], 10001);
        assert!(e.due(20000).is_empty());
        e.ingest(&[row("4", COOLDOWN + 10000)], COOLDOWN + 10000);
        assert_eq!(e.due(COOLDOWN + 16000).len(), 1);
    }
    #[test]
    fn reading_cancels_only_the_corresponding_pending_reply() {
        let mut e = engine();
        enable(&mut e, 100);
        e.ingest(&[row("1", 101)], 101);
        e.cancel_read(&["other".into()]);
        assert_eq!(e.pending.len(), 1);
        e.cancel_read(&["1".into()]);
        assert!(e.due(6000).is_empty());
        e.ingest(&[row("1", 101)], 102);
        assert!(e.pending.is_empty());
    }
    #[test]
    fn own_reply_cancels_and_pauses_only_this_person() {
        let mut e = engine();
        enable(&mut e, 100);
        e.ingest(&[row("1", 101)], 101);
        let mut own = row("manual", 102);
        own.own = true;
        own.eligible = false;
        e.ingest(&[own], 102);
        e.ingest(&[row("2", 103)], 103);
        assert!(e.due(6000).is_empty());
        assert!(e.paused.contains("alice"));
    }
    #[test]
    fn stop_switch_expiry_and_edit_invalidate_pending() {
        for action in 0..4 {
            let mut e = engine();
            enable(&mut e, 100);
            e.ingest(&[row("1", 101)], 101);
            let p = e.due(6000).pop().unwrap();
            match action {
                0 => e.stop(),
                1 => e.bind("account-b"),
                2 => {
                    e.due(3_600_101);
                }
                _ => enable(&mut e, 7000),
            }
            assert!(e.reserve(&p, 8000).is_none());
        }
    }
    #[test]
    fn failed_or_ambiguous_send_is_never_retried_and_late_result_is_ignored() {
        let mut e = engine();
        enable(&mut e, 100);
        e.ingest(&[row("1", 101)], 101);
        let p = e.due(6000).pop().unwrap();
        assert!(e.reserve(&p, 6000).is_some());
        e.finish("account-a", "alice", Err("结果未知".into()));
        assert!(e.reserve(&p, 7000).is_none());
        assert_eq!(e.logs.len(), 1);
        e.bind("account-b");
        e.finish("account-a", "alice", Ok("late".into()));
        assert!(e.logs.is_empty());
        assert!(e.sent.is_empty());
    }
}

#[cfg(test)]
impl Pending {
    pub(crate) fn fixture(peer: &str, message: &str, chat: &str) -> Self {
        Self {
            peer: peer.into(),
            message: message.into(),
            chat: chat.into(),
            due: 0,
            at: 0,
        }
    }
}
