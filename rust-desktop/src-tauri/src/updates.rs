use crate::*;
use tauri_plugin_updater::UpdaterExt;
fn state(app: &tauri::AppHandle, v: Value) {
    shared(app).inner.lock().unwrap().state["update"] = v;
    publish(app);
}
#[tauri::command]
pub async fn check_update(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    trusted(&window)?;
    check_updates(&app).await
}
pub async fn check_updates(app: &tauri::AppHandle) -> Result<(), String> {
    let sh = shared(app);
    let Ok(mut slot) = sh.update.try_lock() else {
        return Ok(());
    };
    state(app, json!({"status":"checking","message":"正在检查新版本"}));
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
            state(
                app,
                json!({"status":"available","version":update.version,"notes":update.body,"message":"发现新版本，可下载并安装"}),
            );
            *slot = Some(update);
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
            *slot = None;
            state(
                app,
                json!({"status":"error","message":"暂时无法检查更新，请确认已连接内网且服务器已上传版本清单"}),
            );
            Err("检查更新失败".into())
        }
    }
}
#[tauri::command]
pub async fn install_update(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    trusted(&window)?;
    let sh = shared(&app);
    let mut slot = sh.update.try_lock().map_err(|_| "更新正在进行")?;
    let update = slot.as_ref().ok_or("请先检查更新")?;
    state(
        &app,
        json!({"status":"downloading","version":update.version,"message":"正在下载更新，完成后将重启应用"}),
    );
    let mut downloaded = 0_u64;
    let result=update.download_and_install(|size,total|{downloaded+=size as u64;state(&app,json!({"status":"downloading","downloaded":downloaded,"total":total,"message":"正在下载并校验更新"}));},||{state(&app,json!({"status":"installing","message":"签名校验通过，正在安装"}));}).await;
    match result {
        Ok(()) => {
            *slot = None;
            app.restart();
        }
        Err(_) => {
            state(
                &app,
                json!({"status":"error","message":"更新失败，原版本仍可使用；请重新检查或手动下载"}),
            );
            Err("更新未安装".into())
        }
    }
}
