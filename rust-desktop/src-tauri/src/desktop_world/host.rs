use super::{win32, *};
use std::time::Instant;
use tauri::{WebviewUrl, WebviewWindowBuilder};
use tokio::sync::{mpsc, oneshot};

enum Message {
    Wake,
    Command {
        action: String,
        done: oneshot::Sender<Result<(), String>>,
    },
    Renderer {
        label: String,
        token: String,
        kind: String,
        request: Option<u64>,
    },
}
struct Service(mpsc::UnboundedSender<Message>);
struct PendingFeed {
    id: u64,
    deadline: Instant,
    done: oneshot::Sender<Result<(), String>>,
}
struct Host {
    window: WebviewWindow,
    desktop: win32::Desktop,
    hwnd: isize,
    rect: [i32; 4],
    token: String,
    initialized: bool,
    ready: bool,
    paused: Option<bool>,
    pointer: Option<[f64; 2]>,
    started: Instant,
    checked: Instant,
}

pub fn start(app: &tauri::AppHandle) {
    let (tx, rx) = mpsc::unbounded_channel();
    app.manage(Service(tx));
    tauri::async_runtime::spawn(run(app.clone(), rx));
}
pub fn wake(app: &tauri::AppHandle) {
    if let Some(service) = app.try_state::<Service>() {
        let _ = service.0.send(Message::Wake);
    }
}
pub async fn command(app: &tauri::AppHandle, action: &str) -> Result<(), String> {
    let (tx, rx) = oneshot::channel();
    app.try_state::<Service>()
        .ok_or("桌面世界服务正在启动")?
        .0
        .send(Message::Command {
            action: action.into(),
            done: tx,
        })
        .map_err(|_| "桌面世界服务已停止")?;
    tokio::time::timeout(Duration::from_secs(8), rx)
        .await
        .map_err(|_| "河床未响应，请重新加载")?
        .map_err(|_| "桌面世界服务已停止")?
}
pub fn renderer_event(
    app: &tauri::AppHandle,
    label: &str,
    token: String,
    kind: String,
    request: Option<u64>,
) -> Result<(), String> {
    app.try_state::<Service>()
        .ok_or("桌面世界服务正在启动")?
        .0
        .send(Message::Renderer {
            label: label.into(),
            token,
            kind,
            request,
        })
        .map_err(|_| "桌面世界服务已停止".into())
}
fn status(app: &tauri::AppHandle, value: &str, message: &str) {
    let next = json!({"supported":true,"status":value,"message":message});
    let changed = {
        let sh = shared(app);
        let mut r = sh.inner.lock().unwrap();
        if r.state["desktopWorld"] == next {
            false
        } else {
            r.state["desktopWorld"] = next;
            true
        }
    };
    if changed {
        publish(app);
        let _ = windows::update_tray(app);
    }
}
fn preferences(app: &tauri::AppHandle) -> (bool, bool, bool) {
    let sh = shared(app);
    let r = sh.inner.lock().unwrap();
    let s = &r.state["settings"];
    (
        s["worldEnabled"] == true,
        s["worldPaused"] == true,
        s["reducedMotion"] == true,
    )
}
fn primary_rect(app: &tauri::AppHandle) -> Result<[i32; 4], String> {
    let monitor = app
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("主显示器不可用")?;
    let p = monitor.position();
    let s = monitor.size();
    Ok([p.x, p.y, s.width as i32, s.height as i32])
}
fn create(app: &tauri::AppHandle) -> Result<Host, String> {
    let desktop = win32::discover()?;
    let rect = primary_rect(app)?;
    let token = uuid::Uuid::new_v4().to_string();
    let label = format!("world-riverbed-{token}");
    let window = WebviewWindowBuilder::new(
        app,
        &label,
        WebviewUrl::App(format!("world.html?token={token}&quality=balanced").into()),
    )
    .title("EM Use · 河床")
    .parent_raw(::windows::Win32::Foundation::HWND(
        desktop.parent as *mut std::ffi::c_void,
    ))
    .inner_size(960., 540.)
    .visible(false)
    .focused(false)
    .focusable(false)
    .decorations(false)
    .shadow(false)
    .resizable(false)
    .skip_taskbar(true)
    .on_navigation(super::local_world_url)
    .build()
    .map_err(|e| format!("河床窗口创建失败：{e}"))?;
    let attach = (|| {
        window
            .set_ignore_cursor_events(true)
            .map_err(|e| e.to_string())?;
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as isize;
        win32::place(desktop, hwnd, rect)?;
        Ok::<_, String>(hwnd)
    })();
    let hwnd = match attach {
        Ok(hwnd) => hwnd,
        Err(error) => {
            let _ = window.destroy();
            return Err(error);
        }
    };
    Ok(Host {
        window,
        desktop,
        hwnd,
        rect,
        token,
        initialized: false,
        ready: false,
        paused: None,
        pointer: None,
        started: Instant::now(),
        checked: Instant::now(),
    })
}
fn control(host: &Host, value: Value) -> Result<(), String> {
    host.window
        .eval(format!("window.worldHost && window.worldHost({value})"))
        .map_err(|_| "河床通信中断，请重新加载".into())
}
fn close(host: &mut Option<Host>, pending: &mut Option<PendingFeed>) {
    if let Some(feed) = pending.take() {
        let _ = feed.done.send(Err("河床已停止，未继续投喂".into()));
    }
    if let Some(host) = host.take() {
        let _ = control(&host, json!({"paused":true,"pointer":null}));
        let _ = host.window.hide();
        let _ = host.window.destroy();
    }
}

async fn run(app: tauri::AppHandle, mut rx: mpsc::UnboundedReceiver<Message>) {
    let mut host: Option<Host> = None;
    let mut pending: Option<PendingFeed> = None;
    let mut fault = false;
    let mut feed_id = 0_u64;
    let mut recovered = false;
    loop {
        if fault {
            close(&mut host, &mut pending);
        }
        let (enabled, paused, gentle) = preferences(&app);
        let delay = if !enabled || fault {
            30_000
        } else if paused || gentle {
            1000
        } else {
            50
        };
        if let Ok(message) = tokio::time::timeout(Duration::from_millis(delay), rx.recv()).await {
            let Some(message) = message else {
                close(&mut host, &mut pending);
                break;
            };
            match message {
                Message::Wake => {}
                Message::Command { action, done } => {
                    let (enabled, paused, gentle) = preferences(&app);
                    if action == "worldRetry" && enabled {
                        close(&mut host, &mut pending);
                        fault = false;
                        recovered = false;
                        let _ = done.send(Ok(()));
                    } else if action == "worldFeed"
                        && enabled
                        && !paused
                        && !gentle
                        && !fault
                        && host.as_ref().is_some_and(|h| h.ready)
                        && pending.is_none()
                    {
                        feed_id += 1;
                        if let Err(error) = control(host.as_ref().unwrap(), json!({"feed":feed_id}))
                        {
                            let _ = done.send(Err(error));
                        } else {
                            pending = Some(PendingFeed {
                                id: feed_id,
                                deadline: Instant::now() + Duration::from_secs(3),
                                done,
                            });
                        }
                    } else {
                        let _ = done.send(Err(
                            "请等待河床运行后再操作；暂停、轻柔模式或加载期间不能投喂".into(),
                        ));
                    }
                }
                Message::Renderer {
                    label,
                    token,
                    kind,
                    request,
                } => {
                    if !preferences(&app).0 {
                        continue;
                    }
                    // Old webviews cannot revive a closed world or acknowledge a newer feed.
                    if let Some(h) = host
                        .as_mut()
                        .filter(|h| h.window.label() == label && h.token == token)
                    {
                        match kind.as_str() {
                            "initialized" => {
                                h.initialized = true;
                                h.ready = false;
                                h.paused = None;
                                if h.window.show().is_err() {
                                    fault = true;
                                    status(&app, "error", "河床窗口无法显示，请重新加载");
                                }
                            }
                            "ready" if h.initialized => {
                                h.ready = true;
                            }
                            "error" => {
                                fault = true;
                                status(&app, "error", "河床渲染失败，请重新加载；若持续失败，请检查 WebView2 与显卡驱动");
                            }
                            "fed" | "feed-rejected"
                                if pending.as_ref().is_some_and(|p| Some(p.id) == request) =>
                            {
                                if let Some(feed) = pending.take() {
                                    let _ = feed.done.send(if kind == "fed" {
                                        Ok(())
                                    } else {
                                        Err("河床当前没有运行，未投喂".into())
                                    });
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
        let (enabled, paused, gentle) = preferences(&app);
        if !enabled {
            close(&mut host, &mut pending);
            fault = false;
            recovered = false;
            status(&app, "off", "河床未开启");
            continue;
        }
        if fault {
            close(&mut host, &mut pending);
            continue;
        }
        if host.is_none() {
            status(&app, "loading", "正在加载河床，首次加载可能需要稍候…");
            match create(&app) {
                Ok(h) => host = Some(h),
                Err(error) => {
                    fault = true;
                    status(&app, "error", &error);
                    continue;
                }
            }
        }
        if pending
            .as_ref()
            .is_some_and(|feed| Instant::now() >= feed.deadline)
        {
            if let Some(feed) = pending.take() {
                let _ = feed.done.send(Err(
                    "未收到投喂确认，请检查河床画面；不会自动重复投喂".into()
                ));
            }
        }
        let h = host.as_mut().unwrap();
        // Explorer can restart without the application. Close the old generation before rebuilding.
        if h.checked.elapsed() >= Duration::from_secs(1) {
            h.checked = Instant::now();
            if !win32::valid(h.desktop, h.hwnd) {
                close(&mut host, &mut pending);
                if recovered {
                    fault = true;
                    status(
                        &app,
                        "error",
                        "桌面层反复断开，请等待资源管理器稳定后重新加载河床",
                    );
                }
                recovered = true;
                continue;
            }
            match primary_rect(&app) {
                Ok(rect) if rect != h.rect => {
                    if let Err(error) = win32::place(h.desktop, h.hwnd, rect) {
                        fault = true;
                        status(&app, "error", &error);
                        continue;
                    }
                    h.rect = rect;
                    h.pointer = None;
                }
                Err(error) => {
                    fault = true;
                    status(&app, "error", &error);
                    continue;
                }
                _ => {}
            }
        }
        if !h.ready && h.started.elapsed() > Duration::from_secs(50) {
            fault = true;
            status(&app, "error", "河床加载超时，请重新加载");
            continue;
        }
        if h.initialized {
            let stopped = paused || gentle;
            let point = if stopped {
                None
            } else {
                win32::pointer(h.desktop, h.rect)
            };
            let result = if h.paused != Some(stopped) {
                h.paused = Some(stopped);
                h.pointer = point;
                control(h, json!({"paused":stopped,"pointer":point}))
            } else if h.pointer != point {
                h.pointer = point;
                control(h, json!({"pointer":point}))
            } else {
                Ok(())
            };
            if let Err(error) = result {
                fault = true;
                status(&app, "error", &error);
                continue;
            }
            if h.ready {
                status(
                    &app,
                    if stopped { "paused" } else { "running" },
                    if gentle {
                        "轻柔模式：河床保持静止"
                    } else if paused {
                        "河床已暂停"
                    } else {
                        "河床正在主显示器运行 · 移动鼠标与鱼群互动"
                    },
                );
            }
        }
    }
}
