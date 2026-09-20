//! Message detail and read receipts. The DongDong database remains strictly read-only.
use crate::{dongdong, message_source::Reader, *};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use std::{
    collections::{HashMap, VecDeque},
    sync::Arc,
};

#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Part {
    pub kind: String,
    pub text: String,
    pub image: Option<usize>,
}
#[derive(Clone)]
pub struct Raw {
    pub id: String,
    pub chat: String,
    pub row: i64,
    pub at: i64,
    pub sender: String,
    pub own: bool,
    pub read: bool,
    pub withdrawn: bool,
    pub kind: String,
    pub content: String,
    pub extra: String,
    pub file: String,
    pub quote: String,
}
#[derive(Clone)]
struct Entry {
    raw: Raw,
    media: Vec<String>,
    complete: bool,
    server_read: bool,
}
#[derive(Default)]
pub struct Cache {
    epoch: String,
    entries: HashMap<String, Entry>,
    order: VecDeque<String>,
    chats: HashMap<String, String>,
    session: Option<Arc<dongdong::Session>>,
    session_stamp: String,
    reader: Option<Reader>,
}
impl Cache {
    pub fn clear(&mut self) {
        *self = Self {
            epoch: self.epoch.clone(),
            ..Self::default()
        };
    }
    pub fn bind(&mut self, epoch: &str) {
        if self.epoch != epoch {
            *self = Self {
                epoch: epoch.into(),
                ..Self::default()
            };
        }
    }
    fn query<T>(
        &mut self,
        session: &dongdong::Session,
        query: impl FnOnce(&Reader) -> Result<T, String>,
    ) -> Result<T, String> {
        if self.reader.as_ref().is_some_and(|r| !r.is_current(session)) {
            self.reader = None;
        }
        if self.reader.is_none() {
            self.reader = Some(Reader::open(session).map_err(str::to_string)?);
        }
        let result = query(self.reader.as_ref().unwrap());
        if result.is_err() {
            self.reader = None;
        }
        result
    }
    fn insert(&mut self, raw: Raw) -> Value {
        use sha2::{Digest, Sha256};
        let key = format!("{:x}", Sha256::digest(format!("{}:{}", self.epoch, raw.id)));
        let (parts, media, complete) = parse(&raw);
        let server_read = raw.read || self.entries.get(&key).is_some_and(|e| e.server_read);
        let value = json!({"key":key,"at":raw.at,"sender":raw.sender,"own":raw.own,"parts":parts,"complete":complete,"withdrawn":raw.withdrawn,"readState":if raw.read {"synced"} else if server_read {"server"} else {"unread"}});
        if !self.entries.contains_key(&key) {
            self.order.push_back(key.clone());
        }
        self.entries.insert(
            key,
            Entry {
                raw,
                media,
                complete,
                server_read,
            },
        );
        while self.order.len() > 500 {
            if let Some(k) = self.order.pop_front() {
                self.entries.remove(&k);
            }
        }
        value
    }
    fn entry(&self, epoch: &str, key: &str) -> Result<Entry, String> {
        if self.epoch != epoch {
            return Err("消息账户已变化，请重新打开会话".into());
        }
        self.entries
            .get(key)
            .cloned()
            .ok_or("消息已过期，请重新打开会话".into())
    }
}
fn string_id(v: &Value) -> String {
    v.as_str()
        .map(str::to_owned)
        .or_else(|| v.as_u64().map(|n| n.to_string()))
        .unwrap_or_default()
}
fn valid_id(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 128
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}
fn text_part(parts: &mut Vec<Part>, text: &str) {
    let text: String = text
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
        .collect();
    if !text.is_empty() {
        parts.push(Part {
            kind: "text".into(),
            text,
            image: None,
        });
    }
}
fn image_part(parts: &mut Vec<Part>, media: &mut Vec<String>, id: String) -> bool {
    if !valid_id(&id) || media.len() >= 30 {
        return false;
    }
    parts.push(Part {
        kind: "image".into(),
        text: "消息图片".into(),
        image: Some(media.len()),
    });
    media.push(id);
    true
}
fn rich_nodes(v: &Value, parts: &mut Vec<Part>, media: &mut Vec<String>, depth: usize) -> bool {
    if depth > 16 || parts.len() > 500 {
        return false;
    }
    if let Some(a) = v.as_array() {
        return a
            .iter()
            .fold(true, |ok, n| rich_nodes(n, parts, media, depth + 1) && ok);
    }
    if let Some(text) = v["text"].as_str() {
        text_part(parts, text);
        return true;
    }
    let kind = v["type"].as_str().unwrap_or("");
    if kind == "image" {
        return image_part(parts, media, string_id(&v["serverId"]));
    }
    if let Some(children) = v.get("children") {
        let ok = rich_nodes(children, parts, media, depth + 1);
        if matches!(
            kind,
            "paragraph" | "p" | "header" | "heading" | "blockquote" | "list-item"
        ) {
            text_part(parts, "\n");
        }
        return ok
            && matches!(
                kind,
                "" | "paragraph"
                    | "p"
                    | "header"
                    | "heading"
                    | "blockquote"
                    | "list-item"
                    | "link"
                    | "mention"
                    | "bulleted-list"
                    | "numbered-list"
                    | "code"
                    | "code-block"
            );
    }
    false
}
pub fn parse(raw: &Raw) -> (Vec<Part>, Vec<String>, bool) {
    let mut parts = vec![];
    let mut media = vec![];
    if raw.withdrawn {
        text_part(&mut parts, "这条消息已撤回");
        return (parts, media, false);
    }
    if raw.content.len() > 512 * 1024 || raw.extra.len() > 512 * 1024 {
        text_part(&mut parts, "内容较大，请在咚咚中查看完整消息");
        return (parts, media, false);
    }
    if !raw.quote.is_empty() {
        parts.push(Part {
            kind: "quote".into(),
            text: raw.quote.clone(),
            image: None,
        });
    }
    let complete = match raw.kind.as_str() {
        "text" => {
            text_part(&mut parts, &raw.content);
            true
        }
        "image" | "picture" => image_part(&mut parts, &mut media, raw.file.clone()),
        "richText" => {
            let extra = serde_json::from_str::<Value>(&raw.extra).unwrap_or(Value::Null);
            let mut nodes = extra.get("richTextContent").cloned().unwrap_or(Value::Null);
            if let Some(s) = nodes.as_str() {
                nodes = serde_json::from_str(s).unwrap_or(Value::Null);
            }
            if nodes.is_null() {
                nodes = serde_json::from_str(&raw.content).unwrap_or(Value::Null);
            }
            rich_nodes(&nodes, &mut parts, &mut media, 0)
        }
        _ => {
            text_part(&mut parts, &raw.content);
            false
        }
    };
    if !complete {
        parts.push(Part {
            kind: "unsupported".into(),
            text: match raw.kind.as_str() {
                "file" => "文件消息，请在咚咚打开附件",
                "voice" | "audio" => "语音消息，请在咚咚收听",
                "video" => "视频消息，请在咚咚播放",
                _ => "部分内容暂不支持，请在咚咚查看",
            }
            .into(),
            image: None,
        });
    }
    if parts.is_empty() {
        text_part(&mut parts, "消息内容为空");
    }
    (parts, media, complete)
}

fn context(
    app: &tauri::AppHandle,
    p: &Value,
) -> Result<(String, Arc<dongdong::Session>, String), String> {
    context_with_preview(app, p, true)
}
fn context_with_preview(
    app: &tauri::AppHandle,
    p: &Value,
    require_preview: bool,
) -> Result<(String, Arc<dongdong::Session>, String), String> {
    let epoch = p["epoch"].as_str().ok_or("消息账户无效")?.to_string();
    let sh = shared(app);
    let settings = sh.inner.lock().unwrap().state["settings"].clone();
    if settings["messageEnabled"] != true || (require_preview && settings["messagePreview"] != true)
    {
        return Err("请先开启消息提醒和正文预览".into());
    }
    if !message_source::running() {
        return Err("请先登录并运行本机咚咚".into());
    }
    let stamp = message_source::stamp();
    if sh.messages.lock().unwrap().epoch != epoch {
        return Err("消息账户已变化，请重新打开会话".into());
    }
    let session = {
        let mut cache = sh.reading.lock().unwrap();
        cache.bind(&epoch);
        if cache.session_stamp != stamp {
            cache.session = None;
            cache.reader = None;
        }
        if cache.session.is_none() {
            cache.session = Some(Arc::new(
                dongdong::read_session().map_err(|_| "本机咚咚会话不可用")?,
            ));
            cache.session_stamp = stamp.clone();
        }
        cache.session.as_ref().unwrap().clone()
    };
    let hub = sh.messages.lock().unwrap();
    if hub.epoch != epoch
        || !hub.is_source(&session.fingerprint)
        || stamp != message_source::stamp()
    {
        return Err("消息账户已变化，请重新打开会话".into());
    }
    drop(hub);
    sh.reading.lock().unwrap().bind(&epoch);
    Ok((epoch, session, stamp))
}
fn recheck(
    app: &tauri::AppHandle,
    epoch: &str,
    s: &dongdong::Session,
    stamp: &str,
) -> Result<(), String> {
    let (e, current, now_stamp) = context(app, &json!({"epoch":epoch}))?;
    if e != epoch || current.fingerprint != s.fingerprint || now_stamp != stamp {
        return Err("消息账户已变化，已取消本次操作".into());
    }
    Ok(())
}
pub fn conversation_uri(app: &tauri::AppHandle, p: &Value) -> Result<String, String> {
    // Resolve only an opaque key already issued to this account, never a renderer-supplied URL.
    let (epoch, session, stamp) = context_with_preview(app, p, false)?;
    let conversation = p["conversation"].as_str().ok_or("请选择会话")?;
    let sh = shared(app);
    let chat = sh
        .messages
        .lock()
        .unwrap()
        .chat_for(conversation)
        .or_else(|| sh.reading.lock().unwrap().chats.get(conversation).cloned())
        .ok_or("会话已过期，请重新打开")?;
    let target = sh.reading.lock().unwrap().query(&session, |reader| {
        reader.conversation_target(&chat).map_err(str::to_string)
    })?;
    let (current_epoch, current, current_stamp) = context_with_preview(app, p, false)?;
    if current_epoch != epoch
        || current.fingerprint != session.fingerprint
        || current_stamp != stamp
    {
        return Err("消息账户已变化，已取消本次操作".into());
    }
    target.uri().map_err(str::to_string)
}
pub async fn history(app: &tauri::AppHandle, p: &Value) -> Result<Value, String> {
    let (epoch, s, stamp) = context(app, p)?;
    let conversation = p["conversation"].as_str().ok_or("请选择会话")?;
    let sh = shared(app);
    let chat = sh
        .messages
        .lock()
        .unwrap()
        .chat_for(conversation)
        .or_else(|| sh.reading.lock().unwrap().chats.get(conversation).cloned())
        .ok_or("会话已过期，请重新打开")?;
    let before = if let Some(cursor) = p["before"].as_str() {
        let entry = sh.reading.lock().unwrap().entry(&epoch, cursor)?;
        if entry.raw.chat != chat {
            return Err("会话游标无效".into());
        }
        entry.raw.row
    } else {
        i64::MAX
    };
    let rows = sh.reading.lock().unwrap().query(&s, |reader| {
        reader.history(&chat, before).map_err(str::to_string)
    })?;
    recheck(app, &epoch, &s, &stamp)?;
    let more = rows.len() == 30;
    let mut cache = sh.reading.lock().unwrap();
    let items: Vec<_> = rows.into_iter().map(|r| cache.insert(r)).collect();
    // Repair retained reminders for receipts already confirmed in this session,
    // including details reopened after the renderer stopped posting read receipts.
    let acknowledged: Vec<_> = items
        .iter()
        .filter_map(|item| {
            let entry = cache.entries.get(item["key"].as_str()?)?;
            (entry.server_read && !entry.raw.own).then(|| entry.raw.id.clone())
        })
        .collect();
    drop(cache);
    let changed = sh.messages.lock().unwrap().seen_ids(&epoch, &acknowledged);
    if changed {
        publish(app);
    }
    Ok(json!({"epoch":epoch,"items":items,"hasMore":more}))
}
async fn bounded(mut response: reqwest::Response, limit: usize) -> Result<Vec<u8>, String> {
    if !response.status().is_success() {
        return Err("咚咚请求失败，请稍后重试".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "连接中断，请稍后重试")? {
        if bytes.len() + chunk.len() > limit {
            return Err("消息附件过大，请在咚咚查看".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
fn success(v: &Value) -> bool {
    v["code"].as_i64() == Some(200) || v["code"].as_str() == Some("200")
}
fn image_data(bytes: &[u8]) -> Result<String, String> {
    let mime = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        "image/png"
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        "image/jpeg"
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        "image/gif"
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        "image/webp"
    } else {
        return Err("图片格式暂不支持，请在咚咚查看".into());
    };
    if bytes.len() > 16 * 1024 * 1024 {
        return Err("图片过大，请在咚咚查看".into());
    }
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}
pub async fn image(app: &tauri::AppHandle, p: &Value) -> Result<Value, String> {
    let (epoch, s, stamp) = context(app, p)?;
    let key = p["key"].as_str().ok_or("消息无效")?;
    let index = p["image"].as_u64().ok_or("图片无效")? as usize;
    let entry = shared(app).reading.lock().unwrap().entry(&epoch, key)?;
    let id = entry.media.get(index).ok_or("图片不属于此消息")?;
    let (local, server_id) = shared(app).reading.lock().unwrap().query(&s, |reader| {
        reader
            .image_bytes(&entry.raw.id, id)
            .map_err(str::to_string)
    })?;
    let bytes = if let Some(local) = local {
        local
    } else {
        if !valid_id(&server_id) {
            return Err("图片暂未同步，请稍后重试".into());
        }
        download_image(&shared(app).http, &s, &server_id).await?
    };
    let url = image_data(&bytes)?;
    recheck(app, &epoch, &s, &stamp)?;
    Ok(json!({"epoch":epoch,"url":url}))
}
pub async fn read(app: &tauri::AppHandle, p: &Value) -> Result<Value, String> {
    let (epoch, s, stamp) = context(app, p)?;
    let keys: Vec<String> =
        serde_json::from_value(p["keys"].clone()).map_err(|_| "消息列表无效")?;
    if keys.is_empty() || keys.len() > 30 {
        return Err("已读消息数量无效".into());
    }
    let entries: Vec<_> = {
        let sh = shared(app);
        let c = sh.reading.lock().unwrap();
        keys.iter()
            .map(|k| c.entry(&epoch, k))
            .collect::<Result<_, _>>()?
    };
    let mut ids = vec![];
    shared(app).reading.lock().unwrap().query(&s, |r| {
        for e in &entries {
            if e.raw.own || !e.complete || e.raw.withdrawn {
                continue;
            }
            if !r.can_read(&e.raw.id, &e.raw.chat).map_err(str::to_string)? {
                return Err("消息已撤回或会话已变化，请刷新会话".into());
            }
            if !e.server_read && !ids.contains(&e.raw.id) {
                ids.push(e.raw.id.clone());
            }
        }
        Ok(())
    })?;
    // Opening/reading cancels this message's pending autoresponse, before network IO.
    shared(app)
        .auto_reply
        .lock()
        .unwrap()
        .cancel_read(&entries.iter().map(|e| e.raw.id.clone()).collect::<Vec<_>>());
    recheck(app, &epoch, &s, &stamp)?;
    // The pet reminder means not viewed, not waiting for DongDong's local DB.
    // Clear only complete messages the foreground reader actually submitted;
    // a failed network receipt must not bring the pet's notification back.
    let viewed: Vec<_> = entries
        .iter()
        .filter(|e| e.complete && !e.raw.own && !e.raw.withdrawn)
        .map(|e| e.raw.id.clone())
        .collect();
    let changed = shared(app)
        .messages
        .lock()
        .unwrap()
        .seen_ids(&epoch, &viewed);
    if changed {
        publish(app);
    }
    if !ids.is_empty() {
        let sh = shared(app);
        let req = dongdong::message_request(&sh.http, &s, "message/v3/batchRead")
            .build()
            .map_err(|_| "已读请求无效")?;
        let response = sh
            .http
            .post(req.url().clone())
            .headers(req.headers().clone())
            .timeout(Duration::from_secs(10))
            .json(&ids)
            .send()
            .await
            .map_err(|_| "已读结果待核对，请重试同步")?;
        let body: Value = serde_json::from_slice(&bounded(response, 256 * 1024).await?)
            .map_err(|_| "已读回执无效")?;
        if !success(&body) {
            return Err("咚咚未确认已读，请重试同步".into());
        }
    }
    recheck(app, &epoch, &s, &stamp)?;
    let sh = shared(app);
    let mut cache = sh.reading.lock().unwrap();
    let local_reads = cache.query(&s, |reader| {
        Ok(entries
            .iter()
            .map(|e| reader.is_read(&e.raw.id).unwrap_or(false))
            .collect::<Vec<_>>())
    })?;
    let states:Vec<_>=keys.iter().zip(entries.iter()).zip(local_reads).map(|((key,e),local)| {
        let accepted=e.complete && !e.raw.own && !e.raw.withdrawn;
        if accepted {if let Some(c)=cache.entries.get_mut(key){c.server_read=true;}}
        json!({"key":key,"state":if local {"synced"} else if accepted {"server"} else {"unread"}})
    }).collect();
    drop(cache);
    Ok(json!({"epoch":epoch,"states":states}))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn raw(kind: &str, content: &str, extra: Value) -> Raw {
        Raw {
            id: "101".into(),
            chat: "chat".into(),
            row: 1,
            at: 1,
            sender: "测试".into(),
            own: false,
            read: false,
            withdrawn: false,
            kind: kind.into(),
            content: content.into(),
            extra: extra.to_string(),
            file: "image-file".into(),
            quote: String::new(),
        }
    }
    #[test]
    fn full_text_preserves_literals_and_is_not_truncated_to_notification_length() {
        let body = format!("<script>literal</script>\n{}", "正文".repeat(2000));
        let (parts, _, complete) = parse(&raw("text", &body, Value::Null));
        assert!(complete);
        assert_eq!(parts[0].text, body);
    }
    #[test]
    fn rich_text_preserves_order_and_unknown_content_prevents_read() {
        let r = raw(
            "richText",
            "",
            json!({"richTextContent":[{"type":"paragraph","children":[{"text":"前文"}]},{"type":"image","serverId":"123","children":[{"text":""}]},{"type":"paragraph","children":[{"text":"后文"}]}]}),
        );
        let (parts, media, complete) = parse(&r);
        assert!(complete);
        assert_eq!(media, vec!["123"]);
        assert_eq!(parts[2].kind, "image");
        assert_eq!(parts[3].text, "后文");
        let (_, _, complete) = parse(&raw(
            "richText",
            "",
            json!({"richTextContent":[{"type":"unknown-widget","children":[{"text":"摘要"}]}]}),
        ));
        assert!(!complete);
        let (_, _, complete) = parse(&raw(
            "richText",
            "",
            json!({"richTextContent":[{"type":"image","serverId":"../../secret"}]}),
        ));
        assert!(!complete);
    }
    #[test]
    fn account_switch_invalidates_content_and_media_handles() {
        let mut c = Cache::default();
        c.bind("a");
        let view = c.insert(raw("image", "", Value::Null));
        let key = view["key"].as_str().unwrap();
        assert!(c.entry("a", key).is_ok());
        c.bind("b");
        assert!(c.entry("a", key).is_err());
        assert!(c.entry("b", key).is_err());
    }
    #[test]
    fn clearing_reader_cache_drops_private_state_but_keeps_epoch() {
        let mut cache = Cache::default();
        cache.bind("a");
        let message = cache.insert(raw("text", "private", Value::Null));
        cache.chats.insert("key".into(), "chat".into());
        cache.session_stamp = "old".into();
        cache.clear();
        assert_eq!(cache.epoch, "a");
        assert!(cache.entries.is_empty() && cache.chats.is_empty() && cache.order.is_empty());
        assert!(
            cache.session.is_none() && cache.reader.is_none() && cache.session_stamp.is_empty()
        );
        assert!(cache.entry("a", message["key"].as_str().unwrap()).is_err());
    }
    #[test]
    fn withdrawn_and_oversized_messages_never_become_readable() {
        let mut r = raw("text", "content", Value::Null);
        r.withdrawn = true;
        assert!(!parse(&r).2);
        assert!(!parse(&raw("text", &"x".repeat(524289), Value::Null)).2);
        assert!(image_data(b"<svg onload='alert(1)'/>").is_err());
    }
    #[test]
    #[ignore = "Read-only timing of the user-designated conversation; no content or receipts"]
    fn live_reader_timing() {
        use std::time::Instant;
        let t = Instant::now();
        let s = dongdong::read_session()
            .map_err(|_| "session unavailable")
            .unwrap();
        println!("session_ms={}", t.elapsed().as_millis());
        let t = Instant::now();
        let r = Reader::open(&s).unwrap();
        println!("open_ms={}", t.elapsed().as_millis());
        let chat = r.test_chat("\u{738b}\u{68a6}\u{7476}1").unwrap();
        r.test_history_plan(&chat);
        for n in 0..3 {
            let t = Instant::now();
            let rows = r.history(&chat, i64::MAX).unwrap();
            println!(
                "history_{n}_ms={} count={}",
                t.elapsed().as_millis(),
                rows.len()
            );
        }
        let t = Instant::now();
        let rows = r.conversations().unwrap();
        println!(
            "conversations_ms={} count={}",
            t.elapsed().as_millis(),
            rows.len()
        );
    }
    #[test]
    #[ignore = "Read-only content verification for the user-designated test conversation"]
    fn live_reader_content() {
        let s = dongdong::read_session().map_err(|_| "No session").unwrap();
        let r = Reader::open(&s).unwrap();
        let chat = r.test_chat("王梦瑶1").unwrap();
        let conversations = r.conversations().unwrap();
        println!(
            "recent_conversations={} designated_present={}",
            conversations.len(),
            conversations.iter().any(|c| c.0 == chat)
        );
        let rows = r.history(&chat, i64::MAX).unwrap();
        assert!(!rows.is_empty());
        println!(
            "recent_unread_count={}",
            rows.iter()
                .filter(|r| !r.own && !r.read && r.at > crate::now() - 60 * 60_000)
                .count()
        );
        let mut image_count = 0;
        for raw in rows.iter().take(10) {
            if image_count >= 2 {
                break;
            }
            let (parts, media, complete) = parse(raw);
            println!(
                "kind={} parts={} images={} complete={}",
                raw.kind,
                parts.len(),
                media.len(),
                complete
            );
            for id in media.iter().take(1) {
                image_count += 1;
                let (local, server) = r.image_bytes(&raw.id, id).unwrap();
                let local = if std::env::var_os("EM_USE_VERIFY_IMAGE_DOWNLOAD").is_some() {
                    None
                } else {
                    local
                };
                if let Some(bytes) = local {
                    println!("local_image_valid={}", image_data(&bytes).is_ok());
                } else {
                    tauri::async_runtime::block_on(async {
                        let http = reqwest::Client::builder()
                            .redirect(reqwest::redirect::Policy::none())
                            .build()
                            .unwrap();
                        let bytes = download_image(&http, &s, &server).await.unwrap();
                        let valid = image_data(&bytes).is_ok();
                        println!("remote_image_valid={valid}");
                        assert!(valid);
                    });
                }
            }
        }
        println!("image_messages_checked={image_count}");
    }
}

async fn download_image(
    http: &reqwest::Client,
    session: &dongdong::Session,
    id: &str,
) -> Result<Vec<u8>, String> {
    if !valid_id(id) {
        return Err("图片标识无效".into());
    }
    if let Some((company, _)) = id.split_once('-') {
        let origin = match company {
            "group" => "https://dongdong-api.eastmoney.com",
            "security" => "https://dongdong-api.18.cn",
            "ttfund" => "https://dongdong-api.1234567.com.cn",
            "dcfund" => "https://dongdong-api.dongcaijijin.com",
            "futures" => "https://dongdong-api.eastmoneyfutures.com",
            _ => return Err("图片来源暂不支持，请在咚咚查看".into()),
        };
        let req = dongdong::message_request(http, session, "tokenAuth/newTempToken")
            .build()
            .map_err(|_| "图片认证请求无效")?;
        let response = http
            .post(req.url().clone())
            .headers(req.headers().clone())
            .timeout(Duration::from_secs(10))
            .send()
            .await
            .map_err(|_| "图片认证失败，请重试")?;
        let bytes = zeroize::Zeroizing::new(bounded(response, 64 * 1024).await?);
        let mut v: Value = serde_json::from_slice(&bytes).map_err(|_| "图片认证回执无效")?;
        if !success(&v) {
            return Err("咚咚图片会话失效，请重新登录".into());
        }
        let temp = zeroize::Zeroizing::new(
            v["data"]["tempToken"]
                .take()
                .as_str()
                .ok_or("图片临时凭据不可用")?
                .to_string(),
        );
        let response = http
            .post("https://dongdong-api.eastmoney.com/dong-common-server/api/v1/auth")
            .timeout(Duration::from_secs(10))
            .json(&json!({"oaToken":temp.as_str(),"ddSource":"group","sessionType":"PC"}))
            .send()
            .await
            .map_err(|_| "图片认证失败，请重试")?;
        let bytes = zeroize::Zeroizing::new(bounded(response, 64 * 1024).await?);
        let mut v: Value = serde_json::from_slice(&bytes).map_err(|_| "图片认证回执无效")?;
        if !success(&v) {
            return Err("图片认证未通过，请在咚咚查看".into());
        }
        let token = zeroize::Zeroizing::new(
            v["data"]["token"]
                .take()
                .as_str()
                .ok_or("图片会话不可用")?
                .to_string(),
        );
        let response = http
            .get(format!("{origin}/dong-common-server/api/v1/files/download"))
            .query(&[("fileId", id)])
            .header("Authorization", token.as_str())
            .header("ddSource", "group")
            .timeout(Duration::from_secs(20))
            .send()
            .await
            .map_err(|_| "图片加载失败，请重试")?;
        bounded(response, 16 * 1024 * 1024).await
    } else {
        let response = dongdong::image_request(http, session, id)?
            .send()
            .await
            .map_err(|_| "图片加载失败，请重试")?;
        bounded(response, 16 * 1024 * 1024).await
    }
}

pub fn conversations(app: &tauri::AppHandle, p: &Value) -> Result<Value, String> {
    use sha2::{Digest, Sha256};
    let (epoch, s, stamp) = context(app, p)?;
    let rows = shared(app)
        .reading
        .lock()
        .unwrap()
        .query(&s, |reader| reader.conversations().map_err(str::to_string))?;
    recheck(app, &epoch, &s, &stamp)?;
    let sh = shared(app);
    let mut cache = sh.reading.lock().unwrap();
    let items: Vec<_> = rows
        .into_iter()
        .map(|(chat, title, body, at)| {
            let key = format!("{:x}", Sha256::digest(format!("{epoch}:{chat}")));
            cache.chats.insert(key.clone(), chat);
            json!({"key":key,"title":title,"body":body,"at":at})
        })
        .collect();
    Ok(json!({"epoch":epoch,"items":items}))
}
