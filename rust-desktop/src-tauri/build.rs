fn main() {
    let commands = &[
        "desktop",
        "auth_candidate",
        "check_update",
        "install_update",
    ];
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(commands)),
    )
    .expect("failed to build Tauri application");
}
