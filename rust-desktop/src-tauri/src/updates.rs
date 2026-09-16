use crate::*;
#[cfg(not(target_os = "macos"))]
use tauri_plugin_notification::NotificationExt;
#[cfg(not(target_os = "macos"))]
use tauri_plugin_updater::UpdaterExt;

fn state(app: &tauri::AppHandle, value: Value) {
    let sh = shared(app);
    let mut runtime = sh.inner.lock().unwrap();
    let menu_changed = runtime.state["update"]["status"] != value["status"]
        || runtime.state["update"]["version"] != value["version"];
    runtime.state["update"] = value;
    drop(runtime);
    publish(app);
    if menu_changed {
        let _ = windows::update_tray(app);
    }
}
pub fn restore_notice(app: &tauri::AppHandle) {
    if let Some(value) = storage::read(app, "update-notice.json") {
        if let Some(version) = value["dismissedVersion"]
            .as_str()
            .filter(|s| s.len() <= 128)
        {
            shared(app).inner.lock().unwrap().state["dismissedUpdateVersion"] = json!(version);
        }
    }
}
#[tauri::command]
pub fn dismiss_update(
    window: WebviewWindow,
    app: tauri::AppHandle,
    version: String,
) -> Result<(), String> {
    trusted(&window)?;
    let sh = shared(&app);
    let mut runtime = sh.inner.lock().unwrap();
    if runtime.state["update"]["version"].as_str() != Some(version.as_str()) {
        return Err("版本已经变化，请查看新的来信".into());
    }
    storage::write(
        &app,
        "update-notice.json",
        &json!({"dismissedVersion":version}),
    )?;
    runtime.state["dismissedUpdateVersion"] = json!(version);
    drop(runtime);
    publish(&app);
    Ok(())
}
#[cfg(not(target_os = "macos"))]
pub async fn watch_updates(app: tauri::AppHandle) {
    tokio::time::sleep(Duration::from_secs(10)).await;
    loop {
        let delay = if check_updates(&app, false).await.is_ok() {
            6 * 3600
        } else {
            15 * 60
        };
        tokio::time::sleep(Duration::from_secs(delay)).await;
    }
}
#[tauri::command]
pub async fn check_update(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    trusted(&window)?;
    check_updates(&app, true).await
}
// A background network failure must not erase an already discovered installable version.
fn failed_check(previous: &Value, manual: bool) -> Value {
    if previous["status"] == "available" {
        return previous.clone();
    }
    if !manual {
        return previous.clone();
    }
    json!({"status":"error","message":"暂时无法检查更新，请确认已连接内网且服务器已上传版本清单"})
}
pub fn tray_label(update: &Value) -> String {
    match update["status"].as_str() {
        Some("available") => format!(
            "发现新版本 v{} · 查看更新",
            update["version"].as_str().unwrap_or("")
        ),
        Some("downloading") => "正在下载更新 · 查看进度".into(),
        Some("installing") => "正在安装更新".into(),
        Some("error") if update["version"].is_string() => "更新未完成 · 查看详情".into(),
        _ => "检查更新".into(),
    }
}
#[cfg(not(target_os = "macos"))]
pub async fn check_updates(app: &tauri::AppHandle, manual: bool) -> Result<(), String> {
    let sh = shared(app);
    let Ok(mut slot) = sh.update.try_lock() else {
        return Ok(());
    };
    let previous = snapshot(app)["update"].clone();
    if manual && previous["status"] != "available" {
        state(app, json!({"status":"checking","message":"正在检查新版本"}));
    }
    let result = async {
        app.updater_builder()
            .timeout(Duration::from_secs(20))
            .build()
            .map_err(|e| e.to_string())?
            .check()
            .await
            .map_err(|e| e.to_string())
    }
    .await;
    match result {
        Ok(Some(update)) => {
            let version = update.version.clone();
            state(
                app,
                json!({"status":"available","version":version,"notes":update.body,"message":"发现新版本，可下载并安装"}),
            );
            *slot = Some(update);
            // Keep notification policy separate from quota alerts. Never show or focus a hidden pet.
            let runtime = sh.inner.lock().unwrap();
            let notify = runtime.state["settings"]["notifications"] == true
                && runtime.state["dismissedUpdateVersion"] != version
                && sh.update_notified.lock().unwrap().insert(version.clone());
            drop(runtime);
            if notify {
                let _ = app.notification().builder().title(format!("EM Use v{version} 已就绪"))
                    .body("伙伴收到一封更新来信。可点击桌宠上的新版本入口，或从托盘查看更新；安装需要你确认。")
                    .show();
            }
            Ok(())
        }
        Ok(None) => {
            *slot = None;
            state(
                app,
                json!({"status":"current","message":"当前已是最新版本"}),
            );
            Ok(())
        }
        Err(_) => {
            if previous["status"] != "available" {
                *slot = None;
            }
            state(app, failed_check(&previous, manual));
            Err("检查更新失败".into())
        }
    }
}
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn install_update(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    trusted(&window)?;
    let sh = shared(&app);
    let mut slot = sh.update.try_lock().map_err(|_| "更新正在进行")?;
    let update = slot.as_ref().ok_or("请先检查更新")?;
    let version = update.version.clone();
    state(
        &app,
        json!({"status":"downloading","version":version,"message":"正在下载更新，完成后将重启应用"}),
    );
    let mut downloaded = 0_u64;
    let result = update.download_and_install(|size,total| {
        downloaded += size as u64;
        state(&app, json!({"status":"downloading","version":version,"downloaded":downloaded,"total":total,"message":"正在下载并校验更新"}));
    }, || {
        state(&app, json!({"status":"installing","version":version,"message":"签名校验通过，正在安装"}));
    }).await;
    match result {
        Ok(()) => {
            *slot = None;
            app.restart();
        }
        Err(_) => {
            state(
                &app,
                json!({"status":"error","version":version,"message":"更新失败，原版本仍可使用；请重新检查或手动下载"}),
            );
            Err("更新未安装".into())
        }
    }
}
// macOS only reads release metadata on demand. It never creates an installable Update.
#[cfg(any(target_os = "macos", test))]
fn manual_release(manifest: &Value, current: &str) -> Result<Value, String> {
    let version = manifest["version"].as_str().ok_or("版本清单缺少版本号")?;
    let latest = semver::Version::parse(version).map_err(|_| "版本清单格式不正确")?;
    let current = semver::Version::parse(current).map_err(|_| "当前版本格式不正确")?;
    if !latest.pre.is_empty() {
        return Err("正式版本清单不能包含预览版本".into());
    }
    if latest.cmp_precedence(&current).is_gt() {
        Ok(
            json!({"status":"available","version":version,"notes":manifest["notes"].as_str().unwrap_or(""),"message":"发现新版本，请前往下载页手动安装"}),
        )
    } else {
        Ok(json!({"status":"current","message":"当前已是最新版本"}))
    }
}

#[cfg(target_os = "macos")]
pub async fn check_updates(app: &tauri::AppHandle, manual: bool) -> Result<(), String> {
    if !manual {
        return Ok(());
    }
    let sh = shared(app);
    let Ok(_guard) = sh.update.try_lock() else {
        return Ok(());
    };
    let previous = snapshot(app)["update"].clone();
    state(app, json!({"status":"checking","message":"正在检查新版本"}));
    let result = async {
        let manifest: Value = sh
            .http
            .get(format!("{RELEASES}stable/latest.json"))
            .header(reqwest::header::CACHE_CONTROL, "no-cache")
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        manual_release(&manifest, env!("CARGO_PKG_VERSION"))
    }
    .await;
    match result {
        Ok(value) => {
            state(app, value);
            Ok(())
        }
        Err(_) => {
            let mut value = failed_check(&previous, true);
            value["message"] = json!("暂时无法检查更新，请连接内网后重试，或前往下载页查看");
            state(app, value);
            Err("检查更新失败".into())
        }
    }
}

// Keep the command registered for compatibility, but reject stale UI / direct IPC installs.
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn install_update(window: WebviewWindow, _app: tauri::AppHandle) -> Result<(), String> {
    trusted(&window)?;
    Err("Mac 版请前往下载页手动安装新版本".into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn manual_checks_do_not_require_platform_packages_or_signatures() {
        let manifest = json!({"version":"0.4.10","notes":"new","platforms":{"windows-x86_64":{}}});
        assert_eq!(
            manual_release(&manifest, "0.4.9").unwrap()["status"],
            "available"
        );
        assert_eq!(
            manual_release(&manifest, "0.4.10").unwrap()["status"],
            "current"
        );
        assert_eq!(
            manual_release(&manifest, "0.5.0").unwrap()["status"],
            "current"
        );
        assert_eq!(
            manual_release(&json!({"version":"0.4.9+other"}), "0.4.9+local").unwrap()["status"],
            "current"
        );
        for manifest in [
            json!({}),
            json!({"version":"oops"}),
            json!({"version":"1.0.0-beta"}),
        ] {
            assert!(manual_release(&manifest, "0.4.9").is_err());
        }
    }
    #[test]
    fn background_failure_preserves_the_pending_letter() {
        let available = json!({"status":"available","version":"0.5.0","notes":"hello"});
        assert_eq!(failed_check(&available, false), available);
        assert_eq!(failed_check(&available, true), available);
        let idle = json!({"status":"idle"});
        assert_eq!(failed_check(&idle, false), idle);
        assert_eq!(failed_check(&idle, true)["status"], "error");
    }
    #[test]
    fn tray_exposes_pending_and_active_updates() {
        assert!(tray_label(&json!({"status":"available","version":"0.5.0"})).contains("0.5.0"));
        assert!(tray_label(&json!({"status":"downloading"})).contains("进度"));
        assert_eq!(tray_label(&json!({"status":"current"})), "检查更新");
    }
}
