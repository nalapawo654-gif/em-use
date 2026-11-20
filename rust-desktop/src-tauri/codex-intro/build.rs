use std::{env, fs, path::PathBuf, process::Command};

pub fn prepare() {
    let target = env::var("TARGET").unwrap();
    let os = env::var("CARGO_CFG_TARGET_OS").unwrap();
    if os != "macos" && os != "windows" {
        return;
    }
    let source = PathBuf::from("codex-intro").join(&os);
    println!("cargo:rerun-if-changed={}", source.display());
    println!("cargo:rerun-if-changed=codex-intro/build.rs");
    let out = PathBuf::from(env::var_os("OUT_DIR").unwrap());
    let binaries = PathBuf::from("binaries");
    fs::create_dir_all(&binaries).unwrap();
    let destination = binaries.join(format!("em-use-codex-intro-{target}"));
    if os == "macos" {
        let arch = match env::var("CARGO_CFG_TARGET_ARCH").unwrap().as_str() {
            "aarch64" => "arm64",
            "x86_64" => "x86_64",
            _ => panic!("unsupported macOS architecture"),
        };
        let status = Command::new("xcrun")
            .args(["swiftc", "-swift-version", "5", "-O", "-target"])
            .arg(format!("{arch}-apple-macos12.0"))
            .arg("-module-cache-path")
            .arg(out.join("swift-cache"))
            .arg(source.join("WindowTracking.swift"))
            .arg(source.join("Player.swift"))
            .arg(source.join("Host.swift"))
            .arg(source.join("main.swift"))
            .arg("-o")
            .arg(destination)
            .status()
            .expect("compile macOS Codex intro");
        assert!(status.success(), "Swift player compilation failed");
    } else {
        let compiled = out.join("player");
        let status = Command::new("dotnet")
            .args(["build", "--configuration", "Release", "--output"])
            .arg(&compiled)
            .arg(source.join("Player.csproj"))
            .arg(format!(
                "-p:BaseIntermediateOutputPath={}/",
                out.join("dotnet-obj").display()
            ))
            .status()
            .expect("compile Windows Codex intro");
        assert!(status.success(), "Windows player compilation failed");
        fs::copy(
            compiled.join("Player.exe"),
            destination.with_extension("exe"),
        )
        .unwrap();
    }
}
