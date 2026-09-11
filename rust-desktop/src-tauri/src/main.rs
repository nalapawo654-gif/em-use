#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod account;
mod dongdong;
mod model;
mod storage;
mod updates;
mod windows;
use model::now;
use serde_json::{json, Value};
use std::{collections::HashSet, sync::Mutex, time::Duration};
use tauri::{Emitter, Manager, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
const PORTAL: &str = "https://aihub.eastmoney.com/personal";
const RELEASES: &str = "http://172.27.12.77:5500/em-use/";
struct Runtime {
    state: Value,
    auth: Option<Value>,
    login_mode: account::LoginMode,
    login_id: String,
    dong_fingerprint: Option<String>,
    generation: u64,
    last_refresh: i64,
    next_attempt: i64,
    failures: u32,
    gesture: Option<windows::Gesture>,
    counter: u64,
    notified: HashSet<String>,
}
struct Shared {
    inner: Mutex<Runtime>,
    settings_gate: tokio::sync::Mutex<()>,
    http: reqwest::Client,
    update: tokio::sync::Mutex<Option<tauri_plugin_updater::Update>>,
}
fn shared(app: &tauri::AppHandle) -> tauri::State<'_, Shared> {
    app.state::<Shared>()
}
fn snapshot(app: &tauri::AppHandle) -> Value {
    shared(app).inner.lock().unwrap().state.clone()
}
fn publish(app: &tauri::AppHandle) {
    let s = snapshot(app);
    for label in ["widget", "settings"] {
        let _ = app.emit_to(label, "state:changed", &s);
    }
}
fn trusted(w: &WebviewWindow) -> Result<(), String> {
    let url = w.url().map_err(|e| e.to_string())?;
    let local = matches!(url.scheme(), "tauri" | "https" | "http")
        && (url.host_str() == Some("tauri.localhost")
            || url.scheme() == "tauri"
            || (cfg!(debug_assertions)
                && matches!(url.host_str(), Some("localhost" | "127.0.0.1"))
                && url.port() == Some(5174)));
    if matches!(w.label(), "widget" | "settings") && local {
        Ok(())
    } else {
        Err("Untrusted window".into())
    }
}
#[tauri::command]
async fn desktop(
    window: WebviewWindow,
    app: tauri::AppHandle,
    action: String,
    payload: Option<Value>,
) -> Result<Value, String> {
    trusted(&window)?;
    let p = payload.unwrap_or(Value::Null);
    match action.as_str() {
        "getState" => return Ok(snapshot(&app)),
        "login" => account::login(&app, p.as_str()).await?,
        "refresh" => account::refresh(app.clone(), true).await,
        "logout" => account::logout(&app)?,
        "settings" => windows::apply_settings(&app, p).await?,
        "openSettings" => windows::open_settings(&app)?,
        "hide" => {
            window.hide().map_err(|e| e.to_string())?;
        }
        "quit" => app.exit(0),
        "openPortal" => app
            .opener()
            .open_url(PORTAL, None::<&str>)
            .map_err(|e| e.to_string())?,
        "openReleases" => app
            .opener()
            .open_url(RELEASES, None::<&str>)
            .map_err(|e| e.to_string())?,
        "beginGesture" | "moveGesture" | "endGesture" => {
            return windows::gesture_command(&app, &window, &action, p)
        }
        "screenshot" => {
            use base64::Engine;
            let encoded = p
                .as_str()
                .filter(|s| s.len() < 32 * 1024 * 1024)
                .ok_or("Invalid screenshot")?;
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(encoded)
                .map_err(|_| "Invalid PNG")?;
            if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
                return Err("Invalid PNG".into());
            }
            let file = app
                .dialog()
                .file()
                .set_file_name("EM-Use.png")
                .add_filter("PNG", &["png"])
                .blocking_save_file();
            if let Some(file) = file {
                let path = file.into_path().map_err(|e| e.to_string())?;
                std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
                return Ok(json!(path.to_string_lossy()));
            }
        }
        _ => return Err("Unknown desktop action".into()),
    }
    Ok(Value::Null)
}
fn main() {
    let state = json!({"status":"signed-out","quota":null,"message":"登录后，让小伙伴陪你看额度","syncing":false,"settings":model::contract()["defaults"],"version":env!("CARGO_PKG_VERSION"),"persistentLogin":false,"loginOpen":false,"update":{"status":"idle","message":"尚未检查更新"}});
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            windows::show(app)
        }))
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Shared {
            inner: Mutex::new(Runtime {
                state,
                auth: None,
                login_mode: account::LoginMode::SignedOut,
                login_id: String::new(),
                dong_fingerprint: None,
                generation: 0,
                last_refresh: 0,
                next_attempt: 0,
                failures: 0,
                gesture: None,
                counter: 0,
                notified: HashSet::new(),
            }),
            settings_gate: tokio::sync::Mutex::new(()),
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .unwrap(),
            update: tokio::sync::Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            desktop,
            account::auth_candidate,
            updates::check_update,
            updates::install_update
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            {
                let sh = shared(&handle);
                let mut r = sh.inner.lock().unwrap();
                if let Some(saved) = storage::read(&handle, "preferences.json") {
                    let valid = model::validate(&saved);
                    if valid.get("windowWidth").is_none() {
                        if let Some(size) = valid["size"].as_str() {
                            r.state["settings"]["windowWidth"] =
                                model::contract()["presets"][size].clone();
                        }
                    }
                    model::merge(&mut r.state["settings"], &valid);
                }
                r.state["settings"]["clickThrough"] = json!(false);
            }
            account::restore(&handle);
            windows::setup(app)?;
            tauri::async_runtime::spawn(async move {
                account::refresh(handle.clone(), true).await;
                let update_app = handle.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(Duration::from_secs(10)).await;
                    let _ = updates::check_updates(&update_app).await;
                });
                let mut last = now();
                let mut update_at = now();
                loop {
                    tokio::time::sleep(Duration::from_secs(15)).await;
                    {
                        let sh = shared(&handle);
                        let mut r = sh.inner.lock().unwrap();
                        if now() - last > 45_000 || model::day(now()) != model::day(last) {
                            r.next_attempt = 0;
                        }
                        account::reconcile(&mut r);
                    }
                    last = now();
                    publish(&handle);
                    windows::maintain(&handle);
                    account::refresh(handle.clone(), false).await;
                    if now() - update_at > 6 * 3600_000 {
                        let _ = updates::check_updates(&handle).await;
                        update_at = now();
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|w, event| {
            let app = w.app_handle();
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } if w.label() == "widget" => {
                    api.prevent_close();
                    let _ = windows::end_gesture(app, None);
                    let _ = w.hide();
                }
                tauri::WindowEvent::Focused(false) if w.label() == "widget" => {
                    let _ = windows::end_gesture(app, None);
                }
                tauri::WindowEvent::Destroyed if w.label() == "login" => {
                    account::login_closed(app);
                }
                _ => (),
            }
        })
        .build(tauri::generate_context!())
        .expect("EM Use 启动失败")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                windows::show(_app);
            }
        });
}
