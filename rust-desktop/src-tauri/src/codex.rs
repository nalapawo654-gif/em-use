//! Read-only Codex account monitor. Never reads credentials or starts a turn.
use crate::{model::now, publish, shared};
use serde_json::{json, Value};
use std::{collections::HashSet, path::PathBuf, process::Stdio, time::Duration};
use tauri_plugin_notification::NotificationExt;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt, BufReader},
    process::{ChildStdin, ChildStdout, Command},
};

pub struct Hub {
    pub state: Value,
    generation: u64,
    busy: bool,
    next: i64,
    failures: u32,
    notified: HashSet<String>,
}
impl Default for Hub {
    fn default() -> Self {
        Self {
            state: json!({"status":"signed-out","message":"连接本机 Codex 后查看额度","syncing":false,"account":null,"buckets":[],"receivedAt":null}),
            generation: 0,
            busy: false,
            next: 0,
            failures: 0,
            notified: HashSet::new(),
        }
    }
}
#[derive(Debug)]
struct Failure(&'static str, &'static str);
const PROTOCOL: Failure = Failure(
    "unavailable",
    "Codex 返回了无法识别的数据，请更新 Codex 后重试",
);
const CONNECTION: Failure = Failure(
    "unavailable",
    "Codex 额度连接失败，请检查网络和本机 Codex 登录状态",
);

pub fn invalidate(app: &tauri::AppHandle) {
    let sh = shared(app);
    let mut h = sh.codex.lock().unwrap();
    let generation = h.generation + 1;
    // An in-flight child is bounded by the request timeout; no second child until it exits.
    let busy = h.busy;
    *h = Hub::default();
    h.generation = generation;
    h.busy = busy;
}

fn home(settings: &Value) -> Result<PathBuf, Failure> {
    let configured = settings["codexHome"].as_str().unwrap_or("");
    let path = if !configured.is_empty() {
        PathBuf::from(configured)
    } else if let Some(path) = std::env::var_os("CODEX_HOME") {
        PathBuf::from(path)
    } else {
        let root = std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).ok_or(
            Failure("unavailable", "无法定位用户目录，请指定 Codex 数据目录"),
        )?;
        PathBuf::from(root).join(".codex")
    };
    if !path.is_absolute() || !path.is_dir() {
        return Err(Failure(
            "unavailable",
            "Codex 数据目录不存在，请在高级设置中指定绝对路径",
        ));
    }
    Ok(path)
}
fn executable(settings: &Value) -> Result<PathBuf, Failure> {
    let configured = settings["codexExecutable"].as_str().unwrap_or("");
    let mut candidates = Vec::new();
    if !configured.is_empty() {
        candidates.push(PathBuf::from(configured));
    } else {
        #[cfg(target_os = "macos")]
        {
            for base in [
                PathBuf::from("/Applications"),
                PathBuf::from(std::env::var_os("HOME").unwrap_or_default()).join("Applications"),
            ] {
                for app in ["Codex.app", "ChatGPT.app"] {
                    candidates.push(base.join(app).join("Contents/Resources/codex"));
                    candidates
                        .push(base.join(app).join(
                            "Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex",
                        ));
                }
            }
            candidates.extend([
                PathBuf::from("/opt/homebrew/bin/codex"),
                PathBuf::from("/usr/local/bin/codex"),
            ]);
        }
        if let Some(paths) = std::env::var_os("PATH") {
            for path in std::env::split_paths(&paths) {
                candidates.push(path.join(if cfg!(windows) { "codex.exe" } else { "codex" }));
                #[cfg(windows)]
                npm_executables(&path.join("node_modules/@openai"), &mut candidates);
            }
        }
        #[cfg(windows)]
        {
            // Store and per-user installations may live in versioned directories.
            // Use the executable of an already-running native Codex process.
            use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};
            let mut system = System::new();
            system.refresh_processes_specifics(
                ProcessesToUpdate::All,
                true,
                ProcessRefreshKind::nothing().with_exe(UpdateKind::Always),
            );
            for process in system.processes().values() {
                if let Some(path) = process.exe().filter(|p| {
                    p.file_name()
                        .is_some_and(|n| n.eq_ignore_ascii_case("codex.exe"))
                }) {
                    candidates.push(path.to_path_buf());
                }
            }
            if let Some(appdata) = std::env::var_os("APPDATA") {
                npm_executables(
                    &PathBuf::from(appdata).join("npm/node_modules/@openai"),
                    &mut candidates,
                );
            }
            if let Some(local) = std::env::var_os("LOCALAPPDATA") {
                let local = PathBuf::from(local);
                for app in ["Codex", "ChatGPT"] {
                    for base in [local.join(app), local.join("Programs").join(app)] {
                        candidates.push(base.join("resources/codex.exe"));
                        candidates.push(base.join("app/resources/codex.exe"));
                    }
                }
                // App execution aliases, when provided by a Store installation.
                candidates.push(local.join("Microsoft/WindowsApps/codex.exe"));
            }
        }
    }
    candidates
        .into_iter()
        .find(|p| {
            if !p.is_absolute() || !p.is_file() {
                return false;
            }
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                p.metadata()
                    .is_ok_and(|m| m.permissions().mode() & 0o111 != 0)
            }
            #[cfg(windows)]
            {
                p.extension().is_some_and(|s| s.eq_ignore_ascii_case("exe"))
            }
            #[cfg(not(any(unix, windows)))]
            {
                true
            }
        })
        .ok_or(Failure(
            "unavailable",
            "未找到 Codex 程序，请安装原生 Codex CLI，或在高级设置中指定程序路径",
        ))
}
#[cfg(windows)]
fn npm_executables(root: &std::path::Path, out: &mut Vec<PathBuf>) {
    // Resolve npm's native executable, never run a .cmd wrapper through a shell.
    for package in ["codex", "codex-win32-x64", "codex-win32-arm64"] {
        for target in ["x86_64-pc-windows-msvc", "aarch64-pc-windows-msvc"] {
            out.push(
                root.join(package)
                    .join("vendor")
                    .join(target)
                    .join("codex/codex.exe"),
            );
            out.push(
                root.join("codex/node_modules/@openai")
                    .join(package)
                    .join("vendor")
                    .join(target)
                    .join("codex/codex.exe"),
            );
        }
    }
}

struct Rpc {
    input: ChildStdin,
    output: BufReader<ChildStdout>,
}
impl Rpc {
    async fn send(&mut self, value: Value) -> Result<(), Failure> {
        let mut bytes = serde_json::to_vec(&value).map_err(|_| PROTOCOL)?;
        bytes.push(b'\n');
        self.input.write_all(&bytes).await.map_err(|_| CONNECTION)
    }
    async fn request(&mut self, id: u32, method: &str, params: Value) -> Result<Value, Failure> {
        self.send(json!({"id":id,"method":method,"params":params}))
            .await?;
        loop {
            let mut line = Vec::new();
            loop {
                let byte = self.output.read_u8().await.map_err(|_| CONNECTION)?;
                if byte == b'\n' {
                    break;
                }
                if line.len() >= 1_048_576 {
                    return Err(PROTOCOL);
                }
                line.push(byte);
            }
            if line.is_empty() {
                continue;
            }
            let message: Value = serde_json::from_slice(&line).map_err(|_| PROTOCOL)?;
            if message["id"].as_u64() != Some(u64::from(id)) {
                continue;
            }
            if !message["error"].is_null() {
                return Err(rpc_failure(&message["error"]));
            }
            return message.get("result").cloned().ok_or(PROTOCOL);
        }
    }
}
fn rpc_failure(error: &Value) -> Failure {
    let code = error["code"].as_i64();
    let http = error["data"]["status"]
        .as_i64()
        .or(error["data"]["statusCode"].as_i64());
    let message = error["message"].as_str().unwrap_or("").to_ascii_lowercase();
    if code == Some(-32601) {
        Failure("unavailable", "此 Codex 版本不支持额度查询，请更新 Codex")
    } else if code == Some(401)
        || http == Some(401)
        || message.contains("unauthorized")
        || message.contains("not authenticated")
        || message.contains("not logged in")
    {
        Failure("expired", "Codex 登录已失效，请在 Codex 中重新登录后重试")
    } else if code == Some(403) || http == Some(403) {
        Failure(
            "forbidden",
            "当前 Codex 账户无权读取额度，请在 Codex 中检查账户与工作区",
        )
    } else {
        CONNECTION
    }
}
fn identity(response: Value) -> Result<Value, Failure> {
    let a = &response["account"];
    if a.is_null() {
        return Err(Failure(
            "signed-out",
            "请先在本机 Codex 中登录 ChatGPT 账户，然后重试",
        ));
    }
    if !matches!(a["type"].as_str(), Some("chatgpt" | "chatgptAuthTokens")) {
        return Err(Failure(
            "forbidden",
            "当前 Codex 登录方式不提供 ChatGPT 订阅额度，请在 Codex 中使用 ChatGPT 登录",
        ));
    }
    let email = a["email"]
        .as_str()
        .filter(|s| !s.is_empty())
        .ok_or(PROTOCOL)?;
    // Whitelist display fields. Tokens and arbitrary server fields never enter app state.
    Ok(
        json!({"id":a["id"].as_str().or(a["accountId"].as_str()).unwrap_or(email),"name":email,"plan":a["planType"].as_str(),"workspace":a["workspaceId"].as_str()}),
    )
}
pub fn normalize(response: &Value) -> Result<Value, &'static str> {
    let entries: Vec<(String, &Value)> =
        if let Some(map) = response["rateLimitsByLimitId"].as_object() {
            map.iter().map(|(k, v)| (k.clone(), v)).collect()
        } else if response["rateLimits"].is_object() {
            vec![(
                response["rateLimits"]["limitId"]
                    .as_str()
                    .unwrap_or("codex")
                    .to_owned(),
                &response["rateLimits"],
            )]
        } else {
            return Err("missing limits");
        };
    let mut buckets = Vec::new();
    for (id, value) in entries {
        let mut windows = Vec::new();
        for key in ["primary", "secondary"] {
            let window = &value[key];
            if window.is_null() {
                continue;
            }
            let percent = window["usedPercent"]
                .as_f64()
                .filter(|v| v.is_finite() && *v >= 0.)
                .map(|v| (100. - v).clamp(0., 100.));
            let minutes = window["windowDurationMins"]
                .as_f64()
                .filter(|v| v.is_finite() && *v > 0.);
            let reset = window["resetsAt"]
                .as_i64()
                .filter(|v| *v > 0 && *v < 253402300800);
            windows.push(json!({"id":key,"remainingPercent":percent,"windowDurationMins":minutes,"resetsAt":reset}));
        }
        buckets.push(json!({"id":id,"name":value["limitName"].as_str().unwrap_or(&id),"windows":windows,"plan":value["planType"].as_str()}));
    }
    if buckets.is_empty() {
        return Err("empty limits");
    }
    Ok(json!(buckets))
}

async fn fetch(settings: &Value, observed: &mut Option<Value>) -> Result<Value, Failure> {
    fetch_with_timeout(settings, observed, Duration::from_secs(15)).await
}
async fn fetch_with_timeout(
    settings: &Value,
    observed: &mut Option<Value>,
    timeout: Duration,
) -> Result<Value, Failure> {
    let home = home(settings)?;
    let path = executable(settings)?;
    let mut command = Command::new(path);
    command
        .args(["app-server", "--listen", "stdio://"])
        .env("CODEX_HOME", &home)
        .current_dir(&home)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    let mut child = command.spawn().map_err(|_| {
        Failure(
            "unavailable",
            "Codex 程序无法启动，请检查程序路径和执行权限",
        )
    })?;
    let result = tokio::time::timeout(timeout, async {
        let mut rpc = Rpc { input: child.stdin.take().ok_or(CONNECTION)?, output: BufReader::new(child.stdout.take().ok_or(CONNECTION)?) };
        rpc.request(1, "initialize", json!({"clientInfo":{"name":"em_use","title":"EM Use","version":env!("CARGO_PKG_VERSION")}})).await?;
        rpc.send(json!({"method":"initialized"})).await?;
        let account = identity(rpc.request(2, "account/read", json!({"refreshToken":false})).await?)?;
        *observed = Some(account.clone());
        let limits = rpc.request(3, "account/rateLimits/read", Value::Null).await?;
        *observed = None;
        let after = identity(rpc.request(4, "account/read", json!({"refreshToken":false})).await?)?;
        if account != after { *observed = None; return Err(Failure("connecting", "Codex 账户已变化，正在重新同步")); }
        *observed = Some(account.clone());
        let buckets = normalize(&limits).map_err(|_| PROTOCOL)?;
        Ok(json!({"status":"ready","message":"已同步 Codex 实时额度","syncing":false,"account":account,"buckets":buckets,"receivedAt":now()}))
    }).await.unwrap_or(Err(Failure("unavailable", "Codex 查询超时，请稍后重试")));
    let _ = child.kill().await;
    let _ = child.wait().await;
    result
}

fn expired_windows(state: &Value, time: i64) -> bool {
    state["buckets"].as_array().is_some_and(|b| {
        b.iter().any(|b| {
            b["windows"].as_array().is_some_and(|w| {
                w.iter()
                    .any(|w| w["resetsAt"].as_i64().is_some_and(|r| r * 1000 <= time))
            })
        })
    })
}
pub fn view(h: &Hub) -> Value {
    let mut state = h.state.clone();
    if state["status"] == "ready"
        && (now() - state["receivedAt"].as_i64().unwrap_or(0) > 180_000
            || expired_windows(&state, now()))
    {
        state["status"] = json!("stale");
        state["message"] = json!("上次同步的额度，正在等待最新结果");
    }
    state
}
pub async fn refresh(app: tauri::AppHandle, force: bool) {
    let (settings, ticket) = {
        let sh = shared(&app);
        let r = sh.inner.lock().unwrap();
        let settings = r.state["settings"].clone();
        let mut h = sh.codex.lock().unwrap();
        if settings["codexEnabled"] != true || h.busy || (!force && now() < h.next) {
            return;
        }
        h.busy = true;
        h.state["syncing"] = json!(true);
        if h.state["account"].is_null() {
            h.state["status"] = json!("connecting");
        }
        (settings, h.generation)
    };
    publish(&app);
    let mut observed = None;
    let result = fetch(&settings, &mut observed).await;
    {
        let sh = shared(&app);
        let current_settings = sh.inner.lock().unwrap().state["settings"].clone();
        let mut h = sh.codex.lock().unwrap();
        h.busy = false;
        if h.generation != ticket {
            return;
        }
        h.state["syncing"] = json!(false);
        match result {
            Ok(state) => {
                if h.state["account"] != state["account"] {
                    h.notified.clear();
                }
                h.state = state;
                h.failures = 0;
                h.next = now() + 60_000;
                // Refresh shortly after a server-provided reset, without inventing a balance.
                if let Some(buckets) = h.state["buckets"].as_array() {
                    let reset = buckets
                        .iter()
                        .filter_map(|b| b["windows"].as_array())
                        .flatten()
                        .filter_map(|w| w["resetsAt"].as_i64())
                        .map(|r| r * 1000 + 1000)
                        .filter(|r| *r > now())
                        .min();
                    if let Some(reset) = reset {
                        h.next = h.next.min(reset);
                    }
                }
                notify(&app, &current_settings, &mut h);
            }
            Err(Failure(status, message)) => {
                h.failures += 1;
                h.next = now() + (30_000 * 2_i64.pow(h.failures.min(4))).min(300_000);
                apply_failure(&mut h.state, observed, Failure(status, message));
            }
        }
    }
    publish(&app);
}
fn apply_failure(state: &mut Value, observed: Option<Value>, failure: Failure) {
    // Historical data is only usable after confirming the same current account.
    let cached = failure.0 == "unavailable"
        && observed.as_ref().is_some_and(|a| *a == state["account"])
        && state["receivedAt"].is_number();
    if !cached {
        state["account"] = observed.unwrap_or(Value::Null);
        state["buckets"] = json!([]);
        state["receivedAt"] = Value::Null;
    }
    state["status"] = json!(if cached { "stale" } else { failure.0 });
    state["message"] = json!(failure.1);
}
fn notify(app: &tauri::AppHandle, settings: &Value, h: &mut Hub) {
    if settings["notifications"] != true
        || settings["quotaSource"] != "codex"
        || expired_windows(&h.state, now())
    {
        return;
    }
    let bucket_id = settings["codexBucket"].as_str().unwrap_or("codex");
    let Some(buckets) = h.state["buckets"].as_array() else {
        return;
    };
    let Some(bucket) = buckets.iter().find(|b| b["id"] == bucket_id) else {
        return;
    };
    let Some(windows) = bucket["windows"].as_array() else {
        return;
    };
    let mut active = HashSet::new();
    for w in windows {
        let Some(reset) = w["resetsAt"].as_i64() else {
            continue;
        };
        let base = format!("{bucket_id}:{}:{reset}", w["id"]);
        for threshold in [30, 10] {
            active.insert(format!("{base}:{threshold}"));
        }
        let Some(percent) = w["remainingPercent"].as_f64().filter(|p| *p <= 30.) else {
            continue;
        };
        let threshold = if percent <= 10. { 10 } else { 30 };
        if h.notified.insert(format!("{base}:{threshold}")) {
            h.notified.insert(format!("{base}:30"));
            let minutes = w["windowDurationMins"]
                .as_f64()
                .map(|n| format!("{n} 分钟窗口"))
                .unwrap_or_else(|| "额度窗口".into());
            let _ = app
                .notification()
                .builder()
                .title("Codex 额度提醒")
                .body(format!(
                    "{bucket_id} · {minutes}剩余 {percent:.0}%，重置时间以 Codex 返回结果为准。"
                ))
                .show();
        }
    }
    h.notified.retain(|key| active.contains(key));
}
pub fn start(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut last = now();
        loop {
            let wake = now() - last > 45_000;
            last = now();
            refresh(app.clone(), wake).await;
            tokio::time::sleep(Duration::from_secs(15)).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn buckets_windows_and_missing_values_are_not_money() {
        let data = normalize(&json!({"rateLimitsByLimitId":{"codex":{"primary":{"usedPercent":72,"windowDurationMins":300,"resetsAt":1900000000},"secondary":{"usedPercent":120,"windowDurationMins":10080}},"other":{"primary":{"usedPercent":null,"windowDurationMins":15}}},"rateLimits":{"primary":{"usedPercent":0}}})).unwrap();
        assert_eq!(data[0]["windows"][0]["remainingPercent"], 28.);
        assert_eq!(data[0]["windows"][1]["remainingPercent"], 0.);
        assert!(data[1]["windows"][0]["remainingPercent"].is_null());
        assert!(data[0]["windows"][1]["resetsAt"].is_null());
    }
    #[test]
    fn legacy_and_invalid() {
        assert!(normalize(&json!({})).is_err());
        assert!(normalize(&json!({"rateLimitsByLimitId":{},"rateLimits":{"primary":{}}})).is_err());
        let data = normalize(&json!({"rateLimits":{"primary":{"usedPercent":-1,"windowDurationMins":0,"resetsAt":-1}}})).unwrap();
        assert_eq!(data[0]["id"], "codex");
        assert!(data[0]["windows"][0]["remainingPercent"].is_null());
        assert!(data[0]["windows"][0]["windowDurationMins"].is_null());
    }
    #[test]
    fn identity_is_whitelisted_and_requires_subscription() {
        assert!(identity(json!({"account":{"type":"apiKey"}})).is_err());
        assert!(identity(json!({"account":null})).is_err());
        let a = identity(json!({"account":{"type":"chatgpt","email":"test@example.invalid","token":"not-to-copy"}})).unwrap();
        assert!(a.get("token").is_none());
    }
    #[test]
    fn reset_and_staleness_never_invent_full_quota() {
        let mut hub = Hub::default();
        hub.state = json!({"status":"ready","receivedAt":now(),"buckets":[{"windows":[{"remainingPercent":0,"resetsAt":1}]}]});
        assert_eq!(view(&hub)["status"], "stale");
        assert_eq!(
            view(&hub)["buckets"][0]["windows"][0]["remainingPercent"],
            0
        );
    }
    #[test]
    #[ignore = "Read-only current Codex account quota; prints counts only, no identities or credentials"]
    fn live_codex_quota() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let mut observed = None;
        let state = rt
            .block_on(fetch(&crate::model::contract()["defaults"], &mut observed))
            .expect("live quota query failed");
        assert_eq!(state["status"], "ready");
        let buckets = state["buckets"].as_array().unwrap();
        assert!(buckets.iter().any(|b| b["windows"]
            .as_array()
            .unwrap()
            .iter()
            .any(|w| w["remainingPercent"].is_number())));
        println!(
            "Codex live quota: {} buckets; account verified; no conversation started",
            buckets.len()
        );
    }
    #[test]
    fn cache_requires_verified_identity_and_never_survives_signout() {
        let old = json!({"account":{"id":"one"},"receivedAt":123,"buckets":[{"id":"codex"}]});
        let mut state = old.clone();
        apply_failure(&mut state, Some(json!({"id":"one"})), CONNECTION);
        assert_eq!(state["status"], "stale");
        assert_eq!(state["buckets"].as_array().unwrap().len(), 1);
        for identity in [None, Some(json!({"id":"two"}))] {
            let mut state = old.clone();
            apply_failure(&mut state, identity, CONNECTION);
            assert!(state["buckets"].as_array().unwrap().is_empty());
            assert!(state["receivedAt"].is_null());
        }
        let mut state = old;
        apply_failure(
            &mut state,
            Some(json!({"id":"one"})),
            Failure("signed-out", "signed out"),
        );
        assert!(state["buckets"].as_array().unwrap().is_empty());
    }
    #[test]
    #[cfg(unix)]
    fn subprocess_protocol_is_readonly_bounded_and_reaped() {
        use std::os::unix::fs::PermissionsExt;
        struct FixtureDir(PathBuf);
        impl Drop for FixtureDir {
            fn drop(&mut self) {
                let _ = std::fs::remove_dir_all(&self.0);
            }
        }
        let dir = std::env::temp_dir().join(format!("em-use-codex-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let _fixture = FixtureDir(dir.clone());
        let exe = dir.join("mock codex");
        // Use only POSIX shell builtins: a cold system Python startup on macOS
        // runners must not consume the protocol test's deadline.
        let script = r#"#!/bin/sh
[ "$1" = app-server ] && [ "$2" = --listen ] && [ "$3" = stdio:// ] || exit 90
printf '%s' "$$" > pid
while IFS= read -r line; do
 case "$line" in
  *'"method":"initialized"'*) printf 'initialized\n' >> methods; continue ;;
  *'"method":"initialize"'*) method=initialize; id=1; result='{}' ;;
  *'"method":"account/read"'*)
   method=account/read; id=2; email=first@example.invalid
   case "$line" in *'"id":4'*) id=4; [ ! -e switch ] || email=second@example.invalid ;; esac
   result="{\"account\":{\"type\":\"chatgpt\",\"email\":\"$email\",\"planType\":\"plus\"}}" ;;
  *'"method":"account/rateLimits/read"'*)
   method=account/rateLimits/read; id=3
   result='{"rateLimits":{"primary":{"usedPercent":72,"windowDurationMins":300,"resetsAt":1900000000}}}' ;;
  *) exit 91 ;;
 esac
 printf '%s\n' "$method" >> methods
 if [ "$method" = account/rateLimits/read ] && [ -e hang ]; then
  # Block in this process, not a sleep grandchild. stdin stays open until killed.
  printf 'ready' > hanging
  while IFS= read -r ignored; do :; done
  exit 0
 fi
 printf '%s\n' '{"method":"ignored/notification","params":{}}'
 printf '{"id":%s,"result":%s}\n' "$id" "$result"
done
"#;
        std::fs::write(&exe, script).unwrap();
        std::fs::set_permissions(&exe, std::fs::Permissions::from_mode(0o700)).unwrap();
        let config = json!({"codexHome":dir,"codexExecutable":exe});
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let mut observed = None;
        let result = rt
            .block_on(fetch_with_timeout(
                &config,
                &mut observed,
                Duration::from_secs(15),
            ))
            .unwrap();
        assert_eq!(result["buckets"][0]["windows"][0]["remainingPercent"], 28.);
        let methods = std::fs::read_to_string(dir.join("methods")).unwrap();
        assert_eq!(
            methods,
            "initialize\ninitialized\naccount/read\naccount/rateLimits/read\naccount/read\n"
        );
        let pid = std::fs::read_to_string(dir.join("pid")).unwrap();
        let status = std::process::Command::new("/bin/kill")
            .args(["-0", pid.trim()])
            .stderr(Stdio::null())
            .status()
            .unwrap();
        assert!(!status.success(), "child must be reaped");
        std::fs::write(dir.join("switch"), "").unwrap();
        let result = rt.block_on(fetch_with_timeout(
            &config,
            &mut observed,
            Duration::from_secs(15),
        ));
        assert_eq!(result.unwrap_err().0, "connecting");
        assert!(observed.is_none());
        std::fs::write(dir.join("hang"), "").unwrap();
        // Do not let an earlier successful run's PID satisfy the reaping check.
        std::fs::remove_file(dir.join("pid")).unwrap();
        let start = std::time::Instant::now();
        let result = rt.block_on(fetch_with_timeout(
            &config,
            &mut observed,
            Duration::from_secs(1),
        ));
        assert!(result.unwrap_err().1.contains("超时"));
        assert!(start.elapsed() < Duration::from_secs(5));
        assert!(
            dir.join("hanging").exists(),
            "mock must reach the blocked RPC before timing out"
        );
        let pid = std::fs::read_to_string(dir.join("pid")).unwrap();
        assert!(!std::process::Command::new("/bin/kill")
            .args(["-0", pid.trim()])
            .stderr(Stdio::null())
            .status()
            .unwrap()
            .success());
    }
}
