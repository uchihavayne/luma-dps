//! Explicit, aggregate-only community sharing. Captures, audio, preferences and
//! revocation secrets are never part of a public encounter or UI snapshot.

use luma_engine::{Encounter, PlayerState};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const BODY_LIMIT: usize = 1024 * 1024;
const STORAGE_LIMIT: usize = 1024 * 1024;
const MAX_SHARES: usize = 200;
const MAX_PLAYERS: usize = 100;
const MAX_TARGETS: usize = 100;
const MAX_SKILLS: usize = 500;
const TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    #[default]
    Personal,
    Party,
    Observed,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default, deny_unknown_fields)]
pub struct Context {
    pub region: String,
    pub server: String,
    pub boss: String,
    pub difficulty: String,
}

impl Context {
    fn cleaned(&self) -> Result<Self, String> {
        Ok(Self {
            region: text(&self.region, 80)?,
            server: text(&self.server, 80)?,
            boss: text(&self.boss, 80)?,
            difficulty: text(&self.difficulty, 80)?,
        })
    }
    fn complete(&self) -> bool {
        [&self.region, &self.server, &self.boss, &self.difficulty]
            .iter()
            .all(|value| !value.is_empty())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct ShareOptions {
    pub scope: Scope,
    pub anonymous: bool,
    pub rank_opt_in: bool,
    pub context: Context,
}

impl Default for ShareOptions {
    fn default() -> Self {
        Self {
            scope: Scope::Personal,
            anonymous: true,
            rank_opt_in: false,
            context: Context::default(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PublicSkill {
    pub id: u32,
    pub name: String,
    pub hits: u64,
    pub damage: u64,
    pub crit_hits: u64,
    pub min: u64,
    pub max: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PublicPlayer {
    /// A document-local ordinal, never the game's entity identifier.
    pub id: u32,
    pub name: String,
    pub class_name: String,
    pub damage: u64,
    pub dps: f64,
    pub skills: Vec<PublicSkill>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PublicTarget {
    pub name: String,
    pub is_boss: bool,
    pub damage: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Quality {
    pub source: String,
    pub sample_complete: bool,
    pub identity_confirmed: bool,
    pub membership_confirmed: bool,
    pub ranking_eligible: bool,
    pub classification: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PublicEncounter {
    pub scope: Scope,
    pub duration_ms: u64,
    pub total_damage: u64,
    pub dps: f64,
    pub players: Vec<PublicPlayer>,
    pub targets: Vec<PublicTarget>,
    pub context: Context,
    pub quality: Quality,
    /// SHA-256 of canonical, allowlisted content with this field empty.
    pub record_hash: String,
}

fn text(value: &str, max: usize) -> Result<String, String> {
    let value = value.trim();
    if value.chars().count() > max || value.chars().any(char::is_control) {
        return Err("Community text contains an invalid character or exceeds its limit".into());
    }
    Ok(value.to_string())
}

fn public_name(value: &str, prefix: &str, index: usize, anonymous: bool) -> Result<String, String> {
    let value = text(value, 80)?;
    if anonymous || value.is_empty() || entity_placeholder(&value) {
        Ok(format!("{prefix} {index}"))
    } else {
        Ok(value)
    }
}

fn entity_placeholder(value: &str) -> bool {
    ["#", "Target #", "Player #", "NPC #"]
        .iter()
        .filter_map(|prefix| value.strip_prefix(prefix))
        .any(|number| !number.is_empty() && number.bytes().all(|byte| byte.is_ascii_digit()))
}

fn checked_sum(mut values: impl Iterator<Item = u64>) -> Result<u64, String> {
    values
        .try_fold(0u64, |sum, value| sum.checked_add(value))
        .ok_or_else(|| "Community damage totals overflow".into())
}

/// Construct a new allowlisted document; serializing the input encounter is
/// deliberately avoided even if the engine adds sensitive fields later.
pub fn prepare_record(
    record: &Encounter,
    options: &ShareOptions,
) -> Result<PublicEncounter, String> {
    if record.ended_ms <= record.started_ms || record.elapsed_ms < 1000 {
        return Err("Finish an encounter of at least one second before sharing".into());
    }
    if (record.actor_scope == "personal" && options.scope != Scope::Personal)
        || (record.actor_scope == "party" && options.scope == Scope::Observed)
    {
        return Err("This saved encounter does not contain the requested player scope".into());
    }
    let local_id = record.local_player_id;
    let mut party: BTreeSet<u64> = record.party_member_ids.iter().copied().collect();
    if let Some(id) = local_id {
        party.insert(id);
    }
    let (duration_ms, expected_total, target_rows) = match options.scope {
        Scope::Personal => {
            if local_id.is_none() {
                return Err("The local player has not been identified for this encounter".into());
            }
            (
                record.personal_elapsed_ms,
                record.personal_total_damage,
                &record.personal_targets,
            )
        }
        Scope::Party => {
            if record.party_membership_source.is_empty()
                || record.party_membership_source == "unresolved"
                || record.party_total_damage.is_none()
            {
                return Err("Party membership is unknown for this encounter".into());
            }
            (
                record.party_elapsed_ms,
                record.party_total_damage,
                &record.party_targets,
            )
        }
        Scope::Observed => (
            record.elapsed_ms,
            Some(record.total_damage),
            &record.targets,
        ),
    };
    if !(1000..=24 * 60 * 60 * 1000).contains(&duration_ms) {
        return Err(
            "The selected scope must have between one second and 24 hours of damage".into(),
        );
    }
    let mut selected: Vec<&PlayerState> = record
        .players
        .iter()
        .filter(|player| match options.scope {
            Scope::Personal => Some(player.id) == local_id,
            Scope::Party => party.contains(&player.id),
            Scope::Observed => true,
        })
        .filter(|player| player.damage > 0)
        .collect();
    if selected.is_empty() || selected.len() > MAX_PLAYERS || target_rows.len() > MAX_TARGETS {
        return Err(
            "The selected encounter has no damage or exceeds the community row limit".into(),
        );
    }
    selected.sort_by_key(|player| (Some(player.id) != local_id, player.id));
    let unique: BTreeSet<_> = selected.iter().map(|player| player.id).collect();
    if unique.len() != selected.len() {
        return Err("The encounter contains duplicate player identities".into());
    }
    let total_damage = checked_sum(selected.iter().map(|player| player.damage))?;
    if total_damage > 9_007_199_254_740_991 || expected_total != Some(total_damage) {
        return Err("The selected encounter totals are inconsistent".into());
    }
    let mut players = Vec::with_capacity(selected.len());
    for (index, player) in selected.iter().enumerate() {
        if player.skills.len() > MAX_SKILLS {
            return Err("The encounter exceeds the community skill limit".into());
        }
        let mut skills = Vec::with_capacity(player.skills.len());
        for skill in &player.skills {
            if skill.crit_hits > skill.hits
                || skill.min > skill.max
                || skill.max > skill.damage
                || skill.hits > 9_007_199_254_740_991
            {
                return Err("The encounter contains inconsistent skill counters".into());
            }
            skills.push(PublicSkill {
                id: skill.id,
                name: text(&skill.name, 100)?,
                hits: skill.hits,
                damage: skill.damage,
                crit_hits: skill.crit_hits,
                min: skill.min,
                max: skill.max,
            });
        }
        skills.sort_by_key(|skill| skill.id);
        if skills.windows(2).any(|pair| pair[0].id == pair[1].id)
            || checked_sum(skills.iter().map(|skill| skill.damage))? != player.damage
        {
            return Err("The encounter skill totals do not match player damage".into());
        }
        players.push(PublicPlayer {
            id: (index + 1) as u32,
            name: public_name(
                &player.name,
                "Player",
                index + 1,
                options.anonymous || Some(player.id) != local_id,
            )?,
            class_name: text(&player.class_name, 80)?,
            damage: player.damage,
            dps: player.damage as f64 * 1000.0 / duration_ms as f64,
            skills,
        });
    }
    let mut targets = Vec::with_capacity(target_rows.len());
    for (index, target) in target_rows.iter().enumerate() {
        targets.push(PublicTarget {
            name: public_name(&target.name, "Target", index + 1, false)?,
            is_boss: target.is_boss,
            damage: target.damage,
        });
    }
    targets.sort_by(|a, b| {
        a.name
            .cmp(&b.name)
            .then(a.damage.cmp(&b.damage))
            .then(a.is_boss.cmp(&b.is_boss))
    });
    if checked_sum(targets.iter().map(|target| target.damage))? != total_damage {
        return Err("The encounter target totals do not match selected damage".into());
    }
    let context = options.context.cleaned()?;
    let identity_confirmed = local_id.is_some_and(|id| {
        selected
            .iter()
            .any(|player| player.id == id && player.identity_confirmed)
    }) && ["server", "name-match"]
        .contains(&record.local_identity_source.as_str());
    let membership_confirmed = record.party_membership_source == "server";
    let ranking_eligible = options.scope == Scope::Personal
        && record.source == "captured"
        && record.sample_complete
        && identity_confirmed
        && duration_ms >= 10_000
        && context.complete()
        && targets.len() == 1
        && targets[0].is_boss
        && !target_rows[0].name.trim().is_empty()
        && !entity_placeholder(target_rows[0].name.trim())
        && targets[0].name.to_lowercase() == context.boss.to_lowercase()
        && players.first().is_some_and(|player| {
            !player.class_name.is_empty() && !player.class_name.eq_ignore_ascii_case("unknown")
        });
    if options.rank_opt_in && !ranking_eligible {
        return Err("Ranking needs a complete personal encounter of at least 10 seconds against one named boss matching the selected boss, an identified player, class and all comparison filters".into());
    }
    let mut result = PublicEncounter {
        scope: options.scope,
        duration_ms,
        total_damage,
        dps: total_damage as f64 * 1000.0 / duration_ms as f64,
        players,
        targets,
        context,
        quality: Quality {
            source: if record.source == "captured" {
                "captured"
            } else {
                "imported"
            }
            .into(),
            sample_complete: record.sample_complete,
            identity_confirmed,
            membership_confirmed,
            ranking_eligible,
            classification: "community".into(),
        },
        record_hash: String::new(),
    };
    let bytes = serde_json::to_vec(&result).map_err(|_| "Cannot encode the community encounter")?;
    if bytes.len() > BODY_LIMIT - 1024 {
        return Err("The community encounter exceeds the 1 MB limit".into());
    }
    result.record_hash = sha256(&bytes);
    Ok(result)
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct RankingFilters {
    pub region: String,
    pub server: String,
    pub boss: String,
    pub class_name: String,
    pub difficulty: String,
    pub scope: Scope,
    pub limit: u32,
    pub cursor: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RankingEntry {
    pub rank: u32,
    pub share_id: String,
    pub url: String,
    pub name: String,
    pub class_name: String,
    pub dps: f64,
    pub total_damage: u64,
    pub duration_ms: u64,
    pub region: String,
    pub server: String,
    pub boss: String,
    pub difficulty: String,
    pub scope: Scope,
    pub validation: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Rankings {
    pub entries: Vec<RankingEntry>,
    pub total: u64,
    #[serde(default)]
    pub next_cursor: Option<String>,
    #[serde(default)]
    pub notice: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Share {
    pub id: String,
    pub url: String,
    pub created_at_ms: u64,
    #[serde(default)]
    pub expires_at_ms: u64,
    pub scope: Scope,
    pub anonymous: bool,
    pub rank_opt_in: bool,
    pub record_hash: String,
    pub validation: String,
    pub local_record_id: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct StoredShare {
    share: Option<Share>,
    record_hash: String,
    local_record_id: u64,
    endpoint: String,
    delete_token: String,
}

#[derive(Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Store {
    schema_version: u32,
    shares: Vec<StoredShare>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Snapshot {
    pub configured: bool,
    pub endpoint: String,
    pub shares: Vec<Share>,
    pub pending_count: usize,
    pub storage_error: String,
}

#[derive(Deserialize)]
struct CreateResponse {
    id: String,
    url: String,
    #[serde(default)]
    created_at_ms: u64,
    #[serde(default)]
    expires_at_ms: u64,
    validation: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Method {
    Get,
    Post,
    Delete,
}

trait Transport: Send + Sync {
    fn request(
        &self,
        method: Method,
        url: &str,
        body: Option<&[u8]>,
        token: Option<&str>,
    ) -> Result<Vec<u8>, String>;
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
                .user_agent("Luma-DPS Community")
                .build()
                .map_err(|_| "Cannot prepare the community HTTPS client")?,
        })
    }
}

impl Transport for HttpsTransport {
    fn request(
        &self,
        method: Method,
        url: &str,
        body: Option<&[u8]>,
        token: Option<&str>,
    ) -> Result<Vec<u8>, String> {
        let request = match method {
            Method::Get => self.client.get(url),
            Method::Post => self.client.post(url),
            Method::Delete => self.client.delete(url),
        };
        let mut request = request.header(reqwest::header::ACCEPT, "application/json");
        if let Some(body) = body {
            if body.len() > BODY_LIMIT {
                return Err("Community request exceeds the 1 MB limit".into());
            }
            request = request
                .header(reqwest::header::CONTENT_TYPE, "application/json")
                .body(body.to_vec());
        }
        if let Some(token) = token {
            request = request.bearer_auth(token);
        }
        let response = request.send().map_err(|_| {
            "Community service could not be reached; the local meter continues working"
        })?;
        if response.status().is_redirection() || response.url().as_str() != url {
            return Err("Community service redirects are not accepted".into());
        }
        if !response.status().is_success() {
            return Err(match response.status().as_u16() {
                404 => "Community share was not found".into(),
                409 => "This encounter was already shared with a different revocation key".into(),
                413 => "Community encounter exceeds the service limit".into(),
                429 => "Community request limit reached; try again later".into(),
                status => format!("Community service returned HTTP {status}"),
            });
        }
        if response.status().as_u16() == 204 {
            return Ok(Vec::new());
        }
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("");
        if !content_type
            .split(';')
            .next()
            .unwrap_or("")
            .trim()
            .eq_ignore_ascii_case("application/json")
        {
            return Err("Community service returned an unsupported response".into());
        }
        if response
            .content_length()
            .is_some_and(|length| length > BODY_LIMIT as u64)
        {
            return Err("Community response exceeds the 1 MB limit".into());
        }
        let mut bytes = Vec::new();
        response
            .take((BODY_LIMIT + 1) as u64)
            .read_to_end(&mut bytes)
            .map_err(|_| "Community response was interrupted")?;
        if bytes.len() > BODY_LIMIT {
            return Err("Community response exceeds the 1 MB limit".into());
        }
        Ok(bytes)
    }
}

fn endpoint(value: &str) -> Result<String, String> {
    if value.is_empty() {
        return Ok(String::new());
    }
    let parsed = reqwest::Url::parse(value).map_err(|_| "Invalid community endpoint")?;
    if value.len() > 256
        || parsed.scheme() != "https"
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || parsed.host_str().is_none()
        || parsed
            .host_str()
            .is_some_and(|host| host.parse::<std::net::IpAddr>().is_ok() || host.starts_with('['))
        || parsed.host_str().is_some_and(|host| {
            host == "localhost" || host.ends_with(".localhost") || !host.contains('.')
        })
    {
        return Err("Community endpoint must be a public HTTPS origin without credentials".into());
    }
    Ok(parsed.as_str().trim_end_matches('/').to_string())
}

fn same_origin(base: &str, value: &str) -> bool {
    let (Ok(base), Ok(value)) = (reqwest::Url::parse(base), reqwest::Url::parse(value)) else {
        return false;
    };
    base.origin() == value.origin()
        && value.scheme() == "https"
        && value.username().is_empty()
        && value.password().is_none()
        && value.fragment().is_none()
        && value.query().is_none()
        && value.as_str().len() <= 512
}

fn valid_id(value: &str) -> bool {
    value.len() == 32
        && value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}

fn valid_token(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
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
    let mut token = [0u8; 32];
    let status = unsafe {
        BCryptGenRandom(
            std::ptr::null_mut(),
            token.as_mut_ptr(),
            token.len() as u32,
            BCRYPT_USE_SYSTEM_PREFERRED_RNG,
        )
    };
    if status < 0 {
        return Err("Windows could not generate a secure revocation key".into());
    }
    Ok(token.iter().map(|byte| format!("{byte:02x}")).collect())
}

#[cfg(not(windows))]
fn random_token() -> Result<String, String> {
    let mut token = [0u8; 32];
    std::fs::File::open("/dev/urandom")
        .and_then(|mut file| file.read_exact(&mut token))
        .map_err(|_| "Cannot generate a secure revocation key")?;
    Ok(token.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn load(path: &Path) -> Result<Store, String> {
    if !path.exists() {
        return Ok(Store {
            schema_version: 1,
            shares: Vec::new(),
        });
    }
    let metadata = fs::metadata(path).map_err(|_| "Cannot read local community keys")?;
    if metadata.len() > STORAGE_LIMIT as u64 {
        return Err("Local community keys exceed the storage limit".into());
    }
    let bytes = fs::read(path).map_err(|_| "Cannot read local community keys")?;
    if bytes.len() > STORAGE_LIMIT {
        return Err("Local community keys exceed the storage limit".into());
    }
    let store: Store = serde_json::from_slice(&bytes).map_err(|_| {
        "Local community keys are invalid; sharing is paused to preserve deletion access"
    })?;
    if store.schema_version != 1 || store.shares.len() > MAX_SHARES {
        return Err("Local community key format or count is unsupported".into());
    }
    for row in &store.shares {
        if !valid_token(&row.delete_token)
            || !valid_token(&row.record_hash)
            || endpoint(&row.endpoint).ok().as_deref() != Some(&row.endpoint)
            || row.endpoint.is_empty()
        {
            return Err("Local community keys contain an invalid entry".into());
        }
        if let Some(share) = &row.share {
            if !valid_id(&share.id)
                || !same_origin(&row.endpoint, &share.url)
                || share.record_hash != row.record_hash
                || share.validation != "community"
            {
                return Err("Local community share contains an invalid link".into());
            }
        }
    }
    Ok(store)
}

fn save(path: &Path, store: &Store) -> Result<(), String> {
    let bytes = serde_json::to_vec(store).map_err(|_| "Cannot encode local community keys")?;
    if bytes.len() > STORAGE_LIMIT || store.shares.len() > MAX_SHARES {
        return Err("Local community key storage is full; revoke older shares first".into());
    }
    let directory = path
        .parent()
        .ok_or("Local community directory is unavailable")?;
    fs::create_dir_all(directory).map_err(|_| "Cannot create the local community directory")?;
    let temporary = path.with_extension("json.new");
    let result = (|| {
        let mut file = OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .open(&temporary)
            .map_err(|_| "Cannot store the community revocation key; no upload was started")?;
        file.write_all(&bytes)
            .map_err(|_| "Cannot store the community revocation key")?;
        file.sync_all()
            .map_err(|_| "Cannot flush the community revocation key")?;
        drop(file);
        fs::rename(&temporary, path).map_err(|_| "Cannot replace local community keys")
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    Ok(result?)
}

/// All mutations are serialized. The key is durable before POST, so a process
/// interruption can be retried without abandoning the ability to revoke it.
pub struct Service {
    endpoint: String,
    path: PathBuf,
    store: Mutex<Result<Store, String>>,
    transport: Arc<dyn Transport>,
}

impl Service {
    pub fn new(base: &str, path: PathBuf) -> Result<Self, String> {
        Self::with_transport(base, path, Arc::new(HttpsTransport::new()?))
    }
    fn with_transport(
        base: &str,
        path: PathBuf,
        transport: Arc<dyn Transport>,
    ) -> Result<Self, String> {
        let endpoint = endpoint(base)?;
        let store = Mutex::new(load(&path));
        Ok(Self {
            endpoint,
            path,
            store,
            transport,
        })
    }
    pub fn snapshot(&self) -> Snapshot {
        let state = self
            .store
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        let (shares, pending_count, storage_error) = match &*state {
            Ok(store) => (
                store
                    .shares
                    .iter()
                    .filter(|row| row.endpoint == self.endpoint)
                    .filter_map(|row| row.share.clone())
                    .collect(),
                store
                    .shares
                    .iter()
                    .filter(|row| row.endpoint == self.endpoint && row.share.is_none())
                    .count(),
                String::new(),
            ),
            Err(message) => (Vec::new(), 0, message.clone()),
        };
        Snapshot {
            configured: !self.endpoint.is_empty(),
            endpoint: self.endpoint.clone(),
            shares,
            pending_count,
            storage_error,
        }
    }
    pub fn share(&self, record: &Encounter, options: &ShareOptions) -> Result<Share, String> {
        let prepared = prepare_record(record, options)?;
        self.share_prepared(record.id, prepared, options, random_token()?)
    }
    fn share_prepared(
        &self,
        local_record_id: u64,
        record: PublicEncounter,
        options: &ShareOptions,
        fresh_token: String,
    ) -> Result<Share, String> {
        if self.endpoint.is_empty() {
            return Err(
                "Community service is not configured; local sharing and analysis remain available"
                    .into(),
            );
        }
        if !valid_token(&fresh_token) {
            return Err("Invalid community revocation key".into());
        }
        let mut guard = self
            .store
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        let store = guard.as_mut().map_err(|message| message.clone())?;
        let existing = store
            .shares
            .iter()
            .position(|row| row.record_hash == record.record_hash && row.endpoint == self.endpoint);
        if let Some(index) = existing {
            if let Some(share) = &store.shares[index].share {
                let expired = share.expires_at_ms != 0 && share.expires_at_ms <= now_ms();
                if !expired {
                    if share.anonymous != options.anonymous
                        || share.rank_opt_in != options.rank_opt_in
                    {
                        return Err(
                            "Revoke this existing share before changing its public ranking options"
                                .into(),
                        );
                    }
                    return Ok(share.clone());
                }
                // The token is already durable. Keep the old link until an
                // explicit successful retry replaces it, preserving deletion
                // access even if the network fails or the process exits.
            }
        }
        let index = if let Some(index) = existing {
            index
        } else {
            if store.shares.len() >= MAX_SHARES {
                return Err(
                    "Local community key storage is full; revoke older shares first".into(),
                );
            }
            store.shares.push(StoredShare {
                share: None,
                record_hash: record.record_hash.clone(),
                local_record_id,
                endpoint: self.endpoint.clone(),
                delete_token: fresh_token,
            });
            let index = store.shares.len() - 1;
            if let Err(message) = save(&self.path, store) {
                store.shares.remove(index);
                return Err(message);
            }
            index
        };
        let body = serde_json::to_vec(&serde_json::json!({"schema_version":1,"record":record,"anonymous":options.anonymous,"rank_opt_in":options.rank_opt_in,"delete_token":store.shares[index].delete_token})).map_err(|_| "Cannot encode community upload")?;
        if body.len() > BODY_LIMIT {
            return Err("Community upload exceeds the 1 MB limit".into());
        }
        let bytes = self.transport.request(
            Method::Post,
            &format!("{}/v1/shares", self.endpoint),
            Some(&body),
            None,
        )?;
        if bytes.len() > BODY_LIMIT {
            return Err("Community response exceeds the 1 MB limit".into());
        }
        let response: CreateResponse = serde_json::from_slice(&bytes)
            .map_err(|_| "Community service returned an invalid share")?;
        if !valid_id(&response.id)
            || !same_origin(&self.endpoint, &response.url)
            || response.validation != "community"
        {
            return Err("Community service returned an unsafe or unsupported share link".into());
        }
        let share = Share {
            id: response.id,
            url: response.url,
            created_at_ms: if response.created_at_ms == 0 {
                now_ms()
            } else {
                response.created_at_ms
            },
            expires_at_ms: response.expires_at_ms,
            scope: options.scope,
            anonymous: options.anonymous,
            rank_opt_in: options.rank_opt_in,
            record_hash: record.record_hash,
            validation: "community".into(),
            local_record_id,
        };
        store.shares[index].share = Some(share.clone());
        save(&self.path, store)?;
        Ok(share)
    }
    pub fn rankings(&self, filters: &RankingFilters) -> Result<Rankings, String> {
        if self.endpoint.is_empty() {
            return Err("Community service is not configured".into());
        }
        let mut url = reqwest::Url::parse(&format!("{}/v1/rankings", self.endpoint))
            .map_err(|_| "Invalid community ranking URL")?;
        let limit = if filters.limit == 0 {
            25
        } else {
            filters.limit.clamp(1, 50)
        };
        {
            let mut query = url.query_pairs_mut();
            for (key, value) in [
                ("region", &filters.region),
                ("server", &filters.server),
                ("boss", &filters.boss),
                ("class_name", &filters.class_name),
                ("difficulty", &filters.difficulty),
            ] {
                let value = text(value, 80)?;
                if !value.is_empty() {
                    query.append_pair(key, &value);
                }
            }
            let scope = match filters.scope {
                Scope::Personal => "personal",
                Scope::Party => "party",
                Scope::Observed => "observed",
            };
            query
                .append_pair("scope", scope)
                .append_pair("limit", &limit.to_string());
            if !filters.cursor.is_empty() {
                query.append_pair("cursor", &text(&filters.cursor, 256)?);
            }
        }
        let bytes = self
            .transport
            .request(Method::Get, url.as_str(), None, None)?;
        if bytes.len() > BODY_LIMIT {
            return Err("Community response exceeds the 1 MB limit".into());
        }
        let mut result: Rankings = serde_json::from_slice(&bytes)
            .map_err(|_| "Community service returned invalid rankings")?;
        if result.entries.len() > limit as usize
            || result
                .next_cursor
                .as_ref()
                .is_some_and(|cursor| text(cursor, 256).is_err())
        {
            return Err("Community ranking response exceeds its row or cursor limit".into());
        }
        for row in &result.entries {
            if !valid_id(&row.share_id)
                || !same_origin(&self.endpoint, &row.url)
                || row.validation != "community"
                || !row.dps.is_finite()
                || row.dps < 0.0
                || row.duration_ms < 1000
                || row.total_damage > 9_007_199_254_740_991
            {
                return Err("Community ranking contains an invalid row".into());
            }
            for value in [
                &row.name,
                &row.class_name,
                &row.region,
                &row.server,
                &row.boss,
                &row.difficulty,
            ] {
                text(value, 80)?;
            }
            let expected = row.total_damage as f64 * 1000.0 / row.duration_ms as f64;
            if (row.dps - expected).abs() > expected.abs().max(1.0) * 0.000_001 {
                return Err("Community ranking contains inconsistent damage and duration".into());
            }
        }
        result.notice = "Community submissions; game-server verification is unavailable. Only matching filters are comparable.".into();
        Ok(result)
    }
    pub fn revoke(&self, id: &str) -> Result<Snapshot, String> {
        if !valid_id(id) {
            return Err("Invalid community share identifier".into());
        }
        let mut guard = self
            .store
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        let store = guard.as_mut().map_err(|message| message.clone())?;
        let index = store
            .shares
            .iter()
            .position(|row| {
                row.endpoint == self.endpoint
                    && row.share.as_ref().is_some_and(|share| share.id == id)
            })
            .ok_or("This share has no revocation key on this device")?;
        self.transport.request(
            Method::Delete,
            &format!("{}/v1/shares/{id}", self.endpoint),
            None,
            Some(&store.shares[index].delete_token),
        )?;
        let removed = store.shares.remove(index);
        if let Err(message) = save(&self.path, store) {
            store.shares.insert(index, removed);
            return Err(message);
        }
        drop(guard);
        Ok(self.snapshot())
    }
    /// Validate an already stored public link before handing it to the OS.
    pub fn allows_url(&self, value: &str) -> bool {
        if !same_origin(&self.endpoint, value) {
            return false;
        }
        self.snapshot()
            .shares
            .iter()
            .any(|share| share.url == value)
    }
    /// Ranking links can also be read, but only via the canonical public
    /// reader route on the configured service origin.
    pub fn allows_public_url(&self, value: &str) -> bool {
        if !same_origin(&self.endpoint, value) {
            return false;
        }
        reqwest::Url::parse(value)
            .ok()
            .and_then(|url| url.path().strip_prefix("/r/").map(str::to_owned))
            .is_some_and(|id| valid_id(&id))
    }
}

/// A small dependency-free SHA-256 implementation for content identity, not
/// authentication. The revocation token comes from the operating system RNG.
fn sha256(bytes: &[u8]) -> String {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];
    let mut h = [
        0x6a09e667u32,
        0xbb67ae85,
        0x3c6ef372,
        0xa54ff53a,
        0x510e527f,
        0x9b05688c,
        0x1f83d9ab,
        0x5be0cd19,
    ];
    let mut padded = bytes.to_vec();
    padded.push(0x80);
    while padded.len() % 64 != 56 {
        padded.push(0);
    }
    padded.extend_from_slice(&(bytes.len() as u64 * 8).to_be_bytes());
    for chunk in padded.chunks_exact(64) {
        let mut w = [0u32; 64];
        for (index, word) in chunk.chunks_exact(4).enumerate() {
            w[index] = u32::from_be_bytes(word.try_into().unwrap());
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1);
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ (!e & g);
            let t1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2 = s0.wrapping_add(maj);
            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(t1);
            d = c;
            c = b;
            b = a;
            a = t1.wrapping_add(t2);
        }
        for (target, value) in h.iter_mut().zip([a, b, c, d, e, f, g, hh]) {
            *target = target.wrapping_add(value);
        }
    }
    h.iter().map(|word| format!("{word:08x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use luma_engine::{DamageSample, SkillState, TargetState};
    use std::sync::atomic::{AtomicU64, Ordering};

    fn fixture() -> Encounter {
        let player = |id, name: &str, damage| PlayerState {
            id,
            name: name.into(),
            class_name: "Ranger".into(),
            damage,
            dps: f64::INFINITY,
            identity_confirmed: true,
            is_local: id == 786421,
            skills: vec![SkillState {
                id: 22,
                name: "Arrow".into(),
                hits: 2,
                damage,
                crit_hits: 1,
                min: 1,
                max: damage,
                ..Default::default()
            }],
            ..Default::default()
        };
        let target = |damage| TargetState {
            id: 990001,
            name: "Boss".into(),
            is_boss: true,
            damage,
            ..Default::default()
        };
        Encounter {
            id: 992,
            started_ms: 1_000_000,
            ended_ms: 1_060_000,
            elapsed_ms: 60_000,
            total_damage: 3000,
            dps: f64::NAN,
            players: vec![
                player(111222, "OtherPrivateName", 2000),
                player(786421, "LocalPrivateName", 1000),
            ],
            targets: vec![target(3000)],
            local_player_id: Some(786421),
            local_player_name: "LocalPrivateName".into(),
            local_identity_source: "server".into(),
            personal_total_damage: Some(1000),
            personal_elapsed_ms: 50_000,
            personal_targets: vec![target(1000)],
            party_member_ids: vec![786421],
            party_membership_source: "server".into(),
            party_total_damage: Some(1000),
            party_elapsed_ms: 50_000,
            party_targets: vec![target(1000)],
            sample_complete: true,
            source: "captured".into(),
            actor_scope: "observed".into(),
            damage_samples: vec![DamageSample {
                source: 786421,
                player_id: 786421,
                target: 990001,
                amount: 1000,
                ..Default::default()
            }],
            ..Default::default()
        }
    }

    fn options() -> ShareOptions {
        ShareOptions {
            context: Context {
                region: "EU".into(),
                server: "Zemurru".into(),
                boss: "Boss".into(),
                difficulty: "Normal".into(),
            },
            ..Default::default()
        }
    }

    fn path() -> PathBuf {
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let directory = std::env::temp_dir().join(format!(
            "luma-community-test-{}-{}-{}",
            std::process::id(),
            now_ms(),
            COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&directory).unwrap();
        directory.join("community.json")
    }

    fn cleanup(path: &Path) {
        if let Some(parent) = path.parent() {
            let _ = fs::remove_dir_all(parent);
        }
    }

    #[derive(Default)]
    struct Mock {
        requests: Mutex<Vec<(Method, String, Vec<u8>, Option<String>)>>,
        responses: Mutex<Vec<Result<Vec<u8>, String>>>,
    }
    impl Transport for Mock {
        fn request(
            &self,
            method: Method,
            url: &str,
            body: Option<&[u8]>,
            token: Option<&str>,
        ) -> Result<Vec<u8>, String> {
            self.requests.lock().unwrap().push((
                method,
                url.into(),
                body.unwrap_or_default().to_vec(),
                token.map(str::to_owned),
            ));
            self.responses.lock().unwrap().remove(0)
        }
    }
    fn response() -> Vec<u8> {
        br#"{"id":"0123456789abcdef0123456789abcdef","url":"https://community.example/r/0123456789abcdef0123456789abcdef","created_at_ms":42,"validation":"community"}"#.to_vec()
    }
    fn service(mock: Arc<Mock>) -> (Service, PathBuf) {
        let path = path();
        (
            Service::with_transport("https://community.example", path.clone(), mock).unwrap(),
            path,
        )
    }

    #[test]
    fn public_record_is_an_allowlist_with_scope_names_and_entity_ids_removed() {
        let result = prepare_record(&fixture(), &options()).unwrap();
        let encoded = serde_json::to_string(&result).unwrap();
        for forbidden in [
            "LocalPrivateName",
            "OtherPrivateName",
            "786421",
            "111222",
            "990001",
            "damage_samples",
            "received_samples",
            "character_build",
            "started_ms",
            "delete_token",
        ] {
            assert!(!encoded.contains(forbidden), "{forbidden}");
        }
        assert_eq!(result.players.len(), 1);
        assert_eq!(result.players[0].id, 1);
        assert_eq!(result.players[0].name, "Player 1");
        assert_eq!(result.total_damage, 1000);
        assert_eq!(result.duration_ms, 50_000);
        assert_eq!(result.dps, 20.0);
        assert_eq!(result.players[0].dps, 20.0);
        assert_eq!(result.targets[0].damage, 1000);
        assert_eq!(result.record_hash.len(), 64);
    }

    #[test]
    fn party_and_observed_exports_have_separate_totals_and_durations() {
        let mut opts = options();
        opts.scope = Scope::Party;
        let party = prepare_record(&fixture(), &opts).unwrap();
        assert_eq!(party.total_damage, 1000);
        assert_eq!(party.duration_ms, 50_000);
        opts.scope = Scope::Observed;
        opts.anonymous = false;
        let observed = prepare_record(&fixture(), &opts).unwrap();
        assert_eq!(observed.total_damage, 3000);
        assert_eq!(observed.duration_ms, 60_000);
        assert_eq!(observed.dps, 50.0);
        assert_eq!(observed.players[0].name, "LocalPrivateName");
        assert_eq!(observed.players[1].name, "Player 2");
    }

    #[test]
    fn limited_scope_history_cannot_be_expanded_to_other_actors() {
        let mut record = fixture();
        record.actor_scope = "personal".into();
        let mut opts = options();
        opts.scope = Scope::Observed;
        assert!(prepare_record(&record, &opts).is_err());
        record.actor_scope = "party".into();
        assert!(prepare_record(&record, &opts).is_err());
    }

    #[test]
    fn unknown_local_and_party_membership_do_not_mislabel_surrounding_damage() {
        let mut record = fixture();
        record.local_player_id = None;
        assert!(prepare_record(&record, &options()).is_err());
        let mut record = fixture();
        record.party_membership_source = "unresolved".into();
        let mut opts = options();
        opts.scope = Scope::Party;
        assert!(prepare_record(&record, &opts).is_err());
    }

    #[test]
    fn corrupted_scope_totals_skills_targets_and_duplicate_entities_are_rejected() {
        let mut record = fixture();
        record.personal_total_damage = Some(999);
        assert!(prepare_record(&record, &options()).is_err());
        let mut record = fixture();
        record.players[1].skills[0].damage = 999;
        assert!(prepare_record(&record, &options()).is_err());
        let mut record = fixture();
        record.personal_targets[0].damage = 999;
        assert!(prepare_record(&record, &options()).is_err());
        let mut record = fixture();
        record.players.push(record.players[1].clone());
        assert!(prepare_record(&record, &options()).is_err());
    }

    #[test]
    fn ranking_opt_in_is_separate_and_ineligible_records_can_still_be_shared() {
        let record = fixture();
        let mut opts = options();
        opts.rank_opt_in = true;
        assert!(
            prepare_record(&record, &opts)
                .unwrap()
                .quality
                .ranking_eligible
        );
        for change in 0..7 {
            let mut record = fixture();
            let mut opts = options();
            opts.rank_opt_in = true;
            match change {
                0 => record.sample_complete = false,
                1 => record.local_identity_source = "manual".into(),
                2 => record.source = "imported".into(),
                3 => record.personal_elapsed_ms = 9_999,
                4 => opts.context.difficulty.clear(),
                5 => record.players[1].class_name = "Unknown".into(),
                _ => record.personal_targets[0].is_boss = false,
            }
            assert!(prepare_record(&record, &opts).is_err(), "{change}");
            opts.rank_opt_in = false;
            assert!(
                !prepare_record(&record, &opts)
                    .unwrap()
                    .quality
                    .ranking_eligible
            );
        }
    }

    #[test]
    fn record_hash_is_stable_across_original_player_order_and_private_samples() {
        let first = prepare_record(&fixture(), &options()).unwrap();
        let mut record = fixture();
        record.players.reverse();
        record.damage_samples.clear();
        record.id += 100;
        let second = prepare_record(&record, &options()).unwrap();
        assert_eq!(first.record_hash, second.record_hash);
        let mut opts = options();
        opts.anonymous = false;
        assert_ne!(
            first.record_hash,
            prepare_record(&record, &opts).unwrap().record_hash
        );
    }

    #[test]
    fn ranking_requires_one_received_boss_name_matching_the_comparison_filter() {
        let mut opts = options();
        opts.rank_opt_in = true;
        opts.context.boss = "bOsS".into();
        assert!(
            prepare_record(&fixture(), &opts)
                .unwrap()
                .quality
                .ranking_eligible
        );

        let mut mixed = fixture();
        mixed.personal_targets[0].damage = 900;
        mixed.personal_targets.push(TargetState {
            id: 99,
            name: "Adds".into(),
            damage: 100,
            is_boss: false,
            ..Default::default()
        });
        assert!(prepare_record(&mixed, &opts).is_err());
        opts.rank_opt_in = false;
        assert!(
            !prepare_record(&mixed, &opts)
                .unwrap()
                .quality
                .ranking_eligible
        );

        let mut mismatch = options();
        mismatch.context.boss = "Different boss".into();
        assert!(
            !prepare_record(&fixture(), &mismatch)
                .unwrap()
                .quality
                .ranking_eligible
        );

        let mut unnamed = fixture();
        unnamed.personal_targets[0].name = "Target #990001".into();
        let mut unnamed_options = options();
        unnamed_options.context.boss = "Target 1".into();
        let public = prepare_record(&unnamed, &unnamed_options).unwrap();
        assert_eq!(public.targets[0].name, "Target 1");
        assert!(!public.quality.ranking_eligible);
        assert!(!serde_json::to_string(&public).unwrap().contains("990001"));
    }

    #[test]
    fn sha256_matches_empty_short_and_multiblock_standard_vectors() {
        assert_eq!(
            sha256(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            sha256(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(
            sha256(b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
            "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
        );
    }

    #[test]
    fn untrusted_text_and_oversized_or_empty_encounters_are_rejected() {
        let mut opts = options();
        opts.context.server = "hello\nInjected".into();
        assert!(prepare_record(&fixture(), &opts).is_err());
        let mut record = fixture();
        record.players[1].name = "x".repeat(81);
        assert!(prepare_record(&record, &options()).is_err());
        let mut record = fixture();
        record.ended_ms = record.started_ms;
        assert!(prepare_record(&record, &options()).is_err());
        let mut record = fixture();
        record.personal_elapsed_ms = 86_400_001;
        assert!(prepare_record(&record, &options()).is_err());
    }

    #[test]
    fn only_public_https_endpoints_and_same_origin_public_urls_are_accepted() {
        for invalid in [
            "http://community.example",
            "https://localhost",
            "https://127.0.0.1",
            "https://[::1]",
            "https://user:pass@community.example",
            "https://community.example/?key=secret",
            "https://community.example/#fragment",
        ] {
            assert!(endpoint(invalid).is_err(), "{invalid}");
        }
        assert_eq!(
            endpoint("https://community.example/").unwrap(),
            "https://community.example"
        );
        assert!(endpoint("").is_ok());
        assert!(!same_origin(
            "https://community.example",
            "https://attacker.example/share/id"
        ));
        assert!(!same_origin(
            "https://community.example",
            "https://community.example/share/id?delete_token=secret"
        ));
    }

    #[test]
    fn delete_token_is_durable_before_upload_and_never_exposed_in_snapshot() {
        let mock = Arc::new(Mock::default());
        mock.responses.lock().unwrap().push(Ok(response()));
        let (service, path) = service(mock.clone());
        let share = service
            .share_prepared(
                992,
                prepare_record(&fixture(), &options()).unwrap(),
                &options(),
                "a".repeat(64),
            )
            .unwrap();
        let stored = fs::read_to_string(&path).unwrap();
        assert!(stored.contains(&"a".repeat(64)));
        let snapshot = serde_json::to_string(&service.snapshot()).unwrap();
        assert!(!snapshot.contains("delete_token"));
        assert!(!snapshot.contains(&"a".repeat(64)));
        assert!(snapshot.contains(&share.id));
        let requests = mock.requests.lock().unwrap();
        let body: serde_json::Value = serde_json::from_slice(&requests[0].2).unwrap();
        assert_eq!(body["delete_token"], "a".repeat(64));
        assert!(requests[0].3.is_none());
        cleanup(&path);
    }

    #[test]
    fn interrupted_upload_reuses_the_persisted_key_on_retry() {
        let mock = Arc::new(Mock::default());
        mock.responses
            .lock()
            .unwrap()
            .extend([Err("temporary offline".into()), Ok(response())]);
        let (service, path) = service(mock.clone());
        let prepared = prepare_record(&fixture(), &options()).unwrap();
        assert!(service
            .share_prepared(992, prepared.clone(), &options(), "a".repeat(64))
            .is_err());
        assert_eq!(service.snapshot().pending_count, 1);
        drop(service);
        let service =
            Service::with_transport("https://community.example", path.clone(), mock.clone())
                .unwrap();
        service
            .share_prepared(992, prepared, &options(), "b".repeat(64))
            .unwrap();
        let requests = mock.requests.lock().unwrap();
        for request in requests.iter() {
            let body: serde_json::Value = serde_json::from_slice(&request.2).unwrap();
            assert_eq!(body["delete_token"], "a".repeat(64));
        }
        assert_eq!(service.snapshot().pending_count, 0);
        cleanup(&path);
    }

    #[test]
    fn successful_identical_share_does_not_upload_twice() {
        let mock = Arc::new(Mock::default());
        mock.responses.lock().unwrap().push(Ok(response()));
        let (service, path) = service(mock.clone());
        let prepared = prepare_record(&fixture(), &options()).unwrap();
        let first = service
            .share_prepared(992, prepared.clone(), &options(), "a".repeat(64))
            .unwrap();
        let second = service
            .share_prepared(992, prepared, &options(), "b".repeat(64))
            .unwrap();
        assert_eq!(first.id, second.id);
        assert_eq!(mock.requests.lock().unwrap().len(), 1);
        cleanup(&path);
    }

    #[test]
    fn expired_share_is_explicitly_renewed_with_the_same_durable_capability() {
        let mock = Arc::new(Mock::default());
        let mut expired: serde_json::Value = serde_json::from_slice(&response()).unwrap();
        expired["expires_at_ms"] = serde_json::json!(1);
        let mut renewed = expired.clone();
        renewed["id"] = serde_json::json!("abcdef0123456789abcdef0123456789");
        renewed["url"] =
            serde_json::json!("https://community.example/r/abcdef0123456789abcdef0123456789");
        renewed["expires_at_ms"] = serde_json::json!(now_ms() + 100_000);
        mock.responses.lock().unwrap().extend([
            Ok(serde_json::to_vec(&expired).unwrap()),
            Ok(serde_json::to_vec(&renewed).unwrap()),
        ]);
        let (service, path) = service(mock.clone());
        let prepared = prepare_record(&fixture(), &options()).unwrap();
        let first = service
            .share_prepared(992, prepared.clone(), &options(), "a".repeat(64))
            .unwrap();
        let second = service
            .share_prepared(992, prepared.clone(), &options(), "b".repeat(64))
            .unwrap();
        assert_ne!(first.id, second.id);
        assert_eq!(service.snapshot().shares.len(), 1);
        assert_eq!(service.snapshot().shares[0].id, second.id);
        assert_eq!(
            service
                .share_prepared(992, prepared, &options(), "c".repeat(64))
                .unwrap()
                .id,
            second.id
        );
        let requests = mock.requests.lock().unwrap();
        assert_eq!(requests.len(), 2);
        for request in requests.iter() {
            let body: serde_json::Value = serde_json::from_slice(&request.2).unwrap();
            assert_eq!(body["delete_token"], "a".repeat(64));
        }
        cleanup(&path);
    }

    #[test]
    fn failed_expired_share_retry_preserves_its_original_local_link_and_key() {
        let mock = Arc::new(Mock::default());
        let mut expired: serde_json::Value = serde_json::from_slice(&response()).unwrap();
        expired["expires_at_ms"] = serde_json::json!(1);
        mock.responses.lock().unwrap().extend([
            Ok(serde_json::to_vec(&expired).unwrap()),
            Err("offline".into()),
        ]);
        let (service, path) = service(mock);
        let prepared = prepare_record(&fixture(), &options()).unwrap();
        let first = service
            .share_prepared(992, prepared.clone(), &options(), "a".repeat(64))
            .unwrap();
        assert!(service
            .share_prepared(992, prepared, &options(), "b".repeat(64))
            .is_err());
        assert_eq!(service.snapshot().shares[0].id, first.id);
        assert!(fs::read_to_string(&path).unwrap().contains(&"a".repeat(64)));
        cleanup(&path);
    }

    #[test]
    fn off_origin_response_is_rejected_while_deletion_key_is_retained() {
        let mock = Arc::new(Mock::default());
        mock.responses
            .lock()
            .unwrap()
            .push(Ok(String::from_utf8(response())
                .unwrap()
                .replace("https://community.example/", "https://attacker.example/")
                .into_bytes()));
        let (service, path) = service(mock);
        assert!(service
            .share_prepared(
                992,
                prepare_record(&fixture(), &options()).unwrap(),
                &options(),
                "a".repeat(64)
            )
            .is_err());
        assert_eq!(service.snapshot().pending_count, 1);
        assert!(fs::read_to_string(&path).unwrap().contains(&"a".repeat(64)));
        cleanup(&path);
    }

    #[test]
    fn revoke_sends_key_only_as_authorization_and_removes_successful_local_entry() {
        let mock = Arc::new(Mock::default());
        mock.responses
            .lock()
            .unwrap()
            .extend([Ok(response()), Ok(Vec::new())]);
        let (service, path) = service(mock.clone());
        let share = service
            .share_prepared(
                992,
                prepare_record(&fixture(), &options()).unwrap(),
                &options(),
                "a".repeat(64),
            )
            .unwrap();
        assert!(service.allows_url(&share.url));
        let snapshot = service.revoke(&share.id).unwrap();
        assert!(snapshot.shares.is_empty());
        assert!(!service.allows_url(&share.url));
        let requests = mock.requests.lock().unwrap();
        assert_eq!(requests[1].0, Method::Delete);
        assert_eq!(requests[1].3, Some("a".repeat(64)));
        assert!(requests[1].2.is_empty());
        assert!(!requests[1].1.contains(&"a".repeat(64)));
        cleanup(&path);
    }

    #[test]
    fn failed_revoke_retains_the_local_deletion_key() {
        let mock = Arc::new(Mock::default());
        mock.responses
            .lock()
            .unwrap()
            .extend([Ok(response()), Err("offline".into())]);
        let (service, path) = service(mock);
        let share = service
            .share_prepared(
                992,
                prepare_record(&fixture(), &options()).unwrap(),
                &options(),
                "a".repeat(64),
            )
            .unwrap();
        assert!(service.revoke(&share.id).is_err());
        assert_eq!(service.snapshot().shares.len(), 1);
        cleanup(&path);
    }

    #[test]
    fn corrupt_local_key_store_blocks_mutation_without_overwriting_keys() {
        let path = path();
        fs::write(&path, b"{broken key store}").unwrap();
        let mock = Arc::new(Mock::default());
        let service =
            Service::with_transport("https://community.example", path.clone(), mock.clone())
                .unwrap();
        assert!(!service.snapshot().storage_error.is_empty());
        assert!(service
            .share_prepared(
                992,
                prepare_record(&fixture(), &options()).unwrap(),
                &options(),
                "a".repeat(64)
            )
            .is_err());
        assert!(mock.requests.lock().unwrap().is_empty());
        assert_eq!(fs::read(&path).unwrap(), b"{broken key store}");
        cleanup(&path);
    }

    #[test]
    fn ranking_filters_are_url_encoded_and_responses_are_bounded_and_labeled() {
        let mock = Arc::new(Mock::default());
        mock.responses.lock().unwrap().push(Ok(
            br#"{"entries":[],"total":0,"notice":"verified world leaderboard"}"#.to_vec(),
        ));
        let (service, path) = service(mock.clone());
        let result = service
            .rankings(&RankingFilters {
                server: "A&B".into(),
                limit: 500,
                ..Default::default()
            })
            .unwrap();
        assert!(result.notice.contains("Community submissions"));
        assert!(!result.notice.contains("verified world"));
        let request = &mock.requests.lock().unwrap()[0];
        assert!(request.1.contains("server=A%26B"));
        assert!(request.1.contains("limit=50"));
        assert!(request.2.is_empty());
        assert!(request.3.is_none());
        cleanup(&path);
    }

    #[test]
    fn absent_service_does_not_issue_requests_or_create_private_state() {
        let path = path();
        let mock = Arc::new(Mock::default());
        let service = Service::with_transport("", path.clone(), mock.clone()).unwrap();
        assert!(!service.snapshot().configured);
        assert!(service
            .share_prepared(
                992,
                prepare_record(&fixture(), &options()).unwrap(),
                &options(),
                "a".repeat(64)
            )
            .is_err());
        assert!(!path.exists());
        assert!(mock.requests.lock().unwrap().is_empty());
        cleanup(&path);
    }

    #[test]
    fn rng_produces_distinct_valid_revocation_tokens() {
        let first = random_token().unwrap();
        let second = random_token().unwrap();
        assert!(valid_token(&first));
        assert!(valid_token(&second));
        assert_ne!(first, second);
    }

    #[test]
    fn public_reader_opens_only_canonical_share_routes_on_the_service() {
        let (service, path) = service(Arc::new(Mock::default()));
        assert!(service
            .allows_public_url("https://community.example/r/0123456789abcdef0123456789abcdef"));
        for invalid in [
            "https://attacker.example/r/0123456789abcdef0123456789abcdef",
            "https://community.example/settings",
            "https://community.example/r/../../settings",
            "https://community.example/r/0123456789abcdef0123456789abcdef?token=secret",
            "https://community.example/r/0123456789abcdef0123456789abcdef/extra",
        ] {
            assert!(!service.allows_public_url(invalid));
        }
        cleanup(&path);
    }
}
