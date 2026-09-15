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
    let previous_scene = settings["scene"].clone();
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
    let scene_changed = settings["scene"] != previous_scene;
    shared(app).inner.lock().unwrap().state["settings"] = settings;
    if scene_changed {
        if let Some(panel) = app.get_webview_window("calendar") {
            let _ = panel.close();
        }
        calendar::dismiss(app);
    }
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
    settings_window(app, "")
}
pub fn open_updates(app: &tauri::AppHandle) -> Result<(), String> {
    settings_window(app, "updates")
}
pub fn open_messages(app: &tauri::AppHandle) -> Result<(), String> {
    settings_window(app, "messages")
}
// A separate card stays readable even with a 180px pet; prefer the free side of the pet.
// Keep the transient bubble outside the pet window without activating it.
pub fn message_toast(app: &tauri::AppHandle, selection: &Value) -> Result<(), String> {
    if calendar_panel_open(app) || !shared(app).calendar.lock().unwrap().active.is_empty() {
        return Ok(());
    }
    let state = snapshot(app);
    let valid = state["settings"]["messageEnabled"] == true
        && state["messages"]["status"] == "ready"
        && selection["epoch"] == state["messages"]["epoch"]
        && state["messages"]["items"]
            .as_array()
            .is_some_and(|items| items.iter().any(|i| i["key"] == selection["key"]));
    if !valid {
        return Err("Message source changed".into());
    }
    let pet = widget(app)?;
    let b = bounds(&pet)?;
    let screen = area(&pet, false)?;
    let toast = message_popup_bounds(b, screen, 284., 96., b.height * 0.12);
    let side = if toast.x >= b.x + b.width {
        "right"
    } else {
        "left"
    };
    let w = if let Some(w) = app.get_webview_window("message-toast") {
        w
    } else {
        WebviewWindowBuilder::new(
            app,
            "message-toast",
            WebviewUrl::App("index.html?view=message-toast".into()),
        )
        .title("咚咚新消息 · EM Use")
        .inner_size(toast.width, toast.height)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .resizable(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .focused(false)
        .focusable(false)
        .accept_first_mouse(true)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())?
    };
    set_bounds(&w, toast)?;
    *shared(app).message_toast.lock().unwrap() =
        Some(json!({"epoch": selection["epoch"], "key": selection["key"], "side": side}));
    publish(app);
    w.show().map_err(|e| e.to_string())
}
pub fn hide_message_toast(app: &tauri::AppHandle, notify: bool) {
    *shared(app).message_toast.lock().unwrap() = None;
    if let Some(w) = app.get_webview_window("message-toast") {
        let _ = w.hide();
    }
    publish(app);
    if notify {
        let _ = app.emit_to("widget", "messages:toast-closed", ());
    }
}
pub fn message_panel(app: &tauri::AppHandle) -> Result<(), String> {
    let pet = widget(app)?;
    let b = bounds(&pet)?;
    let a = area(&pet, false)?;
    let count = snapshot(app)["messages"]["items"]
        .as_array()
        .map_or(0, Vec::len);
    let card = message_panel_bounds(b, a, count);
    let w = if let Some(w) = app.get_webview_window("messages") {
        w
    } else {
        let w = WebviewWindowBuilder::new(
            app,
            "messages",
            WebviewUrl::App("index.html?view=messages".into()),
        )
        .title("咚咚消息 · EM Use")
        .inner_size(card.width, card.height)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .resizable(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .focused(false)
        .visible(false)
        .build()
        .map_err(|e| format!("创建消息窗口失败：{e}"))?;
        install_message_panel_focus(&w);
        w
    };
    set_bounds(&w, card).map_err(|e| format!("定位消息窗口失败：{e}"))?;
    w.show().map_err(|e| format!("显示消息窗口失败：{e}"))?;
    w.set_focus().map_err(|e| format!("激活消息窗口失败：{e}"))
}

// Calendar shares the same screen-edge placement and native focus lifecycle as messages.
pub fn calendar_panel_open(app: &tauri::AppHandle) -> bool {
    app.get_webview_window("calendar")
        .is_some_and(|w| w.is_visible().unwrap_or(false))
}
pub fn hide_calendar_toast(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("calendar-toast") {
        let _ = w.hide();
    }
}
pub fn calendar_popup(app: &tauri::AppHandle, panel: bool) -> Result<(), String> {
    let pet = widget(app)?;
    let b = bounds(&pet)?;
    let screen = area(&pet, false)?;
    let rect = message_popup_bounds(
        b,
        screen,
        if panel { 380. } else { 360. },
        if panel { 460. } else { 260. },
        b.height * 0.12,
    );
    let label = if panel { "calendar" } else { "calendar-toast" };
    if panel {
        if let Some(w) = app.get_webview_window("messages") {
            let _ = w.close();
        }
    } else if app
        .get_webview_window("messages")
        .is_some_and(|w| w.is_visible().unwrap_or(false))
    {
        return Err("正在查看消息，稍后提醒".into());
    }
    hide_message_toast(app, true);
    let w = if let Some(w) = app.get_webview_window(label) {
        w
    } else {
        let w = WebviewWindowBuilder::new(
            app,
            label,
            WebviewUrl::App(format!("index.html?view={label}").into()),
        )
        .title(if panel {
            "今日日程 · EM Use"
        } else {
            "日程提醒 · EM Use"
        })
        .inner_size(rect.width, rect.height)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .resizable(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .focused(false)
        .focusable(panel)
        .accept_first_mouse(true)
        .visible(false)
        .build()
        .map_err(|e| format!("创建日程窗口失败：{e}"))?;
        if panel {
            install_message_panel_focus(&w);
        }
        w
    };
    set_bounds(&w, rect)?;
    publish(app);
    w.show().map_err(|e| e.to_string())?;
    if panel {
        w.set_focus().map_err(|e| e.to_string())?;
        let _ = app.emit_to("widget", "calendar:opened", ());
    }
    Ok(())
}

fn install_message_panel_focus(window: &WebviewWindow) {
    let focus = std::sync::Arc::new(Mutex::new(message_panel_focus::MessagePanelFocus::default()));
    let window_handle = window.clone();
    window.on_window_event(move |event| match event {
        tauri::WindowEvent::Focused(focused) => {
            let check = focus.lock().unwrap().changed(*focused);
            if let Some(revision) = check {
                let focus = focus.clone();
                let window = window_handle.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(Duration::from_millis(200)).await;
                    // Check the host window, not just WebView2's transient LostFocus.
                    // Each window owns its guard, so a destroyed card's timer cannot
                    // close a newly created card with the same label.
                    let focused = message_panel_is_focused(&window);
                    let close = focus.lock().unwrap().should_close(revision, focused);
                    if close {
                        let _ = window.close();
                    }
                });
            }
        }
        tauri::WindowEvent::Destroyed => focus.lock().unwrap().destroyed(),
        _ => (),
    });
}

#[cfg(windows)]
fn message_panel_is_focused(window: &WebviewWindow) -> Result<bool, ()> {
    let hwnd = window.hwnd().map_err(|_| ())?;
    // Tauri's Windows is_focused also tracks keyboard focus, which can belong
    // to a WebView2 child. Compare the top-level foreground window instead.
    let foreground = unsafe { ::windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow() };
    if foreground.0.is_null() {
        Err(()) // Activation is still changing; this is not a confirmed blur.
    } else {
        Ok(foreground == hwnd)
    }
}

#[cfg(not(windows))]
fn message_panel_is_focused(window: &WebviewWindow) -> Result<bool, ()> {
    window.is_focused().map_err(|_| ())
}

fn message_panel_bounds(pet: Bounds, screen: Bounds, count: usize) -> Bounds {
    message_popup_bounds(pet, screen, 350., if count <= 1 { 240. } else { 360. }, 24.)
}
fn message_popup_bounds(
    pet: Bounds,
    screen: Bounds,
    width: f64,
    height: f64,
    offset: f64,
) -> Bounds {
    let width = width.min(screen.width);
    let height = height.min(screen.height);
    let right = pet.x + pet.width + 8.;
    let left = pet.x - width - 8.;
    let x = if right + width <= screen.x + screen.width {
        right
    } else {
        left
    };
    Bounds {
        x: x.clamp(screen.x, screen.x + screen.width - width),
        y: (pet.y + offset).clamp(screen.y, screen.y + screen.height - height),
        width,
        height,
    }
}

fn settings_window(app: &tauri::AppHandle, tab: &str) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("settings") {
        if !tab.is_empty() {
            app.emit_to("settings", &format!("settings:{tab}"), ())
                .map_err(|e| e.to_string())?;
        }
        w.show().map_err(|e| e.to_string())?;
        return w.set_focus().map_err(|e| e.to_string());
    }
    WebviewWindowBuilder::new(
        app,
        "settings",
        WebviewUrl::App(
            if tab == "updates" {
                "index.html?view=settings&tab=updates"
            } else if tab == "messages" {
                "index.html?view=settings&tab=messages"
            } else {
                "index.html?view=settings"
            }
            .into(),
        ),
    )
    .title("桌面小伙伴设置 · EM Use")
    .inner_size(880., 680.)
    .min_inner_size(780., 620.)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}
pub fn update_tray(app: &tauri::AppHandle) -> Result<(), String> {
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
        "feidudu",
        "dinosaur",
        "fox",
        "luckycat",
        "skadi",
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
    add("messages", "咚咚消息")?;
    add("calendar", "今日日程")?;
    let update_label = updates::tray_label(&s["update"]);
    add("update", &update_label)?;
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
    add("dongdong-login", "额度：使用咚咚账户")?;
    add("login", "额度：手动登录 / 切换账户")?;
    add("logout", "退出额度账户（消息不受影响）")?;
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
                "messages" => open_messages(app),
                "calendar" => calendar_popup(app, true),
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
                        let _ = open_updates(&app);
                        if snapshot(&app)["update"]["status"] != "available" {
                            let _ = updates::check_updates(&app, true).await;
                        }
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

#[cfg(test)]
mod message_panel_tests {
    use super::*;
    #[test]
    fn toast_is_outside_all_pet_sizes_on_either_monitor_edge() {
        let screen = Bounds {
            x: -1920.,
            y: 24.,
            width: 1920.,
            height: 1056.,
        };
        for size in [190., 300., 440., 800.] {
            for x in [-1920., -size] {
                let pet = Bounds {
                    x,
                    y: 24.,
                    width: size,
                    height: size,
                };
                let toast = message_popup_bounds(pet, screen, 284., 96., size * 0.12);
                assert!(toast.x >= screen.x && toast.x + toast.width <= screen.x + screen.width);
                assert!(toast.y >= screen.y && toast.y + toast.height <= screen.y + screen.height);
                assert!(toast.x + toast.width <= pet.x || toast.x >= pet.x + pet.width);
            }
        }
    }
    #[test]
    fn card_avoids_pet_and_fits_offset_monitor() {
        let screen = Bounds {
            x: -1920.,
            y: 24.,
            width: 1920.,
            height: 1056.,
        };
        for x in [-1900., -500.] {
            let pet = Bounds {
                x,
                y: 900.,
                width: 440.,
                height: 440.,
            };
            let c = message_panel_bounds(pet, screen, 3);
            assert!(c.x >= screen.x && c.x + c.width <= screen.x + screen.width);
            assert!(c.y >= screen.y && c.y + c.height <= screen.y + screen.height);
            assert!(c.x + c.width <= pet.x || c.x >= pet.x + pet.width);
        }
    }
    #[test]
    fn single_message_card_is_compact() {
        let screen = Bounds {
            x: 0.,
            y: 0.,
            width: 1920.,
            height: 1080.,
        };
        let pet = Bounds {
            x: 20.,
            y: 20.,
            width: 190.,
            height: 190.,
        };
        assert_eq!(message_panel_bounds(pet, screen, 1).height, 240.);
        assert_eq!(message_panel_bounds(pet, screen, 3).height, 360.);
    }
}
