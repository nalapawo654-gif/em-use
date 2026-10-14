//! Read-only local DongDong source. No quota credentials, networking, writes, or message receipts.
const HISTORY_SQL: &str = "WITH page AS MATERIALIZED (SELECT rowid AS page_rowid,* FROM message WHERE chat_id=?1 AND rowid<?2 AND owner_id=?3 AND msg_type NOT IN ('syncread','sync','syncSession','multiRead','msgRefresh','deviceStatusSync') ORDER BY rowid DESC LIMIT 30) SELECT m.msg_id,m.chat_id,m.page_rowid,m.create_at,COALESCE(u.name,m.from_id),m.from_id,m.has_read,m.is_withdrawn,m.msg_type,substr(m.chat_content,1,524289),substr(m.extra_param,1,524289),COALESCE(f.server_file_id,m.file_id,''),CASE WHEN COALESCE(m.reply_msg_id,'')='' THEN '' ELSE COALESCE((SELECT CASE WHEN COALESCE(q.is_withdrawn,0)<>0 THEN '[已撤回]' WHEN q.msg_type='text' THEN substr(q.chat_content,1,300) WHEN q.msg_type IN ('image','picture') THEN '[图片]' ELSE '[引用消息]' END FROM message q WHERE q.msg_id=m.reply_msg_id AND q.owner_id=m.owner_id AND q.chat_id=m.chat_id),'') END FROM page m JOIN chat c ON c.chat_id=m.chat_id LEFT JOIN user u ON u.badge_id=m.from_id LEFT JOIN chat_file f ON f.file_id=m.file_id WHERE COALESCE(c.hidden,0)=0 ORDER BY m.page_rowid DESC";
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

#[derive(Debug, PartialEq)]
pub enum ConversationTarget {
    Private(String),
    Group(String),
}
impl ConversationTarget {
    pub fn uri(&self) -> Result<String> {
        let (key, id) = match self {
            Self::Private(id) => ("userId", id),
            Self::Group(id) => ("groupId", id),
        };
        if id.is_empty()
            || id.len() > 128
            || !id
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
        {
            return Err("会话标识无效，请在咚咚中打开");
        }
        let mut uri = reqwest::Url::parse("emdongdong://chat/start").unwrap();
        uri.query_pairs_mut()
            .append_pair(key, id)
            .append_pair("from", "em-use");
        Ok(uri.into())
    }
}

pub fn running() -> bool {
    !running_processes().is_empty()
}
pub fn running_processes() -> Vec<(u32, PathBuf)> {
    dongdong::running_processes()
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
#[derive(Clone)]
pub struct Contact {
    pub key: String,
    pub peer: String,
    pub name: String,
}
pub struct Record {
    pub private_peer: Option<String>,
    pub own: bool,
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
    #[cfg(test)]
    pub fn test_history_plan(&self, chat: &str) {
        let mut st = self
            .db
            .prepare(&format!("EXPLAIN QUERY PLAN {HISTORY_SQL}"))
            .unwrap();
        st.bind_values(&[
            Sql::Text(chat.into()),
            Sql::Integer(i64::MAX),
            Sql::Text(self.badge.clone()),
        ])
        .unwrap();
        while let StepResult::Row(row) = st.step().unwrap() {
            println!("plan={}", row.column_text(3));
        }
    }
    #[cfg(test)]
    pub fn test_chat(&self, name: &str) -> Result<String> {
        map(self.db.query_row("SELECT c.chat_id FROM chat c JOIN user u ON u.badge_id=c.badge_id WHERE c.type=1 AND COALESCE(c.group_id,'')='' AND u.name=?1", &[Sql::Text(name.into())], |r|Ok(r.column_text(0))))
    }
    pub fn conversation_target(&self, chat: &str) -> Result<ConversationTarget> {
        let mut st = map(self.db.prepare("SELECT c.type,COALESCE(c.badge_id,''),COALESCE(c.group_id,'') FROM chat c WHERE c.chat_id=?1 AND COALESCE(c.hidden,0)=0 AND EXISTS(SELECT 1 FROM message m WHERE m.chat_id=c.chat_id AND m.owner_id=?2) LIMIT 1"))?;
        map(st.bind_values(&[Sql::Text(chat.into()), Sql::Text(self.badge.clone())]))?;
        if let StepResult::Row(r) = map(st.step())? {
            let peer = r.column_text(1);
            let group = r.column_text(2);
            let target = match r.column_i64(0) {
                1 if group.is_empty() && !peer.is_empty() => ConversationTarget::Private(peer),
                2 if !group.is_empty() => ConversationTarget::Group(group),
                _ => return Err("此会话暂不支持直接打开，请在咚咚中查看"),
            };
            target.uri()?;
            return Ok(target);
        }
        Err("会话已失效，请刷新后重试")
    }
    pub fn conversations(&self) -> Result<Vec<(String, String, String, i64)>> {
        let mut st=map(self.db.prepare("SELECT c.chat_id,COALESCE(g.name,u.name,'咚咚会话'),CASE WHEN COALESCE(m.is_withdrawn,0)<>0 THEN 'withdrawn' ELSE m.msg_type END,m.chat_content,m.create_at FROM (SELECT * FROM chat WHERE COALESCE(hidden,0)=0 AND type IN (1,2) ORDER BY update_at DESC LIMIT 50) c JOIN message m ON m.rowid=(SELECT rowid FROM message WHERE chat_id=c.chat_id AND msg_id=c.last_msg_id AND owner_id=?1 ORDER BY create_at DESC LIMIT 1) LEFT JOIN user u ON u.badge_id=c.badge_id LEFT JOIN chat_group g ON g.id=c.group_id WHERE COALESCE(c.hidden,0)=0 AND c.type IN (1,2) ORDER BY m.create_at DESC LIMIT 50"))?;
        map(st.bind_values(&[Sql::Text(self.badge.clone())]))?;
        let mut out = vec![];
        while let StepResult::Row(r) = map(st.step())? {
            let body = match r.column_text(2).as_str() {
                "withdrawn" => "[\u{5df2}\u{64a4}\u{56de}]".into(),
                "text" => clean(&r.column_text(3), 180),
                "image" | "picture" => "[图片]".into(),
                "richText" => "[图文消息]".into(),
                "file" => "[文件]".into(),
                _ => "[消息]".into(),
            };
            out.push((
                r.column_text(0),
                clean(&r.column_text(1), 80),
                body,
                r.column_i64(4),
            ));
        }
        Ok(out)
    }
    pub fn history(&self, chat: &str, before: i64) -> Result<Vec<crate::message_reading::Raw>> {
        let mut st = map(self.db.prepare(HISTORY_SQL))?;
        map(st.bind_values(&[
            Sql::Text(chat.into()),
            Sql::Integer(before),
            Sql::Text(self.badge.clone()),
        ]))?;
        let mut out = vec![];
        while let StepResult::Row(r) = map(st.step())? {
            out.push(crate::message_reading::Raw {
                id: r.column_text(0),
                chat: r.column_text(1),
                row: r.column_i64(2),
                at: r.column_i64(3),
                sender: clean(&r.column_text(4), 80),
                own: r.column_text(5) == self.badge,
                read: r.column_i64(6) != 0,
                withdrawn: r.column_i64(7) != 0,
                kind: r.column_text(8),
                content: r.column_text(9),
                extra: r.column_text(10),
                file: r.column_text(11),
                quote: r.column_text(12),
            });
        }
        Ok(out)
    }
    pub fn can_read(&self, id: &str, chat: &str) -> Result<bool> {
        map(self.db.query_row_optional("SELECT 1 FROM message m JOIN chat c ON c.chat_id=m.chat_id WHERE m.msg_id=?1 AND m.chat_id=?2 AND m.owner_id=?3 AND m.from_id<>?3 AND COALESCE(c.hidden,0)=0 AND COALESCE(m.is_withdrawn,0)=0", &[Sql::Text(id.into()),Sql::Text(chat.into()),Sql::Text(self.badge.clone())], |_|Ok(true))).map(|v|v.unwrap_or(false))
    }
    pub fn is_read(&self, id: &str) -> Result<bool> {
        map(self.db.query_row_optional(
            "SELECT has_read FROM message WHERE msg_id=?1 AND owner_id=?2",
            &[Sql::Text(id.into()), Sql::Text(self.badge.clone())],
            |r| Ok(r.column_i64(0) != 0),
        ))
        .map(|v| v.unwrap_or(false))
    }
    pub fn image_bytes(&self, message: &str, id: &str) -> Result<(Option<Vec<u8>>, String)> {
        use std::io::Read;
        let valid=map(self.db.query_row_optional("SELECT 1 FROM message m JOIN chat c ON c.chat_id=m.chat_id WHERE m.msg_id=?1 AND m.owner_id=?2 AND COALESCE(m.is_withdrawn,0)=0 AND COALESCE(c.hidden,0)=0",&[Sql::Text(message.into()),Sql::Text(self.badge.clone())],|_|Ok(true)))?.unwrap_or(false);
        if !valid {
            return Err("消息已撤回或不可访问");
        }
        let media=map(self.db.query_row_optional("SELECT file_path,relative_filepath,server_file_id FROM chat_file WHERE server_file_id=?1 OR file_id=?1 LIMIT 1",&[Sql::Text(id.into())],|r|Ok((r.column_text(0),r.column_text(1),r.column_text(2)))))?;
        let media = if media.is_some() {
            media
        } else {
            map(self.db.query_row_optional("SELECT file_path,relative_filepath,server_file_unique_id FROM rich_text_media WHERE msg_id=?2 AND (server_file_unique_id=?1 OR file_id=?1) LIMIT 1",&[Sql::Text(id.into()),Sql::Text(message.into())],|r|Ok((r.column_text(0),r.column_text(1),r.column_text(2)))))?
        };
        let Some((absolute, relative, server)) = media else {
            return Ok((None, id.into()));
        };
        let root = self
            .path
            .parent()
            .and_then(Path::parent)
            .ok_or("消息目录无效")?;
        if let Ok(root) = root.canonicalize() {
            for candidate in [PathBuf::from(absolute), root.join(relative)] {
                if let Ok(path) = candidate.canonicalize() {
                    if path.starts_with(&root)
                        && path.is_file()
                        && fs::metadata(&path).is_ok_and(|m| m.len() <= 16 * 1024 * 1024)
                    {
                        if let Ok(file) = fs::File::open(path) {
                            let mut bytes = vec![];
                            if file
                                .take(16 * 1024 * 1024 + 1)
                                .read_to_end(&mut bytes)
                                .is_ok()
                            {
                                return Ok((
                                    Some(bytes),
                                    if server.is_empty() { id.into() } else { server },
                                ));
                            }
                        }
                    }
                }
            }
        }
        Ok((None, if server.is_empty() { id.into() } else { server }))
    }
    pub fn is_current(&self, session: &Session) -> bool {
        self.badge == session.badge
            && self.identity == file_identity(&self.path)
            && database_path(session).is_ok_and(|path| path == self.path)
    }
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
    pub fn contacts(&self, epoch: &str) -> Result<Vec<Contact>> {
        let mut st = map(self.db.prepare("SELECT c.badge_id,u.name FROM chat c JOIN user u ON u.badge_id=c.badge_id WHERE c.type=1 AND COALESCE(c.group_id,'')='' AND COALESCE(c.hidden,0)=0 AND c.badge_id<>?1 ORDER BY c.rowid DESC LIMIT 100"))?;
        map(st.bind_values(&[Sql::Text(self.badge.clone())]))?;
        let mut out = vec![];
        while let StepResult::Row(r) = map(st.step())? {
            let peer = r.column_text(0);
            if peer.is_empty() || out.iter().any(|c: &Contact| c.peer == peer) {
                continue;
            }
            use sha2::{Digest, Sha256};
            out.push(Contact {
                key: format!("{:x}", Sha256::digest(format!("{epoch}:{peer}"))),
                peer,
                name: clean(&r.column_text(1), 80),
            });
        }
        Ok(out)
    }
    pub fn can_reply(&self, p: &crate::auto_reply::Pending) -> Result<bool> {
        // Verify both the incoming message and live chat. A group/unknown type can never pass.
        let sql = "SELECT 1 FROM message m JOIN chat c ON c.chat_id=m.chat_id WHERE m.msg_id=?1 AND m.chat_id=?2 AND m.from_id=?3 AND m.to_id=?4 AND m.owner_id=?4 AND m.chat_type=1 AND c.type=1 AND c.badge_id=?3 AND COALESCE(c.group_id,'')='' AND COALESCE(c.hidden,0)=0 AND COALESCE(c.is_ignore,0)=0 AND COALESCE(m.has_read,0)=0 AND COALESCE(m.is_withdrawn,0)=0 AND m.msg_type='text' AND NOT EXISTS(SELECT 1 FROM message o WHERE o.chat_id=m.chat_id AND o.from_id=?4 AND o.rowid>m.rowid)";
        Ok(map(self.db.query_row_optional(
            sql,
            &[
                Sql::Text(p.message.clone()),
                Sql::Text(p.chat.clone()),
                Sql::Text(p.peer.clone()),
                Sql::Text(self.badge.clone()),
            ],
            |_| Ok(true),
        ))?
        .unwrap_or(false))
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
        let sql="SELECT m.rowid,m.msg_id,m.chat_id,COALESCE(u.name,''),COALESCE(g.name,''),m.chat_content,m.msg_type,m.create_at,m.from_id,COALESCE(m.has_read,0),COALESCE(m.is_withdrawn,0),COALESCE(c.hidden,0),COALESCE(c.is_ignore,0),COALESCE(m.at_emp_ids,''),COALESCE(f.file_name,''),COALESCE(m.chat_type,0),COALESCE(c.type,0),COALESCE(c.group_id,''),COALESCE(c.badge_id,''),COALESCE(m.to_id,''),COALESCE(m.owner_id,''),substr(m.extra_param,1,524289) FROM message m LEFT JOIN user u ON u.badge_id=m.from_id LEFT JOIN chat c ON c.chat_id=m.chat_id LEFT JOIN chat_group g ON g.id=c.group_id LEFT JOIN chat_file f ON f.file_id=m.file_id WHERE m.rowid>?1 ORDER BY m.rowid LIMIT 200";
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
                "richText" => {
                    let raw = crate::message_reading::Raw {
                        id: String::new(),
                        chat: String::new(),
                        row: 0,
                        at: 0,
                        sender: String::new(),
                        own: false,
                        read: false,
                        withdrawn: false,
                        kind: kind.clone(),
                        content: raw.clone(),
                        extra: r.column_text(21),
                        file: String::new(),
                        quote: String::new(),
                    };
                    let (parts, _, _) = crate::message_reading::parse(&raw);
                    clean(
                        &parts
                            .iter()
                            .map(|p| {
                                if p.kind == "image" {
                                    "[图片]"
                                } else {
                                    p.text.as_str()
                                }
                            })
                            .collect::<Vec<_>>()
                            .join(" "),
                        500,
                    )
                }
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
            let peer = r.column_text(18);
            let own = from == self.badge;
            let private_peer = (r.column_i64(15) == 1
                && r.column_i64(16) == 1
                && r.column_text(17).is_empty()
                && !peer.is_empty()
                && peer != self.badge
                && r.column_text(20) == self.badge
                && if own {
                    r.column_text(19) == peer
                } else {
                    from == peer && r.column_text(19) == self.badge
                })
            .then_some(peer);
            out.push(Record {
                private_peer,
                own,
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
            let ok=map(self.db.query_row_optional("SELECT 1 FROM message m LEFT JOIN chat c ON c.chat_id=m.chat_id WHERE m.msg_id=?1 AND COALESCE(m.is_withdrawn,0)=0 AND COALESCE(c.hidden,0)=0",&[Sql::Text(id.clone())],|_|Ok(true)))?.unwrap_or(false);
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
    #[test]
    #[ignore = "Read-only schema inspection; prints field names only"]
    fn live_message_schema() {
        let s = dongdong::read_session().map_err(|_| "No session").unwrap();
        let r = Reader::open(&s).unwrap();
        for table in ["message", "chat_file", "chat"] {
            let mut st =
                r.db.prepare(&format!("PRAGMA table_info({table})"))
                    .unwrap();
            let mut cols = Vec::new();
            while let StepResult::Row(row) = st.step().unwrap() {
                cols.push(row.column_text(1));
            }
            println!("{table}: {cols:?}");
        }
        fn shape(v: &serde_json::Value, depth: usize) -> serde_json::Value {
            if depth > 5 {
                return serde_json::json!("...");
            }
            match v {
                serde_json::Value::Object(o) => o
                    .iter()
                    .filter(|(k, _)| !k.chars().any(|c| c.is_ascii_digit()))
                    .map(|(k, v)| (k.clone(), shape(v, depth + 1)))
                    .collect(),
                serde_json::Value::Array(a) => serde_json::json!(a
                    .iter()
                    .take(2)
                    .map(|v| shape(v, depth + 1))
                    .collect::<Vec<_>>()),
                serde_json::Value::String(_) => serde_json::json!("string"),
                _ => serde_json::json!("scalar"),
            }
        }
        let mut st = r.db.prepare("SELECT chat_content,extra_param FROM message WHERE msg_type='richText' ORDER BY rowid DESC LIMIT 1").unwrap();
        if let StepResult::Row(row) = st.step().unwrap() {
            for col in [0, 1] {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&row.column_text(col)) {
                    println!("rich {col}: {}", shape(&v, 0));
                }
            }
        }
    }
    #[test]
    fn conversation_links_resolve_only_visible_owned_private_or_group_chats() {
        let f = Fixture::new();
        f.writer
            .execute_batch(
                "INSERT INTO message(msg_id,chat_id,owner_id) VALUES('m','chat','self');",
            )
            .unwrap();
        assert_eq!(
            f.reader.conversation_target("chat").unwrap().uri().unwrap(),
            "emdongdong://chat/start?userId=sender&from=em-use"
        );
        f.writer
            .execute_batch("UPDATE chat SET type=2,group_id='group-123';")
            .unwrap();
        assert_eq!(
            f.reader.conversation_target("chat").unwrap().uri().unwrap(),
            "emdongdong://chat/start?groupId=group-123&from=em-use"
        );
        for change in [
            "UPDATE chat SET hidden=1",
            "UPDATE chat SET hidden=0,type=3",
            "UPDATE chat SET type=1",
            "UPDATE chat SET type=2,group_id=''",
            "UPDATE chat SET type=1,badge_id=''",
            "UPDATE chat SET badge_id='x&groupId=other'",
            "UPDATE chat SET badge_id='sender'; UPDATE message SET owner_id='other'",
        ] {
            f.writer.execute_batch(change).unwrap();
            assert!(f.reader.conversation_target("chat").is_err());
        }
        assert!(f.reader.conversation_target("missing").is_err());
        assert!(ConversationTarget::Group("x/../?".into()).uri().is_err());
    }
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
            CREATE TABLE message(msg_id TEXT PRIMARY KEY,chat_id TEXT,chat_content TEXT,msg_type TEXT,create_at INTEGER,from_id TEXT,has_read INTEGER DEFAULT 0,is_withdrawn INTEGER DEFAULT 0,at_emp_ids TEXT DEFAULT '',file_id TEXT,chat_type INTEGER DEFAULT 1,to_id TEXT DEFAULT 'self',owner_id TEXT DEFAULT 'self',extra_param TEXT DEFAULT '',reply_msg_id TEXT);
            CREATE TABLE user(badge_id TEXT,name TEXT); CREATE TABLE chat(chat_id TEXT,group_id TEXT,type INTEGER DEFAULT 1,badge_id TEXT DEFAULT 'sender',hidden INTEGER DEFAULT 0,is_ignore INTEGER DEFAULT 0,unread_num INTEGER DEFAULT 0,last_msg_id TEXT,update_at INTEGER DEFAULT 0);
            CREATE TABLE chat_group(id TEXT,name TEXT); CREATE TABLE chat_file(file_id TEXT,file_name TEXT,server_file_id TEXT,file_path TEXT,relative_filepath TEXT); CREATE TABLE rich_text_media(file_id TEXT,server_file_unique_id TEXT,msg_id TEXT,file_path TEXT,relative_filepath TEXT);
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
    fn private_route_requires_message_and_chat_agreement_and_rechecks_before_send() {
        let mut f = Fixture::new();
        let now = crate::model::now();
        f.insert("private", "sender", now);
        let (rows, _) = f.reader.poll(&[]).unwrap();
        assert_eq!(rows[0].private_peer.as_deref(), Some("sender"));
        let p = crate::auto_reply::Pending::fixture("sender", "private", "chat");
        assert!(f.reader.can_reply(&p).unwrap());
        // A nameless group and even an @ mention must never look like a private chat.
        for change in [
            "UPDATE chat SET type=2",
            "UPDATE chat SET type=1,group_id='group'",
            "UPDATE chat SET group_id='',type=0",
            "UPDATE chat SET type=1; UPDATE message SET chat_type=2",
            "UPDATE message SET chat_type=1,to_id='someone-else'",
            "UPDATE message SET to_id='self',owner_id='other-account'",
        ] {
            f.writer.execute_batch(change).unwrap();
            assert!(!f.reader.can_reply(&p).unwrap());
            f.reader.cursor = 0;
            let (rows, _) = f.reader.poll(&[]).unwrap();
            assert!(rows[0].private_peer.is_none());
        }
        f.writer
            .execute_batch("UPDATE message SET owner_id='self'; UPDATE chat SET type=1")
            .unwrap();
        assert!(f.reader.can_reply(&p).unwrap());
        f.insert("manual", "self", now + 1);
        assert!(!f.reader.can_reply(&p).unwrap());
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
    fn reading_pages_quotes_and_recent_chat_follow_live_database() {
        let f = Fixture::new();
        let now = crate::now();
        for n in 0..65 {
            f.insert(&format!("m{n}"), "sender", now + n);
        }
        f.writer.execute_batch("UPDATE chat SET last_msg_id='m64',update_at=100; UPDATE message SET reply_msg_id='m0' WHERE msg_id='m64'").unwrap();
        let newest = f.reader.history("chat", i64::MAX).unwrap();
        assert_eq!(newest.len(), 30);
        assert_eq!(newest[0].id, "m64");
        assert!(!newest[0].quote.is_empty());
        let older = f
            .reader
            .history("chat", newest.last().unwrap().row)
            .unwrap();
        assert_eq!(older.len(), 30);
        assert!(older
            .iter()
            .all(|old| newest.iter().all(|new| old.id != new.id)));
        // Reusing a connection must see new commits and withdrawals, not a stale snapshot.
        f.writer.execute_batch("UPDATE message SET chat_content='changed',has_read=1 WHERE msg_id='m64'; UPDATE message SET is_withdrawn=1 WHERE msg_id='m0'").unwrap();
        let refreshed = f.reader.history("chat", i64::MAX).unwrap();
        assert_eq!(refreshed[0].content, "changed");
        assert!(refreshed[0].read);
        assert_eq!(refreshed[0].quote, "[已撤回]");
        assert_eq!(f.reader.conversations().unwrap()[0].2, "changed");
        // chat.last_msg_id is authoritative even if a later row was inserted by history sync.
        f.insert("backfilled", "sender", now - 1000);
        assert_eq!(f.reader.conversations().unwrap()[0].2, "changed");
        f.writer.execute_batch("UPDATE chat SET hidden=1").unwrap();
        assert!(f.reader.conversations().unwrap().is_empty());
        assert!(f.reader.history("chat", i64::MAX).unwrap().is_empty());
        assert!(f.reader.db.execute_batch("DELETE FROM message").is_err());
    }
    #[test]
    fn reading_details_are_complete_read_only_and_revalidate_visibility() {
        let f = Fixture::new();
        let now = crate::now();
        f.insert("detail", "sender", now);
        f.writer
            .execute_batch(
                "UPDATE message SET chat_content='full text',extra_param='' WHERE msg_id='detail'",
            )
            .unwrap();
        let rows = f.reader.history("chat", i64::MAX).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].content, "full text");
        assert!(f.reader.can_read("detail", "chat").unwrap());
        assert!(!f.reader.can_read("detail", "another").unwrap());
        assert!(!f.reader.is_read("detail").unwrap());
        f.writer
            .execute_batch("UPDATE message SET is_withdrawn=1 WHERE msg_id='detail'")
            .unwrap();
        assert!(!f.reader.can_read("detail", "chat").unwrap());
        f.writer
            .execute_batch("UPDATE message SET is_withdrawn=0; UPDATE chat SET hidden=1")
            .unwrap();
        assert!(f.reader.history("chat", i64::MAX).unwrap().is_empty());
        assert!(!f.reader.can_read("detail", "chat").unwrap());
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
        assert!(
            gone.is_empty(),
            "Reading must not remove conversation content"
        );
    }
}
