//! A separate wallpaper host. It never receives account/message snapshots or pet gestures.
use crate::*;

pub fn initial_state() -> Value {
    if cfg!(windows) {
        json!({"supported":true,"status":"off","message":"河床未开启"})
    } else {
        json!({"supported":false,"status":"unsupported","message":"桌面世界目前仅支持 Windows"})
    }
}

pub fn validate_platform(patch: &Value) -> Result<(), String> {
    if !cfg!(windows) && patch["worldEnabled"] == true {
        return Err("桌面世界目前仅支持 Windows".into());
    }
    Ok(())
}

#[cfg(windows)]
mod host;
#[cfg(windows)]
mod win32;

pub fn start(app: &tauri::AppHandle) {
    #[cfg(windows)]
    host::start(app);
    #[cfg(not(windows))]
    let _ = app;
}

pub fn settings_changed(app: &tauri::AppHandle) {
    #[cfg(windows)]
    host::wake(app);
    #[cfg(not(windows))]
    let _ = app;
}

pub async fn command(app: &tauri::AppHandle, action: &str) -> Result<(), String> {
    shared(app).inner.lock().unwrap().state["desktopWorldNotice"] = Value::Null;
    publish(app);
    #[cfg(windows)]
    return host::command(app, action).await;
    #[cfg(not(windows))]
    {
        let _ = (app, action);
        Err("桌面世界目前仅支持 Windows".into())
    }
}

// A dedicated, narrow IPC capability; the wallpaper has no access to `desktop`.
#[tauri::command]
pub async fn world_event(
    window: WebviewWindow,
    app: tauri::AppHandle,
    token: String,
    kind: String,
    request: Option<u64>,
) -> Result<(), String> {
    let url = window.url().map_err(|_| "壁纸来源不可用")?;
    if !window.label().starts_with("world-riverbed-")
        || !local_world_url(&url)
        || !matches!(
            kind.as_str(),
            "initialized" | "ready" | "error" | "fed" | "feed-rejected"
        )
    {
        return Err("Untrusted world event".into());
    }
    #[cfg(windows)]
    return host::renderer_event(&app, window.label(), token, kind, request);
    #[cfg(not(windows))]
    {
        let _ = (app, token, kind, request);
        Err("桌面世界目前仅支持 Windows".into())
    }
}

fn local_world_url(url: &tauri::Url) -> bool {
    let local = (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
        || (matches!(url.scheme(), "https" | "http") && url.host_str() == Some("tauri.localhost"))
        || (cfg!(debug_assertions)
            && url.scheme() == "http"
            && matches!(url.host_str(), Some("localhost" | "127.0.0.1"))
            && url.port() == Some(5174));
    local && url.path() == "/world.html"
}

// Physical screen coordinates become normalized coordinates, then CSS pixels in the page.
// This avoids mixing desktop DPI with the WebView's devicePixelRatio.
#[cfg(any(windows, test))]
fn normalized_pointer(rect: [i32; 4], point: [i32; 2]) -> Option<[f64; 2]> {
    let [x, y, width, height] = rect;
    let dx = f64::from(point[0]) - f64::from(x);
    let dy = f64::from(point[1]) - f64::from(y);
    if width <= 0
        || height <= 0
        || dx < 0.
        || dy < 0.
        || dx >= f64::from(width)
        || dy >= f64::from(height)
    {
        None
    } else {
        Some([dx / f64::from(width), dy / f64::from(height)])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pointer_mapping_handles_negative_origins_and_hidpi_without_rounding() {
        assert_eq!(
            normalized_pointer([-3840, -200, 3840, 2160], [-1920, 880]),
            Some([0.5, 0.5])
        );
        assert_eq!(
            normalized_pointer([0, 0, 2560, 1440], [1280, 720]),
            Some([0.5, 0.5])
        );
        for point in [[-1, 10], [2560, 10], [10, 1440]] {
            assert_eq!(normalized_pointer([0, 0, 2560, 1440], point), None);
        }
        assert_eq!(normalized_pointer([0, 0, 0, 0], [0, 0]), None);
    }
    #[test]
    fn wallpaper_navigation_stays_on_its_own_local_page() {
        assert!(local_world_url(
            &"http://tauri.localhost/world.html?token=abc"
                .parse()
                .unwrap()
        ));
        for url in [
            "https://example.com/world.html",
            "http://tauri.localhost/index.html",
            "https://evil.test/?world.html",
            "file:///world.html",
        ] {
            assert!(!local_world_url(&url.parse().unwrap()));
        }
    }
    #[test]
    fn world_preferences_are_validated_without_changing_pet_or_account_settings() {
        let patch = model::validate(
            &json!({"worldEnabled":true,"worldPaused":true,"scene":"bad","token":"secret"}),
        );
        assert_eq!(patch, json!({"worldEnabled":true,"worldPaused":true}));
        assert_eq!(
            model::validate(&json!({"worldEnabled":"true","worldPaused":1})),
            json!({})
        );
        let mut settings = model::contract()["defaults"].clone();
        let scene = settings["scene"].clone();
        model::merge(&mut settings, &patch);
        assert_eq!(settings["scene"], scene);
        assert_eq!(settings["worldPaused"], true);
    }
}
