//! One bounded, account-free introduction per process. Never gates account/network work.
use crate::*;
use tauri::{WebviewUrl, WebviewWindowBuilder};

#[derive(Default)]
struct Gate {
    started: bool,
    ended: bool,
    ready: bool,
    revealed: bool,
}
impl Gate {
    fn reveal(&mut self, force: bool) -> bool {
        if self.started && !self.revealed && (force || (self.ended && self.ready)) {
            self.revealed = true;
            true
        } else {
            false
        }
    }
}
#[derive(Default)]
pub struct State(Mutex<Gate>);
fn eligible(settings: &Value, autostart: bool) -> bool {
    settings["startupAnimation"] == true && settings["reducedMotion"] != true && !autostart
}
fn local(url: &tauri::Url, path: &str) -> bool {
    let origin = (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
        || (matches!(url.scheme(), "http" | "https") && url.host_str() == Some("tauri.localhost"))
        || (cfg!(debug_assertions)
            && url.scheme() == "http"
            && matches!(url.host_str(), Some("localhost" | "127.0.0.1"))
            && url.port() == Some(5174));
    origin && url.path() == path
}
fn trusted_event(label: &str, url: &tauri::Url, kind: &str) -> bool {
    (label == "widget" && local(url, "/index.html") && kind == "widget-ready")
        || (label == "startup"
            && local(url, "/startup.html")
            && matches!(kind, "playing" | "finish"))
}
fn reveal(app: &tauri::AppHandle, force: bool) {
    let should = app.state::<State>().0.lock().unwrap().reveal(force);
    if should {
        if let Some(w) = app.get_webview_window("widget") {
            let _ = w.show(); // Do not steal keyboard focus from the user's other applications.
        }
        if let Some(w) = app.get_webview_window("startup") {
            let _ = w.destroy();
        }
    }
}
pub fn finish(app: &tauri::AppHandle) {
    app.state::<State>().0.lock().unwrap().ended = true;
    reveal(app, false);
}
// Explicit tray/reopen actions take precedence over the intro and its late callbacks.
pub fn cancel(app: &tauri::AppHandle) {
    {
        let state = app.state::<State>();
        let mut gate = state.0.lock().unwrap();
        gate.ended = true;
        gate.revealed = true;
    }
    if let Some(w) = app.get_webview_window("startup") {
        let _ = w.destroy();
    }
}
pub fn start(app: &tauri::AppHandle) {
    // A very early single-instance/dock activation may already have requested the pet.
    if app.state::<State>().0.lock().unwrap().revealed {
        if let Some(w) = app.get_webview_window("widget") {
            let _ = w.show();
        }
        return;
    }
    let play = eligible(
        &snapshot(app)["settings"],
        std::env::args().any(|a| a == "--autostart"),
    );
    {
        let state = app.state::<State>();
        let mut gate = state.0.lock().unwrap();
        gate.started = true;
        gate.ended = !play;
    }
    // The native watchdog works even when the page, video or renderer IPC cannot start.
    let watchdog = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(6)).await;
        reveal(&watchdog, true);
    });
    if !play {
        reveal(app, false);
        return;
    }
    let result = WebviewWindowBuilder::new(app, "startup", WebviewUrl::App("startup.html".into()))
        .title("EM Use · 小世界，即将苏醒")
        .inner_size(720., 405.)
        .center()
        .decorations(false)
        .resizable(false)
        .shadow(true)
        .skip_taskbar(true)
        .focused(false)
        .visible(false)
        .on_navigation(|url| local(url, "/startup.html"))
        .build();
    if result.is_err() {
        finish(app);
    }
}
#[tauri::command]
pub async fn startup_event(
    window: WebviewWindow,
    app: tauri::AppHandle,
    kind: String,
) -> Result<(), String> {
    if !trusted_event(
        window.label(),
        &window.url().map_err(|e| e.to_string())?,
        &kind,
    ) {
        return Err("Untrusted startup event".into());
    }
    match kind.as_str() {
        "widget-ready" => {
            app.state::<State>().0.lock().unwrap().ready = true;
            reveal(&app, false);
        }
        "finish" => finish(&app),
        "playing" => {
            let active = {
                let state = app.state::<State>();
                let gate = state.0.lock().unwrap();
                gate.started && !gate.ended && !gate.revealed
            };
            if active {
                window.show().map_err(|e| e.to_string())?;
                let _ = window.set_focus(); // Manual launch: make Esc immediately available.
            }
        }
        _ => unreachable!(),
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn handoff_waits_for_both_renderers_in_either_order_and_happens_once() {
        let mut g = Gate {
            started: true,
            ..Default::default()
        };
        g.ended = true;
        assert!(!g.reveal(false));
        g.ready = true;
        assert!(g.reveal(false));
        assert!(!g.reveal(true));
        let mut g = Gate {
            started: true,
            ready: true,
            ..Default::default()
        };
        assert!(!g.reveal(false));
        g.ended = true;
        assert!(g.reveal(false));
    }
    #[test]
    fn watchdog_recovers_missing_callbacks_but_cannot_reopen_a_dismissed_pet() {
        let mut g = Gate {
            started: true,
            ..Default::default()
        };
        assert!(g.reveal(true));
        g.ready = true;
        g.ended = true;
        assert!(!g.reveal(false));
        assert!(!g.reveal(true));
    }
    #[test]
    fn settings_and_autostart_skip_animation() {
        let mut s = model::contract()["defaults"].clone();
        assert!(eligible(&s, false));
        assert!(!eligible(&s, true));
        s["reducedMotion"] = json!(true);
        assert!(!eligible(&s, false));
        s["reducedMotion"] = json!(false);
        s["startupAnimation"] = json!(false);
        assert!(!eligible(&s, false));
        assert_eq!(
            model::validate(&json!({"startupAnimation":"true"})),
            json!({})
        );
    }
    #[test]
    fn intro_has_no_general_ipc_and_only_its_own_events() {
        let intro = "http://tauri.localhost/startup.html".parse().unwrap();
        let widget = "tauri://localhost/index.html?view=widget".parse().unwrap();
        assert!(trusted_event("startup", &intro, "finish"));
        assert!(trusted_event("widget", &widget, "widget-ready"));
        assert!(!trusted_event("settings", &intro, "finish"));
        assert!(!trusted_event("startup", &intro, "widget-ready"));
        assert!(!trusted_event("startup", &widget, "finish"));
        assert!(!trusted_event(
            "startup",
            &"https://evil.test/startup.html".parse().unwrap(),
            "finish"
        ));
    }
}
