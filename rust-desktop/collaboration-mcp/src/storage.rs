//! Per-client binding metadata; credentials use the OS keyring by default.
//! The explicit Unix file backend is for headless/test environments only.
use crate::client::Bound;
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

#[derive(Serialize, Deserialize)]
pub(crate) struct Binding {
    pub server_url: String,
    pub host_kind: String,
    pub label: String,
    pub bind_code_hash: String,
    pub credential_store: String,
    pub identity: Bound,
}

fn sidecar(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(format!(".{suffix}"));
    PathBuf::from(name)
}

pub(crate) fn digest(value: &str) -> String {
    hex::encode(Sha256::digest(value.as_bytes()))
}

pub(crate) fn normalize_server(value: &str) -> Result<String> {
    let url = reqwest::Url::parse(value)?;
    let loopback = matches!(
        url.host_str(),
        Some("localhost" | "127.0.0.1" | "[::1]" | "::1")
    );
    if !(url.scheme() == "https" || (url.scheme() == "http" && loopback))
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.path() != "/"
    {
        bail!("服务地址必须为 HTTPS origin；仅本机回环地址允许 HTTP，不接受账号、路径、查询或片段");
    }
    Ok(url.as_str().trim_end_matches('/').to_string())
}

pub(crate) fn state_path() -> Result<PathBuf> {
    if let Ok(path) = std::env::var("EM_USE_STATE_FILE") {
        if path.is_empty() {
            bail!("EM_USE_STATE_FILE 不能为空");
        }
        return Ok(PathBuf::from(path));
    }
    let profile = std::env::var("EM_USE_PROFILE").context(
        "为每个宿主/房间设置独立 EM_USE_PROFILE，或显式设置 EM_USE_STATE_FILE；不再共享默认身份",
    )?;
    if profile.is_empty()
        || profile.len() > 64
        || !profile
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        bail!("EM_USE_PROFILE 只能使用 1–64 个字母、数字、-、_");
    }
    let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE"))?;
    Ok(PathBuf::from(home)
        .join(".em-use")
        .join("profiles")
        .join(profile)
        .join("binding.json"))
}

pub(crate) fn credential_store() -> Result<String> {
    let store = std::env::var("EM_USE_CREDENTIAL_STORE").unwrap_or_else(|_| "keyring".into());
    if store != "keyring" && !(cfg!(unix) && store == "file") {
        bail!("凭据存储只支持 keyring；Unix 无桌面环境可显式选择 file（0600）");
    }
    if store == "keyring" && !cfg!(any(target_os = "macos", target_os = "windows")) {
        bail!("此平台请显式配置 EM_USE_CREDENTIAL_STORE=file 使用 Unix 0600 凭据文件");
    }
    Ok(store)
}

fn check_file(path: &Path) -> Result<()> {
    let meta = fs::symlink_metadata(path)?;
    if !meta.file_type().is_file() {
        bail!("拒绝读取符号链接或非普通绑定文件");
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if meta.permissions().mode() & 0o077 != 0 {
            bail!("绑定/凭据文件权限过宽；先撤销旧令牌并重新绑定到私有文件");
        }
    }
    Ok(())
}

pub(crate) fn prepare(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
        #[cfg(unix)]
        {
            use std::os::unix::fs::DirBuilderExt;
            fs::DirBuilder::new()
                .recursive(true)
                .mode(0o700)
                .create(parent)?;
        }
        #[cfg(not(unix))]
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

pub(crate) fn lock(path: &Path) -> Result<File> {
    prepare(path)?;
    let lock_path = sidecar(path, "lock");
    if lock_path.exists() {
        check_file(&lock_path)?;
    }
    let mut options = OpenOptions::new();
    options.create(true).read(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let file = options.open(lock_path)?;
    fs2::FileExt::try_lock_exclusive(&file)
        .context("此 profile 正在绑定；请等待完成，其他 Agent 使用不同 profile")?;
    Ok(file)
}

fn atomic_write(path: &Path, data: &[u8]) -> Result<()> {
    prepare(path)?;
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let mut temp = tempfile::NamedTempFile::new_in(parent)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        temp.as_file()
            .set_permissions(fs::Permissions::from_mode(0o600))?;
    }
    temp.write_all(data)?;
    temp.as_file().sync_all()?;
    temp.persist(path).map_err(|err| err.error)?;
    Ok(())
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn entry(path: &Path, server: &str) -> Result<keyring::Entry> {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()?.join(path)
    };
    Ok(keyring::Entry::new(
        "em-use-collaboration",
        &digest(&format!("{}|{}", server, absolute.display())),
    )?)
}

pub(crate) fn load(path: &Path, server: &str, store: &str) -> Result<Option<Binding>> {
    if !path.try_exists()? {
        return Ok(None);
    }
    check_file(path)?;
    let mut binding: Binding = serde_json::from_slice(&fs::read(path)?)
        .context("旧版或损坏的绑定文件；请撤销旧 Agent 并用新 profile 重新绑定")?;
    if binding.server_url != server || binding.credential_store != store {
        bail!("绑定属于其他服务端或凭据存储；禁止复用令牌，请创建独立 profile");
    }
    binding.identity.agent_token = if store == "file" {
        let secret = sidecar(path, "credential");
        check_file(&secret)?;
        fs::read_to_string(secret)?
    } else {
        #[cfg(any(target_os = "macos", target_os = "windows"))]
        {
            entry(path, server)?
                .get_password()
                .context("读取系统凭据存储失败")?
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            bail!("此平台未启用系统凭据存储")
        }
    };
    Ok(Some(binding))
}

pub(crate) fn save(path: &Path, binding: &Binding) -> Result<()> {
    if binding.credential_store == "file" {
        atomic_write(
            &sidecar(path, "credential"),
            binding.identity.agent_token.as_bytes(),
        )?;
    } else {
        #[cfg(any(target_os = "macos", target_os = "windows"))]
        entry(path, &binding.server_url)?
            .set_password(&binding.identity.agent_token)
            .context("写入系统凭据存储失败；不会回退到明文")?;
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        bail!("此平台未启用系统凭据存储");
    }
    atomic_write(path, &serde_json::to_vec_pretty(binding)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn server_origin_validation() {
        assert_eq!(
            normalize_server("https://EXAMPLE.com:443/").unwrap(),
            "https://example.com"
        );
        for bad in [
            "http://remote.example",
            "https://user:pw@example.com",
            "https://example.com/path",
            "https://example.com?token=abc",
        ] {
            assert!(normalize_server(bad).is_err());
        }
    }
    #[cfg(unix)]
    #[test]
    fn private_credentials_and_origin_isolation() {
        use std::os::unix::fs::PermissionsExt;
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("binding.json");
        let binding = Binding {
            server_url: "https://one.example".into(),
            host_kind: "codex".into(),
            label: "one".into(),
            bind_code_hash: digest("code"),
            credential_store: "file".into(),
            identity: Bound {
                agent_instance_id: "a".into(),
                room_id: "r".into(),
                agent_token: "secret-sentinel".into(),
            },
        };
        save(&path, &binding).unwrap();
        assert!(!fs::read_to_string(&path)
            .unwrap()
            .contains("secret-sentinel"));
        assert_eq!(
            fs::metadata(sidecar(&path, "credential"))
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
        assert_eq!(
            load(&path, "https://one.example", "file")
                .unwrap()
                .unwrap()
                .identity
                .agent_token,
            "secret-sentinel"
        );
        assert!(load(&path, "https://two.example", "file").is_err());
        fs::set_permissions(
            sidecar(&path, "credential"),
            fs::Permissions::from_mode(0o644),
        )
        .unwrap();
        assert!(load(&path, "https://one.example", "file").is_err());
    }
}
