//! Publisher-authenticated portable updates. Checks never execute downloaded
//! files. Installing is an explicit action and uses the verified new executable
//! as a short-lived helper, without a shell, scheduled task or service.

use crate::community::sha256;
use crate::update_key::{KEY_ID, PUBLIC_KEY_BLOB_HEX};
use reqwest::blocking::{Client, Response};
use reqwest::{redirect::Policy, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const MANIFEST_LIMIT: usize = 16 * 1024;
const SIGNATURE_LIMIT: usize = 2048;
const ARTIFACT_LIMIT: u64 = 64 * 1024 * 1024;
const RELEASE_FEED: &str = "https://api.github.com/repos/uchihavayne/luma-dps/releases?per_page=10";
const RELEASE_ROOT: &str = "https://github.com/uchihavayne/luma-dps/releases/download/";
const HELPER_FLAG: &str = "--luma-apply-update";

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct Version(u32, u32, u32);
impl Version {
    fn parse(value: &str) -> Result<Self, String> {
        if value.len() > 32 {
            return Err("Invalid update version".into());
        }
        let parts: Vec<_> = value.split('.').collect();
        if parts.len() != 3
            || parts.iter().any(|part| {
                part.is_empty()
                    || part.len() > 9
                    || !part.bytes().all(|b| b.is_ascii_digit())
                    || (part.len() > 1 && part.starts_with('0'))
            })
        {
            return Err("Invalid update version".into());
        }
        let numbers: Vec<u32> = parts
            .iter()
            .map(|part| part.parse::<u32>())
            .collect::<Result<_, _>>()
            .map_err(|_| "Invalid update version")?;
        Ok(Self(numbers[0], numbers[1], numbers[2]))
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Manifest {
    schema_version: u32,
    version: String,
    target: String,
    artifact: String,
    artifact_sha256: String,
    artifact_bytes: u64,
    commit: String,
    notes: String,
}
impl Manifest {
    fn validate(&self) -> Result<Version, String> {
        let version = Version::parse(&self.version)?;
        if self.schema_version != 1
            || self.target != "windows-x64"
            || self.artifact != format!("Luma-DPS-{}.exe", self.version)
            || !lower_hex(&self.artifact_sha256, 64)
            || !lower_hex(&self.commit, 40)
            || !(512..=ARTIFACT_LIMIT).contains(&self.artifact_bytes)
            || self.notes.len() > 6000
            || self
                .notes
                .chars()
                .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
        {
            return Err("Invalid signed update manifest".into());
        }
        Ok(version)
    }
    fn asset_url(&self) -> String {
        asset_url(&self.version, &self.artifact)
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Signature {
    schema_version: u32,
    algorithm: String,
    key_id: String,
    signature: String,
}
#[derive(Clone)]
struct VerifiedRelease {
    manifest: Manifest,
    raw_manifest: Vec<u8>,
    raw_signature: Vec<u8>,
}
fn lower_hex(value: &str, length: usize) -> bool {
    value.len() == length
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn decode_hex(value: &str) -> Result<Vec<u8>, String> {
    if value.len() % 2 != 0 || !value.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("Invalid signature encoding".into());
    }
    (0..value.len())
        .step_by(2)
        .map(|index| {
            u8::from_str_radix(&value[index..index + 2], 16)
                .map_err(|_| "Invalid signature encoding".into())
        })
        .collect()
}
fn asset_url(version: &str, name: &str) -> String {
    format!("{RELEASE_ROOT}v{version}/{name}")
}

fn verify_release(
    raw_manifest: &[u8],
    raw_signature: &[u8],
    public_key: &str,
    key_id: &str,
) -> Result<VerifiedRelease, String> {
    if raw_manifest.is_empty()
        || raw_manifest.len() > MANIFEST_LIMIT
        || raw_signature.len() > SIGNATURE_LIMIT
    {
        return Err("Update metadata exceeds its size limit".into());
    }
    let signature: Signature =
        serde_json::from_slice(raw_signature).map_err(|_| "Invalid update signature metadata")?;
    if signature.schema_version != 1
        || signature.algorithm != "rsa-pss-sha256"
        || signature.key_id != key_id
        || !lower_hex(&signature.signature, 768)
    {
        return Err("Update publisher signature is not trusted".into());
    }
    let key = decode_hex(public_key)?;
    if sha256(&key) != key_id {
        return Err("Update verification key is invalid".into());
    }
    let signature = decode_hex(&signature.signature)?;
    let hash = decode_hex(&sha256(raw_manifest))?;
    if !verify_pss(&key, &hash, &signature) {
        return Err("Update publisher signature did not verify".into());
    }
    let manifest: Manifest =
        serde_json::from_slice(raw_manifest).map_err(|_| "Invalid signed update manifest")?;
    manifest.validate()?;
    Ok(VerifiedRelease {
        manifest,
        raw_manifest: raw_manifest.to_vec(),
        raw_signature: raw_signature.to_vec(),
    })
}

#[cfg(windows)]
fn verify_pss(key: &[u8], hash: &[u8], signature: &[u8]) -> bool {
    use windows_sys::Win32::Security::Cryptography::*;
    if key.len() != 411 || hash.len() != 32 || signature.len() != 384 {
        return false;
    }
    let mut algorithm = std::ptr::null_mut();
    if unsafe {
        BCryptOpenAlgorithmProvider(&mut algorithm, BCRYPT_RSA_ALGORITHM, std::ptr::null(), 0)
    } < 0
    {
        return false;
    }
    let mut handle = std::ptr::null_mut();
    let imported = unsafe {
        BCryptImportKeyPair(
            algorithm,
            std::ptr::null_mut(),
            BCRYPT_RSAPUBLIC_BLOB,
            &mut handle,
            key.as_ptr(),
            key.len() as u32,
            0,
        )
    } >= 0;
    let valid = if imported {
        let padding = BCRYPT_PSS_PADDING_INFO {
            pszAlgId: BCRYPT_SHA256_ALGORITHM,
            cbSalt: 32,
        };
        (unsafe {
            BCryptVerifySignature(
                handle,
                (&padding as *const BCRYPT_PSS_PADDING_INFO).cast(),
                hash.as_ptr(),
                hash.len() as u32,
                signature.as_ptr(),
                signature.len() as u32,
                BCRYPT_PAD_PSS,
            )
        }) >= 0
    } else {
        false
    };
    unsafe {
        if imported {
            BCryptDestroyKey(handle);
        }
        BCryptCloseAlgorithmProvider(algorithm, 0);
    }
    valid
}
#[cfg(not(windows))]
fn verify_pss(_key: &[u8], _hash: &[u8], _signature: &[u8]) -> bool {
    false
}

#[derive(Clone, Debug, Serialize)]
pub struct UpdateSnapshot {
    pub supported: bool,
    pub status: String,
    pub current_version: String,
    pub available_version: Option<String>,
    pub notes: String,
    pub commit: Option<String>,
    pub artifact_bytes: Option<u64>,
    pub checked_at_ms: u64,
    pub downloaded: bool,
    pub publisher_verified: bool,
    pub error: String,
}
struct Inner {
    state: UpdateSnapshot,
    release: Option<VerifiedRelease>,
    downloaded: Option<PathBuf>,
}
pub struct UpdateService {
    directory: PathBuf,
    current: Version,
    inner: Mutex<Inner>,
    operation: Mutex<()>,
}
impl UpdateService {
    pub fn new(data_dir: PathBuf, current_version: &str) -> Result<Self, String> {
        let current = Version::parse(current_version)?;
        Ok(Self {
            directory: data_dir.join("updates"),
            current,
            operation: Mutex::new(()),
            inner: Mutex::new(Inner {
                state: UpdateSnapshot {
                    supported: cfg!(windows),
                    status: "idle".into(),
                    current_version: current_version.into(),
                    available_version: None,
                    notes: String::new(),
                    commit: None,
                    artifact_bytes: None,
                    checked_at_ms: 0,
                    downloaded: false,
                    publisher_verified: false,
                    error: String::new(),
                },
                release: None,
                downloaded: None,
            }),
        })
    }
    pub fn snapshot(&self) -> Value {
        serde_json::to_value(&self.inner.lock().unwrap_or_else(|e| e.into_inner()).state)
            .unwrap_or(Value::Null)
    }
    fn fail(&self, error: String) -> String {
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        inner.state.status = "error".into();
        inner.state.error = error.clone();
        error
    }
    pub fn check(&self) -> Result<Value, String> {
        let _operation = self
            .operation
            .try_lock()
            .map_err(|_| "Another update operation is running")?;
        if !cfg!(windows) {
            return Err(self.fail("Automatic updates currently require Windows".into()));
        }
        {
            let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            inner.state.status = "checking".into();
            inner.state.error.clear();
        }
        let result = self.check_inner();
        if let Err(error) = result {
            return Err(self.fail(error));
        }
        Ok(self.snapshot())
    }
    fn check_inner(&self) -> Result<(), String> {
        let client = client()?;
        let feed = get_bounded(&client, Url::parse(RELEASE_FEED).unwrap(), 512 * 1024, true)?;
        let version = select_release(&feed)?;
        let Some(version) = version else {
            let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            inner.state.status = "current".into();
            inner.state.checked_at_ms = now_ms();
            inner.state.available_version = None;
            inner.state.downloaded = false;
            inner.state.publisher_verified = false;
            inner.state.notes.clear();
            inner.state.commit = None;
            inner.state.artifact_bytes = None;
            inner.release = None;
            inner.downloaded = None;
            return Ok(());
        };
        let raw_manifest = get_bounded(
            &client,
            Url::parse(&asset_url(&version, "luma-update.json")).unwrap(),
            MANIFEST_LIMIT,
            false,
        )?;
        let raw_signature = get_bounded(
            &client,
            Url::parse(&asset_url(&version, "luma-update.sig")).unwrap(),
            SIGNATURE_LIMIT,
            false,
        )?;
        let release = verify_release(&raw_manifest, &raw_signature, PUBLIC_KEY_BLOB_HEX, KEY_ID)?;
        let available = release.manifest.validate()?;
        if release.manifest.version != version {
            return Err("Signed update does not match its release".into());
        }
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let previous = inner
            .release
            .as_ref()
            .map(|v| v.manifest.artifact_sha256.as_str());
        let keep_download = previous == Some(release.manifest.artifact_sha256.as_str())
            && inner.downloaded.as_ref().is_some_and(|path| path.is_file());
        if !keep_download {
            inner.downloaded = None;
        }
        inner.state.status = if available > self.current {
            if keep_download {
                "downloaded"
            } else {
                "available"
            }
        } else {
            "current"
        }
        .into();
        inner.state.available_version = if available > self.current {
            Some(version)
        } else {
            None
        };
        inner.state.notes = release.manifest.notes.clone();
        inner.state.commit = Some(release.manifest.commit.clone());
        inner.state.artifact_bytes = Some(release.manifest.artifact_bytes);
        inner.state.checked_at_ms = now_ms();
        inner.state.downloaded = keep_download && available > self.current;
        inner.state.publisher_verified = true;
        inner.release = Some(release);
        Ok(())
    }
    pub fn download(&self) -> Result<Value, String> {
        let _operation = self
            .operation
            .try_lock()
            .map_err(|_| "Another update operation is running")?;
        let release = {
            let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            let release = inner
                .release
                .clone()
                .ok_or("Check for a signed update first")?;
            if release.manifest.validate()? <= self.current {
                return Err("No newer signed update is available".into());
            }
            inner.state.status = "downloading".into();
            inner.state.error.clear();
            release
        };
        let result = (|| {
            let client = client()?;
            let bytes = get_bounded(
                &client,
                Url::parse(&release.manifest.asset_url()).unwrap(),
                release.manifest.artifact_bytes as usize,
                false,
            )?;
            validate_artifact(&bytes, &release.manifest)?;
            fs::create_dir_all(&self.directory)
                .map_err(|_| "Cannot create the update download folder")?;
            ensure_no_symlink(&self.directory)?;
            let path = self.directory.join(&release.manifest.artifact);
            write_cache(
                &self
                    .directory
                    .join(format!("luma-update-{}.json", release.manifest.version)),
                &release.raw_manifest,
            )?;
            write_cache(
                &self
                    .directory
                    .join(format!("luma-update-{}.sig", release.manifest.version)),
                &release.raw_signature,
            )?;
            write_cache(&path, &bytes)?;
            // Read back the final destination before marking it installable.
            validate_artifact(
                &read_bounded_file(&path, ARTIFACT_LIMIT as usize)?,
                &release.manifest,
            )?;
            Ok::<_, String>(path)
        })();
        match result {
            Ok(path) => {
                let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
                inner.downloaded = Some(path);
                inner.state.downloaded = true;
                inner.state.status = "downloaded".into();
                Ok(serde_json::to_value(&inner.state).unwrap())
            }
            Err(error) => Err(self.fail(error)),
        }
    }
    /// Caller exits the old app only after this returns successfully. The helper
    /// waits for that exact PID and verifies its image path before replacement.
    pub fn install(&self, current_exe: PathBuf, current_pid: u32) -> Result<Value, String> {
        let _operation = self
            .operation
            .try_lock()
            .map_err(|_| "Another update operation is running")?;
        let (release, path, current_version) = {
            let inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            (
                inner.release.clone().ok_or("Check for an update first")?,
                inner
                    .downloaded
                    .clone()
                    .ok_or("Download the verified update first")?,
                inner.state.current_version.clone(),
            )
        };
        let result = (|| {
            if release.manifest.validate()? <= self.current {
                return Err("An older or equal version cannot be installed".into());
            }
            let expected = expected_updates_dir()?;
            if fs::canonicalize(&self.directory).map_err(|_| "Update folder is unavailable")?
                != expected
            {
                return Err("Update folder is outside the application data directory".into());
            }
            ensure_no_symlink(&path)?;
            validate_artifact(
                &read_bounded_file(&path, ARTIFACT_LIMIT as usize)?,
                &release.manifest,
            )?;
            let current = std::env::current_exe()
                .and_then(fs::canonicalize)
                .map_err(|_| "Current application path is unavailable")?;
            let target = fs::canonicalize(&current_exe)
                .map_err(|_| "Current application path is unavailable")?;
            if current_pid != std::process::id() || current != target {
                return Err("Update target is not the running application".into());
            }
            validate_target(&target)?;
            spawn_helper(&path, &target, current_pid, &current_version)?;
            Ok::<_, String>(())
        })();
        if let Err(error) = result {
            return Err(self.fail(error));
        }
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        inner.state.status = "installing".into();
        inner.state.error.clear();
        Ok(serde_json::to_value(&inner.state).unwrap())
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |time| time.as_millis().min(u128::from(u64::MAX)) as u64)
}
fn client() -> Result<Client, String> {
    Client::builder()
        .redirect(Policy::none())
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(30))
        .user_agent("Luma-DPS-Updater")
        .build()
        .map_err(|_| "Update HTTPS client is unavailable".into())
}
fn allowed_url(url: &Url, feed: bool) -> bool {
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.port_or_known_default() == Some(443)
        && url.fragment().is_none()
        && if feed {
            url.as_str() == RELEASE_FEED
        } else {
            matches!(
                url.host_str(),
                Some(
                    "github.com"
                        | "release-assets.githubusercontent.com"
                        | "objects.githubusercontent.com"
                )
            )
        }
}
fn get_bounded(client: &Client, mut url: Url, limit: usize, feed: bool) -> Result<Vec<u8>, String> {
    for _ in 0..=4 {
        if !allowed_url(&url, feed) {
            return Err("Update download address is not trusted".into());
        }
        let response = client
            .get(url.clone())
            .header(
                "Accept",
                if feed {
                    "application/vnd.github+json"
                } else {
                    "application/octet-stream"
                },
            )
            .send()
            .map_err(|_| "Could not contact the update server")?;
        if response.status().is_redirection() {
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or("Invalid update download redirect")?;
            url = url
                .join(location)
                .map_err(|_| "Invalid update download redirect")?;
            continue;
        }
        if !response.status().is_success() {
            return Err("The signed update is unavailable; try again later".into());
        }
        return bounded_response(response, limit);
    }
    Err("Too many update download redirects".into())
}
fn bounded_response(response: Response, limit: usize) -> Result<Vec<u8>, String> {
    if response
        .content_length()
        .is_some_and(|length| length > limit as u64)
    {
        return Err("Update response exceeds its size limit".into());
    }
    let mut bytes = Vec::new();
    response
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Update download was interrupted")?;
    if bytes.len() > limit {
        return Err("Update response exceeds its size limit".into());
    }
    Ok(bytes)
}
fn select_release(bytes: &[u8]) -> Result<Option<String>, String> {
    let value: Value = serde_json::from_slice(bytes).map_err(|_| "Invalid update release feed")?;
    let rows = value
        .as_array()
        .filter(|rows| rows.len() <= 10)
        .ok_or("Invalid update release feed")?;
    let mut versions = Vec::new();
    for row in rows {
        if row.get("draft").and_then(Value::as_bool) != Some(false) {
            continue;
        }
        let Some(version) = row
            .get("tag_name")
            .and_then(Value::as_str)
            .and_then(|tag| tag.strip_prefix('v'))
        else {
            continue;
        };
        let Ok(parsed) = Version::parse(version) else {
            continue;
        };
        let Some(assets) = row
            .get("assets")
            .and_then(Value::as_array)
            .filter(|assets| assets.len() <= 20)
        else {
            continue;
        };
        let required = [
            "luma-update.json".to_string(),
            "luma-update.sig".to_string(),
            format!("Luma-DPS-{version}.exe"),
        ];
        if required.iter().all(|name| {
            assets
                .iter()
                .filter(|asset| {
                    asset.get("name").and_then(Value::as_str) == Some(name.as_str())
                        && asset.get("browser_download_url").and_then(Value::as_str)
                            == Some(asset_url(version, name).as_str())
                })
                .count()
                == 1
        }) {
            versions.push((parsed, version.to_string()));
        }
    }
    versions.sort_by_key(|(version, _)| *version);
    Ok(versions.pop().map(|(_, version)| version))
}

fn validate_artifact(bytes: &[u8], manifest: &Manifest) -> Result<(), String> {
    if bytes.len() as u64 != manifest.artifact_bytes || sha256(bytes) != manifest.artifact_sha256 {
        return Err("Downloaded update does not match the signed checksum".into());
    }
    if !amd64_pe(bytes) {
        return Err("Downloaded update is not a Windows x64 executable".into());
    }
    Ok(())
}
fn amd64_pe(bytes: &[u8]) -> bool {
    if bytes.len() < 512 || bytes.get(..2) != Some(b"MZ") {
        return false;
    }
    let offset = u32::from_le_bytes(bytes[0x3c..0x40].try_into().unwrap()) as usize;
    offset >= 0x40
        && offset.checked_add(26).is_some_and(|end| end <= bytes.len())
        && bytes.get(offset..offset + 4) == Some(b"PE\0\0")
        && bytes.get(offset + 4..offset + 6) == Some(&[0x64, 0x86])
        && bytes.get(offset + 24..offset + 26) == Some(&[0x0b, 0x02])
}
fn ensure_no_symlink(path: &Path) -> Result<(), String> {
    let metadata =
        fs::symlink_metadata(path).map_err(|_| "Update file or folder is unavailable")?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return Err("Update paths cannot use symbolic links or junctions".into());
        }
    }
    if metadata.file_type().is_symlink() {
        return Err("Update paths cannot use symbolic links".into());
    }
    Ok(())
}
fn read_bounded_file(path: &Path, limit: usize) -> Result<Vec<u8>, String> {
    ensure_no_symlink(path)?;
    let file = File::open(path).map_err(|_| "Cannot read the verified update file")?;
    if !file
        .metadata()
        .is_ok_and(|meta| meta.is_file() && meta.len() <= limit as u64)
    {
        return Err("Invalid update file size".into());
    }
    let mut bytes = Vec::new();
    file.take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Cannot read the verified update file")?;
    if bytes.len() > limit {
        return Err("Invalid update file size".into());
    }
    Ok(bytes)
}
fn write_cache(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if path.exists() {
        ensure_no_symlink(path)?;
    }
    let temporary = path.with_extension(format!(
        "{}.new",
        path.extension().and_then(|x| x.to_str()).unwrap_or("bin")
    ));
    if temporary.exists() {
        ensure_no_symlink(&temporary)?;
        fs::remove_file(&temporary).map_err(|_| "Cannot replace the incomplete update file")?;
    }
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|_| "Cannot save the update download")?;
    let result = (|| {
        file.write_all(bytes)
            .and_then(|_| file.sync_all())
            .map_err(|_| "Cannot save the update download")?;
        drop(file);
        if path.exists() {
            fs::remove_file(path).map_err(|_| "Cannot replace the cached update")?;
        }
        fs::rename(&temporary, path).map_err(|_| "Cannot finish saving the update download")?;
        Ok::<_, String>(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}
fn expected_updates_dir() -> Result<PathBuf, String> {
    let local =
        std::env::var_os("LOCALAPPDATA").ok_or("Windows application data folder is unavailable")?;
    fs::canonicalize(
        PathBuf::from(local)
            .join("com.luma.independent")
            .join("updates"),
    )
    .map_err(|_| "Update download folder is unavailable".into())
}
fn target_name_valid(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
        return false;
    };
    name.eq_ignore_ascii_case("Luma-DPS.exe")
        || name.eq_ignore_ascii_case("luma-desktop.exe")
        || name
            .strip_prefix("Luma-DPS-")
            .and_then(|name| name.strip_suffix(".exe"))
            .is_some_and(|version| Version::parse(version).is_ok())
}
fn validate_target(target: &Path) -> Result<(), String> {
    if !target.is_absolute() || !target_name_valid(target) {
        return Err("Invalid Luma update target".into());
    }
    ensure_no_symlink(target)?;
    if !amd64_pe(&read_bounded_file(target, ARTIFACT_LIMIT as usize)?) {
        return Err("Update target is not the Luma Windows x64 executable".into());
    }
    Ok(())
}
#[cfg(windows)]
fn spawn_helper(
    stage: &Path,
    target: &Path,
    pid: u32,
    current_version: &str,
) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    let ready = stage
        .parent()
        .ok_or("Invalid update stage folder")?
        .join(format!("install-{pid}-{}.ready", now_ms()));
    if ready.exists() {
        return Err("An update handshake is already present".into());
    }
    let mut child = std::process::Command::new(stage)
        .args([HELPER_FLAG, "--target"])
        .arg(target)
        .args([
            "--wait-pid",
            &pid.to_string(),
            "--from-version",
            current_version,
            "--ready-file",
        ])
        .arg(&ready)
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|_| "Cannot launch the verified update helper")?;
    let began = std::time::Instant::now();
    let expected = format!("ready:{}", child.id());
    while began.elapsed() < Duration::from_secs(15) {
        if read_bounded_file(&ready, 64).is_ok_and(|bytes| bytes == expected.as_bytes()) {
            let _ = fs::remove_file(&ready);
            return Ok(());
        }
        if child
            .try_wait()
            .map_err(|_| "Cannot read the update helper state")?
            .is_some()
        {
            let _ = fs::remove_file(&ready);
            return Err(
                "The update helper could not prepare the replacement; Luma is still running".into(),
            );
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    let _ = child.kill();
    let _ = child.wait();
    let _ = fs::remove_file(&ready);
    Err("The update helper did not confirm readiness; Luma is still running".into())
}
#[cfg(not(windows))]
fn spawn_helper(
    _stage: &Path,
    _target: &Path,
    _pid: u32,
    _current_version: &str,
) -> Result<(), String> {
    Err("Automatic updates currently require Windows".into())
}

/// Call before normal Tauri/capture setup. Malformed helper invocations are
/// consumed and exit with an error; they never fall through to launch the app.
pub fn run_helper_if_requested() -> bool {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if !args.iter().any(|arg| arg == HELPER_FLAG) {
        return false;
    }
    let result = parse_helper_args(&args)
        .and_then(|(target, pid, from, ready)| apply_update(target, pid, &from, ready));
    if let Err(error) = result {
        eprintln!("Luma update: {error}");
    }
    true
}
fn parse_helper_args(
    args: &[std::ffi::OsString],
) -> Result<(PathBuf, u32, String, PathBuf), String> {
    if args.len() != 9
        || args[0] != HELPER_FLAG
        || args[1] != "--target"
        || args[3] != "--wait-pid"
        || args[5] != "--from-version"
        || args[7] != "--ready-file"
    {
        return Err("Invalid update helper arguments".into());
    }
    let pid = args[4]
        .to_str()
        .and_then(|value| value.parse::<u32>().ok())
        .filter(|pid| *pid > 0)
        .ok_or("Invalid update process")?;
    let from = args[6]
        .to_str()
        .ok_or("Invalid update version")?
        .to_string();
    Version::parse(&from)?;
    let ready = PathBuf::from(&args[8]);
    let valid_ready = ready
        .file_name()
        .and_then(|name| name.to_str())
        .and_then(|name| name.strip_prefix(&format!("install-{pid}-")))
        .and_then(|name| name.strip_suffix(".ready"))
        .is_some_and(|time| {
            !time.is_empty() && time.len() <= 20 && time.bytes().all(|b| b.is_ascii_digit())
        });
    if !valid_ready || !ready.is_absolute() {
        return Err("Invalid update handshake path".into());
    }
    Ok((PathBuf::from(&args[2]), pid, from, ready))
}

#[cfg(windows)]
fn apply_update(target: PathBuf, pid: u32, from: &str, ready: PathBuf) -> Result<(), String> {
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    use std::os::windows::process::CommandExt;
    use windows_sys::Win32::Foundation::{CloseHandle, WAIT_OBJECT_0};
    use windows_sys::Win32::Storage::FileSystem::{ReplaceFileW, REPLACEFILE_IGNORE_MERGE_ERRORS};
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, WaitForSingleObject,
        PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE,
    };
    let stage = std::env::current_exe()
        .and_then(fs::canonicalize)
        .map_err(|_| "Update helper path is unavailable")?;
    let expected = expected_updates_dir()?;
    let ready_parent = ready.parent().ok_or("Invalid update handshake directory")?;
    let ready_parent =
        fs::canonicalize(ready_parent).map_err(|_| "Update handshake directory is unavailable")?;
    let ready = ready_parent.join(
        ready
            .file_name()
            .ok_or("Invalid update handshake filename")?,
    );
    if stage.parent() != Some(expected.as_path())
        || ready.parent() != Some(expected.as_path())
        || pid == std::process::id()
    {
        return Err("Update helper is outside its download folder".into());
    }
    ensure_no_symlink(&expected)?;
    ensure_no_symlink(&stage)?;
    let version = stage
        .file_name()
        .and_then(|name| name.to_str())
        .and_then(|name| name.strip_prefix("Luma-DPS-"))
        .and_then(|name| name.strip_suffix(".exe"))
        .ok_or("Invalid update helper filename")?;
    let raw = read_bounded_file(
        &expected.join(format!("luma-update-{version}.json")),
        MANIFEST_LIMIT,
    )?;
    let signature = read_bounded_file(
        &expected.join(format!("luma-update-{version}.sig")),
        SIGNATURE_LIMIT,
    )?;
    let release = verify_release(&raw, &signature, PUBLIC_KEY_BLOB_HEX, KEY_ID)?;
    if release.manifest.version != version
        || version != env!("CARGO_PKG_VERSION")
        || release.manifest.validate()? <= Version::parse(from)?
    {
        return Err("Update helper cannot install an older, equal or mismatched version".into());
    }
    validate_artifact(
        &read_bounded_file(&stage, ARTIFACT_LIMIT as usize)?,
        &release.manifest,
    )?;
    let target = fs::canonicalize(target).map_err(|_| "Update target is unavailable")?;
    validate_target(&target)?;
    let process = unsafe {
        OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE,
            0,
            pid,
        )
    };
    if process.is_null() {
        return Err("The original Luma process is unavailable".into());
    }
    let mut image = vec![0u16; 32768];
    let mut length = image.len() as u32;
    let query = unsafe { QueryFullProcessImageNameW(process, 0, image.as_mut_ptr(), &mut length) };
    let process_path = if query != 0 {
        fs::canonicalize(PathBuf::from(std::ffi::OsString::from_wide(
            &image[..length as usize],
        )))
        .ok()
    } else {
        None
    };
    if process_path.as_ref() != Some(&target) {
        unsafe {
            CloseHandle(process);
        };
        return Err("The update target does not match the running Luma process".into());
    }
    let directory = target.parent().ok_or("Invalid update target directory")?;
    let temporary = directory.join(format!(
        ".luma-update-{}-{}.exe",
        release.manifest.version,
        std::process::id()
    ));
    let backup = target.with_extension("exe.previous");
    if temporary.exists() {
        return Err("An update replacement file already exists".into());
    }
    if backup.exists() {
        ensure_no_symlink(&backup)?;
    }
    let bytes = read_bounded_file(&stage, ARTIFACT_LIMIT as usize)?;
    validate_artifact(&bytes, &release.manifest)?;
    let mut replacement = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|_| "Cannot write to the Luma application folder")?;
    replacement
        .write_all(&bytes)
        .and_then(|_| replacement.sync_all())
        .map_err(|_| "Cannot write the verified Luma replacement")?;
    drop(replacement);
    validate_artifact(
        &read_bounded_file(&temporary, ARTIFACT_LIMIT as usize)?,
        &release.manifest,
    )?;
    let mut handshake = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&ready)
        .map_err(|_| "Cannot create the update handshake")?;
    handshake
        .write_all(format!("ready:{}", std::process::id()).as_bytes())
        .and_then(|_| handshake.sync_all())
        .map_err(|_| "Cannot confirm the update helper")?;
    drop(handshake);
    let waited = unsafe { WaitForSingleObject(process, 60_000) };
    unsafe {
        CloseHandle(process);
    };
    if waited != WAIT_OBJECT_0 {
        let _ = fs::remove_file(&temporary);
        return Err("Luma did not close in time; the update was not installed".into());
    }
    if backup.exists() {
        fs::remove_file(&backup).map_err(|_| "Cannot replace the previous Luma backup")?;
    }
    let wide = |path: &Path| {
        path.as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<_>>()
    };
    let target_wide = wide(&target);
    let temporary_wide = wide(&temporary);
    let backup_wide = wide(&backup);
    if unsafe {
        ReplaceFileW(
            target_wide.as_ptr(),
            temporary_wide.as_ptr(),
            backup_wide.as_ptr(),
            REPLACEFILE_IGNORE_MERGE_ERRORS,
            std::ptr::null(),
            std::ptr::null(),
        )
    } == 0
    {
        let _ = fs::remove_file(&temporary);
        return Err("Windows could not replace Luma; the original file was kept".into());
    }
    if std::process::Command::new(&target)
        .creation_flags(0x08000000)
        .spawn()
        .is_err()
    {
        let restored = unsafe {
            ReplaceFileW(
                target_wide.as_ptr(),
                backup_wide.as_ptr(),
                std::ptr::null(),
                REPLACEFILE_IGNORE_MERGE_ERRORS,
                std::ptr::null(),
                std::ptr::null(),
            )
        } != 0;
        if restored {
            let _ = std::process::Command::new(&target)
                .creation_flags(0x08000000)
                .spawn();
        }
        return Err(if restored {
            "New Luma could not start; the previous version was restored"
        } else {
            "Luma could not restart; the previous executable remains in the adjacent backup"
        }
        .into());
    }
    Ok(())
}
#[cfg(not(windows))]
fn apply_update(_target: PathBuf, _pid: u32, _from: &str, _ready: PathBuf) -> Result<(), String> {
    Err("Automatic updates currently require Windows".into())
}

#[cfg(test)]
#[path = "update_test_vectors.rs"]
mod vectors;

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture_manifest() -> Manifest {
        serde_json::from_slice(vectors::MANIFEST).unwrap()
    }
    fn fixture_signature() -> Vec<u8> {
        serde_json::to_vec(&json!({"schema_version":1,"algorithm":"rsa-pss-sha256","key_id":sha256(&decode_hex(vectors::PUBLIC_KEY_BLOB_HEX).unwrap()),"signature":vectors::SIGNATURE_HEX})).unwrap()
    }
    #[cfg(windows)]
    #[test]
    fn publisher_signature_verifies_exact_bytes_and_rejects_tampering_or_wrong_key() {
        assert!(!verify_pss(
            &decode_hex(PUBLIC_KEY_BLOB_HEX).unwrap(),
            &decode_hex(&sha256(vectors::MANIFEST)).unwrap(),
            &decode_hex(vectors::SIGNATURE_HEX).unwrap()
        ));
        let key_id = sha256(&decode_hex(vectors::PUBLIC_KEY_BLOB_HEX).unwrap());
        let signature = fixture_signature();
        assert_eq!(
            verify_release(
                vectors::MANIFEST,
                &signature,
                vectors::PUBLIC_KEY_BLOB_HEX,
                &key_id
            )
            .unwrap()
            .manifest
            .version,
            "0.16.1"
        );
        let mut altered = vectors::MANIFEST.to_vec();
        altered.push(b' ');
        assert!(
            verify_release(&altered, &signature, vectors::PUBLIC_KEY_BLOB_HEX, &key_id).is_err()
        );
        assert!(
            verify_release(vectors::MANIFEST, &signature, PUBLIC_KEY_BLOB_HEX, KEY_ID).is_err()
        );
        let mut changed: Value = serde_json::from_slice(&signature).unwrap();
        changed["signature"] = json!("0".repeat(768));
        assert!(verify_release(
            vectors::MANIFEST,
            &serde_json::to_vec(&changed).unwrap(),
            vectors::PUBLIC_KEY_BLOB_HEX,
            &key_id
        )
        .is_err());
    }
    #[test]
    fn version_and_manifest_reject_rollback_ambiguity_traversal_and_unbounded_payloads() {
        for version in [
            "1",
            "1.2",
            "v1.2.3",
            "01.2.3",
            "1.2.3-beta",
            "1.2.-1",
            "1.2.4294967296",
            "1.2.3.4",
        ] {
            assert!(Version::parse(version).is_err());
        }
        assert!(Version::parse("0.16.1").unwrap() > Version::parse("0.16.0").unwrap());
        let mut manifest = fixture_manifest();
        assert!(manifest.validate().is_ok());
        for artifact in [
            "../Luma-DPS-0.16.1.exe",
            "Luma-DPS.exe",
            "https://evil.test/a.exe",
            "Luma-DPS-0.16.1.exe:stream",
        ] {
            manifest.artifact = artifact.into();
            assert!(manifest.validate().is_err());
        }
        manifest = fixture_manifest();
        manifest.artifact_bytes = ARTIFACT_LIMIT + 1;
        assert!(manifest.validate().is_err());
        manifest = fixture_manifest();
        manifest.notes = "a".repeat(6001);
        assert!(manifest.validate().is_err());
        assert!(verify_release(
            &vec![0; MANIFEST_LIMIT + 1],
            &fixture_signature(),
            PUBLIC_KEY_BLOB_HEX,
            KEY_ID
        )
        .is_err());
    }
    #[test]
    fn release_selection_uses_only_fixed_repository_assets_not_feed_links_or_notes() {
        let release = |version: &str, draft: bool| json!({"tag_name":format!("v{version}"),"draft":draft,"body":"untrusted notes","assets":[{"name":"luma-update.json","browser_download_url":asset_url(version,"luma-update.json")},{"name":"luma-update.sig","browser_download_url":asset_url(version,"luma-update.sig")},{"name":format!("Luma-DPS-{version}.exe"),"browser_download_url":asset_url(version,&format!("Luma-DPS-{version}.exe"))}]});
        let mut rows = vec![
            release("0.16.1", false),
            release("0.17.0", true),
            release("0.15.0", false),
        ];
        assert_eq!(
            select_release(&serde_json::to_vec(&rows).unwrap()).unwrap(),
            Some("0.16.1".into())
        );
        rows[0]["assets"][0]["browser_download_url"] = json!("https://evil.test/luma-update.json");
        assert_eq!(
            select_release(&serde_json::to_vec(&rows).unwrap()).unwrap(),
            Some("0.15.0".into())
        );
        for url in [
            "http://github.com/a",
            "https://github.com.evil.test/a",
            "https://user@github.com/a",
            "https://github.com:444/a",
            "https://evil.test/a",
        ] {
            assert!(!allowed_url(&Url::parse(url).unwrap(), false));
        }
        assert!(allowed_url(
            &Url::parse("https://release-assets.githubusercontent.com/file?opaque=1").unwrap(),
            false
        ));
        assert!(!allowed_url(
            &Url::parse("https://github.com/a").unwrap(),
            true
        ));
    }
    #[test]
    fn executable_validation_requires_signed_size_hash_machine_and_pe32plus() {
        let mut bytes = vec![0u8; 512];
        bytes[..2].copy_from_slice(b"MZ");
        bytes[0x3c..0x40].copy_from_slice(&128u32.to_le_bytes());
        bytes[128..132].copy_from_slice(b"PE\0\0");
        bytes[132..134].copy_from_slice(&[0x64, 0x86]);
        bytes[152..154].copy_from_slice(&[0x0b, 0x02]);
        let mut manifest = fixture_manifest();
        manifest.artifact_bytes = 512;
        manifest.artifact_sha256 = sha256(&bytes);
        assert!(validate_artifact(&bytes, &manifest).is_ok());
        bytes[132] = 0x4c;
        assert!(!amd64_pe(&bytes));
        assert!(validate_artifact(&bytes, &manifest).is_err());
        bytes[132] = 0x64;
        bytes[152] = 0x0a;
        assert!(!amd64_pe(&bytes));
    }
    #[test]
    fn helper_arguments_preserve_literal_paths_and_reject_extra_commands_or_bad_targets() {
        let args = [
            HELPER_FLAG,
            "--target",
            "C:\\Users\\Name With ' Quotes\\Luma-DPS.exe",
            "--wait-pid",
            "123",
            "--from-version",
            "0.16.0",
            "--ready-file",
            "C:\\Users\\Name With ' Quotes\\install-123-12345.ready",
        ]
        .map(std::ffi::OsString::from);
        let (target, pid, from, ready) = parse_helper_args(&args).unwrap();
        assert_eq!(target, PathBuf::from(&args[2]));
        assert_eq!(pid, 123);
        assert_eq!(from, "0.16.0");
        assert_eq!(ready, PathBuf::from(&args[8]));
        let mut extra = args.to_vec();
        extra.push(";anything".into());
        assert!(parse_helper_args(&extra).is_err());
        assert!(target_name_valid(Path::new("Luma-DPS.exe")));
        assert!(target_name_valid(Path::new("Luma-DPS-0.16.1.exe")));
        for path in [
            "other.exe",
            "Luma-DPS-../a.exe",
            "Luma-DPS-1.exe",
            "Luma-DPS.exe:stream",
        ] {
            assert!(!target_name_valid(Path::new(path)));
        }
    }
    #[test]
    fn absent_or_older_downloads_never_launch_an_update_helper() {
        let service = UpdateService::new(PathBuf::from("unused"), "0.16.0").unwrap();
        assert_eq!(service.snapshot()["status"], "idle");
        assert!(service
            .install(PathBuf::from("Luma-DPS.exe"), std::process::id())
            .is_err());
        let mut inner = service.inner.lock().unwrap();
        inner.release = Some(VerifiedRelease {
            manifest: fixture_manifest(),
            raw_manifest: Vec::new(),
            raw_signature: Vec::new(),
        });
        inner.release.as_mut().unwrap().manifest.version = "0.15.0".into();
        inner.release.as_mut().unwrap().manifest.artifact = "Luma-DPS-0.15.0.exe".into();
        drop(inner);
        assert!(service.download().unwrap_err().contains("newer"));
    }
    #[test]
    fn cache_reads_are_bounded_and_failed_writes_preserve_existing_directories() {
        let directory = std::env::temp_dir().join(format!(
            "luma-update-cache-test-{}-{}",
            std::process::id(),
            now_ms()
        ));
        fs::create_dir(&directory).unwrap();
        let path = directory.join("Luma-DPS-0.16.1.exe");
        write_cache(&path, b"abcd").unwrap();
        assert!(read_bounded_file(&path, 3).is_err());
        write_cache(&path, b"ef").unwrap();
        assert_eq!(read_bounded_file(&path, 4).unwrap(), b"ef");
        let blocked = directory.join("blocked.exe");
        fs::create_dir(&blocked).unwrap();
        assert!(write_cache(&blocked, b"replacement").is_err());
        assert!(blocked.is_dir());
        assert!(!blocked.with_extension("exe.new").exists());
        fs::remove_file(&path).unwrap();
        fs::remove_dir(&blocked).unwrap();
        fs::remove_dir(&directory).unwrap();
    }
}
