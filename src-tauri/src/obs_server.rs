//! Optional OBS browser source. Loopback is the default. LAN binding requires an
//! explicit option and still accepts only loopback/private IPv4 peers, exact
//! numeric local hosts and a fresh per-start token. Capture is not started here.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeSet, HashMap};
use std::io::{Read, Write};
use std::net::{IpAddr, Ipv4Addr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

const MAX_HEADERS: usize = 8192;
const MAX_BODY: usize = 65_536;
const REQUEST_DEADLINE: Duration = Duration::from_millis(600);
pub type SnapshotProvider = Arc<dyn Fn() -> Value + Send + Sync + 'static>;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ObsScope {
    Personal,
    Party,
    Observed,
}
impl ObsScope {
    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "personal" => Ok(Self::Personal),
            "party" => Ok(Self::Party),
            "observed" => Ok(Self::Observed),
            _ => Err("Unknown stream scope".into()),
        }
    }
    fn label(self) -> &'static str {
        match self {
            Self::Personal => "personal",
            Self::Party => "party",
            Self::Observed => "observed",
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct ObsInfo {
    pub url: String,
    pub port: u16,
    pub scope: ObsScope,
    pub hide_names: bool,
    pub lan_enabled: bool,
    /// These bearer-token URLs are returned only over the desktop IPC API.
    /// Never include them in diagnostics, public reports or error messages.
    pub lan_urls: Vec<String>,
    pub bind_address: String,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(default, deny_unknown_fields)]
pub struct ObsOptions {
    pub lan_enabled: bool,
    pub port: Option<u16>,
}
impl ObsOptions {
    pub fn validate(self) -> Result<Self, String> {
        if self.port.is_some_and(|port| port < 1024) {
            return Err("Choose an OBS port from 1024 to 65535, or use an automatic port".into());
        }
        Ok(self)
    }
}

fn private_lan(address: Ipv4Addr) -> bool {
    address.is_private() && !address.is_unspecified() && !address.is_loopback()
}

/// Enumerates the OS interface table without probing remote hosts or changing
/// routing/firewall settings. Network-byte-order u32s are read as memory bytes.
#[cfg(windows)]
fn lan_addresses() -> Vec<Ipv4Addr> {
    use windows_sys::Win32::NetworkManagement::IpHelper::{
        GetIpAddrTable, MIB_IPADDRROW_XP, MIB_IPADDRTABLE, MIB_IPADDR_DELETED,
        MIB_IPADDR_DISCONNECTED,
    };
    let mut size = 0u32;
    if unsafe { GetIpAddrTable(std::ptr::null_mut(), &mut size, 0) } != 122 {
        return Vec::new();
    }
    if size < std::mem::size_of::<MIB_IPADDRTABLE>() as u32 || size > 1024 * 1024 {
        return Vec::new();
    }
    // usize allocation guarantees alignment for the native table and rows.
    let mut storage = vec![0usize; (size as usize).div_ceil(std::mem::size_of::<usize>())];
    let table = storage.as_mut_ptr().cast::<MIB_IPADDRTABLE>();
    if unsafe { GetIpAddrTable(table, &mut size, 0) } != 0 {
        return Vec::new();
    }
    let count = unsafe { (*table).dwNumEntries } as usize;
    let offset = std::mem::offset_of!(MIB_IPADDRTABLE, table);
    let capacity = storage.len() * std::mem::size_of::<usize>();
    if count > 4096
        || offset
            .checked_add(count.saturating_mul(std::mem::size_of::<MIB_IPADDRROW_XP>()))
            .is_none_or(|end| end > capacity)
    {
        return Vec::new();
    }
    let rows = unsafe {
        std::slice::from_raw_parts(
            storage
                .as_ptr()
                .cast::<u8>()
                .add(offset)
                .cast::<MIB_IPADDRROW_XP>(),
            count,
        )
    };
    let addresses: BTreeSet<_> = rows
        .iter()
        .filter(|row| u32::from(row.wType) & (MIB_IPADDR_DELETED | MIB_IPADDR_DISCONNECTED) == 0)
        .map(|row| Ipv4Addr::from(row.dwAddr.to_ne_bytes()))
        .filter(|address| private_lan(*address))
        .collect();
    addresses.into_iter().take(8).collect()
}
#[cfg(not(windows))]
fn lan_addresses() -> Vec<Ipv4Addr> {
    Vec::new()
}

pub struct RunningServer {
    info: ObsInfo,
    stop: Arc<AtomicBool>,
    worker: Option<JoinHandle<()>>,
}
impl RunningServer {
    pub fn info(&self) -> ObsInfo {
        self.info.clone()
    }
    pub fn stop(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}
impl Drop for RunningServer {
    fn drop(&mut self) {
        self.stop()
    }
}

#[cfg(windows)]
fn random_token() -> Result<String, String> {
    use windows_sys::Win32::Security::Cryptography::{
        BCryptGenRandom, BCRYPT_USE_SYSTEM_PREFERRED_RNG,
    };
    let mut token = [0u8; 16];
    let status = unsafe {
        BCryptGenRandom(
            std::ptr::null_mut(),
            token.as_mut_ptr(),
            token.len() as u32,
            BCRYPT_USE_SYSTEM_PREFERRED_RNG,
        )
    };
    if status < 0 {
        return Err("Windows random-token generation failed".into());
    }
    Ok(token.iter().map(|byte| format!("{byte:02x}")).collect())
}
#[cfg(not(windows))]
fn random_token() -> Result<String, String> {
    Err("The native OBS source currently requires Windows".into())
}

pub fn start(
    scope: ObsScope,
    hide_names: bool,
    provider: SnapshotProvider,
) -> Result<RunningServer, String> {
    start_with_options(scope, hide_names, ObsOptions::default(), provider)
}

pub fn start_with_options(
    scope: ObsScope,
    hide_names: bool,
    options: ObsOptions,
    provider: SnapshotProvider,
) -> Result<RunningServer, String> {
    let options = options.validate()?;
    let addresses = if options.lan_enabled {
        lan_addresses()
    } else {
        Vec::new()
    };
    if options.lan_enabled && addresses.is_empty() {
        return Err("No private IPv4 LAN address is available; use the local OBS source".into());
    }
    start_configured(
        scope,
        hide_names,
        options,
        addresses,
        provider,
        random_token()?,
    )
}

#[cfg(test)]
fn start_with_token(
    scope: ObsScope,
    hide_names: bool,
    provider: SnapshotProvider,
    token: String,
) -> Result<RunningServer, String> {
    start_configured(
        scope,
        hide_names,
        ObsOptions::default(),
        Vec::new(),
        provider,
        token,
    )
}

fn start_configured(
    scope: ObsScope,
    hide_names: bool,
    options: ObsOptions,
    addresses: Vec<Ipv4Addr>,
    provider: SnapshotProvider,
    token: String,
) -> Result<RunningServer, String> {
    let options = options.validate()?;
    if token.len() != 32 || !token.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Invalid OBS authentication token".into());
    }
    let addresses: Vec<_> = addresses
        .into_iter()
        .filter(|address| private_lan(*address))
        .collect::<BTreeSet<_>>()
        .into_iter()
        .take(8)
        .collect();
    if options.lan_enabled && addresses.is_empty() {
        return Err("No private IPv4 LAN address is available; use the local OBS source".into());
    }
    let bind_address = if options.lan_enabled {
        Ipv4Addr::UNSPECIFIED
    } else {
        Ipv4Addr::LOCALHOST
    };
    let listener = TcpListener::bind((bind_address, options.port.unwrap_or(0)))
        .map_err(|_| "Could not open the OBS source; the port may already be in use")?;
    listener
        .set_nonblocking(true)
        .map_err(|_| "Could not configure the local OBS source")?;
    let port = listener
        .local_addr()
        .map_err(|_| "Could not read the local OBS port")?
        .port();
    let info = ObsInfo {
        url: format!("http://127.0.0.1:{port}/overlay?key={token}"),
        port,
        scope,
        hide_names,
        lan_enabled: options.lan_enabled,
        lan_urls: if options.lan_enabled {
            addresses
                .iter()
                .map(|address| format!("http://{address}:{port}/overlay?key={token}"))
                .collect()
        } else {
            Vec::new()
        },
        bind_address: bind_address.to_string(),
    };
    let mut allowed_hosts = BTreeSet::from([format!("127.0.0.1:{port}")]);
    if options.lan_enabled {
        allowed_hosts.extend(addresses.iter().map(|address| format!("{address}:{port}")));
    }
    let stop = Arc::new(AtomicBool::new(false));
    let worker_stop = stop.clone();
    let worker = thread::Builder::new()
        .name("luma-obs-source".into())
        .spawn(move || {
            let mut aliases = Aliases::default();
            while !worker_stop.load(Ordering::Acquire) {
                match listener.accept() {
                    Ok((stream, peer)) if peer_allowed(peer.ip(), options.lan_enabled) => handle(
                        stream,
                        &allowed_hosts,
                        &token,
                        scope,
                        hide_names,
                        &provider,
                        &worker_stop,
                        &mut aliases,
                    ),
                    Ok(_) => {}
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(15))
                    }
                    Err(_) => break,
                }
            }
        })
        .map_err(|_| "Could not start the local OBS source")?;
    Ok(RunningServer {
        info,
        stop,
        worker: Some(worker),
    })
}

fn peer_allowed(address: IpAddr, lan_enabled: bool) -> bool {
    match address {
        IpAddr::V4(address) => address.is_loopback() || (lan_enabled && private_lan(address)),
        IpAddr::V6(_) => false,
    }
}

fn metric(value: Option<&Value>) -> Option<f64> {
    value
        .and_then(Value::as_f64)
        .filter(|number| number.is_finite() && *number >= 0.0)
}
fn actor(value: Option<&Value>) -> Option<u64> {
    value
        .and_then(Value::as_u64)
        .filter(|id| *id > 0 && *id <= u64::from(u32::MAX))
}
fn string(value: Option<&Value>, maximum: usize) -> String {
    value
        .and_then(Value::as_str)
        .unwrap_or("")
        .chars()
        .filter(|character| !character.is_control())
        .take(maximum)
        .collect()
}
fn class_name(value: Option<&Value>) -> String {
    let class = value
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_ascii_lowercase();
    if [
        "gladiator",
        "templar",
        "assassin",
        "ranger",
        "sorcerer",
        "spiritmaster",
        "cleric",
        "chanter",
        "fighter",
    ]
    .contains(&class.as_str())
    {
        class
    } else {
        "unknown".into()
    }
}

#[derive(Default)]
struct Aliases {
    ids: HashMap<u64, u64>,
    next: u64,
}
impl Aliases {
    fn id(&mut self, actor: u64) -> u64 {
        if let Some(id) = self.ids.get(&actor) {
            return *id;
        }
        if self.ids.len() >= 4096 {
            self.ids.clear();
            self.next = 0;
        }
        self.next += 1;
        self.ids.insert(actor, self.next);
        self.next
    }
}

/// Produces a small allowlisted snapshot. Hidden names do not survive in nested
/// character/target/capture metadata, because those raw objects are never copied.
fn stream_snapshot(raw: &Value, scope: ObsScope, hide_names: bool, aliases: &mut Aliases) -> Value {
    let rows = raw
        .get("players")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    let local = actor(raw.get("local_player_id"));
    let personal_known = local.is_some()
        && matches!(
            raw.get("local_identity_source").and_then(Value::as_str),
            Some("server" | "manual" | "name-match")
        );
    let party_known = matches!(
        raw.get("party_membership_source").and_then(Value::as_str),
        Some("server" | "manual")
    );
    let members: BTreeSet<u64> = raw
        .get("party_member_ids")
        .and_then(Value::as_array)
        .map(|members| {
            members
                .iter()
                .take(100)
                .filter_map(|value| actor(Some(value)))
                .collect()
        })
        .unwrap_or_default();
    let known = match scope {
        ObsScope::Personal => personal_known,
        ObsScope::Party => party_known,
        ObsScope::Observed => true,
    };
    let elapsed = match scope {
        ObsScope::Personal => metric(raw.get("personal_elapsed_ms")),
        ObsScope::Party => metric(raw.get("party_elapsed_ms")),
        ObsScope::Observed => None,
    }
    .or_else(|| metric(raw.get("elapsed_ms")))
    .unwrap_or(0.0);
    let selected: Vec<&Value> = if known {
        rows.iter()
            .filter(|row| match scope {
                ObsScope::Personal => actor(row.get("id")) == local,
                ObsScope::Party => actor(row.get("id")).is_some_and(|id| members.contains(&id)),
                ObsScope::Observed => actor(row.get("id")).is_some(),
            })
            .take(50)
            .collect()
    } else {
        Vec::new()
    };
    let known = known && !(scope == ObsScope::Personal && selected.len() > 1);
    let mut selected = if known { selected } else { Vec::new() };
    selected.sort_by(|left, right| {
        metric(right.get("damage"))
            .unwrap_or(0.0)
            .total_cmp(&metric(left.get("damage")).unwrap_or(0.0))
    });
    let sum: f64 = selected
        .iter()
        .map(|row| metric(row.get("damage")).unwrap_or(0.0))
        .sum();
    let (damage, dps) = if !known {
        (None, None)
    } else {
        let damage = match scope {
            ObsScope::Personal => metric(raw.get("personal_total_damage")),
            ObsScope::Party => metric(raw.get("party_total_damage")),
            ObsScope::Observed => metric(raw.get("total_damage")),
        }
        .unwrap_or(sum);
        let dps = match scope {
            ObsScope::Personal => metric(raw.get("personal_dps")),
            ObsScope::Party => metric(raw.get("party_dps")),
            ObsScope::Observed => metric(raw.get("dps")),
        }
        .unwrap_or(damage * 1000.0 / elapsed.max(1000.0));
        (Some(damage), Some(dps))
    };
    let players: Vec<Value> = selected.iter().map(|row| {
        let id = aliases.id(actor(row.get("id")).unwrap_or(0));
        let amount = metric(row.get("damage")).unwrap_or(0.0);
        let row_dps = match scope { ObsScope::Personal => dps.unwrap_or(0.0), ObsScope::Party => amount * 1000.0 / elapsed.max(1000.0), ObsScope::Observed => metric(row.get("dps")).unwrap_or(0.0) };
        json!({"id":id,"name":if hide_names {format!("Player {id}")} else {let name=string(row.get("name"),80);if name.is_empty(){format!("Player {id}")}else{name}},"class_name":class_name(row.get("class_name")),"damage":amount,"dps":row_dps,"share":damage.filter(|total|*total>0.0).map_or(0.0,|total|amount/total)})
    }).collect();
    let target_key = match scope {
        ObsScope::Personal => "personal_targets",
        ObsScope::Party => "party_targets",
        ObsScope::Observed => "targets",
    };
    let targets: Vec<Value> = if known {
        raw.get(target_key).and_then(Value::as_array).map(|targets| targets.iter().take(16).enumerate().map(|(index,target)| json!({"name":if hide_names{format!("Target {}",index+1)}else{string(target.get("name"),100)},"damage":metric(target.get("damage")),"current_hp":metric(target.get("current_hp")),"reported_max_hp":metric(target.get("reported_max_hp")),"is_boss":target.get("is_boss").and_then(Value::as_bool).unwrap_or(false)})).collect()).unwrap_or_default()
    } else {
        Vec::new()
    };
    let capture = raw.get("capture").unwrap_or(&Value::Null);
    let status = match capture
        .get("status")
        .and_then(Value::as_str)
        .or_else(|| raw.get("status").and_then(Value::as_str))
    {
        Some("capturing") => "capturing",
        Some("permission-required") => "permission-required",
        Some("unsupported") => "unsupported",
        Some("waiting-game" | "waiting_game") => "waiting-game",
        Some("closed" | "disconnected") => "disconnected",
        Some("error") => "error",
        _ => "unknown",
    };
    let diagnostics = raw.get("diagnostics").unwrap_or(&Value::Null);
    let gaps = diagnostics
        .get("stream_gaps")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let missed = capture
        .get("missed_packets")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let truncated = diagnostics
        .get("truncated_encounter")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    json!({"version":1,"actor_scope":scope.label(),"identity_known":known,"hide_names":hide_names,"elapsed_ms":elapsed,"total_damage":damage,"dps":dps,"players":players,"targets":targets,"capture_status":status,"incomplete":truncated||gaps>0||missed>0,"stream_gaps":gaps,"missed_packets":missed})
}

struct Request {
    path: String,
    headers: HashMap<String, String>,
}
fn parse_request(bytes: &[u8]) -> Result<Request, u16> {
    let raw = std::str::from_utf8(bytes).map_err(|_| 400u16)?;
    if !raw.ends_with("\r\n\r\n") || raw.chars().any(|character| character == '\0') {
        return Err(400);
    }
    let mut lines = raw.split("\r\n");
    let first: Vec<_> = lines.next().ok_or(400u16)?.split(' ').collect();
    if first.len() != 3 || !matches!(first[2], "HTTP/1.1" | "HTTP/1.0") {
        return Err(400);
    }
    if first[0] != "GET" {
        return Err(405);
    }
    if !first[1].starts_with('/') || first[1].contains(['#', '%', '\\']) {
        return Err(400);
    }
    let mut headers = HashMap::new();
    for line in lines {
        if line.is_empty() {
            break;
        }
        let (name, value) = line.split_once(':').ok_or(400u16)?;
        if name.is_empty()
            || !name
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
            || value
                .chars()
                .any(|character| character.is_control() && character != '\t')
        {
            return Err(400);
        }
        if headers
            .insert(name.to_ascii_lowercase(), value.trim().into())
            .is_some()
        {
            return Err(400);
        }
    }
    if headers.contains_key("transfer-encoding")
        || headers
            .get("content-length")
            .is_some_and(|value| value != "0")
    {
        return Err(400);
    }
    Ok(Request {
        path: first[1].into(),
        headers,
    })
}
fn token_equal(provided: &str, expected: &str) -> bool {
    if provided.len() != expected.len() {
        return false;
    }
    provided
        .bytes()
        .zip(expected.bytes())
        .fold(0u8, |difference, (a, b)| difference | (a ^ b))
        == 0
}

fn route(
    request: &Request,
    allowed_hosts: &BTreeSet<String>,
    token: &str,
) -> Result<&'static str, u16> {
    let host = request.headers.get("host").ok_or(403u16)?;
    if !allowed_hosts.contains(host) {
        return Err(403);
    }
    let origin = format!("http://{host}");
    if request
        .headers
        .get("origin")
        .is_some_and(|provided| provided != &origin)
    {
        return Err(403);
    }
    let (path, query) = request.path.split_once('?').ok_or(401u16)?;
    let key = query
        .strip_prefix("key=")
        .filter(|key| !key.contains('&'))
        .ok_or(401u16)?;
    if !token_equal(key, token) {
        return Err(401);
    }
    match path {
        "/overlay" => Ok("html"),
        "/overlay.js" => Ok("js"),
        "/overlay.css" => Ok("css"),
        "/state" => Ok("json"),
        _ => Err(404),
    }
}

fn response(stream: &mut TcpStream, status: u16, content_type: &str, body: &[u8]) {
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        413 => "Payload Too Large",
        _ => "Service Unavailable",
    };
    let header=format!("HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'\r\n\r\n",body.len());
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body);
}
fn handle(
    mut stream: TcpStream,
    allowed_hosts: &BTreeSet<String>,
    token: &str,
    scope: ObsScope,
    hide_names: bool,
    provider: &SnapshotProvider,
    stop: &AtomicBool,
    aliases: &mut Aliases,
) {
    if stream
        .set_read_timeout(Some(Duration::from_millis(100)))
        .is_err()
        || stream
            .set_write_timeout(Some(Duration::from_millis(150)))
            .is_err()
    {
        return;
    }
    let began = Instant::now();
    let mut bytes = Vec::with_capacity(1024);
    let mut chunk = [0u8; 1024];
    while !bytes.ends_with(b"\r\n\r\n") {
        if stop.load(Ordering::Acquire) || began.elapsed() > REQUEST_DEADLINE {
            return;
        }
        match stream.read(&mut chunk) {
            Ok(0) => return,
            Ok(count) => {
                bytes.extend_from_slice(&chunk[..count]);
                if bytes.len() > MAX_HEADERS {
                    response(
                        &mut stream,
                        413,
                        "text/plain; charset=utf-8",
                        b"Request too large",
                    );
                    return;
                }
            }
            Err(error)
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock
                ) =>
            {
                continue
            }
            Err(_) => return,
        }
    }
    let request = match parse_request(&bytes) {
        Ok(request) => request,
        Err(status) => {
            response(
                &mut stream,
                status,
                "text/plain; charset=utf-8",
                b"Request rejected",
            );
            return;
        }
    };
    let endpoint = match route(&request, allowed_hosts, token) {
        Ok(endpoint) => endpoint,
        Err(status) => {
            response(
                &mut stream,
                status,
                "text/plain; charset=utf-8",
                b"Request rejected",
            );
            return;
        }
    };
    let (content_type, body) = match endpoint {
        "html" => (
            "text/html; charset=utf-8",
            include_str!("obs/overlay.html")
                .replace("__KEY__", token)
                .into_bytes(),
        ),
        "js" => (
            "text/javascript; charset=utf-8",
            include_bytes!("obs/overlay.js").to_vec(),
        ),
        "css" => (
            "text/css; charset=utf-8",
            include_bytes!("obs/overlay.css").to_vec(),
        ),
        "json" => {
            let raw = provider();
            let value = stream_snapshot(&raw, scope, hide_names, aliases);
            let Ok(body) = serde_json::to_vec(&value) else {
                return;
            };
            if body.len() > MAX_BODY {
                response(
                    &mut stream,
                    503,
                    "text/plain; charset=utf-8",
                    b"Snapshot limit exceeded",
                );
                return;
            }
            ("application/json; charset=utf-8", body)
        }
        _ => return,
    };
    response(&mut stream, 200, content_type, &body);
}

#[cfg(test)]
mod tests {
    use super::*;
    fn hosts(port: u16) -> BTreeSet<String> {
        BTreeSet::from([format!("127.0.0.1:{port}")])
    }
    fn state() -> Value {
        json!({"local_player_id":7,"local_identity_source":"server","personal_total_damage":1000,"personal_dps":20,"personal_elapsed_ms":50000,"party_member_ids":[7],"party_membership_source":"server","party_total_damage":1000,"party_dps":20,"party_elapsed_ms":50000,"total_damage":3000,"dps":50,"elapsed_ms":60000,"players":[{"id":7,"name":"SelfName","class_name":"ranger","damage":1000,"dps":16.6},{"id":8,"name":"NearbyName","class_name":"cleric","damage":2000,"dps":33.3}],"personal_targets":[{"id":50,"name":"SecretTarget","damage":1000}],"targets":[{"id":50,"name":"SecretTarget","damage":3000}],"character_build":{"name":"SecretBuild"},"capture":{"status":"capturing","detail":"private endpoint","missed_packets":1},"diagnostics":{"stream_gaps":2}})
    }
    fn request(path: &str, port: u16, origin: Option<&str>) -> Vec<u8> {
        format!(
            "GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n{}\r\n",
            origin
                .map(|origin| format!("Origin: {origin}\r\n"))
                .unwrap_or_default()
        )
        .into_bytes()
    }
    fn read(port: u16, bytes: &[u8]) -> String {
        let mut socket = TcpStream::connect((Ipv4Addr::LOCALHOST, port)).unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(2)))
            .unwrap();
        socket.write_all(bytes).unwrap();
        let mut output = String::new();
        socket.read_to_string(&mut output).unwrap();
        output
    }
    #[test]
    fn personal_scope_excludes_strangers_and_nested_identity_while_projecting_own_clock() {
        let raw = state();
        let output = stream_snapshot(&raw, ObsScope::Personal, true, &mut Aliases::default());
        let serialized = output.to_string();
        assert!(!serialized.contains("SelfName"));
        assert!(!serialized.contains("NearbyName"));
        assert!(!serialized.contains("SecretBuild"));
        assert!(!serialized.contains("SecretTarget"));
        assert!(!serialized.contains("private endpoint"));
        assert_eq!(output["players"].as_array().unwrap().len(), 1);
        assert_eq!(output["total_damage"].as_f64(), Some(1000.0));
        assert_eq!(output["players"][0]["dps"].as_f64(), Some(20.0));
        assert_eq!(output["elapsed_ms"].as_f64(), Some(50000.0));
        assert_eq!(output["incomplete"], true)
    }
    #[test]
    fn unknown_identity_and_party_are_unknown_instead_of_nearby_group_totals() {
        let mut raw = state();
        raw["local_identity_source"] = json!("unresolved");
        raw["party_membership_source"] = json!("unresolved");
        for scope in [ObsScope::Personal, ObsScope::Party] {
            let output = stream_snapshot(&raw, scope, false, &mut Aliases::default());
            assert!(output["total_damage"].is_null());
            assert!(output["players"].as_array().unwrap().is_empty());
            assert!(output["targets"].as_array().unwrap().is_empty())
        }
    }
    #[test]
    fn party_scope_cannot_be_overridden_by_an_out_of_roster_row_flag() {
        let mut raw = state();
        raw["players"][1]["in_party"] = json!(true);
        let output = stream_snapshot(&raw, ObsScope::Party, false, &mut Aliases::default());
        assert_eq!(output["players"].as_array().unwrap().len(), 1);
        assert!(!output.to_string().contains("NearbyName"));
    }
    #[test]
    fn explicit_observed_scope_and_optional_names_are_preserved_as_data_not_html() {
        let mut raw = state();
        raw["players"][0]["name"] = json!("<script>alert(1)</script>");
        let output = stream_snapshot(&raw, ObsScope::Observed, false, &mut Aliases::default());
        assert_eq!(output["actor_scope"], "observed");
        assert_eq!(output["players"].as_array().unwrap().len(), 2);
        assert_eq!(output["players"][1]["name"], "<script>alert(1)</script>");
        assert!(include_str!("obs/overlay.js").contains("textContent"));
        assert!(!include_str!("obs/overlay.js").contains("innerHTML"))
    }
    #[test]
    fn anonymous_actor_aliases_stay_stable_when_damage_order_changes() {
        let mut raw = state();
        let mut aliases = Aliases::default();
        let first = stream_snapshot(&raw, ObsScope::Observed, true, &mut aliases);
        raw["players"][0]["damage"] = json!(3000);
        let second = stream_snapshot(&raw, ObsScope::Observed, true, &mut aliases);
        assert_eq!(first["players"][1]["id"], second["players"][0]["id"]);
        assert_eq!(first["players"][1]["name"], second["players"][0]["name"])
    }
    #[test]
    fn every_path_requires_token_with_exact_host_and_same_origin() {
        let good = "a".repeat(32);
        for path in ["/overlay", "/overlay.js", "/overlay.css", "/state"] {
            assert_eq!(
                route(
                    &parse_request(&request(path, 8080, None)).unwrap(),
                    &hosts(8080),
                    &good
                ),
                Err(401)
            );
            let path = format!("{path}?key={good}");
            assert!(route(
                &parse_request(&request(&path, 8080, None)).unwrap(),
                &hosts(8080),
                &good
            )
            .is_ok());
            assert_eq!(
                route(
                    &parse_request(&request(&path, 8080, Some("https://evil.test"))).unwrap(),
                    &hosts(8080),
                    &good
                ),
                Err(403)
            );
        }
        let mut parsed =
            parse_request(&request(&format!("/state?key={good}"), 8080, None)).unwrap();
        parsed.headers.insert("host".into(), "evil.test".into());
        assert_eq!(route(&parsed, &hosts(8080), &good), Err(403));
    }
    #[test]
    fn malformed_and_body_requests_cannot_be_used_for_files_or_alternate_scope() {
        assert_eq!(
            parse_request(b"POST /state HTTP/1.1\r\nHost: local\r\n\r\n").err(),
            Some(405)
        );
        assert_eq!(
            parse_request(b"GET /%2e%2e HTTP/1.1\r\nHost: local\r\n\r\n").err(),
            Some(400)
        );
        assert_eq!(
            parse_request(b"GET /state HTTP/1.1\r\nHost: local\r\nHost: local\r\n\r\n").err(),
            Some(400)
        );
        assert_eq!(
            parse_request(b"GET /state HTTP/1.1\r\nHost: local\r\nContent-Length: 1\r\n\r\n").err(),
            Some(400)
        );
        let parsed = parse_request(&request(
            "/state?key=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&scope=observed",
            8080,
            None,
        ))
        .unwrap();
        assert_eq!(route(&parsed, &hosts(8080), &"a".repeat(32)), Err(401));
    }
    #[test]
    fn lan_hosts_and_origins_must_match_a_bounded_local_numeric_allowlist() {
        let key = "d".repeat(32);
        let allowed =
            BTreeSet::from(["127.0.0.1:8080".to_string(), "192.168.1.2:8080".to_string()]);
        let mut parsed = parse_request(&request(&format!("/state?key={key}"), 8080, None)).unwrap();
        parsed
            .headers
            .insert("host".into(), "192.168.1.2:8080".into());
        parsed
            .headers
            .insert("origin".into(), "http://192.168.1.2:8080".into());
        assert_eq!(route(&parsed, &allowed, &key), Ok("json"));
        for host in [
            "192.168.1.3:8080",
            "example.com:8080",
            "0.0.0.0:8080",
            "192.168.1.2:80",
            "[::1]:8080",
        ] {
            parsed.headers.insert("host".into(), host.into());
            assert_eq!(route(&parsed, &allowed, &key), Err(403));
        }
        parsed
            .headers
            .insert("host".into(), "192.168.1.2:8080".into());
        parsed
            .headers
            .insert("origin".into(), "http://127.0.0.1:8080".into());
        assert_eq!(route(&parsed, &allowed, &key), Err(403));
        parsed.headers.remove("origin");
        for path in [
            "/",
            "/settings",
            "/api",
            "/overlay/../state",
            "/state?scope=observed",
            "/state?key=bad",
        ] {
            parsed.path = if path.contains('?') {
                path.to_string()
            } else {
                format!("{path}?key={key}")
            };
            assert!(route(&parsed, &allowed, &key).is_err());
        }
    }
    #[test]
    fn lan_opt_in_rejects_public_peers_and_default_mode_stays_loopback_only() {
        for address in ["10.1.2.3", "172.16.0.1", "192.168.1.7"] {
            let address = address.parse::<IpAddr>().unwrap();
            assert!(peer_allowed(address, true));
            assert!(!peer_allowed(address, false));
        }
        for address in [
            "8.8.8.8",
            "0.0.0.0",
            "224.0.0.1",
            "169.254.1.1",
            "::1",
            "::ffff:192.168.1.1",
        ] {
            assert!(!peer_allowed(address.parse().unwrap(), true));
        }
        assert!(peer_allowed("127.0.0.1".parse().unwrap(), false));
        assert!(!ObsOptions::default().lan_enabled);
        assert!(ObsOptions {
            lan_enabled: false,
            port: Some(80)
        }
        .validate()
        .is_err());
        assert!(ObsOptions {
            lan_enabled: true,
            port: Some(0)
        }
        .validate()
        .is_err());
        assert!(ObsOptions {
            lan_enabled: true,
            port: Some(65535)
        }
        .validate()
        .is_ok());
        assert!(start_configured(
            ObsScope::Personal,
            true,
            ObsOptions {
                lan_enabled: true,
                port: None
            },
            vec!["8.8.8.8".parse().unwrap()],
            Arc::new(state),
            "e".repeat(32)
        )
        .is_err());
        assert!(start_with_token(
            ObsScope::Personal,
            true,
            Arc::new(state),
            "not a valid token".into()
        )
        .is_err());
    }
    #[test]
    fn loopback_server_authorizes_data_and_stops_without_leaving_listener() {
        let provider: SnapshotProvider = Arc::new(state);
        let key = "b".repeat(32);
        let mut server = start_with_token(ObsScope::Personal, true, provider, key.clone()).unwrap();
        let port = server.info().port;
        assert!(!server.info().lan_enabled);
        assert!(server.info().lan_urls.is_empty());
        assert_eq!(server.info().bind_address, "127.0.0.1");
        let unauthorized = read(port, &request("/state", port, None));
        assert!(unauthorized.starts_with("HTTP/1.1 401"));
        let authorized = read(port, &request(&format!("/state?key={key}"), port, None));
        assert!(authorized.starts_with("HTTP/1.1 200"));
        assert!(authorized.contains("default-src 'none'"));
        assert!(!authorized.contains("NearbyName"));
        assert!(!authorized.contains("SelfName"));
        server.stop();
        assert!(TcpStream::connect((Ipv4Addr::LOCALHOST, port)).is_err())
    }
    #[test]
    fn incomplete_client_cannot_hold_shutdown_open() {
        let provider: SnapshotProvider = Arc::new(state);
        let mut server =
            start_with_token(ObsScope::Personal, true, provider, "c".repeat(32)).unwrap();
        let mut client = TcpStream::connect((Ipv4Addr::LOCALHOST, server.info().port)).unwrap();
        client.write_all(b"GET /state HTTP/1.1\r\n").unwrap();
        thread::sleep(Duration::from_millis(30));
        let at = Instant::now();
        server.stop();
        assert!(at.elapsed() < Duration::from_secs(2))
    }
    #[cfg(windows)]
    #[test]
    fn per_start_windows_tokens_have_128_bits_and_are_not_reused() {
        let first = random_token().unwrap();
        let second = random_token().unwrap();
        assert_eq!(first.len(), 32);
        assert!(first.bytes().all(|byte| byte.is_ascii_hexdigit()));
        assert_ne!(first, second)
    }
    #[test]
    fn occupied_fixed_port_returns_safe_error_without_exposing_the_token() {
        let occupied = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let key = "f".repeat(32);
        let error = start_configured(
            ObsScope::Personal,
            true,
            ObsOptions {
                lan_enabled: false,
                port: Some(occupied.local_addr().unwrap().port()),
            },
            Vec::new(),
            Arc::new(state),
            key.clone(),
        )
        .err()
        .unwrap();
        assert!(!error.contains(&key));
        assert!(error.contains("port"));
    }
}
