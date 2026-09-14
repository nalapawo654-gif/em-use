//! Account-independent message state: never reads or modifies quota login/auth/generation.
use crate::{
    dongdong,
    message_source::{self, Reader, Record},
    *,
};
use serde::Serialize;
use std::collections::{HashSet, VecDeque};
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub key: String,
    pub conversation: String,
    pub sender: String,
    pub title: String,
    pub body: String,
    pub kind: String,
    pub at: i64,
    pub fresh: bool,
    pub mentioned: bool,
    #[serde(skip)]
    source_id: String,
}
pub struct Hub {
    pub epoch: String,
    source: String,
    pub account: Value,
    pub status: String,
    pub message: String,
    pub items: VecDeque<Item>,
    seen: HashSet<String>,
    order: VecDeque<String>,
    revision: u64,
}
impl Default for Hub {
    fn default() -> Self {
        Self {
            epoch: uuid::Uuid::new_v4().to_string(),
            source: String::new(),
            account: Value::Null,
            status: "waiting".into(),
            message: "等待本机咚咚连接".into(),
            items: VecDeque::new(),
            seen: HashSet::new(),
            order: VecDeque::new(),
            revision: 0,
        }
    }
}
impl Hub {
    pub fn bind(&mut self, source: &str, account: Value) {
        if self.source != source {
            self.epoch = uuid::Uuid::new_v4().to_string();
            self.items.clear();
            self.seen.clear();
            self.order.clear();
            self.revision = 0;
            self.source = source.into();
        }
        self.account = account;
    }
    fn transition(&mut self, status: &str, message: &str) {
        self.status = status.into();
        self.message = message.into();
    }
    fn ingest(&mut self, rows: Vec<Record>, gone: Vec<String>, respect_mute: bool, allow: bool) {
        self.items.retain(|i| !gone.contains(&i.source_id));
        for r in rows {
            if !self.seen.insert(r.id.clone()) {
                continue;
            }
            self.order.push_back(r.id.clone());
            while self.order.len() > 4096 {
                if let Some(x) = self.order.pop_front() {
                    self.seen.remove(&x);
                }
            }
            if !allow || !r.eligible || (respect_mute && r.muted) {
                continue;
            }
            self.revision += 1;
            // Opaque keys only. Native message IDs and account session material stay here.
            let key = uuid::Uuid::new_v4().to_string();
            let conversation = {
                use sha2::{Digest, Sha256};
                format!("{:x}", Sha256::digest(format!("{}:{}", self.epoch, r.chat)))
            };
            self.items.push_front(Item {
                key,
                conversation,
                sender: r.sender,
                title: r.title,
                body: r.body,
                kind: r.kind,
                at: r.at,
                fresh: true,
                mentioned: r.mentioned,
                source_id: r.id,
            });
            self.items.truncate(100);
        }
    }
    pub fn view(&self, preview: bool, paused_until: i64) -> Value {
        let items: Vec<_> = self
            .items
            .iter()
            .map(|i| {
                let mut i = i.clone();
                if !preview {
                    i.sender = "咚咚".into();
                    i.title = "新消息".into();
                    i.body = "你收到了一条新消息".into();
                    i.mentioned = false;
                }
                i
            })
            .collect();
        json!({"epoch":self.epoch,"status":self.status,"message":self.message,"account":self.account,"items":items,"revision":self.revision,"pausedUntil":paused_until,"newCount":self.items.iter().filter(|i|i.fresh).count()})
    }
    pub fn seen(&mut self, epoch: &str, keys: &[String]) -> Result<(), String> {
        if epoch != self.epoch {
            return Err("消息账户已切换，请重新打开提醒".into());
        }
        for i in &mut self.items {
            if keys.contains(&i.key) {
                i.fresh = false
            }
        }
        Ok(())
    }
}
pub fn start(app: tauri::AppHandle) {
    std::thread::Builder::new()
        .name("dongdong-messages".into())
        .spawn(move || watch_source(app))
        .expect("message reader thread");
}
fn watch_source(app: tauri::AppHandle) {
    let mut reader: Option<Reader> = None;
    let mut source = String::new();
    let mut last_view = Value::Null;
    let mut cached_session = None;
    let mut session_stamp = String::new();
    let mut session_retry = 0;
    let mut reader_retry = 0;
    loop {
        let sh = shared(&app);
        let settings = sh.inner.lock().unwrap().state["settings"].clone();
        let enabled = settings["messageEnabled"] == true;
        let paused = settings["messagePausedUntil"].as_i64().unwrap_or(0) > now();
        let before = message_source::stamp();
        // Reuse the parsed session while the encrypted config is unchanged. No per-second
        // PBKDF2 or archive traversal; a config change or process exit invalidates it.
        if !message_source::running() {
            cached_session = None;
            session_stamp.clear();
        } else if session_stamp != before || (cached_session.is_none() && now() >= session_retry) {
            cached_session = dongdong::read_session().ok();
            session_stamp = before.clone();
            session_retry = now() + 5000;
        }
        if let Some(s) = &cached_session {
            sh.messages.lock().unwrap().bind(
                &s.fingerprint,
                json!({"name":if s.name.is_empty(){"本机咚咚用户"}else{&s.name},"id":s.badge}),
            );
            if !enabled {
                reader = None;
                source.clear();
                reader_retry = 0;
                let mut h = sh.messages.lock().unwrap();
                h.items.clear();
                h.transition("disabled", "咚咚消息提醒已关闭");
            } else {
                if source != s.fingerprint {
                    reader = None;
                    source = s.fingerprint.clone();
                    reader_retry = 0;
                }
                if reader.is_some() || now() >= reader_retry {
                    let result = (|| -> message_source::Result<()> {
                        if reader.is_none() {
                            reader = Some(Reader::open(s)?);
                        }
                        let r = reader.as_mut().unwrap();
                        if r.changed()? {
                            let ids = sh
                                .messages
                                .lock()
                                .unwrap()
                                .items
                                .iter()
                                .map(|i| i.source_id.clone())
                                .collect::<Vec<_>>();
                            let (rows, gone) = r.poll(&ids)?;
                            if before != message_source::stamp() {
                                return Err("咚咚账户正在切换");
                            }
                            sh.messages.lock().unwrap().ingest(
                                rows,
                                gone,
                                settings["messageRespectMute"] != false,
                                !paused,
                            );
                        }
                        Ok(())
                    })();
                    let mut h = sh.messages.lock().unwrap();
                    match result {
                        Ok(()) => h.transition(
                            if paused { "paused" } else { "ready" },
                            if paused {
                                "咚咚提醒已暂停"
                            } else {
                                "正在接收本机咚咚消息"
                            },
                        ),
                        Err(e) => {
                            reader = None;
                            reader_retry = now() + 5000;
                            h.items.clear();
                            h.transition(
                                if e.contains("不支持") || e.contains("不兼容") {
                                    "unsupported"
                                } else {
                                    "waiting"
                                },
                                e,
                            );
                        }
                    }
                }
            }
        } else {
            reader = None;
            source.clear();
            reader_retry = 0;
            let mut h = sh.messages.lock().unwrap();
            h.bind("", Value::Null);
            h.transition(
                if enabled { "waiting" } else { "disabled" },
                if enabled {
                    "等待本机咚咚登录并运行"
                } else {
                    "咚咚消息提醒已关闭"
                },
            );
        }
        // Check even when opening the database took time or no rows changed.
        if before != message_source::stamp() {
            reader = None;
            cached_session = None;
            source.clear();
            session_stamp.clear();
            let mut h = sh.messages.lock().unwrap();
            h.bind("", Value::Null);
            h.transition("waiting", "咚咚账户正在切换");
        }
        let current = sh.messages.lock().unwrap().view(
            settings["messagePreview"] != false,
            settings["messagePausedUntil"].as_i64().unwrap_or(0),
        );
        if current != last_view {
            last_view = current;
            publish(&app);
        }
        std::thread::sleep(Duration::from_millis(1000));
    }
}
pub fn acknowledge(app: &tauri::AppHandle, p: &Value) -> Result<(), String> {
    let epoch = p["epoch"].as_str().ok_or("Missing message epoch")?;
    let keys = p["keys"].as_array().ok_or("Missing message keys")?;
    if keys.len() > 100 {
        return Err("Too many message keys".into());
    }
    let keys = keys
        .iter()
        .filter_map(|x| x.as_str().map(str::to_owned))
        .collect::<Vec<_>>();
    shared(app).messages.lock().unwrap().seen(epoch, &keys)?;
    publish(app);
    Ok(())
}
pub fn open_dongdong(_app: &tauri::AppHandle) -> Result<(), String> {
    launch_dongdong()
}
fn launch_dongdong() -> Result<(), String> {
    // Prefer the actual running installation, including custom installation paths.
    let processes = message_source::running_processes();
    #[cfg(target_os = "macos")]
    {
        let running_app = processes.iter().find_map(|(_, p)| {
            p.ancestors()
                .find(|p| p.extension().is_some_and(|e| e == "app"))
                .map(PathBuf::from)
        });
        let path = running_app
            .or_else(|| {
                dongdong::archive_candidates()
                    .into_iter()
                    .find(|p| p.is_file())
                    .and_then(|p| p.ancestors().nth(3).map(PathBuf::from))
            })
            .ok_or("未找到本机咚咚，请先安装或启动咚咚。")?;
        // Launch Services activates an existing instance and restores its window.
        let status = std::process::Command::new("/usr/bin/open")
            .arg("-a")
            .arg(path)
            .status()
            .map_err(|_| "系统未能唤起咚咚，请重试。")?;
        if status.success() {
            Ok(())
        } else {
            Err("系统未能唤起咚咚，请手动打开后重试。".into())
        }
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let mut candidates: Vec<PathBuf> = processes.into_iter().map(|(_, path)| path).collect();
        for archive in dongdong::archive_candidates() {
            if let Some(root) = archive.parent().and_then(|p| p.parent()) {
                for name in ["咚咚.exe", "emc.exe", "DongDong.exe", "EmDongDong.exe"] {
                    candidates.push(root.join(name));
                }
            }
        }
        let mut found = false;
        for path in candidates.into_iter().filter(|p| p.is_file()) {
            found = true;
            // DongDong's single-instance handler restores/focuses the existing main window.
            // Execute the installed client directly, without file associations or a shell.
            let mut command = std::process::Command::new(&path);
            if let Some(parent) = path.parent() {
                command.current_dir(parent);
            }
            match command.creation_flags(0x08000000).spawn() {
                Ok(mut child) => {
                    std::thread::spawn(move || {
                        let _ = child.wait();
                    });
                    return Ok(());
                }
                Err(_) => continue,
            }
        }
        Err(if found {
            "系统未能启动咚咚，请手动打开后重试。"
        } else {
            "未找到本机咚咚，请先安装或启动咚咚。"
        }
        .into())
    }
    #[cfg(not(any(target_os = "macos", windows)))]
    {
        let _ = processes;
        Err("当前系统暂不支持打开咚咚".into())
    }
}
use std::path::PathBuf;
#[cfg(test)]
mod tests {
    use super::*;
    fn row(id: &str) -> Record {
        Record {
            id: id.into(),
            chat: "chat".into(),
            sender: "A".into(),
            title: "A".into(),
            body: "private text".into(),
            kind: "text".into(),
            at: 1,
            eligible: true,
            muted: false,
            mentioned: false,
        }
    }
    #[test]
    fn message_account_and_generation_are_independent() {
        let mut h = Hub::default();
        h.bind("dong-A", json!({"name":"A"}));
        h.ingest(vec![row("1")], vec![], true, true);
        let epoch = h.epoch.clone();
        // There is deliberately no quota account in this API. Same source retains messages.
        h.bind("dong-A", json!({"name":"A"}));
        assert_eq!(h.items.len(), 1);
        assert_eq!(h.epoch, epoch);
        h.bind("dong-C", json!({"name":"C"}));
        assert!(h.items.is_empty());
        assert_ne!(h.epoch, epoch);
        assert!(h.seen(&epoch, &[]).is_err());
        h.bind("", Value::Null);
        assert!(h.account.is_null());
    }
    #[test]
    fn dedupe_mute_pause_privacy_and_local_seen() {
        let mut h = Hub::default();
        let mut muted = row("2");
        muted.muted = true;
        let mut own = row("3");
        own.eligible = false;
        h.ingest(vec![row("1"), row("1"), muted, own], vec![], true, true);
        assert_eq!(h.items.len(), 1);
        assert!(!h.view(false, 0).to_string().contains("private text"));
        let epoch = h.epoch.clone();
        let key = h.items[0].key.clone();
        h.seen(&epoch, &[key]).unwrap();
        assert!(!h.items[0].fresh);
        h.ingest(vec![row("4")], vec![], true, false);
        assert_eq!(h.items.len(), 1);
        h.ingest(vec![], vec!["1".into()], true, true);
        assert!(h.items.is_empty());
    }
    #[test]
    #[ignore = "Reads current user's local DongDong, no message text is logged"]
    fn live_readonly_message_database() {
        let s = dongdong::read_session()
            .map_err(|_| "No local DongDong")
            .unwrap();
        let mut reader = Reader::open(&s).unwrap();
        assert!(!reader.changed().unwrap());
    }
}
