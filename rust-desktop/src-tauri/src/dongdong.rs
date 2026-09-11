//! Read the current user's group DongDong session. Never modify its installation or store.
use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyIvInit};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256, Sha512};
use std::{
    fs,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
};
use zeroize::Zeroizing;

pub type Failure = (String, String);
const CONFIG: &str = "emc.config.v3.json";
const LIMIT: u64 = 16 * 1024 * 1024;
fn failure(message: &str) -> Failure {
    ("signed-out".into(), message.into())
}
fn format_error() -> Failure {
    failure("当前咚咚版本的登录格式暂不支持，可切换为手动登录")
}

// Deliberately no Debug/Serialize: session material must never reach logs or the frontend.
pub struct Session {
    token: Zeroizing<String>,
    badge: String,
    unique: String,
    pub name: String,
    pub fingerprint: String,
    version: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoginInfo {
    #[serde(default)]
    token: String,
    #[serde(default)]
    badge_id: String,
    #[serde(default)]
    unique_key: String,
    #[serde(default)]
    user_name: String,
}
#[derive(Deserialize)]
struct Store {
    #[serde(rename = "loginInfo")]
    login: LoginInfo,
}

fn bounded_read(path: &Path) -> Result<Vec<u8>, Failure> {
    let file =
        fs::File::open(path).map_err(|_| failure("暂时无法读取咚咚登录信息，可重试或手动登录"))?;
    let mut bytes = Vec::new();
    file.take(LIMIT + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| format_error())?;
    if bytes.len() as u64 > LIMIT {
        return Err(format_error());
    }
    Ok(bytes)
}
fn decrypt(bytes: &[u8], key: &str) -> Result<Zeroizing<Vec<u8>>, Failure> {
    if bytes.len() < 33 || bytes[16] != b':' {
        return Err(format_error());
    }
    let iv = &bytes[..16];
    // conf uses Buffer.toString() on the IV as the PBKDF2 salt, including UTF-8 replacement.
    let salt = String::from_utf8_lossy(iv);
    let mut derived = Zeroizing::new([0u8; 32]);
    pbkdf2::pbkdf2_hmac::<Sha512>(key.as_bytes(), salt.as_bytes(), 10_000, &mut *derived);
    let cipher = cbc::Decryptor::<aes::Aes256>::new_from_slices(&*derived, iv)
        .map_err(|_| format_error())?;
    cipher
        .decrypt_padded_vec_mut::<Pkcs7>(&bytes[17..])
        .map(Zeroizing::new)
        .map_err(|_| format_error())
}

struct Archive {
    file: fs::File,
    header: Value,
    start: u64,
}
impl Archive {
    fn open(path: &Path) -> Result<Self, Failure> {
        let mut file = fs::File::open(path).map_err(|_| format_error())?;
        let mut prefix = [0u8; 16];
        file.read_exact(&mut prefix).map_err(|_| format_error())?;
        let header_size = u32::from_le_bytes(prefix[4..8].try_into().unwrap()) as u64;
        let json_size = u32::from_le_bytes(prefix[12..16].try_into().unwrap()) as u64;
        if json_size > LIMIT || header_size > LIMIT || header_size < json_size + 8 {
            return Err(format_error());
        }
        let mut bytes = vec![0; json_size as usize];
        file.read_exact(&mut bytes).map_err(|_| format_error())?;
        let header = serde_json::from_slice(&bytes).map_err(|_| format_error())?;
        Ok(Self {
            file,
            header,
            start: 8 + header_size,
        })
    }
    fn text(&mut self, path: &str) -> Result<String, Failure> {
        let mut entry = &self.header;
        for part in path.trim_start_matches("./").split('/') {
            if part.is_empty() || part == ".." {
                return Err(format_error());
            }
            entry = &entry["files"][part];
        }
        let size = entry["size"]
            .as_u64()
            .filter(|n| *n <= LIMIT)
            .ok_or_else(format_error)?;
        let offset = entry["offset"]
            .as_str()
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(format_error)?;
        if entry["unpacked"] == true {
            return Err(format_error());
        }
        let start = self.start.checked_add(offset).ok_or_else(format_error)?;
        let end = start.checked_add(size).ok_or_else(format_error)?;
        if end > self.file.metadata().map_err(|_| format_error())?.len() {
            return Err(format_error());
        }
        self.file
            .seek(SeekFrom::Start(start))
            .map_err(|_| format_error())?;
        let mut bytes = vec![0; size as usize];
        self.file
            .read_exact(&mut bytes)
            .map_err(|_| format_error())?;
        String::from_utf8(bytes).map_err(|_| format_error())
    }
}
fn installed_key(path: &Path) -> Result<(Zeroizing<String>, String), Failure> {
    let mut archive = Archive::open(path)?;
    let package: Value =
        serde_json::from_str(&archive.text("package.json")?).map_err(|_| format_error())?;
    if package["name"] != "emc" {
        return Err(format_error());
    }
    let version = package["version"]
        .as_str()
        .filter(|s| s.starts_with("3."))
        .ok_or_else(format_error)?
        .to_owned();
    let main = archive.text(package["main"].as_str().ok_or_else(format_error)?)?;
    let at = main.find(".config.v3").ok_or_else(format_error)?;
    let tail = main.get(at..).ok_or_else(format_error)?;
    let constructor = tail.split('}').next().unwrap_or(tail);
    let pattern = regex::Regex::new(r#"encryptionKey\s*:\s*["']([^"'\\\r\n]{1,256})["']"#).unwrap();
    let key = pattern
        .captures(constructor)
        .and_then(|c| c.get(1))
        .ok_or_else(format_error)?;
    Ok((Zeroizing::new(key.as_str().to_owned()), version))
}
pub fn config_path() -> Result<PathBuf, Failure> {
    #[cfg(target_os = "macos")]
    let root =
        std::env::var_os("HOME").map(|p| PathBuf::from(p).join("Library/Application Support"));
    #[cfg(target_os = "windows")]
    let root = std::env::var_os("APPDATA").map(PathBuf::from);
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let root: Option<PathBuf> = None;
    root.map(|p| p.join("emc").join(CONFIG))
        .ok_or_else(|| failure("当前系统暂不支持连接咚咚，可使用手动登录"))
}
#[cfg(any(windows, test))]
fn archives_in(root: &Path, out: &mut Vec<PathBuf>) {
    out.push(root.join("resources/app.asar"));
    out.push(root.join("app.asar"));
    if let Ok(entries) = fs::read_dir(root) {
        let mut versions: Vec<_> = entries
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().starts_with("app-"))
            .map(|e| e.path())
            .collect();
        versions.sort_by_key(|p| {
            p.file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .trim_start_matches("app-")
                .split('.')
                .map(|s| s.parse::<u64>().unwrap_or(0))
                .collect::<Vec<_>>()
        });
        for version in versions.into_iter().rev() {
            out.push(version.join("resources/app.asar"));
        }
    }
}
fn archive_candidates() -> Vec<PathBuf> {
    let mut out = Vec::new();
    #[cfg(target_os = "macos")]
    {
        out.push(PathBuf::from(
            "/Applications/咚咚.app/Contents/Resources/app.asar",
        ));
        if let Some(home) = std::env::var_os("HOME") {
            out.push(PathBuf::from(home).join("Applications/咚咚.app/Contents/Resources/app.asar"));
        }
    }
    #[cfg(target_os = "windows")]
    {
        use winreg::{enums::*, RegKey};
        // Read only matching uninstall entries, including custom installation locations.
        for hive in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
            for view in [KEY_WOW64_64KEY, KEY_WOW64_32KEY] {
                if let Ok(uninstall) = RegKey::predef(hive).open_subkey_with_flags(
                    r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
                    KEY_READ | view,
                ) {
                    for name in uninstall.enum_keys().flatten() {
                        if let Ok(entry) = uninstall.open_subkey_with_flags(name, KEY_READ | view) {
                            let display: String =
                                entry.get_value("DisplayName").unwrap_or_default();
                            if !matches!(
                                display.as_str(),
                                "咚咚" | "DongDong" | "EmDongDong" | "emc"
                            ) {
                                continue;
                            }
                            let location: String =
                                entry.get_value("InstallLocation").unwrap_or_default();
                            if !location.is_empty() {
                                archives_in(Path::new(location.trim_matches('"')), &mut out);
                            }
                            let icon: String = entry.get_value("DisplayIcon").unwrap_or_default();
                            let icon = icon.trim_end_matches(",0").trim_matches('"');
                            if let Some(parent) = Path::new(icon).parent() {
                                archives_in(parent, &mut out);
                            }
                        }
                    }
                }
            }
        }
        for variable in ["LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(base) = std::env::var_os(variable) {
                for name in ["emc", "咚咚", "DongDong", "EmDongDong"] {
                    archives_in(&PathBuf::from(&base).join(name), &mut out);
                    if variable == "LOCALAPPDATA" {
                        archives_in(&PathBuf::from(&base).join("Programs").join(name), &mut out);
                    }
                }
            }
        }
    }
    out
}
fn parse_session(plain: &[u8], version: String) -> Result<Session, Failure> {
    let Store { login } = serde_json::from_slice(plain).map_err(|_| format_error())?;
    let token = Zeroizing::new(login.token);
    if token.is_empty() {
        return Err(failure("咚咚尚未登录，请先登录咚咚，或手动登录其他账户"));
    }
    if [&*token, &login.badge_id, &login.unique_key]
        .iter()
        .any(|s| s.trim().is_empty() || s.len() > 16384 || s.contains(['\r', '\n']))
    {
        return Err(format_error());
    }
    let mut hash = Sha256::new();
    for value in [&login.badge_id, &login.unique_key, &*token] {
        hash.update(value.len().to_le_bytes());
        hash.update(value.as_bytes());
    }
    Ok(Session {
        token,
        badge: login.badge_id,
        unique: login.unique_key,
        name: login
            .user_name
            .chars()
            .filter(|c| !c.is_control())
            .take(80)
            .collect(),
        fingerprint: format!("{:x}", hash.finalize()),
        version,
    })
}
pub fn read_session() -> Result<Session, Failure> {
    let path = config_path()?;
    if !path.exists() {
        return Err(failure(
            "未找到本机咚咚登录信息，可先登录咚咚或选择手动登录",
        ));
    }
    let bytes = bounded_read(&path)?;
    let mut found = false;
    for archive in archive_candidates().into_iter().filter(|p| p.is_file()) {
        found = true;
        if let Ok((key, version)) = installed_key(&archive) {
            if let Ok(plain) = decrypt(&bytes, &key) {
                return parse_session(&plain, version);
            }
        }
    }
    Err(if found {
        format_error()
    } else {
        failure("未找到咚咚安装目录，可使用手动登录；自定义安装请反馈路径")
    })
}
pub struct PlatformSession {
    pub auth: Value,
    pub profile: Value,
}
fn network_error() -> Failure {
    (
        "stale".into(),
        "暂时连接不上咚咚或平台，恢复网络后自动重试".into(),
    )
}
fn temporary_token(bytes: &[u8]) -> Result<Zeroizing<String>, Failure> {
    #[derive(Deserialize)]
    struct Temp {
        #[serde(rename = "tempToken")]
        token: String,
    }
    #[derive(Deserialize)]
    struct Envelope {
        code: Value,
        data: Option<Temp>,
    }
    let envelope: Envelope = serde_json::from_slice(bytes).map_err(|_| network_error())?;
    let code = envelope
        .code
        .as_u64()
        .or_else(|| envelope.code.as_str()?.parse().ok());
    if matches!(code, Some(401 | 403)) {
        return Err((
            "expired".into(),
            "咚咚会话暂不可用，请在咚咚重新登录，或手动登录其他账户".into(),
        ));
    }
    if code != Some(200) {
        return Err(network_error());
    }
    let token = Zeroizing::new(envelope.data.map(|d| d.token).unwrap_or_default());
    if token.is_empty() {
        return Err((
            "unavailable".into(),
            "咚咚暂未返回有效授权，请重试或手动登录".into(),
        ));
    }
    Ok(token)
}
pub async fn exchange(
    http: &reqwest::Client,
    source: &Session,
) -> Result<PlatformSession, Failure> {
    let os = if cfg!(windows) { "win32" } else { "darwin" };
    let arch = if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x64"
    };
    let response = http.post("https://dongdong-api.eastmoney.com/chatserver/app/api/tokenAuth/newTempToken")
        .header("token", source.token.as_str()).header("X-Job-Number", &source.badge).header("X-Unique-Key", &source.unique)
        .header("Device-Info", json!({"sessionType":"PC","deviceSystem":format!("{os} {arch}"),"productVersion":source.version,"version":source.version}).to_string())
        .send().await.map_err(|_| network_error())?;
    let status = response.status().as_u16();
    if status == 401 || status == 403 {
        return Err((
            "expired".into(),
            "咚咚登录已失效，请在咚咚重新登录，或手动登录其他账户".into(),
        ));
    }
    if status != 200 {
        return Err(network_error());
    }
    let bytes = Zeroizing::new(
        response
            .bytes()
            .await
            .map_err(|_| network_error())?
            .to_vec(),
    );
    let token = temporary_token(&bytes)?;
    let client = format!("WEB-{}", uuid::Uuid::new_v4());
    let response = http
        .get("https://aihub.eastmoney.com/ai-cloud-hub/api/v1/auth/dongdong-token")
        .query(&[
            ("ddSource", "group"),
            ("sessionType", "PC"),
            ("oa_token", token.as_str()),
        ])
        .header("X-Dong-Client", &client)
        .send()
        .await
        .map_err(|_| network_error())?;
    if response.status().as_u16() == 403 {
        return Err((
            "forbidden".into(),
            "当前咚咚账户暂无 AI 云平台访问权限，可手动登录其他账户".into(),
        ));
    }
    if response.status().as_u16() == 401 {
        return Err(("expired".into(), "咚咚授权已失效，请重试或手动登录".into()));
    }
    if !response.status().is_success() {
        return Err(network_error());
    }
    let body: Value = response.json().await.map_err(|_| network_error())?;
    let body = if body["token"].is_string() {
        &body
    } else {
        &body["data"]
    };
    let auth =
        json!({"x-dong-auth":body["token"],"x-dong-user":body["userId"],"x-dong-client":client});
    if !crate::account::valid_auth(&auth) {
        return Err((
            "unavailable".into(),
            "平台未返回有效登录信息，可重试或手动登录".into(),
        ));
    }
    Ok(PlatformSession {
        profile: json!({"id":body["userId"],"name":source.name}),
        auth,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    fn fixture() -> Value {
        serde_json::from_str(include_str!("../../tests/fixtures/dongdong-store.json")).unwrap()
    }
    #[test]
    fn decrypts_node_conf_fixture_with_non_utf8_iv() {
        let fixture = fixture();
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(fixture["encrypted"].as_str().unwrap())
            .unwrap();
        let plain = decrypt(&bytes, fixture["key"].as_str().unwrap()).unwrap();
        let session = parse_session(&plain, "3.4.0".into()).unwrap();
        assert_eq!(session.name, "测试账户");
        assert_eq!(session.badge, "fixture-user");
        assert!(decrypt(&bytes, "wrong-key").is_err());
        assert!(decrypt(&bytes[..bytes.len() - 1], fixture["key"].as_str().unwrap()).is_err());
    }
    #[test]
    fn extracts_only_group_client_key_and_validates_archive_bounds() {
        let fixture = fixture();
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(fixture["asar"].as_str().unwrap())
            .unwrap();
        let path = std::env::temp_dir().join(format!("em-use-test-{}.asar", uuid::Uuid::new_v4()));
        fs::write(&path, &bytes).unwrap();
        let (key, version) = installed_key(&path).unwrap();
        assert_eq!(*key, fixture["key"].as_str().unwrap());
        assert_eq!(version, "3.4.0");
        let mut archive = Archive::open(&path).unwrap();
        assert!(archive.text("../main.cjs").is_err());
        fs::write(&path, &bytes[..bytes.len() - 3]).unwrap();
        assert!(installed_key(&path).is_err());
        fs::remove_file(path).unwrap();
    }
    #[test]
    fn discovers_squirrel_installations_in_numeric_version_order() {
        let root = std::env::temp_dir().join(format!("em-use-test-{}", uuid::Uuid::new_v4()));
        for name in ["app-3.9.0", "app-3.10.0"] {
            fs::create_dir_all(root.join(name)).unwrap();
        }
        let mut paths = vec![];
        archives_in(&root, &mut paths);
        assert!(paths[2].ends_with("app-3.10.0/resources/app.asar"));
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn empty_session_and_header_injection_are_rejected() {
        assert_eq!(
            parse_session(br#"{"loginInfo":{"token":""}}"#, "3.4.0".into())
                .err()
                .unwrap()
                .0,
            "signed-out"
        );
        assert!(parse_session(
            br#"{"loginInfo":{"token":"x\r\ny","badgeId":"u","uniqueKey":"G-u"}}"#,
            "3.4.0".into()
        )
        .is_err());
    }
    #[test]
    fn identity_or_session_change_invalidates_fingerprint() {
        let session = |badge, token| {
            parse_session(json!({"loginInfo":{"token":token,"badgeId":badge,"uniqueKey":"g","password":"ignored"}}).to_string().as_bytes(), "3.4.0".into()).unwrap().fingerprint
        };
        assert_ne!(session("alice", "one"), session("bob", "one"));
        assert_ne!(session("alice", "one"), session("alice", "two"));
        assert_eq!(session("alice", "one"), session("alice", "one"));
    }
    #[test]
    fn bad_ciphertext_is_rejected() {
        assert!(decrypt(b"not-an-encrypted-store", "test").is_err());
    }
    #[test]
    fn temporary_ticket_distinguishes_rejection_from_service_failure() {
        assert_eq!(
            temporary_token(br#"{"code":"401","data":null}"#)
                .err()
                .unwrap()
                .0,
            "expired"
        );
        assert_eq!(
            temporary_token(br#"{"code":"500","data":null}"#)
                .err()
                .unwrap()
                .0,
            "stale"
        );
        assert_eq!(
            temporary_token(br#"{"code":200,"data":{"tempToken":""}}"#)
                .err()
                .unwrap()
                .0,
            "unavailable"
        );
        assert_eq!(
            temporary_token(br#"{"code":"200","data":{"tempToken":"fixture"}}"#)
                .unwrap()
                .as_str(),
            "fixture"
        );
    }
    #[test]
    #[ignore = "Explicit local account verification only; no credentials are saved or printed"]
    fn live_dongdong_exchange_and_quota() {
        let source = read_session().unwrap_or_else(|e| panic!("{}", e.1));
        tauri::async_runtime::block_on(async {
            let http = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .unwrap();
            let platform = exchange(&http, &source)
                .await
                .unwrap_or_else(|e| panic!("{}", e.1));
            let mut req = http.get("https://aihub.eastmoney.com/ai-cloud-hub/coding-plan/usage");
            for k in ["x-dong-auth", "x-dong-user", "x-dong-client"] {
                req = req.header(k, platform.auth[k].as_str().unwrap());
            }
            let response = req
                .send()
                .await
                .unwrap_or_else(|_| panic!("Quota request failed"));
            assert_eq!(response.status().as_u16(), 200);
            let body = response
                .json()
                .await
                .unwrap_or_else(|_| panic!("Invalid quota response"));
            assert!(crate::model::normalize(body, crate::now()).is_ok());
        });
    }
}
