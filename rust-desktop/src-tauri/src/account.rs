use crate::*;
use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_notification::NotificationExt;
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
    let (auth, ticket) = {
        let sh = shared(&app);
        let mut r = sh.inner.lock().unwrap();
        if r.auth.is_none()
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
        w.show().map_err(|e| e.to_string())?;
        return w.set_focus().map_err(|e| e.to_string());
    }
    let popup_app = app.clone();
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
        if ticket != r.generation || r.state["loginOpen"] != true {
            return Err("登录已取消".into());
        }
        r.state["syncing"] = json!(false);
        match result {
            Ok(q) => {
                r.state["persistentLogin"] = json!(storage::save_credentials(&candidate));
                r.auth = Some(candidate);
                r.state["quota"] = q;
                r.state["status"] = json!("ready");
                r.failures = 0;
                r.next_attempt = now() + 60_000;
                r.notified.clear();
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
    storage::clear_credentials()?;
    {
        let sh = shared(app);
        let mut r = sh.inner.lock().unwrap();
        r.generation += 1;
        r.auth = None;
        r.state["quota"] = Value::Null;
        r.state["status"] = json!("signed-out");
        r.state["message"] = json!("已退出登录");
        r.state["persistentLogin"] = json!(false);
        r.state["syncing"] = json!(false);
    }
    if let Some(w) = app.get_webview_window("login") {
        let _ = w.close();
    }
    publish(app);
    Ok(())
}
