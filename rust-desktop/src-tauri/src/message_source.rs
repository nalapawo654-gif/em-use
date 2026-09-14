//! Read-only local DongDong source. No quota credentials, networking, writes, or message receipts.
use crate::dongdong::{self, Archive, Session};
use std::{
    fs,
    path::{Path, PathBuf},
};
use walletkit_sqlite::{Connection, StepResult, Value as Sql};
use zeroize::Zeroizing;
pub type Result<T> = std::result::Result<T, &'static str>;
fn map<T>(v: walletkit_sqlite::DbResult<T>) -> Result<T> {
    v.map_err(|_| "当前咚咚消息库暂不可读，稍后自动重试")
}

pub fn running() -> bool {
    use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};
    let mut system = System::new();
    system.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().with_exe(UpdateKind::Always),
    );
    system.processes().values().any(|p| {
        p.exe().is_some_and(|p| {
            let name = p
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase();
            matches!(
                name.as_str(),
                "咚咚" | "咚咚.exe" | "emc.exe" | "dongdong.exe" | "emdongdong.exe"
            )
        })
    })
}
pub fn stamp() -> String {
    use sha2::{Digest, Sha256};
    dongdong::config_path()
        .ok()
        .and_then(|p| fs::read(p).ok())
        .filter(|x| x.len() <= 16 * 1024 * 1024)
        .map(|x| format!("{:x}", Sha256::digest(x)))
        .unwrap_or_default()
}
fn database_path(session: &Session) -> Result<PathBuf> {
    if session.badge.is_empty()
        || !session
            .badge
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_')
    {
        return Err("当前咚咚账户格式暂不支持");
    }
    let config = dongdong::config_path().map_err(|_| "未找到本机咚咚")?;
    let persistent = config
        .parent()
        .unwrap()
        .join("emc.persistent.config.v3.json");
    let doc = fs::read(persistent)
        .ok()
        .filter(|b| b.len() < 65536)
        .and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok())
        .and_then(|v| v["sysUserDocHome"].as_str().map(PathBuf::from));
    let doc = doc
        .or_else(|| {
            #[cfg(windows)]
            {
                std::env::var_os("USERPROFILE").map(|p| PathBuf::from(p).join("Documents"))
            }
            #[cfg(not(windows))]
            {
                std::env::var_os("HOME").map(|p| PathBuf::from(p).join("Documents"))
            }
        })
        .ok_or("未找到咚咚消息目录")?;
    if !doc.is_absolute() {
        return Err("咚咚消息目录无效");
    }
    let path = doc.join("emc").join(&session.badge).join("msg/msg.db");
    if !path.is_file() {
        return Err("等待咚咚同步本机消息");
    }
    Ok(path)
}
fn module_bytes() -> Result<Vec<u8>> {
    for path in dongdong::archive_candidates() {
        let Ok(mut a) = Archive::open(&path) else {
            continue;
        };
        let base = "seagull/renderer/dist/assets";
        for name in a
            .entries(base)
            .into_iter()
            .filter(|n| n.starts_with("heart-") && n.ends_with(".js"))
        {
            let Ok(js) = a.text(&format!("{base}/{name}")) else {
                continue;
            };
            let regex =
                regex::Regex::new(r#"new URL\("(seagull_wings_bg\.[a-zA-Z0-9_-]+\.wasm)"#).unwrap();
            if let Some(c) = regex.captures(&js) {
                if let Ok(b) = a.bytes(&format!("{base}/{}", &c[1])) {
                    if b.len() < 1024 * 1024 {
                        return Ok(b);
                    }
                }
            }
        }
    }
    Err("当前咚咚版本暂不支持消息提醒")
}
fn derive_key(badge: &str) -> Result<Zeroizing<String>> {
    use wasmi::{Config, Engine, Linker, Module, Store, StoreLimitsBuilder};
    let mut cfg = Config::default();
    cfg.consume_fuel(true);
    let engine = Engine::new(&cfg);
    let module =
        Module::new(&engine, module_bytes()?.as_slice()).map_err(|_| "消息模块无法加载")?;
    let mut store = Store::new(
        &engine,
        StoreLimitsBuilder::new()
            .memory_size(32 * 1024 * 1024)
            .build(),
    );
    store.limiter(|limits| limits);
    store
        .set_fuel(10_000_000)
        .map_err(|_| "消息模块无法初始化")?;
    let instance = Linker::new(&engine)
        .instantiate(&mut store, &module)
        .and_then(|i| i.start(&mut store))
        .map_err(|_| "消息模块无法初始化")?;
    let mem = instance
        .get_memory(&store, "memory")
        .ok_or("消息模块缺少内存")?;
    let result = (|| {
        let alloc = instance
            .get_typed_func::<(i32, i32), i32>(&store, "__wbindgen_malloc")
            .map_err(|_| "消息模块不兼容")?;
        let stack = instance
            .get_typed_func::<i32, i32>(&store, "__wbindgen_add_to_stack_pointer")
            .map_err(|_| "消息模块不兼容")?;
        let derive = instance
            .get_typed_func::<(i32, i32, i32), ()>(&store, "getDbEncryptionKey")
            .map_err(|_| "消息模块不兼容")?;
        let ptr = alloc
            .call(&mut store, (badge.len() as i32, 1))
            .map_err(|_| "消息模块分配失败")?;
        let ret = stack
            .call(&mut store, -16)
            .map_err(|_| "消息模块分配失败")?;
        mem.write(&mut store, ptr as usize, badge.as_bytes())
            .map_err(|_| "消息模块内存异常")?;
        derive
            .call(&mut store, (ret, ptr, badge.len() as i32))
            .map_err(|_| "消息模块派生失败")?;
        let mut result = [0u8; 8];
        mem.read(&store, ret as usize, &mut result)
            .map_err(|_| "消息模块内存异常")?;
        let off = u32::from_le_bytes(result[..4].try_into().unwrap()) as usize;
        let len = u32::from_le_bytes(result[4..].try_into().unwrap()) as usize;
        if len == 0 || len > 4096 {
            return Err("消息模块密钥格式不兼容");
        }
        let mut key = Zeroizing::new(vec![0; len]);
        mem.read(&store, off, &mut key)
            .map_err(|_| "消息模块内存异常")?;
        Ok(Zeroizing::new(
            std::str::from_utf8(&key)
                .map_err(|_| "消息模块密钥格式不兼容")?
                .to_owned(),
        ))
    })();
    mem.data_mut(&mut store).fill(0);
    result
}
pub struct Record {
    pub id: String,
    pub chat: String,
    pub sender: String,
    pub title: String,
    pub body: String,
    pub kind: String,
    pub at: i64,
    pub eligible: bool,
    pub muted: bool,
    pub mentioned: bool,
}
pub struct Reader {
    db: Connection,
    pub path: PathBuf,
    pub identity: String,
    cursor: i64,
    version: i64,
    pending: bool,
    floor: i64,
    badge: String,
}
fn scalar(db: &Connection, sql: &str) -> Result<i64> {
    map(db.query_row(sql, &[], |r| Ok(r.column_i64(0))))
}
pub fn file_identity(path: &Path) -> String {
    let Ok(m) = fs::metadata(path) else {
        return String::new();
    };
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        format!("{}:{}", m.dev(), m.ino())
    }
    #[cfg(not(unix))]
    {
        format!("{:?}", m.created().ok())
    }
}
impl Reader {
    pub fn open(s: &Session) -> Result<Self> {
        let path = database_path(s)?;
        let key = derive_key(&s.badge)?;
        let db = map(Connection::open(&path, true))?;
        map(db.execute_batch("PRAGMA cipher='chacha20'; PRAGMA query_only=ON; PRAGMA busy_timeout=500; PRAGMA temp_store=MEMORY;"))?;
        let mut sql = Zeroizing::new(String::from("PRAGMA key='"));
        for ch in key.chars() {
            sql.push(ch);
            if ch == '\'' {
                sql.push(ch)
            }
        }
        sql.push('\'');
        map(db.execute_batch_zeroized(&sql))?;
        let floor = crate::model::now();
        let version = scalar(&db, "PRAGMA data_version")?;
        let cursor = scalar(&db, "SELECT COALESCE(MAX(rowid),0) FROM message")?;
        Ok(Self {
            identity: file_identity(&path),
            path,
            db,
            cursor,
            version,
            pending: false,
            floor,
            badge: s.badge.clone(),
        })
    }
    pub fn changed(&mut self) -> Result<bool> {
        if self.identity != file_identity(&self.path) {
            return Err("咚咚消息库已切换，正在重新连接");
        }
        let next = scalar(&self.db, "PRAGMA data_version")?;
        let changed = next != self.version;
        self.version = next;
        Ok(changed || self.pending)
    }
    pub fn poll(&mut self, retained: &[String]) -> Result<(Vec<Record>, Vec<String>)> {
        let max = scalar(&self.db, "SELECT COALESCE(MAX(rowid),0) FROM message")?;
        if max < self.cursor {
            return Err("咚咚消息库已重建，正在重新连接");
        }
        let sql="SELECT m.rowid,m.msg_id,m.chat_id,COALESCE(u.name,''),COALESCE(g.name,''),m.chat_content,m.msg_type,m.create_at,m.from_id,COALESCE(m.has_read,0),COALESCE(m.is_withdrawn,0),COALESCE(c.hidden,0),COALESCE(c.is_ignore,0),COALESCE(m.at_emp_ids,''),COALESCE(f.file_name,'') FROM message m LEFT JOIN user u ON u.badge_id=m.from_id LEFT JOIN chat c ON c.chat_id=m.chat_id LEFT JOIN chat_group g ON g.id=c.group_id LEFT JOIN chat_file f ON f.file_id=m.file_id WHERE m.rowid>?1 ORDER BY m.rowid LIMIT 200";
        let mut st = map(self.db.prepare(sql))?;
        map(st.bind_values(&[Sql::Integer(self.cursor)]))?;
        let mut out = Vec::new();
        while let StepResult::Row(r) = map(st.step())? {
            self.cursor = r.column_i64(0);
            let from = r.column_text(8);
            let at = r.column_i64(7);
            let at = if at < 100_000_000_000 { at * 1000 } else { at };
            let kind = r.column_text(6);
            let raw = r.column_text(5);
            let sender = clean(&r.column_text(3), 80);
            let group = clean(&r.column_text(4), 80);
            let mentioned = r
                .column_text(13)
                .split(|c: char| !c.is_ascii_alphanumeric() && c != '_')
                .any(|s| s == self.badge);
            let body = match kind.as_str() {
                "text" => clean(&raw, 500),
                "image" | "picture" => "[图片]".into(),
                "file" => format!("[文件] {}", clean(&r.column_text(14), 120)),
                "voice" | "audio" => "[语音]".into(),
                "video" => "[视频]".into(),
                _ => "[新消息]".into(),
            };
            let sender = if sender.is_empty() {
                "咚咚联系人".into()
            } else {
                sender
            };
            let eligible = from != self.badge
                && at >= self.floor - 5000
                && at <= crate::model::now() + 60_000
                && r.column_i64(9) == 0
                && r.column_i64(10) == 0
                && r.column_i64(11) == 0
                && !matches!(kind.as_str(), "system" | "tip" | "recall");
            out.push(Record {
                id: r.column_text(1),
                chat: r.column_text(2),
                title: if group.is_empty() {
                    sender.clone()
                } else {
                    group
                },
                sender,
                body,
                kind,
                at,
                eligible,
                muted: r.column_i64(12) != 0,
                mentioned,
            });
        }
        self.pending = self.cursor < max;
        let mut gone = Vec::new();
        for id in retained {
            let ok=map(self.db.query_row_optional("SELECT 1 FROM message m LEFT JOIN chat c ON c.chat_id=m.chat_id WHERE m.msg_id=?1 AND COALESCE(m.has_read,0)=0 AND COALESCE(m.is_withdrawn,0)=0 AND COALESCE(c.hidden,0)=0",&[Sql::Text(id.clone())],|_|Ok(true)))?.unwrap_or(false);
            if !ok {
                gone.push(id.clone())
            }
        }
        Ok((out, gone))
    }
}
pub fn clean(text: &str, limit: usize) -> String {
    let re = regex::Regex::new(r"<[^>]*>").unwrap();
    re.replace_all(text, "")
        .replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
        .chars()
        .filter(|c| !c.is_control() || *c == '\n')
        .take(limit)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture {
        path: PathBuf,
        writer: Connection,
        reader: Reader,
    }
    impl Fixture {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("em-use-msg-test-{}.db", uuid::Uuid::new_v4()));
            let writer = Connection::open(&path, false).unwrap();
            writer.execute_batch("PRAGMA cipher='chacha20'; PRAGMA key='synthetic-test-key'; PRAGMA journal_mode=WAL;
            CREATE TABLE message(msg_id TEXT PRIMARY KEY,chat_id TEXT,chat_content TEXT,msg_type TEXT,create_at INTEGER,from_id TEXT,has_read INTEGER DEFAULT 0,is_withdrawn INTEGER DEFAULT 0,at_emp_ids TEXT DEFAULT '',file_id TEXT);
            CREATE TABLE user(badge_id TEXT,name TEXT); CREATE TABLE chat(chat_id TEXT,group_id TEXT,hidden INTEGER DEFAULT 0,is_ignore INTEGER DEFAULT 0,unread_num INTEGER DEFAULT 0);
            CREATE TABLE chat_group(id TEXT,name TEXT); CREATE TABLE chat_file(file_id TEXT,file_name TEXT);
            INSERT INTO user VALUES('sender','张三'); INSERT INTO chat(chat_id) VALUES('chat');").unwrap();
            let db = Connection::open(&path, true).unwrap();
            db.execute_batch(
                "PRAGMA cipher='chacha20'; PRAGMA key='synthetic-test-key'; PRAGMA query_only=ON;",
            )
            .unwrap();
            let version = scalar(&db, "PRAGMA data_version").unwrap();
            let reader = Reader {
                db,
                path: path.clone(),
                identity: file_identity(&path),
                cursor: 0,
                version,
                pending: false,
                floor: crate::model::now(),
                badge: "self".into(),
            };
            Self {
                path,
                writer,
                reader,
            }
        }
        fn insert(&self, id: &str, from: &str, at: i64) {
            self.writer.execute("INSERT INTO message(msg_id,chat_id,chat_content,msg_type,create_at,from_id) VALUES(?1,'chat','<b>hello</b> &amp; world','text',?2,?3)",&[Sql::Text(id.into()),Sql::Integer(at),Sql::Text(from.into())]).unwrap();
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_file(&self.path);
            for suffix in ["-wal", "-shm"] {
                let _ = fs::remove_file(format!("{}{suffix}", self.path.display()));
            }
        }
    }
    #[test]
    fn encrypted_read_only_source_handles_batches_and_late_chat_update() {
        let mut f = Fixture::new();
        let now = crate::model::now();
        assert!(!f.reader.changed().unwrap());
        assert!(f.reader.db.execute_batch("DELETE FROM message").is_err());
        for n in 0..205 {
            f.insert(&n.to_string(), "sender", now);
        }
        assert!(f.reader.changed().unwrap());
        let (a, _) = f.reader.poll(&[]).unwrap();
        assert_eq!(a.len(), 200);
        // Message has_read is authoritative: chat unread_num can be updated in a later commit.
        assert!(a.iter().all(|r| r.eligible));
        assert_eq!(a[0].body, "hello & world");
        assert!(f.reader.changed().unwrap());
        let (b, _) = f.reader.poll(&[]).unwrap();
        assert_eq!(b.len(), 5);
        assert!(!f.reader.changed().unwrap());
        assert_eq!(
            scalar(&f.writer, "SELECT count(*) FROM message").unwrap(),
            205
        );
    }
    #[test]
    fn filters_self_history_and_withdrawn_syncs_read_and_keeps_mute_metadata() {
        let mut f = Fixture::new();
        let now = crate::model::now();
        f.insert("own", "self", now);
        f.insert("old", "sender", now - 60000);
        f.insert("gone", "sender", now);
        f.insert("ok", "sender", now + 2000);
        f.writer.execute_batch("UPDATE message SET is_withdrawn=1 WHERE msg_id='gone'; UPDATE message SET at_emp_ids='[\"self\"]' WHERE msg_id='ok'; UPDATE chat SET is_ignore=1;").unwrap();
        let (rows, _) = f.reader.poll(&[]).unwrap();
        let yes = rows.iter().filter(|r| r.eligible).collect::<Vec<_>>();
        assert_eq!(yes.len(), 1);
        assert_eq!(yes[0].id, "ok");
        assert!(yes[0].muted && yes[0].mentioned);
        f.writer
            .execute_batch("UPDATE message SET has_read=1 WHERE msg_id='ok'")
            .unwrap();
        let (_, gone) = f.reader.poll(&["ok".into()]).unwrap();
        assert_eq!(gone, vec!["ok"]);
    }
}
