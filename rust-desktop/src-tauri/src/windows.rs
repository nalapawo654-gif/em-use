use crate::*;
use model::Bounds;
use tauri::{LogicalPosition, LogicalSize, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_autostart::ManagerExt as _;
#[derive(Clone)]
pub struct Gesture {
    pub id: u64,
    mode: String,
    bounds: Bounds,
    x: f64,
    y: f64,
    scale: f64,
    pub started: i64,
}
pub fn widget(app: &tauri::AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("widget")
        .ok_or("桌宠窗口不可用".into())
}
fn bounds(w: &WebviewWindow) -> Result<Bounds, String> {
    let scale = w.scale_factor().map_err(|e| e.to_string())?;
    let p = w
        .outer_position()
        .map_err(|e| e.to_string())?
        .to_logical::<f64>(scale);
    let s = w
        .inner_size()
        .map_err(|e| e.to_string())?
        .to_logical::<f64>(scale);
    Ok(Bounds {
        x: p.x,
        y: p.y,
        width: s.width,
        height: s.height,
    })
}
fn area(w: &WebviewWindow, cursor: bool) -> Result<Bounds, String> {
    let m = if cursor {
        let p = w.cursor_position().map_err(|e| e.to_string())?;
        w.monitor_from_point(p.x, p.y)
    } else {
        w.current_monitor()
    }
    .map_err(|e| e.to_string())?
    .or(w.primary_monitor().map_err(|e| e.to_string())?)
    .ok_or("屏幕不可用")?;
    let scale = w.scale_factor().map_err(|e| e.to_string())?;
    let a = m.work_area();
    Ok(Bounds {
        x: a.position.x as f64 / scale,
        y: a.position.y as f64 / scale,
        width: a.size.width as f64 / scale,
        height: a.size.height as f64 / scale,
    })
}
fn set_bounds(w: &WebviewWindow, b: Bounds) -> Result<(), String> {
    w.set_size(LogicalSize::new(b.width, b.height))
        .map_err(|e| e.to_string())?;
    w.set_position(LogicalPosition::new(b.x, b.y))
        .map_err(|e| e.to_string())
}
fn persist(app: &tauri::AppHandle) -> Result<(), String> {
    let b = bounds(&widget(app)?)?;
    let sh = shared(app);
    let mut r = sh.inner.lock().unwrap();
    r.state["settings"]["windowWidth"] = json!(b.width.round() as u32);
    storage::write(app, "preferences.json", &r.state["settings"])?;
    storage::write(app, "position.json", &json!({"x":b.x,"y":b.y}))
}
pub fn end_gesture(app: &tauri::AppHandle, id: Option<u64>) -> Result<(), String> {
    let sh = shared(app);
    let mut r = sh.inner.lock().unwrap();
    if r.gesture
        .as_ref()
        .is_some_and(|g| id.is_none() || id == Some(g.id))
    {
        r.gesture = None;
        drop(r);
        persist(app)?;
        publish(app);
    }
    Ok(())
}
pub fn gesture_command(
    app: &tauri::AppHandle,
    w: &WebviewWindow,
    action: &str,
    p: Value,
) -> Result<Value, String> {
    if w.label() != "widget" {
        return Err("Widget only".into());
    }
    match action {
        "beginGesture" => {
            let mode = p.as_str().ok_or("Invalid gesture")?;
            if !["move", "nw", "ne", "sw", "se"].contains(&mode) {
                return Err("Invalid gesture".into());
            }
            end_gesture(app, None)?;
            let b = bounds(w)?;
            let scale = w.scale_factor().map_err(|e| e.to_string())?;
            let c = w.cursor_position().map_err(|e| e.to_string())?;
            let sh = shared(app);
            let mut r = sh.inner.lock().unwrap();
            r.counter += 1;
            let id = r.counter;
            r.gesture = Some(Gesture {
                id,
                mode: mode.into(),
                bounds: b,
                x: c.x,
                y: c.y,
                scale,
                started: now(),
            });
            return Ok(json!(id));
        }
        "moveGesture" => {
            let sh = shared(app);
            let active = sh.inner.lock().unwrap().gesture.clone();
            if let Some(g) = active.as_ref().filter(|g| Some(g.id) == p.as_u64()) {
                let scale = w.scale_factor().map_err(|e| e.to_string())?;
                let c = w.cursor_position().map_err(|e| e.to_string())?;
                set_bounds(
                    w,
                    model::gesture(
                        Bounds {
                            x: g.bounds.x * g.scale / scale,
                            y: g.bounds.y * g.scale / scale,
                            ..g.bounds
                        },
                        (c.x - g.x) / scale,
                        (c.y - g.y) / scale,
                        &g.mode,
                        area(w, g.mode == "move")?,
                    ),
                )?;
            }
        }
        "endGesture" => {
            let id = p.as_u64().ok_or("Invalid gesture id")?;
            end_gesture(app, Some(id))?;
        }
        _ => return Err("Invalid gesture".into()),
    }
    Ok(Value::Null)
}
pub async fn apply_settings(app: &tauri::AppHandle, patch: Value) -> Result<(), String> {
    let shared_state = shared(app);
    let _guard = shared_state.settings_gate.lock().await;
    end_gesture(app, None)?;
    let valid = model::validate(&patch);
    let mut settings = snapshot(app)["settings"].clone();
    model::merge(&mut settings, &valid);
    let w = widget(app)?;
    if valid.get("launchAtLogin").is_some() {
        let auto = app.autolaunch();
        if settings["launchAtLogin"] == true {
            auto.enable()
        } else {
            auto.disable()
        }
        .map_err(|e| e.to_string())?;
    }
    w.set_always_on_top(settings["alwaysOnTop"] == true)
        .map_err(|e| e.to_string())?;
    w.set_ignore_cursor_events(settings["clickThrough"] == true)
        .map_err(|e| e.to_string())?;
    if valid.get("size").is_some() || valid.get("windowWidth").is_some() {
        let width = valid["windowWidth"]
            .as_f64()
            .unwrap_or(match settings["size"].as_str() {
                Some("mini") => 190.,
                Some("compact") => 300.,
                _ => 440.,
            });
        let b = model::fit(
            Bounds {
                width,
                ..bounds(&w)?
            },
            area(&w, false)?,
        );
        set_bounds(&w, b)?;
        settings["windowWidth"] = json!(b.width.round() as u32);
    }
    storage::write(app, "preferences.json", &settings)?;
    shared(app).inner.lock().unwrap().state["settings"] = settings;
    update_tray(app)?;
    publish(app);
    Ok(())
}
pub fn show(app: &tauri::AppHandle) {
    if let Ok(w) = widget(app) {
        let _ = w.show();
        let _ = w.set_focus();
    }
}
pub fn open_settings(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("settings") {
        w.show().map_err(|e| e.to_string())?;
        return w.set_focus().map_err(|e| e.to_string());
    }
    WebviewWindowBuilder::new(
        app,
        "settings",
        WebviewUrl::App("index.html?view=settings".into()),
    )
    .title("桌面小伙伴设置 · EM Use")
    .inner_size(880., 680.)
    .min_inner_size(780., 620.)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}
fn update_tray(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
    let s = snapshot(app);
    let scene = s["settings"]["scene"].as_str().unwrap_or("aquarium");
    let c = model::contract();
    let menu = Menu::new(app).map_err(|e| e.to_string())?;
    let add = |id: &str, label: &str| -> Result<(), String> {
        menu.append(
            &MenuItem::with_id(app, id, label, true, None::<&str>).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())
    };
    add(
        "show",
        &format!("显示{}", c["labels"][scene].as_str().unwrap_or("桌宠")),
    )?;
    let scenes = Submenu::new(app, "陪伴场景", true).map_err(|e| e.to_string())?;
    for id in [
        "aquarium",
        "buddy",
        "beaver",
        "hamster",
        "cultivation",
        "battery",
    ] {
        scenes
            .append(
                &CheckMenuItem::with_id(
                    app,
                    format!("scene:{id}"),
                    c["labels"][id].as_str().unwrap(),
                    true,
                    scene == id,
                    None::<&str>,
                )
                .map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
    }
    menu.append(&scenes).map_err(|e| e.to_string())?;
    add("refresh", "刷新额度")?;
    add("settings", "设置")?;
    add("update", "检查更新")?;
    for (key, label) in [("alwaysOnTop", "置顶显示"), ("clickThrough", "鼠标穿透")] {
        menu.append(
            &CheckMenuItem::with_id(
                app,
                key,
                label,
                true,
                s["settings"][key] == true,
                None::<&str>,
            )
            .map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
    }
    add("dongdong-login", "使用咚咚账户")?;
    add("login", "手动登录 / 切换账户")?;
    add("logout", "退出账户（暂停自动连接）")?;
    menu.append(&PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    add("quit", "退出 EM Use")?;
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle().clone();
    let s = snapshot(&handle);
    let width = s["settings"]["windowWidth"].as_f64().unwrap_or(440.);
    let w = WebviewWindowBuilder::new(
        app,
        "widget",
        WebviewUrl::App("index.html?view=widget".into()),
    )
    .title("EM Use")
    .inner_size(width, width)
    .transparent(true)
    .decorations(false)
    .shadow(false)
    .resizable(false)
    .skip_taskbar(true)
    .always_on_top(s["settings"]["alwaysOnTop"] == true)
    .visible(false)
    .build()?;
    let a = area(&w, false)?;
    let p = storage::read(&handle, "position.json").unwrap_or(Value::Null);
    let b = model::fit(
        Bounds {
            x: p["x"].as_f64().unwrap_or(a.x + a.width - width - 32.),
            y: p["y"].as_f64().unwrap_or(a.y + 60.),
            width,
            height: width,
        },
        a,
    );
    set_bounds(&w, b)?;
    persist(&handle)?;
    w.show()?;
    tauri::tray::TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("EM Use · 桌面小伙伴")
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                tauri::tray::TrayIconEvent::Click {
                    button: tauri::tray::MouseButton::Left,
                    button_state: tauri::tray::MouseButtonState::Up,
                    ..
                }
            ) {
                show(tray.app_handle());
            }
        })
        .on_menu_event(|app, e| {
            let id = e.id.as_ref();
            let result = match id {
                "show" => {
                    show(app);
                    Ok(())
                }
                "settings" => open_settings(app),
                "login" => account::open_login(app),
                "logout" => account::logout(app),
                "dongdong-login" => {
                    let app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = account::login(&app, Some("dongdong")).await;
                    });
                    Ok(())
                }
                "quit" => {
                    app.exit(0);
                    Ok(())
                }
                "refresh" => {
                    tauri::async_runtime::spawn(account::refresh(app.clone(), true));
                    Ok(())
                }
                "update" => {
                    let app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = open_settings(&app);
                        let _ = updates::check_updates(&app).await;
                    });
                    Ok(())
                }
                "alwaysOnTop" | "clickThrough" => {
                    schedule_settings(app, json!({id:snapshot(app)["settings"][id]!=true}));
                    Ok(())
                }
                _ if id.starts_with("scene:") => {
                    schedule_settings(app, json!({"scene":&id[6..]}));
                    Ok(())
                }
                _ => Ok(()),
            };
            if result.is_err() {
                shared(app).inner.lock().unwrap().state["message"] =
                    json!("操作未能完成，请在设置中重试");
                publish(app);
            }
        })
        .build(app)?;
    update_tray(&handle)?;
    Ok(())
}
pub fn maintain(app: &tauri::AppHandle) {
    let expired = shared(app)
        .inner
        .lock()
        .unwrap()
        .gesture
        .as_ref()
        .is_some_and(|g| now() - g.started > 30_000);
    if expired {
        let _ = end_gesture(app, None);
    }
    if let Ok(w) = widget(app) {
        if let (Ok(b), Ok(a)) = (bounds(&w), area(&w, false)) {
            let fitted = model::fit(b, a);
            if b != fitted {
                let _ = set_bounds(&w, fitted);
                let _ = persist(app);
            }
        }
    }
}

fn schedule_settings(app: &tauri::AppHandle, patch: Value) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if apply_settings(&app, patch).await.is_err() {
            shared(&app).inner.lock().unwrap().state["message"] = json!("设置未能保存，请重试");
            publish(&app);
        }
    });
}
