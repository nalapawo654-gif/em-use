// The native player has no tray or settings of its own. Closing stdin also
// terminates it if EM Use exits unexpectedly.
use crate::{publish, shared, snapshot};
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, Write},
    process::{Child, Command, Stdio},
    sync::Mutex,
};
use tauri::{AppHandle, Manager};

#[derive(Default)]
pub struct State(Mutex<Option<Child>>);

pub fn enabled(settings: &Value) -> bool {
    cfg!(any(target_os = "macos", windows))
        && settings["codexIntroEnabled"] == true
        && settings["reducedMotion"] != true
}

fn notice(app: &AppHandle, text: Option<&str>) {
    shared(app).inner.lock().unwrap().state["codexIntroNotice"] = json!(text);
}

pub fn shutdown(app: &AppHandle) {
    if let Some(mut child) = app.state::<State>().0.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

pub fn configure(app: &AppHandle) {
    if enabled(&snapshot(app)["settings"]) {
        let _ = command(app, "configure");
    } else {
        shutdown(app);
        notice(app, None);
    }
}

pub fn command(app: &AppHandle, action: &str) -> Result<(), String> {
    let result = send(app, action);
    if let Err(error) = &result {
        notice(app, Some(error));
    }
    publish(app);
    result
}

fn send(app: &AppHandle, action: &str) -> Result<(), String> {
    let state = app.state::<State>();
    let mut process = state.0.lock().unwrap();
    let settings = &snapshot(app)["settings"];
    if !enabled(settings) {
        return Ok(());
    }
    let theme = if settings["codexIntroTheme"] == "emerald" {
        "emerald"
    } else {
        "dragon"
    };
    if let Some(child) = process.as_mut() {
        if child.try_wait().map_err(|e| e.to_string())?.is_some() {
            *process = None;
        }
    }
    if process.is_none() {
        if action == "stop" {
            return Ok(());
        }
        let media = app
            .path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("codex-intro/media");
        if !["dragon.mp4", "emerald.mp4"]
            .iter()
            .all(|name| media.join(name).is_file())
        {
            return Err("缺少 Codex 开屏影片，请检查桌面安装包。".into());
        }
        let binary = std::env::current_exe()
            .map_err(|e| e.to_string())?
            .with_file_name(format!(
                "em-use-codex-intro{}",
                std::env::consts::EXE_SUFFIX
            ));
        let mut child = Command::new(binary)
            .arg(media)
            .arg(theme)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Codex 开屏播放器启动失败：{e}"))?;
        let output = child.stdout.take().unwrap();
        let pid = child.id();
        let handle = app.clone();
        *process = Some(child);
        std::thread::spawn(move || {
            for line in BufReader::new(output).lines().map_while(Result::ok) {
                let message = match line.as_str() {
                    "missing" => Some("请打开或切回 Codex 桌面窗口，再从托盘重播。"),
                    "failed" => Some("开屏影片未能播放，可从托盘重试。"),
                    "playing" => None,
                    _ => continue,
                };
                let state = handle.state::<State>();
                let active = state.0.lock().unwrap();
                if active.as_ref().map(Child::id) != Some(pid) {
                    return;
                }
                notice(&handle, message);
                drop(active);
                publish(&handle);
            }
            // Only report an unexpected exit of the currently registered helper.
            let state = handle.state::<State>();
            let mut active = state.0.lock().unwrap();
            if active.as_ref().map(Child::id) == Some(pid) {
                if let Some(mut child) = active.take() {
                    let _ = child.wait();
                }
                notice(&handle, Some("开屏播放器已退出，可从托盘重播。"));
                drop(active);
                publish(&handle);
            }
        });
    }
    let child = process.as_mut().unwrap();
    let input = child.stdin.as_mut().unwrap();
    let line = if action == "configure" { theme } else { action };
    writeln!(input, "{line}").map_err(|e| format!("播放器未响应：{e}"))?;
    notice(app, None);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn window_intro_is_on_by_default_and_only_gentle_mode_stops_it() {
        let mut settings = crate::model::contract()["defaults"].clone();
        assert_eq!(settings["codexIntroTheme"], "dragon");
        assert_eq!(enabled(&settings), cfg!(any(target_os = "macos", windows)));
        settings["reducedMotion"] = json!(true);
        assert!(!enabled(&settings));
        settings["reducedMotion"] = json!(false);
        settings["codexIntroEnabled"] = json!(false);
        assert!(!enabled(&settings));
    }

    #[test]
    fn stored_off_from_old_default_is_dropped_once() {
        let saved = json!({"codexIntroEnabled":false,"scene":"buddy"});
        let mut first = crate::model::validate(&saved);
        crate::model::migrate_codex_intro(&mut first, false);
        assert!(first.get("codexIntroEnabled").is_none());
        assert_eq!(first["scene"], "buddy");
        let mut later = crate::model::validate(&saved);
        crate::model::migrate_codex_intro(&mut later, true);
        assert_eq!(later["codexIntroEnabled"], false);
    }
}
