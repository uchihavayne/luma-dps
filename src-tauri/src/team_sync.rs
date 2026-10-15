//! Explicit, short-lived team cooldown rooms. Credentials and room snapshots
//! stay in memory; capture buffers, game actor ids and encounters never enter
//! the relay payload. No request is made before create_room or join_room.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeSet;
use std::io::Read;
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

pub const ENDPOINT: &str = "https://luma-dps-community.uchihavayne.chatgpt.site";
pub const FRESH_MS: u64 = 6_000;
const PEER_TTL_MS: u64 = 20_000;
const ROOM_TTL_MS: u64 = 120 * 60 * 1_000;
const RESPONSE_LIMIT: usize = 256 * 1024;
const REQUEST_LIMIT: usize = 32 * 1024;
const MAX_PEERS: usize = 12;
const MAX_COOLDOWNS: usize = 64;
const MAX_SAFE_JS: u64 = 9_007_199_254_740_991;
const TIMEOUT: Duration = Duration::from_secs(5);
const POLL_INTERVAL: Duration = Duration::from_secs(5);
pub type OwnProvider = Arc<dyn Fn() -> Value + Send + Sync>;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Cooldown {
    pub skill_id: u32,
    pub raw_remaining_units: Option<u32>,
    pub estimated_remaining_ms: Option<u64>,
    pub charges: Option<u32>,
    pub age_ms: u64,
    pub ready_confirmed: bool,
}

impl Cooldown {
    fn valid(&self) -> bool {
        self.skill_id > 0
            && self
                .raw_remaining_units
                .is_none_or(|value| value <= 3_600_000)
            && self
                .estimated_remaining_ms
                .is_none_or(|value| value <= 3_600_000)
            && self.charges.is_none_or(|value| value <= 100)
            && self.age_ms <= 86_400_000
            && (!self.ready_confirmed || self.raw_remaining_units == Some(0))
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OwnData {
    pub display_name: String,
    pub class_name: String,
    pub cooldowns: Vec<Cooldown>,
    pub capture_live: bool,
}

impl OwnData {
    fn cleaned(mut self) -> Result<Self, String> {
        self.display_name = display_text(&self.display_name)?;
        self.class_name = class_name(&self.class_name)?;
        if self.cooldowns.len() > MAX_COOLDOWNS {
            return Err("Team cooldown payload exceeds 64 skills".into());
        }
        let mut seen = BTreeSet::new();
        if self
            .cooldowns
            .iter()
            .any(|cooldown| !cooldown.valid() || !seen.insert(cooldown.skill_id))
        {
            return Err("Team cooldown payload contains invalid or duplicate skills".into());
        }
        if !self.capture_live {
            self.cooldowns.clear();
        } else {
            for cooldown in &mut self.cooldowns {
                if cooldown.age_ms > FRESH_MS {
                    cooldown.ready_confirmed = false;
                }
            }
        }
        Ok(self)
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct CooldownView {
    pub skill_id: u32,
    pub raw_remaining_units: Option<u32>,
    pub estimated_remaining_ms: Option<u64>,
    pub charges: Option<u32>,
    pub age_ms: u64,
    pub ready_confirmed: bool,
    pub fresh: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct PeerView {
    pub peer_id: String,
    pub display_name: String,
    pub class_name: String,
    pub is_self: bool,
    pub received_at_ms: u64,
    pub sequence: u64,
    pub capture_live: bool,
    pub fresh: bool,
    pub age_ms: u64,
    pub cooldowns: Vec<CooldownView>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Snapshot {
    pub sampled_at_ms: u64,
    pub enabled: bool,
    pub status: String,
    pub room_id: Option<String>,
    pub self_peer_id: Option<String>,
    pub expires_at_ms: Option<u64>,
    pub is_host: bool,
    pub peers: Vec<PeerView>,
    pub last_sync_at_ms: Option<u64>,
    pub error: String,
}

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct RoomCreated {
    room_id: String,
    expires_at_ms: u64,
}

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct PeerJoined {
    peer_id: String,
    expires_at_ms: u64,
}

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct ReceivedPeer {
    peer_id: String,
    display_name: String,
    class_name: String,
    received_at_ms: u64,
    sequence: u64,
    capture_live: bool,
    cooldowns: Vec<Cooldown>,
}

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct SyncReply {
    server_time_ms: u64,
    expires_at_ms: u64,
    peers: Vec<ReceivedPeer>,
}

// Deliberately no Debug or Serialize: credentials cannot enter UI snapshots.
#[derive(Clone)]
struct Session {
    room_id: String,
    join_token: String,
    host_token: Option<String>,
    peer_id: String,
    peer_token: String,
    expires_at_ms: u64,
    display_name: String,
    class_name: String,
}

struct Inner {
    generation: u64,
    status: String,
    session: Option<Session>,
    peers: Vec<ReceivedPeer>,
    server_time_ms: Option<u64>,
    last_sync_at_ms: Option<u64>,
    last_sync_instant: Option<Instant>,
    transport_age_ms: u64,
    error: String,
}

impl Default for Inner {
    fn default() -> Self {
        Self {
            generation: 0,
            status: "idle".into(),
            session: None,
            peers: Vec::new(),
            server_time_ms: None,
            last_sync_at_ms: None,
            last_sync_instant: None,
            transport_age_ms: 0,
            error: String::new(),
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Method {
    Post,
    Delete,
}

struct Reply {
    status: u16,
    body: Vec<u8>,
}

trait Transport: Send + Sync {
    fn request(
        &self,
        method: Method,
        path: &str,
        body: Option<&[u8]>,
        token: Option<&str>,
    ) -> Result<Reply, String>;
}

struct HttpsTransport {
    client: reqwest::blocking::Client,
}

impl HttpsTransport {
    fn new() -> Result<Self, String> {
        Ok(Self {
            client: reqwest::blocking::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .connect_timeout(TIMEOUT)
                .timeout(TIMEOUT)
                .user_agent("Luma-DPS Team Sync")
                .build()
                .map_err(|_| "Cannot prepare the team HTTPS client")?,
        })
    }
}

impl Transport for HttpsTransport {
    fn request(
        &self,
        method: Method,
        path: &str,
        body: Option<&[u8]>,
        token: Option<&str>,
    ) -> Result<Reply, String> {
        if !allowed_path(method, path)
            || token.is_some_and(|value| !valid_hex(value, 64))
            || body.is_some_and(|value| value.len() > REQUEST_LIMIT)
        {
            return Err("Invalid team relay request".into());
        }
        let url = format!("{ENDPOINT}{path}");
        let mut request = match method {
            Method::Post => self.client.post(&url),
            Method::Delete => self.client.delete(&url),
        }
        .header(reqwest::header::ACCEPT, "application/json");
        if let Some(token) = token {
            request = request.bearer_auth(token);
        }
        if let Some(body) = body {
            request = request
                .header(reqwest::header::CONTENT_TYPE, "application/json")
                .body(body.to_vec());
        }
        let response = request
            .send()
            .map_err(|_| "Team service could not be reached")?;
        if response.status().is_redirection() || response.url().as_str() != url {
            return Err("Team service redirects are not accepted".into());
        }
        let status = response.status().as_u16();
        if !response.status().is_success() {
            return Err(http_error(status));
        }
        if status == 204 {
            return Ok(Reply {
                status,
                body: Vec::new(),
            });
        }
        let json = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .split(';')
            .next()
            .unwrap_or("")
            .trim()
            .eq_ignore_ascii_case("application/json");
        if !json
            || response
                .content_length()
                .is_some_and(|value| value > RESPONSE_LIMIT as u64)
        {
            return Err("Team service returned an unsupported or oversized response".into());
        }
        let mut body = Vec::new();
        response
            .take((RESPONSE_LIMIT + 1) as u64)
            .read_to_end(&mut body)
            .map_err(|_| "Team response was interrupted")?;
        if body.len() > RESPONSE_LIMIT {
            return Err("Team response exceeds 256 KB".into());
        }
        Ok(Reply { status, body })
    }
}

fn http_error(status: u16) -> String {
    match status {
        401 | 403 => "Team invitation or room permission is no longer valid".into(),
        404 | 410 => "Team room expired or was closed".into(),
        409 => "Team room is full or the snapshot sequence is outdated".into(),
        429 => "Free team relay request limit reached; try later".into(),
        _ => format!("Team service returned HTTP {status}"),
    }
}

fn allowed_path(method: Method, path: &str) -> bool {
    let parts: Vec<_> = path.split('/').collect();
    match (method, parts.as_slice()) {
        (Method::Post, ["", "v1", "rooms"]) => true,
        (Method::Post, ["", "v1", "rooms", room, "join" | "sync"]) => valid_hex(room, 32),
        (Method::Delete, ["", "v1", "rooms", room]) => valid_hex(room, 32),
        (Method::Delete, ["", "v1", "rooms", room, "peers", peer]) => {
            valid_hex(room, 32) && valid_hex(peer, 32)
        }
        _ => false,
    }
}

fn valid_hex(value: &str, size: usize) -> bool {
    value.len() == size
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn parse_invite(value: &str) -> Result<(String, String), String> {
    if value.len() > 102 || value != value.trim() {
        return Err("Use a LUMA room invitation code".into());
    }
    let parts: Vec<_> = value.split(':').collect();
    match parts.as_slice() {
        ["LUMA", room, token] if valid_hex(room, 32) && valid_hex(token, 64) => {
            Ok((room.to_string(), token.to_string()))
        }
        _ => Err("Use a LUMA room invitation code".into()),
    }
}

fn display_text(value: &str) -> Result<String, String> {
    let value = value.trim();
    let entity_placeholder = ["#", "Player #", "Target #", "NPC #"]
        .iter()
        .filter_map(|prefix| value.strip_prefix(prefix))
        .any(|number| !number.is_empty() && number.bytes().all(|byte| byte.is_ascii_digit()));
    if value.is_empty()
        || entity_placeholder
        || value == "—"
        || value.eq_ignore_ascii_case("unknown")
        || value.chars().count() > 80
        || value.chars().any(|character| {
            character.is_control()
                || ('\u{202a}'..='\u{202e}').contains(&character)
                || ('\u{2066}'..='\u{2069}').contains(&character)
        })
    {
        return Err("A resolved local character name is required for team sync".into());
    }
    Ok(value.to_string())
}

fn class_name(value: &str) -> Result<String, String> {
    [
        "Gladiator",
        "Templar",
        "Assassin",
        "Ranger",
        "Sorcerer",
        "Spiritmaster",
        "Cleric",
        "Chanter",
        "Unknown",
    ]
    .into_iter()
    .find(|class| class.eq_ignore_ascii_case(value.trim()))
    .map(String::from)
    .ok_or_else(|| "Unknown team class".into())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(u128::from(u64::MAX)) as u64
}

#[cfg(windows)]
fn random_token() -> Result<String, String> {
    use windows_sys::Win32::Security::Cryptography::{
        BCryptGenRandom, BCRYPT_USE_SYSTEM_PREFERRED_RNG,
    };
    let mut bytes = [0u8; 32];
    let result = unsafe {
        BCryptGenRandom(
            std::ptr::null_mut(),
            bytes.as_mut_ptr(),
            bytes.len() as u32,
            BCRYPT_USE_SYSTEM_PREFERRED_RNG,
        )
    };
    if result < 0 {
        return Err("Windows could not generate a secure team key".into());
    }
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

#[cfg(not(windows))]
fn random_token() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    std::fs::File::open("/dev/urandom")
        .and_then(|mut file| file.read_exact(&mut bytes))
        .map_err(|_| "Cannot generate a secure team key")?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn decode<T: for<'de> Deserialize<'de>>(reply: Reply) -> Result<T, String> {
    if !(200..=299).contains(&reply.status) {
        return Err(http_error(reply.status));
    }
    if reply.body.len() > RESPONSE_LIMIT {
        return Err("Team response exceeds 256 KB".into());
    }
    serde_json::from_slice(&reply.body).map_err(|_| "Team service returned invalid data".into())
}

fn valid_expiry(value: u64, at: u64) -> bool {
    value > at && value <= MAX_SAFE_JS && value <= at.saturating_add(ROOM_TTL_MS + 60_000)
}

fn validate_sync(reply: &SyncReply) -> Result<(), String> {
    if reply.server_time_ms == 0
        || reply.server_time_ms > MAX_SAFE_JS
        || !valid_expiry(reply.expires_at_ms, reply.server_time_ms)
        || reply.peers.len() > MAX_PEERS
    {
        return Err("Invalid team snapshot bounds".into());
    }
    let mut seen = BTreeSet::new();
    for peer in &reply.peers {
        if !valid_hex(&peer.peer_id, 32)
            || !seen.insert(&peer.peer_id)
            || display_text(&peer.display_name).is_err()
            || class_name(&peer.class_name).is_err()
            || peer.sequence > MAX_SAFE_JS
            || peer.received_at_ms > reply.server_time_ms
            || peer.cooldowns.len() > MAX_COOLDOWNS
        {
            return Err("Invalid team participant".into());
        }
        let mut skills = BTreeSet::new();
        if peer
            .cooldowns
            .iter()
            .any(|cooldown| !cooldown.valid() || !skills.insert(cooldown.skill_id))
        {
            return Err("Invalid team cooldown snapshot".into());
        }
    }
    Ok(())
}

fn peer_view(
    peer: &ReceivedPeer,
    self_id: &str,
    server_time_ms: u64,
    received_locally_at: u64,
    at: u64,
    minimum_elapsed_ms: u64,
) -> Option<PeerView> {
    if at < received_locally_at || peer.received_at_ms > server_time_ms {
        return None;
    }
    let elapsed = (at - received_locally_at).max(minimum_elapsed_ms);
    let age = server_time_ms
        .saturating_sub(peer.received_at_ms)
        .saturating_add(elapsed);
    if age > PEER_TTL_MS {
        return None;
    }
    let fresh = peer.capture_live && age <= FRESH_MS;
    let cooldowns = peer
        .cooldowns
        .iter()
        .map(|cooldown| {
            // Server age_ms already includes its time since the sender's POST.
            let observed_age = cooldown.age_ms.saturating_add(elapsed);
            let fresh = fresh && observed_age <= FRESH_MS;
            let ready_confirmed =
                fresh && cooldown.ready_confirmed && cooldown.raw_remaining_units == Some(0);
            CooldownView {
                skill_id: cooldown.skill_id,
                raw_remaining_units: fresh.then_some(cooldown.raw_remaining_units).flatten(),
                estimated_remaining_ms: if ready_confirmed {
                    Some(0)
                } else if fresh {
                    cooldown
                        .estimated_remaining_ms
                        .map(|remaining| remaining.saturating_sub(observed_age))
                } else {
                    None
                },
                charges: fresh.then_some(cooldown.charges).flatten(),
                age_ms: observed_age,
                ready_confirmed,
                fresh,
            }
        })
        .collect();
    Some(PeerView {
        peer_id: peer.peer_id.clone(),
        display_name: peer.display_name.clone(),
        class_name: peer.class_name.clone(),
        is_self: peer.peer_id == self_id,
        received_at_ms: peer.received_at_ms,
        sequence: peer.sequence,
        capture_live: peer.capture_live,
        fresh,
        age_ms: age,
        cooldowns,
    })
}

pub struct Service {
    provider: OwnProvider,
    transport: Arc<dyn Transport>,
    inner: Mutex<Inner>,
    wake: Condvar,
}

impl Service {
    pub fn new(provider: OwnProvider) -> Result<Self, String> {
        Ok(Self::with_transport(
            provider,
            Arc::new(HttpsTransport::new()?),
        ))
    }
    fn with_transport(provider: OwnProvider, transport: Arc<dyn Transport>) -> Self {
        Self {
            provider,
            transport,
            inner: Mutex::new(Inner::default()),
            wake: Condvar::new(),
        }
    }

    fn own_data(&self) -> Result<OwnData, String> {
        let value = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| (self.provider)()))
            .map_err(|_| "Local team snapshot is unavailable")?;
        serde_json::from_value::<OwnData>(value)
            .map_err(|_| "Local team snapshot is invalid")?
            .cleaned()
    }

    fn begin(self: &Arc<Self>) -> u64 {
        let (generation, old) = {
            let mut inner = self
                .inner
                .lock()
                .unwrap_or_else(|poison| poison.into_inner());
            let old = inner.session.take();
            inner.generation = inner.generation.wrapping_add(1);
            inner.status = "connecting".into();
            inner.peers.clear();
            inner.server_time_ms = None;
            inner.last_sync_at_ms = None;
            inner.last_sync_instant = None;
            inner.transport_age_ms = 0;
            inner.error.clear();
            (inner.generation, old)
        };
        self.wake.notify_all();
        if let Some(old) = old {
            self.cleanup_later(old);
        }
        generation
    }

    fn generation_matches(&self, generation: u64) -> bool {
        self.inner
            .lock()
            .unwrap_or_else(|poison| poison.into_inner())
            .generation
            == generation
    }

    fn fail_connect(&self, generation: u64, error: &str) {
        let mut inner = self
            .inner
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        if inner.generation == generation {
            inner.status = "error".into();
            inner.error = error.to_string();
        }
    }

    pub fn create_room(self: &Arc<Self>) -> Result<Snapshot, String> {
        let own = self.own_data()?;
        let join_token = random_token()?;
        let host_token = random_token()?;
        let peer_token = random_token()?;
        let generation = self.begin();
        let created = (|| {
            let body = serde_json::to_vec(&serde_json::json!({ "join_token": join_token, "host_token": host_token, "ttl_minutes": 120 })).map_err(|_| "Cannot encode team room")?;
            let room: RoomCreated =
                decode(
                    self.transport
                        .request(Method::Post, "/v1/rooms", Some(&body), None)?,
                )?;
            if !valid_hex(&room.room_id, 32) || !valid_expiry(room.expires_at_ms, now_ms()) {
                return Err("Invalid team room response".into());
            }
            Ok::<_, String>(room)
        })();
        let room = match created {
            Ok(room) => room,
            Err(error) => {
                self.fail_connect(generation, &error);
                return Err(error);
            }
        };
        let temporary = Session {
            room_id: room.room_id.clone(),
            join_token,
            host_token: Some(host_token),
            peer_id: String::new(),
            peer_token,
            expires_at_ms: room.expires_at_ms,
            display_name: own.display_name.clone(),
            class_name: own.class_name.clone(),
        };
        if !self.generation_matches(generation) {
            self.cleanup_later(temporary);
            return Err("Team operation was cancelled".into());
        }
        self.finish_join(generation, temporary, own)
    }

    pub fn join_room(self: &Arc<Self>, invite: &str) -> Result<Snapshot, String> {
        let (room_id, join_token) = parse_invite(invite)?;
        {
            let inner = self
                .inner
                .lock()
                .unwrap_or_else(|poison| poison.into_inner());
            if let Some(current) = inner
                .session
                .as_ref()
                .filter(|current| current.room_id == room_id && current.expires_at_ms > now_ms())
            {
                if current.join_token != join_token {
                    return Err("This invitation does not match the active team room".into());
                }
                drop(inner);
                return Ok(self.snapshot());
            }
        }
        let own = self.own_data()?;
        let peer_token = random_token()?;
        let generation = self.begin();
        let temporary = Session {
            room_id,
            join_token,
            host_token: None,
            peer_id: String::new(),
            peer_token,
            expires_at_ms: 0,
            display_name: own.display_name.clone(),
            class_name: own.class_name.clone(),
        };
        self.finish_join(generation, temporary, own)
    }

    fn finish_join(
        self: &Arc<Self>,
        generation: u64,
        mut session: Session,
        own: OwnData,
    ) -> Result<Snapshot, String> {
        let joined = (|| {
            if !self.generation_matches(generation) {
                return Err("Team operation was cancelled".into());
            }
            let body = serde_json::to_vec(&serde_json::json!({ "peer_token": session.peer_token, "display_name": own.display_name, "class_name": own.class_name })).map_err(|_| "Cannot encode team participant")?;
            let joined: PeerJoined = decode(self.transport.request(
                Method::Post,
                &format!("/v1/rooms/{}/join", session.room_id),
                Some(&body),
                Some(&session.join_token),
            )?)?;
            if !valid_hex(&joined.peer_id, 32)
                || !valid_expiry(joined.expires_at_ms, now_ms())
                || session.expires_at_ms != 0 && joined.expires_at_ms != session.expires_at_ms
            {
                return Err("Invalid team join response".into());
            }
            Ok::<_, String>(joined)
        })();
        let joined = match joined {
            Ok(joined) => joined,
            Err(error) => {
                self.fail_connect(generation, &error);
                if session.host_token.is_some() {
                    self.cleanup_later(session);
                }
                return Err(error);
            }
        };
        session.peer_id = joined.peer_id;
        session.expires_at_ms = joined.expires_at_ms;
        {
            let mut inner = self
                .inner
                .lock()
                .unwrap_or_else(|poison| poison.into_inner());
            if inner.generation != generation {
                drop(inner);
                self.cleanup_later(session);
                return Err("Team operation was cancelled".into());
            }
            inner.status = "active".into();
            inner.session = Some(session);
            inner.error.clear();
        }
        let service = Arc::clone(self);
        std::thread::Builder::new()
            .name("luma-team-relay".into())
            .spawn(move || service.run(generation))
            .map_err(|_| {
                let old = {
                    let mut inner = self
                        .inner
                        .lock()
                        .unwrap_or_else(|poison| poison.into_inner());
                    if inner.generation == generation {
                        inner.generation = inner.generation.wrapping_add(1);
                        inner.status = "error".into();
                        inner.error = "Cannot start team synchronization".into();
                        inner.session.take()
                    } else {
                        None
                    }
                };
                self.wake.notify_all();
                if let Some(old) = old {
                    self.cleanup_later(old);
                }
                "Cannot start team synchronization".to_string()
            })?;
        Ok(self.snapshot())
    }

    fn stop_local(&self) -> Option<Session> {
        let old = {
            let mut inner = self
                .inner
                .lock()
                .unwrap_or_else(|poison| poison.into_inner());
            let old = inner.session.take();
            inner.generation = inner.generation.wrapping_add(1);
            inner.status = "idle".into();
            inner.peers.clear();
            inner.server_time_ms = None;
            inner.last_sync_at_ms = None;
            inner.last_sync_instant = None;
            inner.transport_age_ms = 0;
            inner.error.clear();
            old
        };
        self.wake.notify_all();
        old
    }

    pub fn leave(self: &Arc<Self>) -> Snapshot {
        let old = self.stop_local();
        if let Some(old) = old {
            self.cleanup_later(old);
        }
        self.snapshot()
    }

    /// Explicit UI leave reports uncertainty instead of claiming that all
    /// participants were disconnected after an unacknowledged host DELETE.
    /// The local worker stops before this bounded network request begins.
    pub fn leave_confirmed(self: &Arc<Self>) -> Result<Snapshot, String> {
        if let Some(old) = self.stop_local() {
            Self::cleanup_now(&*self.transport, &old)?;
        }
        Ok(self.snapshot())
    }

    fn cleanup_now(transport: &dyn Transport, session: &Session) -> Result<(), String> {
        let (path, token) = if let Some(host) = session.host_token.as_ref() {
            (format!("/v1/rooms/{}", session.room_id), host)
        } else if valid_hex(&session.peer_id, 32) {
            (
                format!("/v1/rooms/{}/peers/{}", session.room_id, session.peer_id),
                &session.peer_token,
            )
        } else {
            return Err("Local team sync stopped; server cleanup could not be confirmed".into());
        };
        match transport.request(Method::Delete, &path, None, Some(token)) {
            Ok(reply) if [204, 404, 410].contains(&reply.status) => Ok(()),
            Err(error) if error == "Team room expired or was closed" => Ok(()),
            _ => Err("Local team sync stopped; server cleanup could not be confirmed".into()),
        }
    }

    fn cleanup_later(&self, session: Session) {
        let transport = Arc::clone(&self.transport);
        let _ = std::thread::Builder::new()
            .name("luma-team-leave".into())
            .spawn(move || {
                let _ = Self::cleanup_now(&*transport, &session);
            });
    }

    pub fn invite(&self) -> Result<String, String> {
        let inner = self
            .inner
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        let session = inner
            .session
            .as_ref()
            .filter(|session| session.expires_at_ms > now_ms())
            .ok_or("Join or create a team room first")?;
        Ok(format!("LUMA:{}:{}", session.room_id, session.join_token))
    }

    pub fn snapshot(&self) -> Snapshot {
        self.snapshot_at(now_ms())
    }

    fn snapshot_at(&self, at: u64) -> Snapshot {
        let inner = self
            .inner
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        let session = inner.session.as_ref();
        let expired = session.is_some_and(|session| session.expires_at_ms <= at);
        let peers = if expired {
            Vec::new()
        } else if let (Some(session), Some(server), Some(received)) =
            (session, inner.server_time_ms, inner.last_sync_at_ms)
        {
            // A wall clock correction must not make an old counter fresh again.
            // Add the whole request duration conservatively: the service may
            // have sampled its response before network or scheduling delays.
            let monotonic_age = inner
                .last_sync_instant
                .map(|instant| instant.elapsed().as_millis().min(u128::from(u64::MAX)) as u64)
                .unwrap_or(0);
            let elapsed = inner
                .transport_age_ms
                .saturating_add(at.saturating_sub(received).max(monotonic_age));
            inner
                .peers
                .iter()
                .filter_map(|peer| peer_view(peer, &session.peer_id, server, received, at, elapsed))
                .collect()
        } else {
            Vec::new()
        };
        Snapshot {
            sampled_at_ms: at,
            enabled: session.is_some() && !expired,
            status: if expired {
                "expired".into()
            } else {
                inner.status.clone()
            },
            room_id: session.map(|session| session.room_id.clone()),
            self_peer_id: session.map(|session| session.peer_id.clone()),
            expires_at_ms: session.map(|session| session.expires_at_ms),
            is_host: session.is_some_and(|session| session.host_token.is_some()),
            peers,
            last_sync_at_ms: inner.last_sync_at_ms,
            error: inner.error.clone(),
        }
    }

    fn apply_sync(
        &self,
        generation: u64,
        reply: SyncReply,
        at: u64,
        transport_age_ms: u64,
    ) -> Result<bool, String> {
        validate_sync(&reply)?;
        let mut inner = self
            .inner
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        if inner.generation != generation {
            return Ok(false);
        }
        let Some(session) = inner.session.as_mut() else {
            return Ok(false);
        };
        if reply.expires_at_ms != session.expires_at_ms {
            return Err("Team room expiry changed unexpectedly".into());
        }
        if !reply
            .peers
            .iter()
            .any(|peer| peer.peer_id == session.peer_id)
        {
            return Err("Team snapshot is missing the local participant".into());
        }
        session.expires_at_ms = reply.expires_at_ms;
        inner.peers = reply.peers;
        inner.server_time_ms = Some(reply.server_time_ms);
        inner.last_sync_at_ms = Some(at);
        inner.last_sync_instant = Some(Instant::now());
        inner.transport_age_ms = transport_age_ms;
        inner.status = "active".into();
        inner.error.clear();
        Ok(true)
    }

    fn run(self: Arc<Self>, generation: u64) {
        let mut sequence = 0u64;
        let mut failures = 0u32;
        loop {
            let session = {
                let mut inner = self
                    .inner
                    .lock()
                    .unwrap_or_else(|poison| poison.into_inner());
                if inner.generation != generation {
                    return;
                }
                let Some(session) = inner.session.as_ref() else {
                    return;
                };
                if session.expires_at_ms <= now_ms() {
                    inner.session = None;
                    inner.peers.clear();
                    inner.status = "expired".into();
                    return;
                }
                session.clone()
            };
            if !self.generation_matches(generation) {
                return;
            }
            let request_started = Instant::now();
            let own = self.own_data().unwrap_or(OwnData {
                display_name: session.display_name.clone(),
                class_name: session.class_name.clone(),
                cooldowns: Vec::new(),
                capture_live: false,
            });
            sequence = sequence.saturating_add(1);
            let result = (|| {
                if sequence > MAX_SAFE_JS {
                    return Err("Team sequence limit reached; reconnect to the room".into());
                }
                let body = serde_json::to_vec(&serde_json::json!({ "sequence": sequence, "display_name": own.display_name, "class_name": own.class_name, "cooldowns": own.cooldowns, "capture_live": own.capture_live })).map_err(|_| "Cannot encode team cooldowns")?;
                if !self.generation_matches(generation) {
                    return Ok(false);
                }
                let reply = decode(self.transport.request(
                    Method::Post,
                    &format!("/v1/rooms/{}/sync", session.room_id),
                    Some(&body),
                    Some(&session.peer_token),
                )?)?;
                let transport_age_ms = request_started
                    .elapsed()
                    .as_millis()
                    .min(u128::from(u64::MAX)) as u64;
                self.apply_sync(generation, reply, now_ms(), transport_age_ms)
            })();
            if let Err(error) = result {
                let mut inner = self
                    .inner
                    .lock()
                    .unwrap_or_else(|poison| poison.into_inner());
                if inner.generation != generation {
                    return;
                }
                if error == "Team room expired or was closed"
                    || error == "Team invitation or room permission is no longer valid"
                {
                    inner.session = None;
                    inner.peers.clear();
                    inner.status = "expired".into();
                    inner.error = error;
                    return;
                }
                inner.status = "retrying".into();
                inner.error = error;
                failures = failures.saturating_add(1);
            } else {
                failures = 0;
            }
            let delay = if failures == 0 {
                POLL_INTERVAL
            } else {
                Duration::from_secs((5u64.saturating_mul(1u64 << failures.min(4))).min(60))
            };
            let inner = self
                .inner
                .lock()
                .unwrap_or_else(|poison| poison.into_inner());
            let _wait = self
                .wake
                .wait_timeout_while(inner, delay, |inner| inner.generation == generation)
                .unwrap_or_else(|poison| poison.into_inner());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    fn cooldown() -> Cooldown {
        Cooldown {
            skill_id: 100001,
            raw_remaining_units: Some(1000),
            estimated_remaining_ms: Some(10000),
            charges: Some(1),
            age_ms: 1000,
            ready_confirmed: false,
        }
    }
    fn own() -> Value {
        serde_json::json!({ "display_name": "TestRanger", "class_name": "Ranger", "capture_live": true, "cooldowns": [cooldown()] })
    }
    fn session(at: u64) -> Session {
        Session {
            room_id: "a".repeat(32),
            join_token: "b".repeat(64),
            host_token: Some("c".repeat(64)),
            peer_id: "d".repeat(32),
            peer_token: "e".repeat(64),
            expires_at_ms: at + ROOM_TTL_MS,
            display_name: "TestRanger".into(),
            class_name: "Ranger".into(),
        }
    }
    fn peer(at: u64) -> ReceivedPeer {
        ReceivedPeer {
            peer_id: "d".repeat(32),
            display_name: "TestRanger".into(),
            class_name: "Ranger".into(),
            received_at_ms: at - 1000,
            sequence: 1,
            capture_live: true,
            cooldowns: vec![cooldown()],
        }
    }
    fn sync_reply(at: u64) -> SyncReply {
        SyncReply {
            server_time_ms: at,
            expires_at_ms: at + ROOM_TTL_MS,
            peers: vec![peer(at)],
        }
    }

    struct RejectTransport {
        requests: Mutex<usize>,
    }
    impl Transport for RejectTransport {
        fn request(
            &self,
            _method: Method,
            _path: &str,
            _body: Option<&[u8]>,
            _token: Option<&str>,
        ) -> Result<Reply, String> {
            *self.requests.lock().unwrap() += 1;
            Err("Synthetic offline test".into())
        }
    }
    fn dormant_service() -> Arc<Service> {
        Arc::new(Service::with_transport(
            Arc::new(own),
            Arc::new(RejectTransport {
                requests: Mutex::new(0),
            }),
        ))
    }
    fn active_service(at: u64) -> Arc<Service> {
        let service = dormant_service();
        {
            let mut inner = service.inner.lock().unwrap();
            inner.session = Some(session(at));
            inner.status = "active".into();
            inner.generation = 7;
        }
        service
    }

    #[test]
    fn fixed_https_origin_and_only_exact_room_paths_are_accepted() {
        let base = reqwest::Url::parse(ENDPOINT).unwrap();
        assert_eq!(base.scheme(), "https");
        assert_eq!(
            base.host_str(),
            Some("luma-dps-community.uchihavayne.chatgpt.site")
        );
        assert_eq!(base.port(), None);
        assert_eq!(base.path(), "/");
        let room = "a".repeat(32);
        let peer = "b".repeat(32);
        for (method, path) in [
            (Method::Post, "/v1/rooms".to_string()),
            (Method::Post, format!("/v1/rooms/{room}/join")),
            (Method::Post, format!("/v1/rooms/{room}/sync")),
            (Method::Delete, format!("/v1/rooms/{room}")),
            (Method::Delete, format!("/v1/rooms/{room}/peers/{peer}")),
        ] {
            assert!(allowed_path(method, &path));
        }
        for path in [
            format!("https://evil.example/v1/rooms/{room}/sync"),
            format!("//evil.example/{room}/sync"),
            format!("/v1/rooms/{room}/sync?token=x"),
            format!("/v1/rooms/{room}/sync#x"),
            format!("/v1/rooms/{room}/../sync"),
            format!("/v1/rooms/{room}/SYNC"),
            format!("/v1/rooms/{}/sync", "A".repeat(32)),
            "/v1/rooms/".into(),
        ] {
            assert!(!allowed_path(Method::Post, &path), "{path}");
        }
        assert!(!allowed_path(Method::Delete, "/v1/rooms"));
    }

    #[test]
    fn invitation_accepts_only_fixed_length_lowercase_room_and_capability_without_urls() {
        let valid = format!("LUMA:{}:{}", "a".repeat(32), "b".repeat(64));
        assert_eq!(
            parse_invite(&valid).unwrap(),
            ("a".repeat(32), "b".repeat(64))
        );
        for invalid in [
            format!(" {valid}"),
            format!("{valid}\n"),
            valid.to_lowercase(),
            format!("LUMA:{}:{}", "A".repeat(32), "b".repeat(64)),
            format!("LUMA:{}:{}", "a".repeat(31), "b".repeat(64)),
            format!("LUMA:{}:{}", "a".repeat(32), "b".repeat(63)),
            format!("https://evil.example/{valid}"),
            format!("{valid}:extra"),
        ] {
            assert!(parse_invite(&invalid).is_err());
        }
    }

    #[test]
    fn no_network_or_credentials_exist_before_explicit_room_action() {
        let transport = Arc::new(RejectTransport {
            requests: Mutex::new(0),
        });
        let service = Arc::new(Service::with_transport(Arc::new(own), transport.clone()));
        assert_eq!(service.snapshot().status, "idle");
        assert!(!service.snapshot().enabled);
        assert!(service.invite().is_err());
        service.leave();
        assert_eq!(*transport.requests.lock().unwrap(), 0);
    }

    #[test]
    fn own_payload_is_allowlisted_and_requires_resolved_bounded_plain_character_text() {
        let provider = dormant_service();
        assert_eq!(provider.own_data().unwrap().display_name, "TestRanger");
        for name in [
            "",
            "\n",
            "#123",
            "Player #123",
            "Unknown",
            "—",
            "Test\u{0000}",
            "Test\u{202e}",
            &"x".repeat(81),
        ] {
            assert!(display_text(name).is_err());
        }
        assert_eq!(class_name("ranger").unwrap(), "Ranger");
        assert!(class_name("UnknownThing").is_err());
        let mut private = own();
        private["actor_id"] = Value::from(10);
        assert!(serde_json::from_value::<OwnData>(private).is_err());
        let mut private = own();
        private["capture_buffer"] = Value::from("private");
        assert!(serde_json::from_value::<OwnData>(private).is_err());
        let bytes = serde_json::to_string(&provider.own_data().unwrap()).unwrap();
        assert!(!bytes.contains("actor_id"));
        assert!(!bytes.contains("observed_at_ms"));
        assert!(!bytes.contains("token"));
    }

    #[test]
    fn invalid_duplicate_and_oversized_local_cooldowns_are_rejected() {
        let base: OwnData = serde_json::from_value(own()).unwrap();
        let mut duplicate = base.clone();
        duplicate.cooldowns.push(cooldown());
        assert!(duplicate.cleaned().is_err());
        let mut many = base.clone();
        many.cooldowns = (1..=65)
            .map(|skill| Cooldown {
                skill_id: skill,
                ..cooldown()
            })
            .collect();
        assert!(many.cleaned().is_err());
        let variants = [
            Cooldown {
                skill_id: 0,
                ..cooldown()
            },
            Cooldown {
                raw_remaining_units: Some(3_600_001),
                ..cooldown()
            },
            Cooldown {
                estimated_remaining_ms: Some(3_600_001),
                ..cooldown()
            },
            Cooldown {
                charges: Some(101),
                ..cooldown()
            },
            Cooldown {
                age_ms: 86_400_001,
                ..cooldown()
            },
            Cooldown {
                ready_confirmed: true,
                ..cooldown()
            },
        ];
        for value in variants {
            assert!(!value.valid());
        }
        let mut bad = own();
        bad["cooldowns"][0]["skill_id"] = Value::from(-1);
        assert!(serde_json::from_value::<OwnData>(bad).is_err());
        let mut bad = own();
        bad["cooldowns"][0]["age_ms"] = Value::from(1.5);
        assert!(serde_json::from_value::<OwnData>(bad).is_err());
    }

    #[test]
    fn capture_off_never_sends_old_cooldowns_and_old_server_ready_loses_confirmation() {
        let mut data: OwnData = serde_json::from_value(own()).unwrap();
        data.capture_live = false;
        assert!(data.cleaned().unwrap().cooldowns.is_empty());
        let mut data: OwnData = serde_json::from_value(own()).unwrap();
        data.cooldowns[0] = Cooldown {
            raw_remaining_units: Some(0),
            ready_confirmed: true,
            age_ms: 6001,
            ..cooldown()
        };
        assert!(!data.cleaned().unwrap().cooldowns[0].ready_confirmed);
    }

    #[test]
    fn relay_age_is_counted_once_and_raw_units_are_not_treated_as_milliseconds() {
        let at = 100_000;
        let mut input = peer(at);
        input.received_at_ms = at - 2000;
        input.cooldowns[0].age_ms = 3000;
        let view = peer_view(&input, &input.peer_id, at, 200_000, 201_000, 0).unwrap();
        assert_eq!(view.age_ms, 3000);
        assert!(view.fresh);
        assert!(view.is_self);
        assert_eq!(view.cooldowns[0].age_ms, 4000);
        assert_eq!(view.cooldowns[0].estimated_remaining_ms, Some(6000));
        assert_eq!(view.cooldowns[0].raw_remaining_units, Some(1000));
        assert!(!view.cooldowns[0].ready_confirmed);
        input.cooldowns[0].estimated_remaining_ms = None;
        assert_eq!(
            peer_view(&input, "other", at, 200_000, 201_000, 0)
                .unwrap()
                .cooldowns[0]
                .estimated_remaining_ms,
            None
        );
    }

    #[test]
    fn elapsed_estimate_never_becomes_confirmed_ready_and_stale_counters_clear_all_claims() {
        let at = 100_000;
        let mut input = peer(at);
        input.cooldowns[0].estimated_remaining_ms = Some(1);
        let view = peer_view(&input, "other", at, 200_000, 201_000, 0).unwrap();
        assert_eq!(view.cooldowns[0].estimated_remaining_ms, Some(0));
        assert!(!view.cooldowns[0].ready_confirmed);
        let stale = peer_view(&input, "other", at, 200_000, 206_001, 0).unwrap();
        assert!(!stale.fresh);
        assert!(!stale.cooldowns[0].fresh);
        assert_eq!(stale.cooldowns[0].raw_remaining_units, None);
        assert_eq!(stale.cooldowns[0].estimated_remaining_ms, None);
        assert_eq!(stale.cooldowns[0].charges, None);
        assert!(peer_view(&input, "other", at, 200_000, 220_001, 0).is_none());
        assert!(peer_view(&input, "other", at, 200_000, 199_999, 0).is_none());
    }

    #[test]
    fn confirmed_ready_requires_received_zero_and_fresh_live_capture() {
        let at = 100_000;
        let mut input = peer(at);
        input.cooldowns[0] = Cooldown {
            raw_remaining_units: Some(0),
            ready_confirmed: true,
            ..cooldown()
        };
        assert!(peer_view(&input, "other", at, at, at, 0).unwrap().cooldowns[0].ready_confirmed);
        input.capture_live = false;
        let view = peer_view(&input, "other", at, at, at, 0).unwrap();
        assert!(!view.fresh);
        assert!(!view.cooldowns[0].ready_confirmed);
        assert_eq!(view.cooldowns[0].charges, None);
    }

    #[test]
    fn response_validation_rejects_duplicate_peers_future_receipts_bad_names_and_large_lists() {
        let at = 100_000;
        assert!(validate_sync(&sync_reply(at)).is_ok());
        let mut input = sync_reply(at);
        input.peers.push(peer(at));
        assert!(validate_sync(&input).is_err());
        let mut input = sync_reply(at);
        input.peers[0].received_at_ms = at + 1;
        assert!(validate_sync(&input).is_err());
        let mut input = sync_reply(at);
        input.peers[0].display_name = "\u{0000}".into();
        assert!(validate_sync(&input).is_err());
        let mut input = sync_reply(at);
        input.peers[0].cooldowns.push(cooldown());
        assert!(validate_sync(&input).is_err());
        let mut input = sync_reply(at);
        input.peers[0].sequence = MAX_SAFE_JS + 1;
        assert!(validate_sync(&input).is_err());
        let mut input = sync_reply(at);
        input.peers = (0..13)
            .map(|index| ReceivedPeer {
                peer_id: format!("{index:032x}"),
                ..peer(at)
            })
            .collect();
        assert!(validate_sync(&input).is_err());
        let mut input = sync_reply(at);
        input.expires_at_ms = at;
        assert!(validate_sync(&input).is_err());
    }

    #[test]
    fn response_decode_has_a_hard_byte_limit_and_never_surfaces_untrusted_error_body() {
        assert!(decode::<Value>(Reply {
            status: 200,
            body: vec![b' '; RESPONSE_LIMIT + 1]
        })
        .is_err());
        assert!(decode::<Value>(Reply {
            status: 200,
            body: b"broken".to_vec()
        })
        .is_err());
        assert_eq!(
            decode::<Value>(Reply {
                status: 403,
                body: b"SECRET_TOKEN_DO_NOT_DISPLAY".to_vec()
            })
            .unwrap_err(),
            http_error(403)
        );
        assert!(!http_error(500).contains("SECRET"));
    }

    #[test]
    fn snapshots_do_not_contain_room_tokens_or_provider_buffers_and_invites_are_explicit_only() {
        let at = now_ms();
        let service = active_service(at);
        service.apply_sync(7, sync_reply(at), at, 0).unwrap();
        let encoded = serde_json::to_string(&service.snapshot_at(at)).unwrap();
        for secret in [
            "b".repeat(64),
            "c".repeat(64),
            "e".repeat(64),
            "join_token".into(),
            "host_token".into(),
            "peer_token".into(),
        ] {
            assert!(!encoded.contains(&secret));
        }
        assert_eq!(
            service.invite().unwrap(),
            format!("LUMA:{}:{}", "a".repeat(32), "b".repeat(64))
        );
        assert_eq!(service.snapshot_at(at + ROOM_TTL_MS + 1).status, "expired");
        assert!(service.snapshot_at(at + ROOM_TTL_MS + 1).peers.is_empty());
    }

    #[test]
    fn generation_guard_rejects_late_sync_after_leave_or_a_new_join() {
        let at = now_ms();
        let service = active_service(at);
        assert!(service.apply_sync(7, sync_reply(at), at, 0).unwrap());
        service.leave();
        assert!(!service.apply_sync(7, sync_reply(at), at + 1, 0).unwrap());
        assert_eq!(service.snapshot().status, "idle");
        {
            let mut inner = service.inner.lock().unwrap();
            inner.generation = 9;
            inner.status = "connecting".into();
        }
        assert!(!service.apply_sync(7, sync_reply(at), at + 2, 0).unwrap());
        assert_eq!(service.snapshot().status, "connecting");
    }

    #[test]
    fn changed_expiry_or_missing_self_cannot_replace_a_confirmed_room_snapshot() {
        let at = now_ms();
        let service = active_service(at);
        service.apply_sync(7, sync_reply(at), at, 0).unwrap();
        let mut wrong = sync_reply(at);
        wrong.expires_at_ms -= 1;
        assert!(service.apply_sync(7, wrong, at + 1, 0).is_err());
        let mut wrong = sync_reply(at);
        wrong.peers.clear();
        assert!(service.apply_sync(7, wrong, at + 1, 0).is_err());
        assert_eq!(service.snapshot_at(at + 2).last_sync_at_ms, Some(at));
    }

    #[test]
    fn delayed_response_ages_counters_once_before_the_first_visible_snapshot() {
        let at = now_ms();
        let service = active_service(at);
        let mut response = sync_reply(at);
        response.peers[0].received_at_ms = at;
        response.peers[0].cooldowns[0].age_ms = 500;
        service.apply_sync(7, response, at, 5000).unwrap();
        // Deterministic immediate-response snapshot; production always retains
        // its monotonic anchor to measure time after receipt as well.
        service.inner.lock().unwrap().last_sync_instant = None;
        let first = service.snapshot_at(at);
        assert!(first.peers[0].fresh);
        assert_eq!(first.peers[0].age_ms, 5000);
        assert!(first.peers[0].cooldowns[0].fresh);
        assert_eq!(first.peers[0].cooldowns[0].age_ms, 5500);
        assert_eq!(
            first.peers[0].cooldowns[0].estimated_remaining_ms,
            Some(4500)
        );
        let later = service.snapshot_at(at + 501);
        assert!(later.peers[0].fresh);
        assert!(!later.peers[0].cooldowns[0].fresh);
        assert_eq!(later.peers[0].cooldowns[0].age_ms, 6001);
        assert_eq!(later.peers[0].cooldowns[0].estimated_remaining_ms, None);
        assert_eq!(later.peers[0].cooldowns[0].charges, None);
    }

    #[test]
    fn a_response_delayed_beyond_freshness_cannot_refresh_a_server_ready_claim() {
        let at = now_ms();
        let service = active_service(at);
        let mut response = sync_reply(at);
        response.peers[0].received_at_ms = at;
        response.peers[0].cooldowns[0] = Cooldown {
            raw_remaining_units: Some(0),
            ready_confirmed: true,
            age_ms: 0,
            ..cooldown()
        };
        service.apply_sync(7, response, at, 6001).unwrap();
        let first = service.snapshot_at(at);
        assert!(!first.peers[0].fresh);
        assert!(!first.peers[0].cooldowns[0].ready_confirmed);
        assert_eq!(first.peers[0].cooldowns[0].estimated_remaining_ms, None);
        assert_eq!(first.peers[0].cooldowns[0].raw_remaining_units, None);
    }

    #[test]
    fn clock_rollback_and_recovery_cannot_rejuvenate_a_previous_snapshot() {
        let at = now_ms();
        let service = active_service(at);
        let mut response = sync_reply(at);
        response.peers[0].received_at_ms = at;
        response.peers[0].cooldowns[0] = Cooldown {
            raw_remaining_units: Some(0),
            ready_confirmed: true,
            age_ms: 0,
            ..cooldown()
        };
        service.apply_sync(7, response, at, 0).unwrap();
        service.inner.lock().unwrap().last_sync_instant =
            Some(Instant::now().checked_sub(Duration::from_secs(7)).unwrap());
        assert!(service.snapshot_at(at - 1000).peers.is_empty());
        for wall_time in [at, at + 1000] {
            let recovered = service.snapshot_at(wall_time);
            assert!(!recovered.peers[0].fresh);
            assert!(recovered.peers[0].age_ms >= 7000);
            assert!(!recovered.peers[0].cooldowns[0].ready_confirmed);
            assert_eq!(recovered.peers[0].cooldowns[0].estimated_remaining_ms, None);
        }
    }

    #[test]
    fn invalid_invite_or_unresolved_local_name_does_not_stop_a_running_room() {
        let at = now_ms();
        let service = active_service(at);
        assert!(service.join_room("invalid").is_err());
        assert_eq!(service.snapshot().room_id, Some("a".repeat(32)));
        let invalid = Arc::new(Service::with_transport(
            Arc::new(
                || serde_json::json!({"display_name":"","class_name":"Unknown","cooldowns":[],"capture_live":false}),
            ),
            Arc::new(RejectTransport {
                requests: Mutex::new(0),
            }),
        ));
        assert!(invalid.create_room().is_err());
        assert_eq!(invalid.snapshot().status, "idle");
    }

    #[test]
    fn rejoining_the_active_invite_is_idempotent_and_never_closes_the_host_room() {
        let at = now_ms();
        let service = active_service(at);
        let current = service.invite().unwrap();
        assert!(service.join_room(&current).unwrap().is_host);
        assert_eq!(service.inner.lock().unwrap().generation, 7);
        let wrong = format!("LUMA:{}:{}", "a".repeat(32), "f".repeat(64));
        assert!(service.join_room(&wrong).is_err());
        assert_eq!(service.inner.lock().unwrap().generation, 7);
        assert_eq!(service.invite().unwrap(), current);
    }

    #[test]
    fn secure_room_capabilities_are_independent_lowercase_256_bit_values() {
        let first = random_token().unwrap();
        let second = random_token().unwrap();
        assert!(valid_hex(&first, 64));
        assert!(valid_hex(&second, 64));
        assert_ne!(first, second);
    }

    struct DeleteTransport {
        response: Result<u16, &'static str>,
    }
    impl Transport for DeleteTransport {
        fn request(
            &self,
            method: Method,
            path: &str,
            _body: Option<&[u8]>,
            token: Option<&str>,
        ) -> Result<Reply, String> {
            assert_eq!(method, Method::Delete);
            assert_eq!(path, format!("/v1/rooms/{}", "a".repeat(32)));
            assert_eq!(token, Some("c".repeat(64).as_str()));
            self.response
                .map(|status| Reply {
                    status,
                    body: Vec::new(),
                })
                .map_err(String::from)
        }
    }

    #[test]
    fn explicit_host_leave_reports_cleanup_failure_but_local_sync_is_already_stopped() {
        for response in [
            Err("Timeout with private details"),
            Ok(403),
            Ok(500),
            Ok(200),
        ] {
            let at = now_ms();
            let service = Arc::new(Service::with_transport(
                Arc::new(own),
                Arc::new(DeleteTransport { response }),
            ));
            {
                let mut inner = service.inner.lock().unwrap();
                inner.session = Some(session(at));
                inner.status = "active".into();
                inner.generation = 7;
            }
            service.apply_sync(7, sync_reply(at), at, 0).unwrap();
            assert_eq!(
                service.leave_confirmed().unwrap_err(),
                "Local team sync stopped; server cleanup could not be confirmed"
            );
            assert!(!service.snapshot().enabled);
            assert_eq!(service.snapshot().status, "idle");
            assert!(service.snapshot().peers.is_empty());
            assert!(service.invite().is_err());
            assert!(!service.apply_sync(7, sync_reply(at), at + 1, 0).unwrap());
        }
    }

    #[test]
    fn acknowledged_or_already_expired_host_cleanup_can_be_confirmed() {
        for response in [
            Ok(204),
            Ok(404),
            Ok(410),
            Err("Team room expired or was closed"),
        ] {
            let at = now_ms();
            let service = Arc::new(Service::with_transport(
                Arc::new(own),
                Arc::new(DeleteTransport { response }),
            ));
            {
                let mut inner = service.inner.lock().unwrap();
                inner.session = Some(session(at));
                inner.status = "active".into();
            }
            let snapshot = service.leave_confirmed().unwrap();
            assert!(!snapshot.enabled);
            assert!(snapshot.peers.is_empty());
            assert_eq!(snapshot.status, "idle");
        }
    }

    struct BlockCreate {
        started: Mutex<Option<mpsc::Sender<()>>>,
        release: (Mutex<bool>, Condvar),
        deleted: Mutex<Option<mpsc::Sender<()>>>,
        expiry: u64,
    }
    impl Transport for BlockCreate {
        fn request(
            &self,
            method: Method,
            path: &str,
            _body: Option<&[u8]>,
            _token: Option<&str>,
        ) -> Result<Reply, String> {
            if method == Method::Delete {
                if let Some(sender) = self.deleted.lock().unwrap().take() {
                    let _ = sender.send(());
                }
                return Ok(Reply {
                    status: 204,
                    body: Vec::new(),
                });
            }
            if path != "/v1/rooms" {
                return Err("Unexpected request after cancellation".into());
            }
            if let Some(sender) = self.started.lock().unwrap().take() {
                let _ = sender.send(());
            }
            let (lock, wake) = &self.release;
            let released = lock.lock().unwrap();
            let _guard = wake
                .wait_timeout_while(released, Duration::from_secs(2), |released| !*released)
                .unwrap();
            Ok(Reply {
                status: 201,
                body: serde_json::to_vec(
                    &serde_json::json!({ "room_id": "a".repeat(32), "expires_at_ms": self.expiry }),
                )
                .unwrap(),
            })
        }
    }

    #[test]
    fn cancelling_an_inflight_create_returns_immediately_and_cleans_up_its_late_room() {
        let (started, started_rx) = mpsc::channel();
        let (deleted, deleted_rx) = mpsc::channel();
        let transport = Arc::new(BlockCreate {
            started: Mutex::new(Some(started)),
            release: (Mutex::new(false), Condvar::new()),
            deleted: Mutex::new(Some(deleted)),
            expiry: now_ms() + ROOM_TTL_MS,
        });
        let service = Arc::new(Service::with_transport(Arc::new(own), transport.clone()));
        let worker_service = service.clone();
        let pending = std::thread::spawn(move || worker_service.create_room());
        started_rx.recv_timeout(Duration::from_secs(1)).unwrap();
        let stopped = std::time::Instant::now();
        assert_eq!(service.leave().status, "idle");
        assert!(stopped.elapsed() < Duration::from_millis(100));
        *transport.release.0.lock().unwrap() = true;
        transport.release.1.notify_all();
        assert_eq!(
            pending.join().unwrap().unwrap_err(),
            "Team operation was cancelled"
        );
        deleted_rx.recv_timeout(Duration::from_secs(1)).unwrap();
        assert_eq!(service.snapshot().status, "idle");
        assert!(service.snapshot().peers.is_empty());
    }

    struct HappyTransport {
        requests: Mutex<Vec<(Method, String, Value, Option<String>)>>,
        expiry: u64,
        synced: Mutex<Option<mpsc::Sender<()>>>,
        deleted: Mutex<Option<mpsc::Sender<()>>>,
    }
    impl Transport for HappyTransport {
        fn request(
            &self,
            method: Method,
            path: &str,
            body: Option<&[u8]>,
            token: Option<&str>,
        ) -> Result<Reply, String> {
            let body: Value = body
                .map(|bytes| serde_json::from_slice(bytes).unwrap())
                .unwrap_or(Value::Null);
            self.requests.lock().unwrap().push((
                method,
                path.to_string(),
                body.clone(),
                token.map(String::from),
            ));
            if method == Method::Delete {
                if let Some(sender) = self.deleted.lock().unwrap().take() {
                    let _ = sender.send(());
                }
                return Ok(Reply {
                    status: 204,
                    body: Vec::new(),
                });
            }
            let response = if path == "/v1/rooms" {
                serde_json::json!({ "room_id": "a".repeat(32), "expires_at_ms": self.expiry })
            } else if path.ends_with("/join") {
                serde_json::json!({ "peer_id": "d".repeat(32), "expires_at_ms": self.expiry })
            } else if path.ends_with("/sync") {
                let now = now_ms();
                serde_json::json!({ "server_time_ms": now, "expires_at_ms": self.expiry, "peers": [{ "peer_id": "d".repeat(32), "display_name": body["display_name"], "class_name": body["class_name"], "received_at_ms": now, "sequence": body["sequence"], "capture_live": body["capture_live"], "cooldowns": body["cooldowns"] }] })
            } else {
                return Err("Unexpected test route".into());
            };
            if path.ends_with("/sync") {
                if let Some(sender) = self.synced.lock().unwrap().take() {
                    let _ = sender.send(());
                }
            }
            Ok(Reply {
                status: 200,
                body: serde_json::to_vec(&response).unwrap(),
            })
        }
    }

    #[test]
    fn explicit_create_joins_and_sends_only_own_payload_with_separate_capabilities() {
        let (synced, synced_rx) = mpsc::channel();
        let (deleted, deleted_rx) = mpsc::channel();
        let transport = Arc::new(HappyTransport {
            requests: Mutex::new(Vec::new()),
            expiry: now_ms() + ROOM_TTL_MS,
            synced: Mutex::new(Some(synced)),
            deleted: Mutex::new(Some(deleted)),
        });
        let service = Arc::new(Service::with_transport(Arc::new(own), transport.clone()));
        assert!(service.create_room().unwrap().enabled);
        synced_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        let requests = transport.requests.lock().unwrap().clone();
        assert_eq!(requests.len(), 3);
        let (_, create_path, create_body, create_auth) = &requests[0];
        assert_eq!(create_path, "/v1/rooms");
        assert!(create_auth.is_none());
        assert_eq!(create_body["ttl_minutes"], 120);
        let join_token = create_body["join_token"].as_str().unwrap();
        let host_token = create_body["host_token"].as_str().unwrap();
        assert!(valid_hex(join_token, 64));
        assert!(valid_hex(host_token, 64));
        assert_ne!(join_token, host_token);
        assert_eq!(requests[1].3.as_deref(), Some(join_token));
        let peer_token = requests[1].2["peer_token"].as_str().unwrap();
        assert!(valid_hex(peer_token, 64));
        assert_ne!(join_token, peer_token);
        assert_ne!(host_token, peer_token);
        assert_eq!(requests[2].3.as_deref(), Some(peer_token));
        assert_eq!(requests[2].2["sequence"], 1);
        assert_eq!(requests[2].2["display_name"], "TestRanger");
        assert_eq!(requests[2].2.as_object().unwrap().len(), 5);
        assert!(requests[2].2.get("actor_id").is_none());
        service.leave();
        deleted_rx.recv_timeout(Duration::from_secs(1)).unwrap();
        let requests = transport.requests.lock().unwrap();
        let last = requests.last().unwrap();
        assert_eq!(last.0, Method::Delete);
        assert_eq!(last.1, format!("/v1/rooms/{}", "a".repeat(32)));
        assert_eq!(last.3.as_deref(), Some(host_token));
    }

    #[test]
    fn invitation_join_reuses_only_join_capability_and_leaves_only_the_local_peer() {
        let (synced, synced_rx) = mpsc::channel();
        let (deleted, deleted_rx) = mpsc::channel();
        let transport = Arc::new(HappyTransport {
            requests: Mutex::new(Vec::new()),
            expiry: now_ms() + ROOM_TTL_MS,
            synced: Mutex::new(Some(synced)),
            deleted: Mutex::new(Some(deleted)),
        });
        let service = Arc::new(Service::with_transport(Arc::new(own), transport.clone()));
        let invite = format!("LUMA:{}:{}", "a".repeat(32), "b".repeat(64));
        assert!(!service.join_room(&invite).unwrap().is_host);
        synced_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        service.leave();
        deleted_rx.recv_timeout(Duration::from_secs(1)).unwrap();
        let requests = transport.requests.lock().unwrap();
        assert_eq!(requests[0].1, format!("/v1/rooms/{}/join", "a".repeat(32)));
        assert_eq!(requests[0].3.as_deref(), Some("b".repeat(64).as_str()));
        let peer_token = requests[0].2["peer_token"].as_str().unwrap();
        let last = requests.last().unwrap();
        assert_eq!(last.0, Method::Delete);
        assert_eq!(
            last.1,
            format!("/v1/rooms/{}/peers/{}", "a".repeat(32), "d".repeat(32))
        );
        assert_eq!(last.3.as_deref(), Some(peer_token));
    }
}
