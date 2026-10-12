fn main() {
    let commands = &[
        "desktop",
        "world_event",
        "auth_candidate",
        "check_update",
        "install_update",
        "dismiss_update",
    ];
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(commands)),
    )
    .expect("failed to build Tauri application");
}
