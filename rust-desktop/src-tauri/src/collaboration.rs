//! Project-room bridge. Human tokens never cross IPC; each host binding reuses
//! the MCP crate's origin-scoped keyring storage and immutable room identity.
use crate::storage;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, path::PathBuf, process::Stdio, time::Duration};
use tauri::{Manager, WebviewWindow};
use tokio::io::AsyncWriteExt;

#[derive(Default)]
pub struct Hub(pub tokio::sync::Mutex<()>);
#[derive(Default, Serialize, Deserialize)]
#[serde(default)]
struct Preferences {
    server_url: String,
    last_rooms: HashMap<String, String>,
    bindings: Vec<Binding>,
}
#[derive(Clone, Serialize, Deserialize)]
struct Binding {
    id: String,
    server_url: String,
    user_id: String,
    room_id: String,
    agent_id: String,
    host_kind: String,
    host_ref: String,
    scope: String,
    label: String,
    state_file: String,
    executable: String,
}
fn origin(value: &str) -> Result<String, String> {
    let u = reqwest::Url::parse(value.trim()).map_err(|_| "服务地址无效")?;
    if !(u.scheme() == "https"
        || (u.scheme() == "http"
            && matches!(u.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"))))
        || !u.username().is_empty()
        || u.password().is_some()
        || u.query().is_some()
        || u.fragment().is_some()
        || u.path() != "/"
    {
        return Err("服务地址须为 HTTPS origin；仅本机回环地址允许 HTTP，不带路径或凭据".into());
    }
    Ok(u.as_str().trim_end_matches('/').to_owned())
}
fn entry(server: &str) -> Result<keyring::Entry, String> {
    let key = format!("{:x}", Sha256::digest(server.as_bytes()));
    keyring::Entry::new("em-use-collaboration-human", &key).map_err(|_| "无法访问系统钥匙串".into())
}
fn load_session(server: &str) -> Result<Option<Value>, String> {
    match entry(server)?.get_password() {
        Ok(raw) => serde_json::from_str(&raw)
            .map(Some)
            .map_err(|_| "协作凭据损坏，请重新连接".into()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("无法读取系统钥匙串，请解锁后重试".into()),
    }
}
fn session_key(server: &str, user: &Value) -> String {
    format!("{}|{}", server, user["id"].as_str().unwrap_or(""))
}
fn text<'a>(p: &'a Value, key: &str) -> Result<&'a str, String> {
    p[key]
        .as_str()
        .filter(|s| !s.trim().is_empty() && s.len() <= 4096)
        .ok_or_else(|| format!("缺少有效的 {key}"))
}
fn uuid(p: &Value, key: &str) -> Result<String, String> {
    uuid::Uuid::parse_str(text(p, key)?)
        .map(|id| id.to_string())
        .map_err(|_| format!("无效的 {key}"))
}
fn request_allowed(method: &str, path: &str) -> bool {
    // No arbitrary proxying, auth endpoints, origin changes or path traversal.
    let (base, query) = path.split_once('?').unwrap_or((path, ""));
    if !query.is_empty()
        && !query.split('&').all(|pair| {
            pair.split_once('=').is_some_and(|(k, v)| {
                matches!(k, "after_seq" | "limit")
                    && !v.is_empty()
                    && v.bytes().all(|b| b.is_ascii_digit())
            })
        })
    {
        return false;
    }
    let parts: Vec<_> = base.trim_start_matches('/').split('/').collect();
    let id = |s: &str| uuid::Uuid::parse_str(s).is_ok();
    match parts.as_slice() {
        ["v1", "auth", "invites"] => method == "POST" && query.is_empty(),
        ["v1", "rooms"] | ["v1", "rooms", ""] => {
            matches!(method, "GET" | "POST") && query.is_empty()
        }
        ["v1", "rooms", r, action] if id(r) => match *action {
            "messages" => matches!(method, "GET" | "POST") && (method == "GET" || query.is_empty()),
            "members" | "tasks" => matches!(method, "GET" | "POST") && query.is_empty(),
            "agents" => method == "GET" && query.is_empty(),
            "context" => matches!(method, "GET" | "PUT") && query.is_empty(),
            _ => false,
        },
        ["v1", "agents", a] if id(a) => {
            matches!(method, "GET" | "PATCH" | "DELETE") && query.is_empty()
        }
        ["v1", "tasks", t, action] if id(t) => {
            query.is_empty()
                && match *action {
                    "artifact" => method == "GET",
                    "authorize" | "review" => method == "POST",
                    _ => false,
                }
        }
        ["v1", "tasks", t, "artifact", a] => id(t) && id(a) && method == "GET" && query.is_empty(),
        ["v1", "runs", r] => id(r) && method == "GET" && query.is_empty(),
        _ => false,
    }
}
async fn http(
    server: &str,
    token: Option<&str>,
    method: &str,
    path: &str,
    body: Option<Value>,
) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "无法创建协作连接")?;
    let method = reqwest::Method::from_bytes(method.as_bytes()).map_err(|_| "无效的方法")?;
    let mut request = client.request(method, format!("{server}{path}"));
    if let Some(token) = token {
        request = request.bearer_auth(token);
    }
    if let Some(body) = body {
        request = request.json(&body);
    }
    let mut response = request
        .send()
        .await
        .map_err(|_| "无法连接协作服务，请检查地址和网络；未自动重试写操作")?;
    let status = response.status();
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "读取协作响应失败")? {
        if bytes.len() + chunk.len() > 16 * 1024 * 1024 {
            return Err("协作响应过大".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let value: Value = serde_json::from_slice(&bytes)
        .map_err(|_| format!("服务响应非 JSON（{}）", status.as_u16()))?;
    if !status.is_success() {
        return Err(format!(
            "{}：{}",
            status.as_u16(),
            value["message"].as_str().unwrap_or("协作请求失败")
        ));
    }
    Ok(value)
}
fn view(prefs: &Preferences, user: Value, executable: &str) -> Value {
    let key = session_key(&prefs.server_url, &user);
    let bindings: Vec<_> = prefs
        .bindings
        .iter()
        .filter(|b| b.server_url == prefs.server_url && user["id"] == b.user_id)
        .cloned()
        .collect();
    json!({"server_url":prefs.server_url,"user":user,"session_key":key,"last_room_id":prefs.last_rooms.get(&key),"bindings":bindings,"mcp_executable":executable})
}
fn detect_executable(app: &tauri::AppHandle) -> String {
    let name = if cfg!(windows) {
        "em-use-collab-mcp.exe"
    } else {
        "em-use-collab-mcp"
    };
    let mut candidates = vec![];
    // Tauri externalBin is installed beside the main executable (Contents/MacOS
    // on macOS, the install directory on Windows), not in the source checkout.
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join(name));
        }
    }
    if let Ok(dir) = app.path().resource_dir() {
        candidates.push(dir.join(name));
    }
    if cfg!(debug_assertions) {
        candidates.push(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../collaboration-mcp/target/debug")
                .join(name),
        );
    }
    candidates
        .into_iter()
        .find(|p| p.is_file())
        .and_then(|p| p.canonicalize().ok())
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default()
}
async fn mcp_command(
    executable: &str,
    server: &str,
    state_file: &str,
    input: Value,
) -> Result<Value, String> {
    let mut command = tokio::process::Command::new(executable);
    command
        .arg("--desktop-command")
        .env("EM_USE_SERVER_URL", server)
        .env("EM_USE_STATE_FILE", state_file)
        .env("EM_USE_CREDENTIAL_STORE", "keyring")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x08000000); // CREATE_NO_WINDOW, shared desktop convention.
    let mut child = command
        .spawn()
        .map_err(|_| "无法启动内置 MCP，请检查安装是否完整")?;
    let mut stdin = child.stdin.take().ok_or("无法打开 MCP 接入通道")?;
    stdin
        .write_all(input.to_string().as_bytes())
        .await
        .map_err(|_| "写入 MCP 接入通道失败")?;
    drop(stdin);
    let output = tokio::time::timeout(Duration::from_secs(40), child.wait_with_output())
        .await
        .map_err(|_| "MCP 接入超时，请检查系统钥匙串提示；绑定可能已完成，请重试前检查 Agent 列表")?
        .map_err(|_| "MCP 接入进程异常")?;
    let result: Value = serde_json::from_slice(&output.stdout).map_err(|_| "MCP 接入响应无效")?;
    if !output.status.success() || result.get("error").is_some() {
        return Err("MCP 接入失败，请检查服务连接、绑定状态与系统钥匙串；不会回退到明文".into());
    }
    result
        .get("result")
        .cloned()
        .ok_or("MCP 接入结果缺失".into())
}
fn validate_binding(
    prefs: &Preferences,
    server: &str,
    user: &str,
    p: &Value,
) -> Result<(), String> {
    let host = text(p, "host_kind")?;
    if !["codex", "dsh", "aiwork", "workbuddy", "ide", "other"].contains(&host) {
        return Err("不支持的宿主".into());
    }
    let scope = text(p, "scope")?;
    if !["session", "project", "profile"].contains(&scope) || (host == "dsh" && scope != "profile")
    {
        return Err("DSH 当前必须按独立 profile 绑定；其他宿主需明确会话或项目范围".into());
    }
    let reference = text(p, "host_ref")?.trim();
    text(p, "label")?;
    if prefs.bindings.iter().any(|b| {
        b.server_url == server
            && b.user_id == user
            && b.host_kind == host
            && b.host_ref == reference
    }) {
        return Err(
            "该宿主会话 / 配置已绑定。请先解绑，或为另一个项目使用独立会话 / profile".into(),
        );
    }
    Ok(())
}
#[tauri::command]
pub async fn collaboration(
    window: WebviewWindow,
    app: tauri::AppHandle,
    action: String,
    payload: Option<Value>,
) -> Result<Value, String> {
    let url = window.url().map_err(|_| "无法确认窗口来源")?;
    let local = url.scheme() == "tauri"
        || (url.host_str() == Some("tauri.localhost") && matches!(url.scheme(), "http" | "https"))
        || (cfg!(debug_assertions)
            && matches!(url.host_str(), Some("localhost" | "127.0.0.1"))
            && url.port() == Some(5174));
    if !local || window.label() != "collaboration" {
        return Err("仅项目协作窗口可使用此桥接".into());
    }
    let hub = app.state::<Hub>();
    let _gate = hub.0.lock().await;
    let p = payload.unwrap_or(Value::Null);
    let mut prefs: Preferences = match std::fs::read(storage::dir(&app)?.join("collaboration.json"))
    {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map_err(|_| "协作配置损坏，请先恢复配置；不会覆盖已有绑定")?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Preferences::default(),
        Err(_) => return Err("无法读取协作配置，请检查文件权限".into()),
    };
    let executable = detect_executable(&app);
    if action == "restore" {
        if prefs.server_url.is_empty() {
            return Ok(view(&prefs, Value::Null, &executable));
        }
        prefs.server_url = origin(&prefs.server_url)?;
        let Some(session) = load_session(&prefs.server_url)? else {
            return Ok(view(&prefs, Value::Null, &executable));
        };
        match http(
            &prefs.server_url,
            session["session_token"].as_str(),
            "GET",
            "/v1/auth/me",
            None,
        )
        .await
        {
            Ok(user) => return Ok(view(&prefs, user, &executable)),
            Err(error) => {
                let mut v = view(&prefs, Value::Null, &executable);
                v["error"] = json!(error);
                return Ok(v);
            }
        }
    }
    if action == "connect" {
        let server = origin(text(&p, "server_url")?)?;
        let mode = p["mode"].as_str().unwrap_or("login");
        if !["login", "register", "bootstrap"].contains(&mode) {
            return Err("无效的登录方式".into());
        }
        let previous = load_session(&server)?;
        let session=http(&server,None,"POST",&format!("/v1/auth/{mode}"),Some(json!({"username":text(&p,"username")?,"password":text(&p,"password")?,"display_name":p["display_name"],"invite_token":p["invite_token"]}))).await?;
        if entry(&server)?.set_password(&session.to_string()).is_err() {
            let _ = http(
                &server,
                session["session_token"].as_str(),
                "POST",
                "/v1/auth/logout",
                Some(json!({})),
            )
            .await;
            return Err("钥匙串保存失败，不会回退到明文".into());
        }
        prefs.server_url = server;
        if let Err(error) = storage::write(
            &app,
            "collaboration.json",
            &serde_json::to_value(&prefs).map_err(|_| "配置序列化失败")?,
        ) {
            if let Some(ref old) = previous {
                let _ = entry(&prefs.server_url)?.set_password(&old.to_string());
            } else {
                let _ = entry(&prefs.server_url)?.delete_credential();
            }
            let _ = http(
                &prefs.server_url,
                session["session_token"].as_str(),
                "POST",
                "/v1/auth/logout",
                Some(json!({})),
            )
            .await;
            return Err(error);
        }
        if let Some(old) = previous {
            let _ = http(
                &prefs.server_url,
                old["session_token"].as_str(),
                "POST",
                "/v1/auth/logout",
                Some(json!({})),
            )
            .await;
        }
        return Ok(view(&prefs, session["user"].clone(), &executable));
    }
    let server = origin(&prefs.server_url)?;
    let session = load_session(&server)?.ok_or("请先连接协作账户")?;
    let user = &session["user"];
    if p["session_key"] != session_key(&server, user) {
        return Err("连接已切换，请重新加载项目".into());
    }
    let token = text(&session, "session_token")?;
    match action.as_str() {
        "disconnect" => {
            match entry(&server)?.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => {}
                Err(_) => return Err("无法清除钥匙串，请重试退出".into()),
            }
            let remote_revoked = http(
                &server,
                Some(token),
                "POST",
                "/v1/auth/logout",
                Some(json!({})),
            )
            .await
            .is_ok();
            let mut v = view(&prefs, Value::Null, &executable);
            v["remote_revoked"] = json!(remote_revoked);
            return Ok(v);
        }
        "request" => {
            let method = text(&p, "method")?;
            let path = text(&p, "path")?;
            if !request_allowed(method, path) {
                return Err("不支持的协作操作".into());
            }
            return http(&server, Some(token), method, path, p.get("body").cloned()).await;
        }
        "selectRoom" => {
            let room = uuid(&p, "room_id")?;
            http(
                &server,
                Some(token),
                "GET",
                &format!("/v1/rooms/{room}/members"),
                None,
            )
            .await?;
            prefs.last_rooms.insert(session_key(&server, user), room);
        }
        "bindAgent" => {
            validate_binding(&prefs, &server, text(user, "id")?, &p)?;
            let room = uuid(&p, "room_id")?;
            let path = PathBuf::from(text(&p, "executable")?)
                .canonicalize()
                .map_err(|_| "请选择已安装的 MCP 程序完整路径")?;
            if !path.is_file() {
                return Err("MCP 程序路径不是文件".into());
            }
            let id = uuid::Uuid::new_v4().to_string();
            let state_file = storage::dir(&app)?
                .join("collaboration/profiles")
                .join(&id)
                .join("binding.json");
            let code = http(
                &server,
                Some(token),
                "POST",
                &format!("/v1/rooms/{room}/agent-bind-codes"),
                Some(json!({})),
            )
            .await?;
            let result = mcp_command(&path.to_string_lossy(), &server, &state_file.to_string_lossy(),
                json!({"action":"bind","bind_code":text(&code,"bind_code")?,"host_kind":text(&p,"host_kind")?,"label":text(&p,"label")?})).await?;
            let agent_id = text(&result, "agent_instance_id")?.to_owned();
            prefs.bindings.push(Binding {
                id,
                server_url: server.clone(),
                user_id: text(user, "id")?.into(),
                room_id: room,
                agent_id,
                host_kind: text(&p, "host_kind")?.into(),
                host_ref: text(&p, "host_ref")?.trim().into(),
                scope: text(&p, "scope")?.into(),
                label: text(&p, "label")?.trim().into(),
                state_file: state_file.to_string_lossy().into(),
                executable: path.to_string_lossy().into(),
            });
            if let Err(error) = storage::write(
                &app,
                "collaboration.json",
                &serde_json::to_value(&prefs).map_err(|_| "配置序列化失败")?,
            ) {
                let agent = &prefs.bindings.last().unwrap().agent_id;
                let revoked = http(
                    &server,
                    Some(token),
                    "DELETE",
                    &format!("/v1/agents/{agent}"),
                    None,
                )
                .await
                .is_ok();
                return Err(format!(
                    "绑定记录保存失败：{error}。{}",
                    if revoked {
                        "新身份已撤销，请重试"
                    } else {
                        "新身份可能仍有效，请刷新 Agent 列表后撤销它"
                    }
                ));
            }
            return Ok(view(&prefs, user.clone(), &executable));
        }
        "probeBinding" | "unbind" => {
            let id = text(&p, "binding_id")?;
            let binding = prefs
                .bindings
                .iter()
                .find(|b| b.id == id && b.server_url == server && user["id"] == b.user_id)
                .cloned()
                .ok_or("绑定不存在")?;
            if action == "probeBinding" {
                mcp_command(
                    &binding.executable,
                    &server,
                    &binding.state_file,
                    json!({"action":"probe","agent_id":binding.agent_id,"room_id":binding.room_id}),
                )
                .await?;
                return Ok(
                    json!({"verified":true,"message":"房间凭据有效；宿主是否加载 MCP 仍需在宿主中调用 room_read 验证"}),
                );
            }
            http(
                &server,
                Some(token),
                "DELETE",
                &format!("/v1/agents/{}", binding.agent_id),
                None,
            )
            .await?;
            prefs.bindings.retain(|b| b.id != id);
            // Revocation is authoritative; retain inert metadata for recovery, never reuse it.
        }
        _ => return Err("未知协作操作".into()),
    }
    storage::write(
        &app,
        "collaboration.json",
        &serde_json::to_value(&prefs).map_err(|_| "配置序列化失败")?,
    )?;
    Ok(view(&prefs, user.clone(), &executable))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn origins_and_proxy_paths_do_not_leak_credentials() {
        assert_eq!(
            origin("https://Example.com:443/").unwrap(),
            "https://example.com"
        );
        for bad in [
            "http://remote.test",
            "https://u:p@example.com",
            "https://example.com/path",
            "https://example.com?secret=1",
        ] {
            assert!(origin(bad).is_err());
        }
        let id = "8e1c30c5-04ab-4da7-a05b-8b870f843e4d";
        assert!(request_allowed(
            "GET",
            &format!("/v1/rooms/{id}/messages?after_seq=20&limit=200")
        ));
        for path in [
            "https://evil.test/v1/rooms",
            "//evil.test/v1/rooms",
            "/v1/auth/devices",
            "/v1/rooms/../auth/login",
            "/v1/rooms?url=https://evil.test",
        ] {
            assert!(!request_allowed("POST", path));
        }
        assert!(!request_allowed("POST", &format!("/v1/tasks/{id}/start")));
    }
    #[test]
    fn shared_host_reference_cannot_be_reassigned_silently() {
        let mut prefs = Preferences::default();
        let p = json!({"host_kind":"dsh","host_ref":"desktop-profile","label":"test","scope":"session"});
        assert!(validate_binding(&prefs, "https://example.com", "u", &p).is_err());
        let mut p = p;
        p["scope"] = json!("profile");
        assert!(validate_binding(&prefs, "https://example.com", "u", &p).is_ok());
        prefs.bindings.push(Binding {
            id: "1".into(),
            server_url: "https://example.com".into(),
            user_id: "u".into(),
            room_id: "r1".into(),
            agent_id: "a1".into(),
            host_kind: "dsh".into(),
            host_ref: "desktop-profile".into(),
            scope: "profile".into(),
            label: "test".into(),
            state_file: "file".into(),
            executable: "exe".into(),
        });
        assert!(validate_binding(&prefs, "https://example.com", "u", &p).is_err());
        assert!(validate_binding(&prefs, "https://other.example.com", "u", &p).is_ok());
    }
}
