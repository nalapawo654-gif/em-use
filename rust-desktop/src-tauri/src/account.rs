use crate::*;
use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_notification::NotificationExt;
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LoginMode {
    Dongdong,
    Manual,
    SignedOut,
}

fn saved_mode(saved: Option<&Value>, credentials: Option<&Value>) -> LoginMode {
    match saved {
        Some(v) => serde_json::from_value(v["mode"].clone()).unwrap_or(LoginMode::SignedOut),
        None if credentials.is_some_and(valid_auth) => LoginMode::Manual,
        None => LoginMode::Dongdong,
    }
}
fn reset(r: &mut Runtime, mode: LoginMode) {
    r.generation += 1;
    r.login_mode = mode;
    r.auth = None;
    r.dong_fingerprint = None;
    r.last_refresh = 0;
    r.next_attempt = 0;
    r.failures = 0;
    r.notified.clear();
    r.state["loginMode"] = json!(mode);
    r.state["account"] = Value::Null;
    r.state["quota"] = Value::Null;
    r.state["syncing"] = json!(false);
    r.state["loginOpen"] = json!(false);
    r.state["persistentLogin"] = json!(false);
    r.state["status"] = json!("signed-out");
}
fn accepts(r: &Runtime, ticket: u64, mode: LoginMode) -> bool {
    r.generation == ticket && r.login_mode == mode
}
fn current_cache(c: &Value, mode: LoginMode, id: &str) -> bool {
    mode != LoginMode::SignedOut
        && !id.is_empty()
        && c["sessionId"] == id
        && c["mode"] == json!(mode)
        && valid_auth(&c["auth"])
}
fn cache(r: &mut Runtime) {
    let saved = json!({"mode":r.login_mode,"sessionId":r.login_id,"auth":r.auth,"account":r.state["account"],"sourceFingerprint":r.dong_fingerprint});
    r.state["persistentLogin"] = json!(storage::save_credentials(&saved));
}
pub fn restore(app: &tauri::AppHandle) {
    let saved = storage::read(app, "account.json").or_else(|| {
        storage::dir(app)
            .ok()
            .filter(|p| p.join("account.json").exists())
            .map(|_| Value::Null)
    });
    let credentials = storage::credentials();
    let mode = saved_mode(saved.as_ref(), credentials.as_ref());
    let sh = shared(app);
    let mut r = sh.inner.lock().unwrap();
    reset(&mut r, mode);
    r.login_id = saved
        .as_ref()
        .and_then(|v| v["sessionId"].as_str())
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    if storage::write(
        app,
        "account.json",
        &json!({"mode":mode,"sessionId":r.login_id}),
    )
    .is_err()
    {
        reset(&mut r, LoginMode::SignedOut);
        r.state["message"] = json!("登录方式暂未保存，请打开设置重试");
        return;
    }
    if let Some(c) = credentials {
        if current_cache(&c, mode, &r.login_id) {
            r.auth = Some(c["auth"].clone());
            r.dong_fingerprint = c["sourceFingerprint"].as_str().map(str::to_owned);
            if mode == LoginMode::Manual {
                r.state["account"] = c["account"].clone();
            }
            r.state["persistentLogin"] = json!(true);
        } else if saved.is_none() && mode == LoginMode::Manual && valid_auth(&c) {
            r.state["account"] = json!({"id":c["x-dong-user"]});
            r.auth = Some(c);
            cache(&mut r);
        }
    }
    r.state["message"] = json!(match mode {
        LoginMode::Dongdong => "正在连接本机咚咚账户",
        LoginMode::Manual if r.auth.is_some() => "正在恢复手动登录账户",
        LoginMode::Manual => "请手动登录 AI 云平台",
        LoginMode::SignedOut => "已退出登录，自动连接已暂停",
    });
}
fn select_mode(app: &tauri::AppHandle, mode: LoginMode) -> Result<u64, String> {
    let ticket = {
        let sh = shared(app);
        let mut r = sh.inner.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        // Persist intent first. A stale keyring entry can never restore after this ID changes.
        storage::write(app, "account.json", &json!({"mode":mode,"sessionId":id}))
            .map_err(|_| "登录方式暂未保存，请重试")?;
        reset(&mut r, mode);
        r.login_id = id;
        r.state["message"] = json!(match mode {
            LoginMode::Dongdong => "正在连接本机咚咚账户",
            LoginMode::Manual => "请在官方窗口登录需要使用的账户",
            LoginMode::SignedOut => "已退出登录，自动连接已暂停",
        });
        if storage::clear_credentials().is_err() {
            r.state["message"] = json!("原登录凭据未能从系统存储中清除，已停止使用该凭据");
        }
        r.generation
    };
    // The destroyed callback is ignored after reset, so it cannot cancel a new automatic attempt.
    if let Some(w) = app.get_webview_window("login") {
        let _ = w.close();
    }
    publish(app);
    Ok(ticket)
}
fn exchange_retry_at(status: &str, failures: u32, time: i64) -> i64 {
    if matches!(status, "expired" | "forbidden") {
        // Wait for a changed source session or an explicit login attempt.
        i64::MAX
    } else {
        time + (30_000 * 2_i64.pow(failures.min(4))).min(300_000)
    }
}
pub async fn login(app: &tauri::AppHandle, requested: Option<&str>) -> Result<(), String> {
    // Unqualified login is a user click (connect / sign in again).
    // Automatic startup uses the saved mode; DongDong buttons request it explicitly.
    let mode = match requested {
        None | Some("manual") => LoginMode::Manual,
        Some("dongdong") => LoginMode::Dongdong,
        _ => return Err("未知登录方式".into()),
    };
    if mode == LoginMode::Manual {
        return open_login(app);
    }
    select_mode(app, mode)?;
    refresh(app.clone(), true).await;
    Ok(())
}
async fn ensure_dongdong(app: &tauri::AppHandle, force: bool) {
    let ticket = {
        let sh = shared(app);
        let r = sh.inner.lock().unwrap();
        if r.login_mode != LoginMode::Dongdong {
            return;
        }
        r.generation
    };
    let source = tauri::async_runtime::spawn_blocking(crate::dongdong::read_session)
        .await
        .unwrap_or_else(|_| {
            Err((
                "unavailable".into(),
                "暂时无法读取咚咚登录信息，请重试".into(),
            ))
        });
    let (source, ticket) = {
        let sh = shared(app);
        let mut r = sh.inner.lock().unwrap();
        if !accepts(&r, ticket, LoginMode::Dongdong) {
            return;
        }
        let source = match source {
            Ok(source) => source,
            Err((status, message)) => {
                let had_auth = r.auth.is_some();
                reset(&mut r, LoginMode::Dongdong);
                if had_auth {
                    let _ = storage::clear_credentials();
                }
                r.state["status"] = json!(status);
                r.state["message"] = json!(message);
                drop(r);
                publish(app);
                return;
            }
        };
        if r.dong_fingerprint.as_deref() != Some(&source.fingerprint) {
            reset(&mut r, LoginMode::Dongdong);
            let _ = storage::clear_credentials();
            r.dong_fingerprint = Some(source.fingerprint.clone());
        }
        if r.auth.is_some() {
            r.state["account"] =
                json!({"id":r.auth.as_ref().unwrap()["x-dong-user"],"name":source.name});
            return;
        }
        if r.state["syncing"] == true || (!force && now() < r.next_attempt) {
            return;
        }
        r.state["syncing"] = json!(true);
        r.state["status"] = json!("connecting");
        r.state["message"] = json!("正在通过咚咚连接 AI 云平台");
        r.last_refresh = now();
        (source, r.generation)
    };
    publish(app);
    let result = async {
        let platform = crate::dongdong::exchange(&shared(app).http, &source).await?;
        let quota = fetch_quota(app, platform.auth.clone()).await?;
        Ok::<_, (String, String)>((platform, quota))
    }
    .await;
    {
        let sh = shared(app);
        let mut r = sh.inner.lock().unwrap();
        if !accepts(&r, ticket, LoginMode::Dongdong) {
            return;
        }
        r.state["syncing"] = json!(false);
        match result {
            Ok((platform, quota)) => {
                r.auth = Some(platform.auth);
                r.state["account"] = platform.profile;
                r.state["quota"] = quota;
                r.state["status"] = json!("ready");
                r.failures = 0;
                r.next_attempt = now() + 60_000;
                cache(&mut r);
                reconcile(&mut r);
            }
            Err((status, message)) => {
                r.failures += 1;
                r.next_attempt = exchange_retry_at(&status, r.failures, now());
                r.state["status"] = json!(status);
                r.state["message"] = json!(message);
            }
        }
    }
    maybe_notify(app);
    publish(app);
}
pub fn valid_auth(v: &Value) -> bool {
    ["x-dong-auth", "x-dong-user", "x-dong-client"]
        .iter()
        .all(|k| {
            v[k].as_str().is_some_and(|s| {
                !s.trim().is_empty() && s.len() < 16384 && !s.contains(['\r', '\n'])
            })
        })
}
async fn fetch_quota(app: &tauri::AppHandle, auth: Value) -> Result<Value, (String, String)> {
    let sh = shared(app);
    let mut req = sh
        .http
        .get("https://aihub.eastmoney.com/ai-cloud-hub/coding-plan/usage");
    for k in ["x-dong-auth", "x-dong-user", "x-dong-client"] {
        req = req.header(k, auth[k].as_str().unwrap_or(""));
    }
    let response = req
        .send()
        .await
        .map_err(|_| ("stale".into(), "暂时连接不上，恢复网络后自动同步".into()))?;
    let status = response.status().as_u16();
    if status == 401 {
        return Err(("expired".into(), "登录已过期，请重新登录".into()));
    }
    if status == 403 {
        return Err(("forbidden".into(), "当前账号暂无个人额度访问权限".into()));
    }
    if status != 200 {
        return Err((
            "stale".into(),
            if status == 429 {
                "查询较频繁，稍后自动重试"
            } else {
                "平台暂时不可用，稍后自动重试"
            }
            .into(),
        ));
    }
    let body = response
        .json()
        .await
        .map_err(|_| ("unavailable".into(), "平台暂未返回有效额度".into()))?;
    model::normalize(body, now()).map_err(|(a, b)| (a.into(), b.into()))
}
pub fn reconcile(r: &mut Runtime) {
    if r.auth.is_none()
        || r.state["quota"].is_null()
        || matches!(
            r.state["status"].as_str(),
            Some("expired" | "forbidden" | "unavailable")
        )
    {
        return;
    }
    let fresh = model::freshness(&r.state["quota"], now());
    if r.failures > 0 && fresh != "resetting" {
        r.state["status"] = json!("stale");
        return;
    }
    r.state["status"] = json!(fresh);
    r.state["message"] = json!(match fresh {
        "ready" => "额度已同步，小伙伴状态不错",
        "resetting" => "正在同步今日额度，请稍候",
        _ => "费用数据更新较慢，当前为上次结果",
    });
}
pub async fn refresh(app: tauri::AppHandle, force: bool) {
    ensure_dongdong(&app, force).await;
    let (auth, ticket) = {
        let sh = shared(&app);
        let mut r = sh.inner.lock().unwrap();
        if r.auth.is_none()
            || r.login_mode == LoginMode::SignedOut
            || r.state["loginOpen"] == true
            || r.state["syncing"] == true
            || now() - r.last_refresh < 3000
            || (!force && now() < r.next_attempt)
        {
            return;
        }
        r.last_refresh = now();
        r.state["syncing"] = json!(true);
        (r.auth.clone().unwrap(), r.generation)
    };
    publish(&app);
    let result = fetch_quota(&app, auth).await;
    {
        let sh = shared(&app);
        let mut r = sh.inner.lock().unwrap();
        if r.generation != ticket {
            return;
        }
        r.state["syncing"] = json!(false);
        match result {
            Ok(q) => {
                r.state["quota"] = q;
                r.state["status"] = json!("ready");
                r.failures = 0;
                r.next_attempt = now() + 60_000;
                reconcile(&mut r);
            }
            Err((status, message)) => {
                r.failures += 1;
                r.next_attempt = now() + (30_000 * 2_i64.pow(r.failures.min(4))).min(300_000);
                if status == "expired" {
                    r.auth = None;
                    r.state["quota"] = Value::Null;
                    if r.login_mode == LoginMode::Dongdong {
                        r.next_attempt = 0;
                    }
                    let _ = storage::clear_credentials();
                    r.state["persistentLogin"] = json!(false);
                }
                r.state["status"] = json!(status);
                r.state["message"] = json!(message);
            }
        }
    }
    maybe_notify(&app);
    publish(&app);
}
fn maybe_notify(app: &tauri::AppHandle) {
    let sh = shared(app);
    let mut r = sh.inner.lock().unwrap();
    let q = r.state["quota"].clone();
    if r.state["status"] != "ready"
        || r.state["settings"]["notifications"] != true
        || q["percent"].as_f64().unwrap_or(100.) > 30.
    {
        return;
    }
    let day = q["day"].as_str().unwrap_or("");
    let danger = q["percent"].as_f64().unwrap_or(100.) <= 10.;
    let key = format!("{day}:{}", if danger { "danger" } else { "warning" });
    r.notified.retain(|s| s.starts_with(day));
    if !r.notified.insert(key) {
        return;
    }
    if danger {
        r.notified.insert(format!("{day}:warning"));
    }
    let _ = app
        .notification()
        .builder()
        .title(if danger {
            "今日额度不多了"
        } else {
            "小伙伴提醒你留意额度"
        })
        .body(format!(
            "剩余 ¥{:.2}，每日 00:00 重置。",
            q["remaining"].as_f64().unwrap_or(0.)
        ))
        .show();
}
pub fn open_login(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("login") {
        let sh = shared(app);
        let r = sh.inner.lock().unwrap();
        if r.login_mode != LoginMode::Manual || r.state["loginOpen"] != true {
            return Err("旧登录窗口正在关闭，请稍后重试".into());
        }
        drop(r);
        w.show().map_err(|e| e.to_string())?;
        return w.set_focus().map_err(|e| e.to_string());
    }
    let ticket = select_mode(app, LoginMode::Manual)?;
    let popup_app = app.clone();
    let window =
        WebviewWindowBuilder::new(app, "login", WebviewUrl::External(PORTAL.parse().unwrap()))
            .title("登录 AI 云平台 · EM Use")
            .inner_size(1020., 760.)
            .min_inner_size(760., 620.)
            .incognito(true)
            .on_new_window(move |url, _| {
                if url.scheme() == "https"
                    && matches!(
                        url.host_str(),
                        Some("aihub.eastmoney.com" | "dongdong-auth.eastmoney.com")
                    )
                {
                    if let Some(login) = popup_app.get_webview_window("login") {
                        let _ = login.navigate(url);
                    }
                }
                tauri::webview::NewWindowResponse::Deny
            })
            .initialization_script(include_str!("login.js"))
            .on_navigation(|url| {
                url.scheme() == "https"
                    && matches!(
                        url.host_str(),
                        Some("aihub.eastmoney.com" | "dongdong-auth.eastmoney.com")
                    )
            })
            .build()
            .map_err(|e| e.to_string())?;
    {
        let sh = shared(app);
        let mut r = sh.inner.lock().unwrap();
        if !accepts(&r, ticket, LoginMode::Manual) {
            drop(r);
            let _ = window.close();
            return Ok(());
        }
        r.generation += 1;
        r.state["syncing"] = json!(false);
        r.state["loginOpen"] = json!(true);
        if r.state["quota"].is_null() {
            r.state["status"] = json!("connecting");
        }
        r.state["message"] = json!("请在官方窗口完成登录");
    }
    publish(app);
    Ok(())
}
#[tauri::command]
pub async fn auth_candidate(
    window: WebviewWindow,
    app: tauri::AppHandle,
    candidate: Value,
) -> Result<(), String> {
    if window.label() != "login"
        || window
            .url()
            .map_err(|e| e.to_string())?
            .origin()
            .ascii_serialization()
            != "https://aihub.eastmoney.com"
        || !valid_auth(&candidate)
    {
        return Err("Invalid login source".into());
    }
    let ticket = {
        let sh = shared(&app);
        let mut r = sh.inner.lock().unwrap();
        if r.state["syncing"] == true {
            return Err("正在验证，请稍后重试".into());
        }
        if r.login_mode != LoginMode::Manual || r.state["loginOpen"] != true {
            return Err("登录已取消".into());
        }
        r.generation += 1;
        r.state["syncing"] = json!(true);
        r.generation
    };
    publish(&app);
    let result = fetch_quota(&app, candidate.clone()).await;
    let success = result.is_ok();
    let error = result.as_ref().err().map(|(_, m)| m.clone());
    {
        let sh = shared(&app);
        let mut r = sh.inner.lock().unwrap();
        if !accepts(&r, ticket, LoginMode::Manual) || r.state["loginOpen"] != true {
            return Err("登录已取消".into());
        }
        r.state["syncing"] = json!(false);
        match result {
            Ok(q) => {
                r.state["account"] = json!({"id":candidate["x-dong-user"]});
                r.auth = Some(candidate);
                r.state["quota"] = q;
                r.state["status"] = json!("ready");
                r.failures = 0;
                r.next_attempt = now() + 60_000;
                r.notified.clear();
                r.state["loginOpen"] = json!(false);
                cache(&mut r);
                reconcile(&mut r);
            }
            Err((s, m)) => {
                r.state["status"] = json!(if s == "forbidden" {
                    "forbidden"
                } else if r.state["quota"].is_null() {
                    "connecting"
                } else {
                    "stale"
                });
                r.state["message"] = json!(m);
            }
        }
    }
    if success {
        let _ = window.close();
        windows::show(&app);
    }
    publish(&app);
    if let Some(e) = error {
        Err(e)
    } else {
        Ok(())
    }
}
pub fn login_closed(app: &tauri::AppHandle) {
    {
        let sh = shared(app);
        let mut r = sh.inner.lock().unwrap();
        if r.login_mode != LoginMode::Manual || r.state["loginOpen"] != true {
            return;
        }
        r.generation += 1;
        r.state["loginOpen"] = json!(false);
        r.state["syncing"] = json!(false);
        if r.state["status"] == "connecting" {
            r.state["status"] = json!("signed-out");
            r.state["message"] = json!("登录未完成，随时可以继续");
        }
    }
    publish(app);
}
pub fn logout(app: &tauri::AppHandle) -> Result<(), String> {
    select_mode(app, LoginMode::SignedOut).map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn auth() -> Value {
        json!({"x-dong-auth":"fixture-token","x-dong-user":"alice","x-dong-client":"WEB-fixture"})
    }
    fn runtime() -> Runtime {
        Runtime {
            state: json!({"quota":{"remaining":123},"account":{"id":"alice"},"syncing":true,"loginOpen":true}),
            auth: Some(auth()),
            login_mode: LoginMode::Dongdong,
            login_id: "old".into(),
            dong_fingerprint: Some("source-a".into()),
            generation: 7,
            last_refresh: 1,
            next_attempt: 100,
            failures: 2,
            gesture: None,
            counter: 0,
            notified: HashSet::from(["old-day".into()]),
        }
    }
    #[test]
    fn fresh_install_defaults_to_dongdong_but_legacy_login_stays_manual() {
        assert_eq!(saved_mode(None, None), LoginMode::Dongdong);
        assert_eq!(saved_mode(None, Some(&auth())), LoginMode::Manual);
        assert_eq!(
            saved_mode(Some(&json!({"mode":"manual"})), None),
            LoginMode::Manual
        );
        assert_eq!(
            saved_mode(Some(&json!({"mode":"signed-out"})), Some(&auth())),
            LoginMode::SignedOut
        );
        assert_eq!(
            saved_mode(Some(&Value::Null), Some(&auth())),
            LoginMode::SignedOut
        );
    }
    #[test]
    fn switching_manual_clears_identity_and_rejects_automatic_result() {
        let mut r = runtime();
        let pending = r.generation;
        reset(&mut r, LoginMode::Manual);
        assert!(!accepts(&r, pending, LoginMode::Dongdong));
        assert!(r.auth.is_none() && r.state["quota"].is_null() && r.state["account"].is_null());
        assert!(r.dong_fingerprint.is_none() && r.notified.is_empty());
        assert_eq!(r.state["loginMode"], "manual");
        assert_eq!(r.state["syncing"], false);
    }
    #[test]
    fn logout_and_source_switch_invalidate_pending_manual_or_auto_requests() {
        let mut r = runtime();
        let pending = r.generation;
        reset(&mut r, LoginMode::Dongdong);
        assert!(!accepts(&r, pending, LoginMode::Dongdong));
        let pending = r.generation;
        reset(&mut r, LoginMode::SignedOut);
        assert!(!accepts(&r, pending, LoginMode::Dongdong));
        assert!(!accepts(&r, pending, LoginMode::Manual));
        assert_eq!(r.state["loginOpen"], false);
    }
    #[test]
    fn stale_keyring_entries_cannot_restore_after_logout_or_account_change() {
        let c = json!({"mode":"manual","sessionId":"old","auth":auth()});
        assert!(current_cache(&c, LoginMode::Manual, "old"));
        assert!(!current_cache(&c, LoginMode::Manual, "new"));
        assert!(!current_cache(&c, LoginMode::Dongdong, "old"));
        assert!(!current_cache(&c, LoginMode::SignedOut, "old"));
        assert!(!current_cache(&auth(), LoginMode::Manual, "old"));
    }
    #[test]
    fn rejected_source_waits_for_user_or_source_change_but_network_retries() {
        assert_eq!(exchange_retry_at("expired", 1, 100), i64::MAX);
        assert_eq!(exchange_retry_at("forbidden", 1, 100), i64::MAX);
        assert_eq!(exchange_retry_at("stale", 1, 100), 60_100);
        assert_eq!(exchange_retry_at("unavailable", 10, 100), 300_100);
    }
}
