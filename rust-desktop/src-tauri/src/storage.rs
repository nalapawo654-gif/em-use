use serde_json::Value;
use std::{fs, path::PathBuf};
use tauri::Manager;
pub fn dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}
pub fn read(app: &tauri::AppHandle, name: &str) -> Option<Value> {
    serde_json::from_slice(&fs::read(dir(app).ok()?.join(name)).ok()?).ok()
}
pub fn write(app: &tauri::AppHandle, name: &str, value: &Value) -> Result<(), String> {
    let dir = dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let temp = dir.join(format!("{name}.tmp"));
    fs::write(&temp, serde_json::to_vec(value).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    fs::rename(temp, dir.join(name)).map_err(|e| e.to_string())
}
fn entry() -> Result<keyring::Entry, keyring::Error> {
    keyring::Entry::new("com.wantwant123.emuse.rust", "official-quota-session")
}
pub fn credentials() -> Option<Value> {
    serde_json::from_str(&entry().ok()?.get_password().ok()?).ok()
}
pub fn save_credentials(v: &Value) -> bool {
    entry().and_then(|e| e.set_password(&v.to_string())).is_ok()
}
pub fn clear_credentials() -> Result<(), String> {
    match entry().and_then(|e| e.delete_credential()) {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("系统凭据未能清除，请重试退出登录".into()),
    }
}
