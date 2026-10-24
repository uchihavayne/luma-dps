pub mod assistance;
pub mod character;
pub mod cooldowns;
pub mod cube;
pub mod field_boss;
pub mod framing;
pub mod latency;
pub mod net;
mod npc_catalog;
pub mod packets;
pub mod records;
pub mod resources;
pub mod spatial;

use packets::Event;
#[cfg(test)]
use packets::Hit;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap, VecDeque};

const IDLE_MS: u64 = 10_000;
/// A boss that is still alive keeps the fight open this long between hits.
const BOSS_IDLE_MS: u64 = 30_000;
const MAX_HITS: usize = 250_000;
const MAX_SAMPLES: usize = 20_000;
const MAX_HISTORY_SAMPLES: usize = 100_000;
const MAX_HISTORY_RECORDS: usize = 200;
const TIMELINE_BUCKETS: u64 = 240;
const TIMELINE_PLAYERS: usize = 64;
const PROFILE_PENDING_MS: u64 = 30_000;
const MAX_PENDING_PROFILES: usize = 64;
const RECENT_PERSONAL_TARGET_MS: u64 = 10_000;

fn event_contains_pet_observation(event: &Event) -> bool {
    match event {
        Event::Character(
            character::CharacterEvent::PetInventory { .. }
            | character::CharacterEvent::PetGains { .. }
            | character::CharacterEvent::PetLevel { .. }
            | character::CharacterEvent::PetAdded { .. },
        ) => true,
        Event::Updates(events) => events.iter().any(event_contains_pet_observation),
        _ => false,
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct DamageSample {
    pub timestamp_ms: u64,
    pub source: u64,
    pub player_id: u64,
    pub target: u64,
    pub skill: u32,
    pub amount: u64,
    pub critical: bool,
    pub tick: bool,
    pub flags: u8,
    pub angle: u8,
    pub metric: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct TrainingState {
    pub status: String,
    pub duration_ms: u64,
    pub remaining_ms: u64,
    pub total_damage: u64,
    pub dps: f64,
    pub started_ms: Option<u64>,
    pub local_player_id: Option<u64>,
    pub capture_incomplete: bool,
    pub target_id: Option<u64>,
}
impl Default for TrainingState {
    fn default() -> Self {
        Self {
            status: "idle".into(),
            duration_ms: 60_000,
            remaining_ms: 0,
            total_damage: 0,
            dps: 0.0,
            started_ms: None,
            local_player_id: None,
            capture_incomplete: false,
            target_id: None,
        }
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct SkillState {
    pub id: u32,
    pub name: String,
    pub hits: u64,
    pub damage: u64,
    pub crit_hits: u64,
    pub min: u64,
    pub max: u64,
    pub direct_hits: u64,
    pub tick_hits: u64,
    pub quality_hits: u64,
    pub parry_hits: Option<u64>,
    pub perfect_hits: Option<u64>,
    pub double_hits: Option<u64>,
    pub direction_1_hits: Option<u64>,
    pub direction_2_hits: Option<u64>,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct PlayerState {
    pub healing_skills: Vec<SkillState>,
    pub healing_coverage: String,
    pub id: u64,
    pub name: String,
    pub class_name: String,
    pub damage: u64,
    pub dps: f64,
    pub share: f64,
    pub identity_confirmed: bool,
    pub is_local: bool,
    pub in_party: bool,
    pub skills: Vec<SkillState>,
    pub healing: Option<u64>,
    pub hps: Option<f64>,
    pub damage_taken: Option<u64>,
    pub damage_taken_per_second: Option<f64>,
    pub damage_taken_elapsed_ms: u64,
    pub damage_taken_started_ms: Option<u64>,
    pub incoming_skills: Vec<SkillState>,
    pub damage_taken_complete: bool,
    pub unclassified_player_target_amount: u64,
    pub unclassified_player_target_events: u64,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct TargetParticipant {
    pub id: u64,
    pub name: String,
    pub class_name: String,
    pub damage: u64,
    pub dps: f64,
    pub share: f64,
    pub identity_confirmed: bool,
    pub is_local: bool,
    pub in_party: bool,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct TargetState {
    pub id: u64,
    pub name: String,
    pub npc_id: Option<u32>,
    pub is_boss: bool,
    pub damage: u64,
    pub current_hp: Option<u64>,
    pub observed_peak_hp: Option<u64>,
    pub reported_max_hp: Option<u64>,
    pub health_observed_at_ms: Option<u64>,
    pub current_hp_observed_at_ms: Option<u64>,
    pub participants: Vec<TargetParticipant>,
    pub participants_available: bool,
    pub participant_count: usize,
    pub own_participant: Option<TargetParticipant>,
    pub own_rank: Option<usize>,
    pub own_last_hit_ms: Option<u64>,
    pub party_total_damage: Option<u64>,
    pub party_dps: Option<f64>,
    pub started_ms: Option<u64>,
    pub elapsed_ms: u64,
    pub last_hit_ms: Option<u64>,
    pub capture_complete: bool,
}

/// A received personal hit used by short-lived live controls, independent of
/// an encounter's completion or history. No damage/drop total is inferred.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecentPersonalTarget {
    pub actor_id: u64,
    pub target_id: u64,
    pub target_name: Option<String>,
    #[serde(default)]
    pub target_npc_id: Option<u32>,
    pub hit_at_ms: u64,
    pub source: String,
}

struct RecentPersonalHit {
    actor_id: u64,
    target_id: u64,
    hit_at_ms: u64,
}
/// Damage per fixed interval for the whole encounter and per player (PvE damage only).
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct DamageTimeline {
    pub interval_ms: u64,
    pub started_ms: u64,
    pub total: Vec<u64>,
    pub players: Vec<TimelinePlayer>,
    /// False when the samples it was built from were known to be incomplete.
    pub complete: bool,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct TimelinePlayer {
    pub id: u64,
    pub damage: Vec<u64>,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Encounter {
    pub spatial: spatial::Snapshot,
    pub timeline: DamageTimeline,
    pub focused_target_id: Option<u64>,
    pub focused_target_observed_at_ms: Option<u64>,
    pub context: EncounterContext,
    pub healing_samples: Vec<DamageSample>,
    pub healing_sample_complete: bool,
    pub network_latency: latency::Snapshot,
    pub id: u64,
    pub started_ms: u64,
    pub ended_ms: u64,
    pub elapsed_ms: u64,
    pub total_damage: u64,
    pub dps: f64,
    pub players: Vec<PlayerState>,
    pub targets: Vec<TargetState>,
    pub local_player_id: Option<u64>,
    pub local_player_name: String,
    pub local_identity_source: String,
    pub personal_total_damage: Option<u64>,
    pub personal_dps: Option<f64>,
    pub personal_elapsed_ms: u64,
    pub personal_started_ms: Option<u64>,
    pub personal_targets: Vec<TargetState>,
    pub party_member_ids: Vec<u64>,
    pub party_membership_source: String,
    pub party_total_damage: Option<u64>,
    pub party_dps: Option<f64>,
    pub party_elapsed_ms: u64,
    pub party_targets: Vec<TargetState>,
    pub damage_samples: Vec<DamageSample>,
    pub received_samples: Vec<DamageSample>,
    pub sample_complete: bool,
    pub source: String,
    #[serde(default = "observed_scope")]
    pub actor_scope: String,
    pub assist: assistance::AssistSnapshot,
    pub character_build: Option<character::CharacterBuild>,
    pub personal_healing: Option<u64>,
    pub personal_hps: Option<f64>,
    pub personal_damage_taken: Option<u64>,
    pub personal_damage_taken_per_second: Option<f64>,
    pub personal_damage_taken_elapsed_ms: u64,
    pub personal_damage_taken_started_ms: Option<u64>,
    pub personal_damage_taken_complete: bool,
    pub unclassified_player_target_amount: u64,
    pub unclassified_player_target_events: u64,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct EncounterContext {
    pub source: String,
    pub map_id: Option<u32>,
    pub zone_observed_at_ms: Option<u64>,
    pub session_id: String,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Diagnostics {
    /// Excluded documented NPC-effect ticks, scoped to the current encounter.
    pub ambiguous_periodic_events: u64,
    pub ambiguous_periodic_amount: u64,
    pub tcp_packets: u64,
    pub frames: u64,
    pub damage_events: u64,
    pub rejected_frames: u64,
    pub stream_gaps: u64,
    pub truncated_encounter: bool,
}

/// Received outgoing damage before the overlay's target-category filter.
/// Unknown identity or membership remains distinct from an observed zero.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct AllTargetsSummary {
    pub total_damage: u64,
    pub dps: f64,
    pub elapsed_ms: u64,
    pub personal_total_damage: Option<u64>,
    pub personal_dps: Option<f64>,
    pub personal_elapsed_ms: Option<u64>,
    pub party_total_damage: Option<u64>,
    pub party_dps: Option<f64>,
    pub party_elapsed_ms: Option<u64>,
}

impl From<&Encounter> for AllTargetsSummary {
    fn from(record: &Encounter) -> Self {
        Self {
            total_damage: record.total_damage,
            dps: record.dps,
            elapsed_ms: record.elapsed_ms,
            personal_total_damage: record.personal_total_damage,
            personal_dps: record.personal_dps,
            personal_elapsed_ms: record
                .personal_total_damage
                .map(|_| record.personal_elapsed_ms),
            party_total_damage: record.party_total_damage,
            party_dps: record.party_dps,
            party_elapsed_ms: record.party_total_damage.map(|_| record.party_elapsed_ms),
        }
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct MeterState {
    pub spatial: spatial::Snapshot,
    pub pet_collection_owner: Option<character::PetCollectionOwner>,
    pub encounter_started_ms: Option<u64>,
    pub focused_target_id: Option<u64>,
    pub focused_target_observed_at_ms: Option<u64>,
    pub live_target: Option<TargetState>,
    pub recent_personal_target: Option<RecentPersonalTarget>,
    pub status: String,
    pub elapsed_ms: u64,
    pub total_damage: u64,
    pub dps: f64,
    pub paused: bool,
    pub players: Vec<PlayerState>,
    pub targets: Vec<TargetState>,
    /// Same-encounter contribution boards, independent of the main boss filter.
    pub observed_targets: Vec<TargetState>,
    pub all_targets_summary: AllTargetsSummary,
    pub history: Vec<Encounter>,
    pub cooldowns: Vec<serde_json::Value>,
    pub observed_casts: Vec<cooldowns::CastUse>,
    pub actor_cooldowns: Vec<cooldowns::ActorObservation>,
    pub resources: resources::ResourceSnapshot,
    pub diagnostics: Diagnostics,
    pub target_mode: String,
    pub history_revision: u64,
    pub history_count: usize,
    pub encounter_active: bool,
    pub local_player_id: Option<u64>,
    pub local_player_name: String,
    pub local_identity_source: String,
    pub personal_total_damage: Option<u64>,
    pub personal_dps: Option<f64>,
    pub personal_elapsed_ms: u64,
    pub personal_started_ms: Option<u64>,
    pub personal_targets: Vec<TargetState>,
    pub party_member_ids: Vec<u64>,
    pub party_member_names: Vec<String>,
    pub party_membership_source: String,
    pub party_identity_roster: serde_json::Value,
    pub live_team_identity: serde_json::Value,
    pub party_total_damage: Option<u64>,
    pub party_dps: Option<f64>,
    pub party_elapsed_ms: u64,
    pub party_targets: Vec<TargetState>,
    pub training: TrainingState,
    pub assist: assistance::AssistSnapshot,
    pub field_boss_revision: u64,
    pub field_boss_available: bool,
    pub character_revision: u64,
    pub character_available: bool,
    pub personal_healing: Option<u64>,
    pub personal_hps: Option<f64>,
    pub personal_damage_taken: Option<u64>,
    pub personal_damage_taken_per_second: Option<f64>,
    pub personal_damage_taken_elapsed_ms: u64,
    pub personal_damage_taken_started_ms: Option<u64>,
    pub personal_damage_taken_complete: bool,
    pub unclassified_player_target_amount: u64,
    pub unclassified_player_target_events: u64,
}

#[derive(Clone, Debug, Default)]
struct Identity {
    removed: bool,
    spawned: bool,
    name: Option<String>,
    home_server: Option<u16>,
    class: Option<String>,
    player: bool,
    npc: bool,
    npc_model_id: Option<u32>,
    pet: bool,
    owner: Option<u64>,
    hp: Option<u64>,
    peak_hp: Option<u64>,
    reported_max_hp: Option<u64>,
    health_observed_at_ms: Option<u64>,
    current_hp_observed_at_ms: Option<u64>,
}
type Aggregate = BTreeMap<(u64, u64), BTreeMap<u32, SkillState>>;
struct Completed {
    aggregates: Aggregate,
    identities: HashMap<u64, Identity>,
    bosses: Vec<u64>,
    record: Encounter,
    pair_activity: BTreeMap<(u64, u64), SourceActivity>,
    paused_ms: u64,
    generation: u64,
    capture_complete: bool,
}
#[derive(Clone, Copy)]
struct SourceActivity {
    first: u64,
    last: u64,
    paused_at_start: u64,
    paused_at_last: u64,
    last_focus_epoch: u64,
}
impl SourceActivity {
    fn merge_window(&mut self, other: &Self) {
        if other.first < self.first {
            self.first = other.first;
            self.paused_at_start = other.paused_at_start;
        }
        if other.last > self.last {
            self.last = other.last;
            self.paused_at_last = other.paused_at_last;
        }
    }

    fn elapsed_until(&self, end: u64, paused_ms: u64) -> u64 {
        let elapsed = end
            .saturating_sub(self.first)
            .saturating_sub(paused_ms.saturating_sub(self.paused_at_start));
        let at_last_hit = self
            .last
            .saturating_sub(self.first)
            .saturating_sub(self.paused_at_last.saturating_sub(self.paused_at_start));
        // The damage clock stops at the last hit: the quiet time that ends an encounter is not
        // combat time, so it must not dilute DPS. The cap is in the same active clock as the
        // elapsed interval, so a pause after the last hit does not shorten the observed window.
        elapsed.min(at_last_hit)
    }
}
#[derive(Default)]
struct StreamPrefix {
    bytes: Vec<u8>,
    decided: bool,
    tls: bool,
}

pub struct MeterEngine {
    spatial: spatial::Store,
    cubes: cube::Tracker,
    /// Power scalars seen per attacker, and the unannounced summons bound to a player by them.
    power: HashMap<u64, Vec<u32>>,
    orphan_bound: std::collections::HashSet<u64>,
    orphans_checked_ms: u64,
    pending_spawn_position: Option<(spatial::Observation, u64)>,
    record_observations: Vec<records::Observation>,
    encounter_gaps_at_start: u64,
    collection_generation: u64,
    focus_epoch: u64,
    current_context: EncounterContext,
    party_id: Option<u32>,
    healing_samples: Vec<DamageSample>,
    healing_sample_complete: bool,
    latency: latency::Trace,
    streams: net::StreamSet,
    frames: framing::FrameStreams,
    prefixes: HashMap<net::Connection, StreamPrefix>,
    identities: HashMap<u64, Identity>,
    own_id: Option<u64>,
    manual_own_id: Option<u64>,
    character_name: String,
    alias_bound_id: Option<u64>,
    party_names: Option<Vec<String>>,
    party_sync_confirmed: bool,
    party_wire_members: BTreeMap<(u16, u32), packets::PartyMember>,
    pending_profiles: Vec<(packets::MemberProfile, u64)>,
    party_snapshot_complete: bool,
    party_classes: BTreeMap<String, u32>,
    manual_party_ids: Option<Vec<u64>>,
    pair_activity: BTreeMap<(u64, u64), SourceActivity>,
    training_targets: std::collections::BTreeSet<u64>,
    generation: u64,
    pending_owners: HashMap<u64, u64>,
    damage_samples: Vec<DamageSample>,
    sample_complete: bool,
    training: TrainingState,
    assistance: assistance::AssistState,
    field_bosses: field_boss::FieldBossStore,
    field_boss_revision: u64,
    field_boss_available: bool,
    character: character::CharacterStore,
    pet_connections: Vec<net::Connection>,
    recent_personal_hit: Option<RecentPersonalHit>,
    character_revision: u64,
    encounter_build: Option<character::CharacterBuild>,
    encounter_build_taken: bool,
    bosses: Vec<u64>,
    cooldowns: cooldowns::Ledger,
    resources: resources::ResourceStore,
    aggregates: Aggregate,
    alive_targets: std::collections::BTreeSet<u64>,
    hit_count: usize,
    completed: Option<Completed>,
    history: VecDeque<Encounter>,
    history_revision: u64,
    started: Option<u64>,
    last_hit: u64,
    last_seen: u64,
    paused: bool,
    pause_at: Option<u64>,
    paused_ms: u64,
    target_mode: String,
    encounter_id: u64,
    diagnostics: Diagnostics,
    revision: u64,
    // "all" and "both" have the same aggregate. Keep exactly two slots so
    // the independent live target does not evict the boss-filtered snapshot.
    cache: RefCell<[Option<(u64, Encounter)>; 2]>,
}
impl Default for MeterEngine {
    fn default() -> Self {
        Self {
            spatial: spatial::Store::default(),
            cubes: cube::Tracker::default(),
            power: HashMap::new(),
            orphan_bound: std::collections::HashSet::new(),
            orphans_checked_ms: 0,
            pending_spawn_position: None,
            record_observations: Vec::new(),
            encounter_gaps_at_start: 0,
            collection_generation: 0,
            focus_epoch: 0,
            current_context: EncounterContext::default(),
            party_id: None,
            healing_samples: Vec::new(),
            healing_sample_complete: true,
            latency: latency::Trace::default(),
            streams: Default::default(),
            frames: Default::default(),
            prefixes: HashMap::new(),
            identities: HashMap::new(),
            own_id: None,
            manual_own_id: None,
            character_name: String::new(),
            alias_bound_id: None,
            party_names: None,
            party_sync_confirmed: false,
            party_wire_members: BTreeMap::new(),
            pending_profiles: Vec::new(),
            party_snapshot_complete: false,
            party_classes: BTreeMap::new(),
            manual_party_ids: None,
            pair_activity: BTreeMap::new(),
            training_targets: Default::default(),
            generation: 0,
            pending_owners: HashMap::new(),
            damage_samples: Vec::new(),
            sample_complete: true,
            training: TrainingState::default(),
            assistance: assistance::AssistState::default(),
            field_bosses: field_boss::FieldBossStore::default(),
            field_boss_revision: 0,
            field_boss_available: false,
            character: character::CharacterStore::default(),
            pet_connections: Vec::new(),
            recent_personal_hit: None,
            character_revision: 0,
            encounter_build: None,
            encounter_build_taken: false,
            bosses: Vec::new(),
            cooldowns: cooldowns::Ledger::default(),
            resources: resources::ResourceStore::default(),
            aggregates: BTreeMap::new(),
            alive_targets: Default::default(),
            hit_count: 0,
            completed: None,
            history: VecDeque::new(),
            history_revision: 0,
            started: None,
            last_hit: 0,
            last_seen: 0,
            paused: false,
            pause_at: None,
            paused_ms: 0,
            target_mode: "all".into(),
            encounter_id: 1,
            diagnostics: Default::default(),
            revision: 0,
            cache: RefCell::new([None, None]),
        }
    }
}
impl MeterEngine {
    fn dirty(&mut self) {
        self.revision = self.revision.wrapping_add(1);
        *self.cache.get_mut() = [None, None];
    }
    fn refresh_wire_party(&mut self) {
        let mut counts = BTreeMap::<String, usize>::new();
        for member in self.party_wire_members.values() {
            *counts.entry(member.name.clone()).or_default() += 1;
        }
        self.party_names = Some(
            self.party_wire_members
                .values()
                .filter(|member| counts.get(&member.name) == Some(&1))
                .map(|member| member.name.clone())
                .collect(),
        );
        self.party_classes = self
            .party_wire_members
            .values()
            .filter(|member| {
                counts.get(&member.name) == Some(&1) && class_name(member.class).is_some()
            })
            .map(|member| (member.name.clone(), member.class))
            .collect();
        self.party_sync_confirmed = true;
        self.manual_party_ids = None;
        self.dirty();
    }
    fn bind_pending_profiles(&mut self, now: u64) {
        let profiles = std::mem::take(&mut self.pending_profiles);
        for (profile, observed_at) in profiles {
            if now < observed_at || now - observed_at > PROFILE_PENDING_MS {
                continue;
            }
            let known: Vec<_> = self
                .party_wire_members
                .values()
                .filter(|member| member.server == profile.server && member.name == profile.name)
                .collect();
            if !self.party_sync_confirmed || known.len() != 1 {
                self.pending_profiles.push((profile, observed_at));
                continue;
            }
            if self.own_id == Some(profile.id)
                && self
                    .identities
                    .get(&profile.id)
                    .and_then(|row| row.name.as_deref())
                    != Some(profile.name.as_str())
            {
                continue;
            }
            let class = known[0].class;
            self.ingest_event(
                Event::Identity {
                    id: profile.id,
                    name: profile.name,
                    class: Some(class),
                    own: false,
                },
                now,
            );
        }
    }
    pub fn ingest_tcp(&mut self, packet: &[u8], incoming: bool, now: u64) {
        if !incoming {
            return;
        }
        let Some(segment) = net::tcp_segment(packet) else {
            return;
        };
        if segment.connection.source_port == 443 || segment.connection.destination_port == 443 {
            return;
        }
        if (segment.syn || segment.reset) && self.pet_connections.contains(&segment.connection) {
            // A proven collection flow has a new TCP lifetime. Its old actor
            // binding is invalid too: fresh login rows may precede the next
            // server self identity and must stay unbound until that arrives.
            self.connection_changed();
        }
        self.diagnostics.tcp_packets = self.diagnostics.tcp_packets.saturating_add(1);
        self.last_seen = now;
        let previous_gaps = self.streams.gaps;
        let chunk = self.streams.push(&segment, now);
        if segment.syn || segment.reset || self.streams.gaps != previous_gaps {
            self.recent_personal_hit = None;
            self.focus_epoch = self.focus_epoch.wrapping_add(1);
            for identity in self.identities.values_mut() {
                identity.current_hp_observed_at_ms = None;
            }
            self.frames.discard(&segment.connection);
            self.prefixes.remove(&segment.connection);
            self.cooldowns.clear();
            self.resources.clear();
            self.party_sync_confirmed = false;
            self.party_names = None;
            self.party_classes.clear();
            self.party_wire_members.clear();
            self.pending_profiles.clear();
            self.party_snapshot_complete = false;
            self.assistance.clear();
            self.spatial.clear();
            self.cubes.clear();
            self.power.clear();
            self.orphan_bound.clear();
            self.pending_spawn_position = None;
            self.character.invalidate_capture(
                now,
                if segment.syn || segment.reset {
                    "auxiliary-flow-change"
                } else {
                    "stream-gap"
                },
            );
            if let Some((actor, name)) = self.own_id.and_then(|actor| {
                self.identities
                    .get(&actor)
                    .filter(|row| row.player && !row.npc && !row.pet && !row.removed)
                    .and_then(|row| row.name.as_ref().map(|name| (actor, name.clone())))
            }) {
                // The old build is unknown after a gap. An existing explicit
                // self identity can still own newly received observations;
                // the encounter-start copy remains immutable.
                self.character.bind_self(actor, &name, None, now);
            }
            self.character_revision = self.character_revision.wrapping_add(1);
            if segment.syn {
                self.frames.mark_start(&segment.connection)
            }
            self.dirty();
        }
        self.diagnostics.stream_gaps = self
            .diagnostics
            .stream_gaps
            .saturating_add(self.streams.gaps.saturating_sub(previous_gaps));
        if self.streams.gaps != previous_gaps
            && matches!(self.training.status.as_str(), "armed" | "running")
        {
            self.training.capture_incomplete = true;
        }
        if self.streams.gaps != previous_gaps && self.started.is_some() {
            self.sample_complete = false
        }
        if chunk.is_empty() {
            return;
        }
        if self.prefixes.len() >= 64 && !self.prefixes.contains_key(&segment.connection) {
            self.prefixes.clear()
        }
        let prefix = self.prefixes.entry(segment.connection.clone()).or_default();
        let delivery = if prefix.decided {
            if prefix.tls {
                return;
            }
            chunk
        } else {
            prefix.bytes.extend_from_slice(&chunk);
            let data = &prefix.bytes;
            let could_tls = [20, 21, 22, 23].contains(&data[0])
                && (data.len() < 2 || data[1] == 3)
                && (data.len() < 3 || data[2] <= 4);
            if could_tls && data.len() < 5 {
                return;
            }
            prefix.tls = could_tls
                && u16::from_be_bytes([data[3], data[4]]) > 0
                && u16::from_be_bytes([data[3], data[4]]) <= 18432;
            prefix.decided = true;
            if prefix.tls {
                prefix.bytes.clear();
                return;
            }
            std::mem::take(&mut prefix.bytes)
        };
        for frame in self.frames.push(&segment.connection, &delivery) {
            let mut expanded = Vec::new();
            if framing::expand(&frame, &mut expanded, 0).is_err() {
                self.diagnostics.rejected_frames += 1;
                continue;
            }
            for payload in expanded {
                self.diagnostics.frames += 1;
                if let Some((source, scalar)) = packets::power_scalar(&payload) {
                    self.observe_power(source, scalar);
                }
                match packets::decode(&payload) {
                    Ok(Some(event)) => {
                        if event_contains_pet_observation(&event)
                            && !self.pet_connections.contains(&segment.connection)
                        {
                            if self.pet_connections.len() == 64 {
                                self.pet_connections.remove(0);
                            }
                            self.pet_connections.push(segment.connection.clone());
                        }
                        self.ingest_event(event, now);
                    }
                    Ok(None) => {}
                    Err(_) => self.diagnostics.rejected_frames += 1,
                }
            }
        }
        self.diagnostics.rejected_frames =
            self.diagnostics.rejected_frames.max(self.frames.rejected);
    }
    fn prepare_entity(&mut self, id: u64, now: u64) {
        if self
            .identities
            .get(&id)
            .is_some_and(|entity| entity.removed)
        {
            self.clear_recent_personal_entity(id);
            if self
                .aggregates
                .keys()
                .any(|(source, target)| *source == id || *target == id)
            {
                self.finish(now)
            }
            self.identities.insert(id, Identity::default());
            if self.manual_own_id == Some(id) {
                self.manual_own_id = None;
                self.alias_bound_id = None
            }
            if self.own_id == Some(id) {
                self.own_id = None;
                self.alias_bound_id = None;
                self.resources.clear();
                self.party_sync_confirmed = false;
                self.character_revision = self.character_revision.wrapping_add(1);
            }
            self.cooldowns.remove_actor(id);
            self.assistance.remove_actor(id, now);
            if let Some(ids) = &mut self.manual_party_ids {
                ids.retain(|value| *value != id)
            }
        }
    }
    pub fn ingest_event(&mut self, event: Event, now: u64) {
        if self
            .recent_personal_hit
            .as_ref()
            .is_some_and(|hit| now < hit.hit_at_ms)
        {
            self.recent_personal_hit = None;
        }
        self.pending_profiles.retain(|(_, observed_at)| {
            now >= *observed_at && now - observed_at <= PROFILE_PENDING_MS
        });
        match event {
            Event::PeriodicDamage { hit, effect_id } => {
                if self.paused || hit.amount == 0 {
                    return;
                }
                let source = Self::owner_in(&self.identities, hit.source);
                let known_player = self
                    .identities
                    .get(&source)
                    .is_some_and(|row| row.player && !row.npc && !row.pet);
                let known_npc = self
                    .identities
                    .get(&hit.target)
                    .is_some_and(|row| row.npc && !row.player && !row.pet);
                let npc_effect =
                    (100_000_000..1_000_000_000).contains(&effect_id) && effect_id % 100 == 11;
                let player_skill = (11..=18).contains(&(hit.skill / 1_000_000));
                if known_player && known_npc && npc_effect && player_skill {
                    // This observed effect shape may restore the NPC rather
                    // than damage it. Keep the uncertainty explicit instead
                    // of inventing healing attribution or counting it as DPS.
                    self.diagnostics.ambiguous_periodic_events =
                        self.diagnostics.ambiguous_periodic_events.saturating_add(1);
                    self.diagnostics.ambiguous_periodic_amount = self
                        .diagnostics
                        .ambiguous_periodic_amount
                        .saturating_add(hit.amount);
                    self.sample_complete = false;
                    self.dirty();
                } else {
                    self.ingest_event(Event::Damage(hit), now);
                }
            }
            Event::PartyContext {
                party_id,
                capacity: _,
            } => {
                if self.party_id != Some(party_id) {
                    if self.party_id.is_some() {
                        self.pending_profiles.clear();
                    }
                    let (prior, _) = self.party_in(&self.identities, self.own_id);
                    for actor in prior {
                        if Some(actor) != self.own_id {
                            self.cooldowns.remove_actor(actor);
                        }
                    }
                    self.party_names = None;
                    self.party_sync_confirmed = false;
                    self.party_wire_members.clear();
                    self.party_classes.clear();
                    self.manual_party_ids = None;
                    self.party_snapshot_complete = false;
                    self.party_id = Some(party_id);
                    self.dirty();
                }
            }
            Event::ZoneChange { zone_id } => {
                if self.current_context.map_id != Some(zone_id) {
                    self.recent_personal_hit = None;
                    self.finish(self.last_hit);
                    self.cooldowns.clear();
                    self.cooldowns.bind_self(self.own_id);
                    self.assistance.clear();
                    self.spatial.clear();
                    self.cubes.clear();
                    self.power.clear();
                    self.orphan_bound.clear();
                    self.pending_spawn_position = None;
                    self.bosses.clear();
                    self.current_context = EncounterContext {
                        source: "server-zone".into(),
                        map_id: Some(zone_id),
                        zone_observed_at_ms: Some(now),
                        session_id: format!("zone-{zone_id}-{now}-{}", self.generation),
                    };
                    self.spatial.map(zone_id);
                    self.pending_spawn_position = None;
                    self.dirty();
                }
            }
            Event::Healing(hit) => self.observe_healing(hit, now),
            Event::Position(mut position) => {
                if position.actor_id == 0 {
                    if let Some(id) = self.own_id {
                        position.actor_id = id;
                    } else {
                        self.pending_spawn_position = Some((position, now));
                        return;
                    }
                }
                if !position.local_only || self.own_id == Some(position.actor_id) {
                    if let (true, Some(z)) = (self.own_id == Some(position.actor_id), position.z) {
                        self.cubes.apply(cube::Event::Fix { pos: [position.x, position.y, z] }, now);
                    }
                    self.spatial.observe(position, now);
                    self.dirty();
                }
            }
            Event::Cube(event) => self.cubes.apply(event, now),
            Event::Resource(event) => {
                self.resources.ingest(event, now);
                self.character_revision = self.character_revision.wrapping_add(1);
            }
            Event::Character(event) => {
                self.character.ingest(event, now);
                self.character_revision = self.character_revision.wrapping_add(1);
            }
            Event::FieldBoss(event) => {
                self.field_boss_available = true;
                self.field_boss_revision = self.field_boss_revision.wrapping_add(1);
                self.field_bosses.ingest(event, now);
            }
            Event::Assistance(event) => {
                match &event {
                    assistance::AssistEvent::Windup(value)
                    | assistance::AssistEvent::Cast(value) => {
                        self.spatial.aim(value, now);
                        // The coordinates of a cast are its target's: when that is the local
                        // player they are the player's own position. A few skills carry small
                        // values instead of coordinates, which stay near the world origin.
                        if let Some(pos) = value
                            .position
                            .filter(|pos| self.own_id == Some(value.target_id) && pos[0].hypot(pos[1]) > 2000.0)
                        {
                            self.cubes.apply(cube::Event::Fix { pos }, now);
                        }
                    }
                    _ => (),
                }
                if let assistance::AssistEvent::Cast(value) = &event {
                    self.cooldowns.observe_cast(
                        value.actor_id,
                        value.skill_id,
                        value.target_id,
                        now,
                    );
                    if let Some(timing) = &value.cooldown {
                        if let (Some(charges), Some(recharge)) =
                            (timing.charges, timing.recharge_ms)
                        {
                            self.cooldowns.observe_actor_charges(
                                value.actor_id,
                                value.skill_id,
                                charges,
                                recharge,
                                now,
                                false,
                            );
                        } else if let Some(duration) = timing.cooldown_ms {
                            self.cooldowns.observe_actor_cooldown(
                                value.actor_id,
                                value.skill_id,
                                duration,
                                now,
                            );
                        }
                    }
                }
                if let assistance::AssistEvent::Health {
                    actor_id,
                    current_hp,
                    reported_max_hp,
                } = &event
                {
                    let entry = self.identities.entry(*actor_id).or_default();
                    entry.health_observed_at_ms = Some(now);
                    if let Some(current) = current_hp {
                        entry.current_hp_observed_at_ms = Some(now);
                        entry.hp = Some(*current);
                        entry.peak_hp = Some(entry.peak_hp.unwrap_or(0).max(*current));
                    }
                    if let Some(maximum) = reported_max_hp {
                        entry.reported_max_hp = (*maximum > 0
                            && entry.hp.is_none_or(|current| *maximum >= current))
                        .then_some(*maximum);
                    }
                    if entry
                        .reported_max_hp
                        .zip(entry.hp)
                        .is_some_and(|(maximum, current)| maximum < current)
                    {
                        entry.reported_max_hp = None
                    }
                    self.dirty();
                }
                self.assistance.ingest(event, now);
            }
            Event::Updates(updates) => {
                for event in updates {
                    self.ingest_event(event, now)
                }
            }
            Event::Identity {
                id,
                name,
                class,
                own,
            } => {
                if !own
                    && self.own_id == Some(id)
                    && self.identities.get(&id).is_some_and(|entry| {
                        !entry.removed && entry.name.as_deref().is_some_and(|old| old != name)
                    })
                {
                    // A nearby/inspection record cannot replace the current
                    // server-confirmed local character with somebody else.
                    return;
                }
                self.pending_profiles
                    .retain(|(profile, _)| profile.id != id);
                let changed_name = self
                    .identities
                    .get(&id)
                    .and_then(|entry| entry.name.as_deref())
                    .is_some_and(|old| old != name);
                if own
                    && (self.pet_collection_owner().is_none()
                        || !self.character.matches_server_self(id, &name))
                {
                    self.collection_generation = self.collection_generation.wrapping_add(1);
                } else if !own
                    && self.own_id == Some(id)
                    && self.identities.get(&id).is_some_and(|entry| entry.removed)
                {
                    // A new non-self occupant of a removed scene handle cannot
                    // inherit the old character's collection binding.
                    self.collection_generation = self.collection_generation.wrapping_add(1);
                    self.character.clear();
                    self.character_revision = self.character_revision.wrapping_add(1);
                }
                if self.recent_personal_hit.as_ref().is_some_and(|hit| {
                    hit.target_id == id
                        || hit.actor_id == id && changed_name
                        || own && hit.actor_id != id
                }) {
                    self.recent_personal_hit = None;
                }
                let may_resolve_completed = !changed_name
                    && self
                        .identities
                        .get(&id)
                        .is_none_or(|entry| !entry.removed && !entry.npc && !entry.pet);
                if changed_name
                    && self
                        .aggregates
                        .keys()
                        .any(|(source, target)| *source == id || *target == id)
                {
                    self.finish(now);
                }
                if self.identities.get(&id).is_some_and(|entry| {
                    entry.npc || entry.pet || entry.name.as_deref().is_some_and(|old| old != name)
                }) {
                    self.cooldowns.remove_actor(id);
                }
                if own
                    && self.own_id == Some(id)
                    && self
                        .identities
                        .get(&id)
                        .and_then(|entry| entry.name.as_deref())
                        .is_some_and(|old| old != name)
                {
                    self.cooldowns.clear();
                    self.pending_profiles.clear();
                    self.party_sync_confirmed = false;
                    self.party_names = None;
                    self.party_classes.clear();
                    self.party_wire_members.clear();
                    self.party_snapshot_complete = false;
                }
                if self.training_targets.contains(&id) {
                    self.cancel_training()
                }
                if self
                    .identities
                    .get(&id)
                    .is_some_and(|entry| entry.npc || entry.pet)
                    && self
                        .aggregates
                        .keys()
                        .any(|(source, target)| *source == id || *target == id)
                {
                    self.finish(now);
                }
                if own && self.own_id.is_some_and(|old| old != id) {
                    self.finish(self.last_hit);
                    self.identities.clear();
                    self.pending_profiles.clear();
                    self.cooldowns.clear();
                    self.manual_own_id = None;
                    self.manual_party_ids = None;
                    self.party_names = None;
                    self.party_sync_confirmed = false;
                    self.party_wire_members.clear();
                    self.party_snapshot_complete = false;
                    self.party_classes.clear();
                    self.alias_bound_id = None;
                    self.character_name.clear();
                    self.completed = None;
                    self.assistance.clear();
                    self.spatial.clear();
                    self.cubes.clear();
                    self.power.clear();
                    self.orphan_bound.clear();
                    self.pending_spawn_position = None;
                    self.field_bosses.clear();
                    self.field_boss_available = false;
                    self.field_boss_revision = self.field_boss_revision.wrapping_add(1);
                    self.bosses.clear();
                    self.character.clear();
                    self.encounter_build = None;
                    self.encounter_build_taken = false;
                    self.character_revision = self.character_revision.wrapping_add(1);
                }
                if self.identities.get(&id).is_some_and(|old| {
                    old.removed
                        || old.npc
                        || old.pet
                        || old.name.as_deref().is_some_and(|old| old != name)
                }) {
                    self.spatial.replace(id, now);
                }
                self.prepare_entity(id, now);
                if own {
                    if !self.encounter_build_taken
                        && self.aggregates.keys().any(|(source, _)| *source == id)
                    {
                        self.encounter_build_taken = true;
                        self.encounter_build = None;
                    }
                    if self
                        .training
                        .local_player_id
                        .is_some_and(|selected| selected != id)
                    {
                        self.cancel_training();
                    }
                    self.own_id = Some(id);
                    self.cooldowns.bind_self(Some(id));
                    self.resources.bind_self(id, &name, now);
                    self.character.bind_self(id, &name, None, now);
                    self.character_revision = self.character_revision.wrapping_add(1);
                    if self.manual_own_id.is_some_and(|selected| selected != id) {
                        self.manual_own_id = None;
                        self.alias_bound_id = None;
                    }
                }
                if !may_resolve_completed {
                    // An actor ID is a scene handle. A new occupant cannot
                    // inherit the previous occupant's class, health or owner.
                    self.identities.insert(id, Identity::default());
                    self.pending_owners.remove(&id);
                }
                let identity = self.identities.entry(id).or_default();
                identity.name = Some(name);
                identity.player = true;
                identity.npc = false;
                identity.pet = false;
                identity.owner = None;
                identity.removed = false;
                if let Some(class) = class.and_then(class_name) {
                    identity.class = Some(class.into())
                }
                self.spatial.register(
                    id,
                    identity.name.as_deref().unwrap_or(""),
                    identity.class.as_deref().unwrap_or(""),
                    "player",
                    None,
                );
                if own {
                    if let Some((mut position, at)) = self
                        .pending_spawn_position
                        .take()
                        .filter(|(_, at)| *at <= now && now - *at <= 30000)
                    {
                        position.actor_id = id;
                        self.spatial.seed(position, at);
                    }
                }
                if let Some(completed) = &mut self.completed {
                    // A late name may resolve an unnamed actor in the current
                    // completed view. Reused actor IDs must never relabel the
                    // previous player's damage after a despawn or rename.
                    let relevant =
                        completed
                            .aggregates
                            .keys()
                            .any(|(source, target)| *source == id || *target == id)
                            || completed.record.healing_samples.iter().any(|row| {
                                row.player_id == id || row.source == id || row.target == id
                            });
                    if may_resolve_completed
                        && relevant
                        && completed.generation == self.generation
                        && completed.identities.get(&id).is_none_or(|old| {
                            !old.removed
                                && !old.npc
                                && !old.pet
                                && old
                                    .name
                                    .as_deref()
                                    .is_none_or(|name| Some(name) == identity.name.as_deref())
                        })
                    {
                        completed.identities.insert(id, identity.clone());
                    }
                }
                self.bind_named_effects(id);
                self.dirty();
            }
            Event::Npc {
                id,
                name,
                model,
                kind,
            } => {
                self.spatial.replace(id, now);
                if self
                    .pet_collection_owner()
                    .is_some_and(|owner| owner.actor_id == id)
                {
                    self.collection_generation = self.collection_generation.wrapping_add(1);
                    self.character.clear();
                    self.character_revision = self.character_revision.wrapping_add(1);
                }
                // Another spawn record is a new occupant of this scene handle;
                // it cannot rename the previous hit, even if the model matches.
                self.clear_recent_personal_entity(id);
                self.pending_profiles
                    .retain(|(profile, _)| profile.id != id);
                let replaces_entity = self
                    .identities
                    .get(&id)
                    .is_some_and(|entry| entry.player || entry.spawned);
                if self
                    .identities
                    .get(&id)
                    .is_some_and(|entry| entry.player || entry.spawned)
                    && self
                        .aggregates
                        .keys()
                        .any(|(source, target)| *source == id || *target == id)
                {
                    self.finish(now);
                }
                self.prepare_entity(id, now);
                if replaces_entity {
                    self.identities.insert(id, Identity::default());
                    self.pending_owners.remove(&id);
                    self.cooldowns.remove_actor(id);
                    self.assistance.remove_actor(id, now);
                }
                let entry = self.identities.entry(id).or_default();
                entry.spawned = true;
                entry.player = false;
                entry.npc = matches!(kind, 0x0c | 0x0d | 0x1c);
                entry.npc_model_id = entry
                    .npc
                    .then_some(model)
                    .filter(|id| (100_000..=9_999_999).contains(id));
                entry.pet = kind == 0x5f;
                if !entry.pet {
                    entry.owner = None
                }
                if entry.pet {
                    entry.owner = self.pending_owners.remove(&id).or(entry.owner)
                }
                entry.removed = false;
                // NPC spawn text can name its current target, rather than the
                // monster itself. Resolve the exact game model first.
                let name = entry
                    .npc
                    .then(|| npc_catalog::name(model))
                    .flatten()
                    .map(str::to_owned)
                    .or(name);
                if let Some(name) = name {
                    entry.name = Some(name)
                }
                self.spatial.register(
                    id,
                    entry.name.as_deref().unwrap_or(""),
                    "",
                    if entry.pet {
                        "pet"
                    } else if entry.npc {
                        "npc"
                    } else {
                        "unknown"
                    },
                    Some(model),
                );
                if self.own_id == Some(id) {
                    self.own_id = None;
                    self.alias_bound_id = None;
                    self.resources.clear();
                    self.character.clear();
                    self.character_revision = self.character_revision.wrapping_add(1);
                    self.cancel_training()
                }
                if self.manual_own_id == Some(id) {
                    self.manual_own_id = None;
                    self.alias_bound_id = None;
                    self.cancel_training()
                }
                self.dirty();
            }
            Event::Owner { id, owner } => {
                if id == 0 || owner == 0 || id == owner {
                    return;
                }
                if !self.encounter_build_taken
                    && self.own_id == Some(owner)
                    && self.aggregates.keys().any(|(source, _)| *source == id)
                {
                    self.encounter_build_taken = true;
                    self.encounter_build = None;
                }
                if self.pending_owners.len() >= 4096 && !self.pending_owners.contains_key(&id) {
                    self.pending_owners.clear()
                }
                if let Some(identity) = self.identities.get_mut(&id) {
                    if identity.pet {
                        identity.owner = Some(owner)
                    } else if !identity.player && !identity.npc {
                        self.pending_owners.insert(id, owner);
                    }
                } else {
                    self.pending_owners.insert(id, owner);
                }
                self.dirty();
            }
            Event::PartyRoster { names } => {
                self.pending_profiles.clear();
                self.party_names = Some(names.into_iter().take(12).collect());
                self.party_sync_confirmed = true;
                self.party_wire_members.clear();
                self.party_snapshot_complete = true;
                self.party_classes.clear();
                self.manual_party_ids = None;
                self.dirty();
            }
            Event::PartyProfiles { members } => {
                for (name, class) in members.into_iter().take(12) {
                    if self
                        .party_names
                        .as_ref()
                        .is_some_and(|names| names.contains(&name))
                        && class_name(class).is_some()
                    {
                        self.party_classes.insert(name, class);
                    }
                }
                self.dirty();
            }
            Event::PartyMembers { members } => {
                if members.is_empty() {
                    return;
                }
                if !self.party_sync_confirmed {
                    self.party_wire_members.clear();
                }
                for member in members.into_iter().take(12) {
                    if member.key == 0
                        || !(1..=12).contains(&member.slot)
                        || !(1000..3000).contains(&member.server)
                    {
                        continue;
                    }
                    self.party_wire_members.retain(|key, old| {
                        old.slot != member.slot || *key == (member.server, member.key)
                    });
                    self.party_wire_members
                        .insert((member.server, member.key), member);
                }
                self.party_snapshot_complete = false;
                self.refresh_wire_party();
                self.bind_pending_profiles(now);
            }
            Event::PartyMemberRemoved { key, server } => {
                if let Some(member) = self.party_wire_members.get(&(server, key)) {
                    self.pending_profiles.retain(|(profile, _)| {
                        profile.server != member.server || profile.name != member.name
                    });
                }
                let own_name = self
                    .own_id
                    .and_then(|id| self.identities.get(&id))
                    .and_then(|identity| identity.name.as_deref());
                let leaving_self = self
                    .party_wire_members
                    .get(&(server, key))
                    .is_some_and(|member| own_name == Some(member.name.as_str()));
                if leaving_self {
                    self.party_wire_members.clear();
                    self.party_names = None;
                    self.party_classes.clear();
                    self.party_sync_confirmed = false;
                    self.party_snapshot_complete = false;
                    self.dirty();
                } else if self.party_wire_members.remove(&(server, key)).is_some() {
                    self.refresh_wire_party();
                }
            }
            Event::MemberProfiles { members } => {
                for profile in members.into_iter().take(12) {
                    let changed_server = self
                        .identities
                        .get(&profile.id)
                        .and_then(|row| row.home_server)
                        .is_some_and(|server| server != profile.server);
                    if changed_server {
                        if self.own_id == Some(profile.id) {
                            // Conflicting received server metadata cannot
                            // replace combat self, nor retain its collection.
                            self.collection_generation = self.collection_generation.wrapping_add(1);
                            self.character.clear();
                            self.character_revision = self.character_revision.wrapping_add(1);
                            continue;
                        }
                        self.ingest_event(
                            Event::Removed {
                                id: profile.id,
                                death: false,
                            },
                            now,
                        );
                    }
                    // The structured profile itself supplies the combat actor
                    // ID and name. A missing party roster must not discard that
                    // identity; it supplies neither self nor party membership.
                    self.ingest_event(
                        Event::Identity {
                            id: profile.id,
                            name: profile.name.clone(),
                            class: None,
                            own: false,
                        },
                        now,
                    );
                    if let Some(identity) = self.identities.get_mut(&profile.id).filter(|row| {
                        row.player && row.name.as_deref() == Some(profile.name.as_str())
                    }) {
                        identity.home_server = Some(profile.server);
                    }
                    // The server can tell two same-named players apart.
                    self.bind_named_effects(profile.id);
                    if self.own_id == Some(profile.id)
                        && self
                            .character
                            .matches_server_self(profile.id, &profile.name)
                    {
                        self.character.bind_self(
                            profile.id,
                            &profile.name,
                            Some(u32::from(profile.server)),
                            now,
                        );
                        self.character_revision = self.character_revision.wrapping_add(1);
                    }
                    if let Some(identity) = self
                        .completed
                        .as_mut()
                        .filter(|record| record.generation == self.generation)
                        .and_then(|record| record.identities.get_mut(&profile.id))
                        .filter(|row| {
                            row.player
                                && row.name.as_deref() == Some(profile.name.as_str())
                                && row
                                    .home_server
                                    .is_none_or(|server| server == profile.server)
                        })
                    {
                        identity.home_server = Some(profile.server);
                    }
                    self.pending_profiles
                        .retain(|(old, _)| old.id != profile.id);
                    if self.pending_profiles.len() == MAX_PENDING_PROFILES {
                        self.pending_profiles.remove(0);
                    }
                    self.pending_profiles.push((profile, now));
                }
                self.bind_pending_profiles(now);
            }
            Event::Cooldown {
                skill,
                remaining_units,
                charges,
            } => {
                // Actorless cooldown records belong only to a server-confirmed
                // local character. A manual row selection is not that evidence.
                if let Some(actor_id) = self.own_id.filter(|id| {
                    self.identities
                        .get(id)
                        .is_some_and(|identity| identity.player && !identity.removed)
                }) {
                    self.cooldowns.bind_self(Some(actor_id));
                    self.cooldowns
                        .observe_local(skill, remaining_units, charges, now);
                }
            }
            Event::SkillCharges {
                skill,
                charges,
                recharge_ms,
            } => {
                if let Some(actor) = self.own_id.filter(|id| {
                    self.identities
                        .get(id)
                        .is_some_and(|identity| identity.player && !identity.removed)
                }) {
                    self.cooldowns.bind_self(Some(actor));
                    self.cooldowns.observe_actor_charges(
                        actor,
                        skill,
                        charges,
                        recharge_ms,
                        now,
                        true,
                    );
                }
            }
            Event::Health { id, current } => {
                let entry = self.identities.entry(id).or_default();
                entry.health_observed_at_ms = Some(now);
                entry.current_hp_observed_at_ms = Some(now);
                entry.hp = Some(current);
                entry.peak_hp = Some(entry.peak_hp.unwrap_or(0).max(current));
                self.dirty();
            }
            Event::Removed { id, death } => {
                if self.own_id == Some(id) {
                    self.recent_personal_hit = None;
                }
                self.pending_profiles
                    .retain(|(profile, _)| profile.id != id);
                // Keep attribution until the encounter ends; an entity leaving
                // the scene does not change damage it already dealt.
                let identity = self.identities.entry(id).or_default();
                identity.removed = true;
                if death && identity.npc && !identity.player && !identity.pet {
                    identity.hp = Some(0);
                    identity.current_hp_observed_at_ms = Some(now);
                    identity.health_observed_at_ms = Some(now);
                }
                self.assistance.remove_actor(id, now);
                self.spatial.remove(id, now);
                self.cooldowns.remove_actor(id);
                if self.own_id == Some(id) {
                    self.resources.clear();
                    self.character_revision = self.character_revision.wrapping_add(1);
                }
                // A death/despawn keeps existing attribution. A later spawn
                // reusing this id, or a connection change, invalidates it.
                if death && self.alive_targets.remove(&id) {
                    let bosses = self.report_bosses();
                    let boss_ended = bosses.contains(&id)
                        && !self
                            .alive_targets
                            .iter()
                            .any(|target| bosses.contains(target));
                    if self.alive_targets.is_empty() || boss_ended {
                        self.finish(now)
                    }
                }
                self.dirty();
            }
            Event::Damage(hit) => {
                if self.paused || hit.amount == 0 {
                    return;
                }
                self.observe_recent_personal_hit(&hit, now);
                self.training_hit(&hit, now);
                if self.started.is_some() && self.idle_for(now) {
                    self.finish(self.last_hit.saturating_add(IDLE_MS))
                }
                if self.started.is_none() {
                    // The finished encounter stays on screen: damage taken or a heal tick right
                    // after a kill must not wipe its result. Only a hit dealt to a target does.
                    self.damage_samples.clear();
                    self.healing_samples.clear();
                    self.healing_sample_complete = true;
                    self.diagnostics.ambiguous_periodic_events = 0;
                    self.diagnostics.ambiguous_periodic_amount = 0;
                    self.sample_complete = true;
                    self.encounter_build = None;
                    self.encounter_build_taken = false;
                    self.encounter_gaps_at_start = self.diagnostics.stream_gaps;
                    self.started = Some(now);
                    self.paused_ms = 0;
                    self.diagnostics.truncated_encounter = false;
                }
                if self.completed.is_some() && self.deals_damage(&hit) {
                    self.completed = None;
                }
                self.last_hit = now;
                if !self.encounter_build_taken
                    && self.own_id == Some(Self::owner_in(&self.identities, hit.source))
                {
                    self.encounter_build = self.character.own_snapshot();
                    self.encounter_build_taken = true;
                }
                self.diagnostics.damage_events += 1;
                if self.hit_count < MAX_HITS {
                    self.observe_record_hit(&hit, now);
                    self.hit_count += 1;
                    if self.damage_samples.len() < MAX_SAMPLES {
                        self.damage_samples.push(DamageSample {
                            timestamp_ms: now,
                            source: hit.source,
                            player_id: hit.source,
                            target: hit.target,
                            skill: hit.skill,
                            amount: hit.amount,
                            critical: hit.critical,
                            tick: hit.tick,
                            flags: hit.flags,
                            angle: hit.angle,
                            metric: String::new(),
                        });
                    } else {
                        self.sample_complete = false
                    }
                    self.pair_activity
                        .entry((hit.source, hit.target))
                        .and_modify(|span| {
                            span.last = now;
                            span.paused_at_last = self.paused_ms;
                            span.last_focus_epoch = self.focus_epoch;
                        })
                        .or_insert(SourceActivity {
                            first: now,
                            last: now,
                            paused_at_start: self.paused_ms,
                            paused_at_last: self.paused_ms,
                            last_focus_epoch: self.focus_epoch,
                        });
                    self.alive_targets.insert(hit.target);
                    let row = self
                        .aggregates
                        .entry((hit.source, hit.target))
                        .or_default()
                        .entry(hit.skill)
                        .or_insert_with(|| SkillState {
                            id: hit.skill,
                            name: format!("Skill #{}", hit.skill),
                            min: hit.amount,
                            ..Default::default()
                        });
                    row.hits += 1;
                    row.damage = row.damage.saturating_add(hit.amount);
                    row.crit_hits += u64::from(hit.critical);
                    row.direct_hits += u64::from(!hit.tick);
                    row.tick_hits += u64::from(hit.tick);
                    if !hit.tick {
                        row.quality_hits += 1;
                        for (counter, active) in [
                            (&mut row.parry_hits, hit.flags & 2 != 0),
                            (&mut row.perfect_hits, hit.flags & 4 != 0),
                            (&mut row.double_hits, hit.flags & 8 != 0),
                            (&mut row.direction_1_hits, hit.angle == 1),
                            (&mut row.direction_2_hits, hit.angle == 2),
                        ] {
                            *counter = Some(counter.unwrap_or(0).saturating_add(u64::from(active)))
                        }
                    }
                    row.min = row.min.min(hit.amount);
                    row.max = row.max.max(hit.amount);
                    self.dirty();
                } else {
                    self.sample_complete = false;
                    self.diagnostics.truncated_encounter = true
                }
            }
        }
    }
    fn record_actor(&self, actor: u64) -> Option<(&Identity, bool)> {
        let identity = self.identities.get(&actor)?;
        if !identity.player
            || identity.removed
            || identity.npc
            || identity.pet
            || identity.owner.is_some()
        {
            return None;
        }
        let local = self.own_id == Some(actor);
        if local {
            return Some((identity, true));
        }
        // A stranger's hit does not rescan the entire party/nearby roster.
        let verified_party = self.party_sync_confirmed
            && self.party_names.as_ref().is_some_and(|names| {
                names.iter().any(|name| {
                    self.party_name_matches(identity, name)
                        && self
                            .identities
                            .values()
                            .filter(|row| {
                                !row.removed
                                    && !row.npc
                                    && !row.pet
                                    && row.owner.is_none()
                                    && self.party_name_matches(row, name)
                            })
                            .take(2)
                            .count()
                            == 1
                })
            });
        verified_party.then_some((identity, false))
    }

    fn record_observation(
        &self,
        actor: u64,
        target: u64,
        amount: u64,
        now: u64,
    ) -> Option<records::Observation> {
        let (identity, local) = self.record_actor(actor)?;
        let target = self.identities.get(&target)?;
        if !target.npc || target.player || target.pet {
            return None;
        }
        Some(records::Observation {
            name: identity.name.clone()?,
            server_id: identity.home_server?,
            class_name: identity.class.clone()?,
            actor_id: actor,
            is_local: local,
            metric: "hit".into(),
            amount,
            at_ms: now,
            skill_id: None,
            critical: false,
            tick: false,
            target_name: target.name.clone().unwrap_or_default(),
            target_npc_id: target.npc_model_id,
            map_id: self.current_context.map_id,
            boss_max_hp: target.reported_max_hp,
            elapsed_ms: None,
        })
    }

    fn observe_record_hit(&mut self, hit: &packets::Hit, now: u64) {
        let actor = Self::owner_in(&self.identities, hit.source);
        if let Some(mut observation) = self.record_observation(actor, hit.target, hit.amount, now) {
            observation.skill_id = Some(hit.skill);
            observation.critical = hit.critical;
            observation.tick = hit.tick;
            records::enqueue(&mut self.record_observations, observation);
        }
    }

    fn observe_boss_record(&mut self, record: &Encounter) {
        if record.source != "captured"
            || record.local_identity_source != "server"
            || !record.sample_complete
            || self.diagnostics.truncated_encounter
            || self.diagnostics.stream_gaps != self.encounter_gaps_at_start
            || record.personal_targets.len() != 1
        {
            return;
        }
        let target = &record.personal_targets[0];
        if !target.is_boss || record.personal_total_damage != Some(target.damage) {
            return;
        }
        let Some(actor) = record.local_player_id else {
            return;
        };
        if let Some(mut observation) =
            self.record_observation(actor, target.id, target.damage, record.ended_ms)
        {
            observation.metric = "boss-dps".into();
            observation.elapsed_ms = Some(record.personal_elapsed_ms);
            observation.map_id = record.context.map_id;
            records::enqueue(&mut self.record_observations, observation);
        }
    }

    /// Native persistence consumes only live accepted observations, never history imports.
    pub fn take_record_observations(&mut self) -> Vec<records::Observation> {
        std::mem::take(&mut self.record_observations)
    }

    /// A hit dealt to a target (player or owned summon onto a non-player), as opposed to damage
    /// taken, an unclassified amount or a heal.
    fn deals_damage(&self, hit: &packets::Hit) -> bool {
        sample_metric(
            &self.identities,
            hit.source,
            hit.target,
            self.own_id.or(self.manual_own_id),
        ) == "damage"
    }

    fn observe_healing(&mut self, hit: packets::Hit, now: u64) {
        if self.paused
            || hit.source == 0
            || hit.target == 0
            || hit.source > u64::from(u32::MAX)
            || hit.target > u64::from(u32::MAX)
            || !(11_000_000..20_000_000).contains(&hit.skill)
        {
            return;
        }
        let owner = Self::owner_in(&self.identities, hit.source);
        let player = |id: u64| {
            self.identities
                .get(&id)
                .is_some_and(|row| row.player && !row.npc && !row.pet)
        };
        if !player(owner) || !player(hit.target) {
            return;
        }
        if self.started.is_some() && self.idle_for(now) {
            self.finish(self.last_hit.saturating_add(IDLE_MS));
        }
        if self.started.is_none() {
            self.damage_samples.clear();
            self.sample_complete = true;
            self.healing_samples.clear();
            self.healing_sample_complete = true;
            self.diagnostics.ambiguous_periodic_events = 0;
            self.diagnostics.ambiguous_periodic_amount = 0;
            self.encounter_build = None;
            self.encounter_build_taken = false;
            self.encounter_gaps_at_start = self.diagnostics.stream_gaps;
            self.started = Some(now);
            self.paused_ms = 0;
            self.diagnostics.truncated_encounter = false;
        }
        self.last_hit = now;
        if self.hit_count >= MAX_HITS || self.healing_samples.len() >= MAX_SAMPLES {
            self.healing_sample_complete = false;
            self.diagnostics.truncated_encounter = true;
            return;
        }
        self.hit_count += 1;
        self.healing_samples.push(DamageSample {
            timestamp_ms: now,
            source: hit.source,
            player_id: owner,
            target: hit.target,
            skill: hit.skill,
            amount: hit.amount,
            critical: hit.critical,
            tick: hit.tick,
            flags: hit.flags,
            angle: hit.angle,
            metric: "healing".into(),
        });
        if !self.encounter_build_taken && self.own_id == Some(owner) {
            self.encounter_build = self.character.own_snapshot();
            self.encounter_build_taken = true;
        }
        self.dirty();
    }

    fn apply_healing(&self, record: &mut Encounter) {
        let identities = self
            .completed
            .as_ref()
            .map(|value| &value.identities)
            .unwrap_or(&self.identities);
        let samples = self
            .completed
            .as_ref()
            .map(|value| &value.record.healing_samples)
            .unwrap_or(&self.healing_samples);
        record.healing_sample_complete = self
            .completed
            .as_ref()
            .map(|value| value.record.healing_sample_complete)
            .unwrap_or(
                self.healing_sample_complete
                    && self.diagnostics.stream_gaps == self.encounter_gaps_at_start,
            );
        record.healing_samples = samples
            .iter()
            .filter(|sample| sample.timestamp_ms >= record.started_ms)
            .cloned()
            .collect();
        let mut skills: BTreeMap<u64, BTreeMap<u32, SkillState>> = BTreeMap::new();
        for sample in &mut record.healing_samples {
            let actor = Self::owner_in(identities, sample.source);
            sample.player_id = actor;
            let row = skills
                .entry(actor)
                .or_default()
                .entry(sample.skill)
                .or_insert_with(|| SkillState {
                    id: sample.skill,
                    name: format!("Skill #{}", sample.skill),
                    min: sample.amount,
                    ..Default::default()
                });
            row.hits += 1;
            row.damage = row.damage.saturating_add(sample.amount);
            row.crit_hits += u64::from(sample.critical);
            row.tick_hits += u64::from(sample.tick);
            row.direct_hits += u64::from(!sample.tick);
            row.min = row.min.min(sample.amount);
            row.max = row.max.max(sample.amount);
        }
        for (actor, actor_skills) in skills {
            let index = record
                .players
                .iter()
                .position(|row| row.id == actor)
                .unwrap_or_else(|| {
                    let identity = identities.get(&actor);
                    record.players.push(PlayerState {
                        id: actor,
                        name: self.display_name(actor, identity),
                        class_name: identity
                            .and_then(|row| row.class.clone())
                            .unwrap_or_else(|| "Unknown".into()),
                        identity_confirmed: identity.is_some_and(|row| row.player),
                        is_local: record.local_player_id == Some(actor),
                        in_party: record.party_member_ids.contains(&actor),
                        ..PlayerState::default()
                    });
                    record.players.len() - 1
                });
            let row = &mut record.players[index];
            row.healing = Some(
                actor_skills
                    .values()
                    .map(|skill| skill.damage)
                    .fold(0, u64::saturating_add),
            );
            row.healing_skills = actor_skills.into_values().collect();
            row.healing_coverage = "explicit-received".into();
        }
        record.personal_healing = record
            .players
            .iter()
            .find(|row| Some(row.id) == record.local_player_id)
            .and_then(|row| row.healing);
    }

    pub fn tick(&mut self, now: u64) {
        self.assistance.tick(now);
        if self.training.status == "running"
            && self
                .training
                .started_ms
                .is_some_and(|start| now >= start.saturating_add(self.training.duration_ms))
        {
            self.training.status = "complete".into();
        }
        self.streams.expire(now);
        if now.saturating_sub(self.orphans_checked_ms) >= 1000 {
            self.orphans_checked_ms = now;
            self.bind_orphans();
        }
        if !self.paused && self.started.is_some() && self.idle_for(now) {
            self.finish(self.last_hit.saturating_add(IDLE_MS))
        }
    }
    pub fn connection_changed(&mut self) {
        self.collection_generation = self.collection_generation.wrapping_add(1);
        self.recent_personal_hit = None;
        self.focus_epoch = self.focus_epoch.wrapping_add(1);
        self.finish(self.last_hit);
        self.current_context = EncounterContext::default();
        self.party_id = None;
        self.healing_samples.clear();
        self.healing_sample_complete = true;
        self.latency.clear();
        self.streams = Default::default();
        self.frames = Default::default();
        self.prefixes.clear();
        self.identities.clear();
        self.cooldowns.clear();
        self.resources.clear();
        self.own_id = None;
        self.generation = self.generation.wrapping_add(1);
        self.pending_owners.clear();
        self.bosses.clear();
        self.assistance.clear();
        self.spatial.clear();
        self.cubes.clear();
        self.power.clear();
        self.orphan_bound.clear();
        self.pending_spawn_position = None;
        self.field_bosses.clear();
        self.field_boss_available = false;
        self.field_boss_revision = self.field_boss_revision.wrapping_add(1);
        self.cancel_training();
        self.character.clear();
        self.pet_connections.clear();
        self.character_revision = self.character_revision.wrapping_add(1);
        self.encounter_build = None;
        self.encounter_build_taken = false;
        self.manual_own_id = None;
        self.alias_bound_id = None;
        self.party_names = None;
        self.party_sync_confirmed = false;
        self.party_wire_members.clear();
        self.pending_profiles.clear();
        self.party_snapshot_complete = false;
        self.party_classes.clear();
        self.manual_party_ids = None;
        self.last_seen = 0;
        self.diagnostics = Default::default();
        self.encounter_gaps_at_start = 0;
        self.dirty();
    }
    pub fn capture_loss(&mut self) {
        self.recent_personal_hit = None;
        self.focus_epoch = self.focus_epoch.wrapping_add(1);
        for identity in self.identities.values_mut() {
            identity.current_hp_observed_at_ms = None;
        }
        self.streams.invalidate();
        self.frames = Default::default();
        // A loss does not create a new TCP generation. Keep established TLS/game
        // classification, while discarding incomplete classifier prefix bytes.
        self.prefixes.retain(|_, prefix| prefix.decided);
        self.cooldowns.clear();
        self.resources.clear();
        self.party_sync_confirmed = false;
        self.party_names = None;
        self.party_classes.clear();
        self.party_wire_members.clear();
        self.pending_profiles.clear();
        self.party_snapshot_complete = false;
        self.character
            .invalidate_capture(self.last_seen, "capture-loss");
        if let Some(id) = self.own_id {
            if let Some(name) = self
                .identities
                .get(&id)
                .and_then(|entry| entry.name.as_deref())
            {
                self.character.bind_self(id, name, None, self.last_seen);
            }
        }
        self.character_revision = self.character_revision.wrapping_add(1);
        self.assistance.clear();
        self.spatial.gap(self.last_seen);
        self.cubes.clear();
        self.power.clear();
        self.orphan_bound.clear();
        self.pending_spawn_position = None;
        self.field_bosses.clear();
        self.field_boss_available = false;
        self.field_boss_revision = self.field_boss_revision.wrapping_add(1);
        if matches!(self.training.status.as_str(), "armed" | "running") {
            self.training.capture_incomplete = true
        }
        if self.started.is_some() {
            self.sample_complete = false
        }
        self.diagnostics.stream_gaps = self.diagnostics.stream_gaps.saturating_add(1);
        self.dirty();
    }
    pub fn pause(&mut self, paused: bool) {
        self.set_paused_at(paused, self.last_hit)
    }
    pub fn set_paused_at(&mut self, paused: bool, now: u64) {
        if paused == self.paused {
            return;
        }
        if paused {
            self.cancel_training();
            self.pause_at = Some(now)
        } else if let Some(start) = self.pause_at.take() {
            self.paused_ms = self.paused_ms.saturating_add(now.saturating_sub(start));
            if self.started.is_some() {
                self.last_hit = now
            }
        }
        self.paused = paused;
    }
    pub fn set_target_mode(&mut self, mode: &str) {
        let next = if mode == "boss" { "boss" } else { "all" };
        if next != self.target_mode {
            self.target_mode = next.into();
            self.dirty()
        }
    }
    pub fn set_boss_targets(&mut self, ids: &[u64]) {
        self.bosses = ids.iter().copied().take(256).collect();
        if let Some(completed) = self
            .completed
            .as_mut()
            .filter(|completed| completed.generation == self.generation)
        {
            // Same-session manual retagging changes the displayed report,
            // while its saved history entry remains immutable.
            completed.bosses.clone_from(&self.bosses);
        }
        self.dirty();
    }
    /// Whether the current encounter has been quiet long enough to end. Phase changes and
    /// mechanics routinely pause the damage on a boss for longer than the ordinary limit, and
    /// ending the fight there splits one boss fight into several records, so a boss that was hit
    /// and has not died keeps it open for `BOSS_IDLE_MS`. The recorded end stays one ordinary
    /// idle limit after the last hit, so the pause is not counted into the duration twice.
    fn idle_for(&self, now: u64) -> bool {
        let quiet = now.saturating_sub(self.last_hit);
        if quiet < IDLE_MS {
            return false;
        }
        if quiet >= BOSS_IDLE_MS {
            return true;
        }
        let bosses = self.report_bosses();
        !self
            .alive_targets
            .iter()
            .any(|target| bosses.contains(target))
    }
    fn report_bosses(&self) -> Vec<u64> {
        let (manual, identities) = self
            .completed
            .as_ref()
            .map(|completed| (&completed.bosses, &completed.identities))
            .unwrap_or((&self.bosses, &self.identities));
        let mut bosses = manual.clone();
        bosses.extend(
            identities
                .iter()
                .filter_map(|(id, identity)| catalog_boss(identity).then_some(*id)),
        );
        bosses.sort_unstable();
        bosses.dedup();
        bosses
    }
    pub fn reset(&mut self) {
        self.recent_personal_hit = None;
        self.cancel_training();
        self.finish(self.last_hit);
        self.completed = None;
        self.aggregates.clear();
        self.pair_activity.clear();
        self.damage_samples.clear();
        self.encounter_build = None;
        self.encounter_build_taken = false;
        self.sample_complete = true;
        self.alive_targets.clear();
        self.hit_count = 0;
        self.started = None;
        self.pause_at = None;
        self.paused_ms = 0;
        self.diagnostics.truncated_encounter = false;
        self.dirty();
    }

    fn clear_recent_personal_entity(&mut self, id: u64) {
        if self
            .recent_personal_hit
            .as_ref()
            .is_some_and(|hit| hit.actor_id == id || hit.target_id == id)
        {
            self.recent_personal_hit = None;
        }
    }

    fn verified_live_self(&self) -> Option<u64> {
        self.own_id.filter(|id| {
            *id > 0
                && *id <= u64::from(u32::MAX)
                && self.identities.get(id).is_some_and(|identity| {
                    identity.player
                        && !identity.npc
                        && !identity.pet
                        && !identity.removed
                        && identity
                            .name
                            .as_deref()
                            .is_some_and(|name| !name.is_empty())
                })
        })
    }

    fn observe_recent_personal_hit(&mut self, hit: &packets::Hit, now: u64) {
        let Some(actor_id) = self.verified_live_self() else {
            return;
        };
        let personal_source = hit.source == actor_id
            || self.identities.get(&hit.source).is_some_and(|identity| {
                identity.pet
                    && !identity.npc
                    && !identity.player
                    && !identity.removed
                    && Self::owner_in(&self.identities, hit.source) == actor_id
            });
        if !personal_source {
            return;
        }
        // A newer personal hit replaces the previous suggestion even when the
        // new target is unnamed, uncatalogued, or ineligible for a pet control.
        self.recent_personal_hit = None;
        if hit.target == 0
            || hit.target > u64::from(u32::MAX)
            || !self.identities.get(&hit.target).is_some_and(|identity| {
                identity.npc
                    && !identity.player
                    && !identity.pet
                    && !identity.removed
                    && identity.owner.is_none()
            })
        {
            return;
        }
        self.recent_personal_hit = Some(RecentPersonalHit {
            actor_id,
            target_id: hit.target,
            hit_at_ms: now,
        });
    }

    fn recent_personal_target(&self, now: u64) -> Option<RecentPersonalTarget> {
        let hit = self.recent_personal_hit.as_ref()?;
        if self.verified_live_self() != Some(hit.actor_id)
            || now.checked_sub(hit.hit_at_ms)? > RECENT_PERSONAL_TARGET_MS
        {
            return None;
        }
        let identity = self.identities.get(&hit.target_id)?;
        if !identity.npc || identity.player || identity.pet || identity.owner.is_some() {
            return None;
        }
        // Removed/dead targets are intentionally eligible. A new spawn or an
        // identity replacement clears the observation before this lookup.
        Some(RecentPersonalTarget {
            actor_id: hit.actor_id,
            target_id: hit.target_id,
            target_name: identity.name.clone(),
            target_npc_id: identity.npc_model_id,
            hit_at_ms: hit.hit_at_ms,
            source: "server-self-hit".into(),
        })
    }

    /// Remember the power scalars an attacker has hit with. A summon inherits its owner's, so the
    /// set is the evidence that ties an unannounced summon to the one player it can belong to.
    pub fn observe_power(&mut self, source: u64, scalar: u32) {
        if self.power.len() >= 2048 && !self.power.contains_key(&source) {
            self.power.clear();
        }
        let set = self.power.entry(source).or_default();
        if set.len() < 8 && !set.contains(&scalar) {
            set.push(scalar);
        }
    }

    /// Bind unannounced summons and spell entities to their player. Some are never spawned or
    /// named, so only their damage records show them. The rule is conservative, like the one the
    /// A2Tools meter measured with no false merge: the same class (the class band of the skill
    /// ids), a power scalar in common, at least three times as many distinct skills on the player
    /// as on the summon, and exactly one such player. It is recomputed each time, so a binding
    /// that stops holding is released.
    fn bind_orphans(&mut self) {
        let mut changed = false;
        for id in std::mem::take(&mut self.orphan_bound) {
            if let Some(row) = self.identities.get_mut(&id) {
                row.owner = None;
                changed = true;
            }
        }
        if !self.power.is_empty() && !self.aggregates.is_empty() {
            let mut skills: HashMap<u64, std::collections::BTreeSet<u32>> = HashMap::new();
            for ((source, _), per_skill) in &self.aggregates {
                skills
                    .entry(*source)
                    .or_default()
                    .extend(per_skill.keys().copied());
            }
            let players: Vec<(u64, u8, usize)> = skills
                .iter()
                .filter_map(|(id, set)| {
                    let row = self.identities.get(id)?;
                    let class = class_band(row.class.as_deref()?)?;
                    (row.player && !row.npc && !row.pet && !row.removed && row.owner.is_none())
                        .then_some((*id, class, set.len()))
                })
                .collect();
            let mut bound = Vec::new();
            for (orphan, set) in &skills {
                let unannounced = self.identities.get(orphan).is_none_or(|row| {
                    !row.player && !row.npc && !row.pet && row.owner.is_none() && !row.removed
                });
                let Some(scalars) = self.power.get(orphan).filter(|_| unannounced) else {
                    continue;
                };
                let mut bands = set.iter().filter_map(|skill| skill_band(*skill));
                let Some(band) = bands.next().filter(|band| bands.all(|other| other == *band))
                else {
                    continue;
                };
                let mut owners = players.iter().filter(|(id, class, count)| {
                    *class == band
                        && *count >= set.len() * 3
                        && self
                            .power
                            .get(id)
                            .is_some_and(|theirs| theirs.iter().any(|value| scalars.contains(value)))
                });
                if let (Some((owner, _, _)), None) = (owners.next(), owners.next()) {
                    bound.push((*orphan, *owner));
                }
            }
            for (orphan, owner) in bound {
                self.identities.entry(orphan).or_default().owner = Some(owner);
                self.orphan_bound.insert(orphan);
                changed = true;
            }
        }
        if changed {
            self.dirty();
        }
    }

    /// Effect entities such as a Cleric's auras are announced by an appearance record under their
    /// caster's name, with no class, and nothing else says whose they are. An identity without a
    /// class whose name matches exactly one identified player (the same home server when both are
    /// known) belongs to that player, so its damage joins the player's row. A real player who is
    /// later identified with a class is released again by the identity record itself.
    fn bind_named_effects(&mut self, id: u64) {
        let Some(me) = self
            .identities
            .get(&id)
            .filter(|row| row.player && !row.npc && !row.pet && !row.removed)
        else {
            return;
        };
        let Some(name) = me.name.clone() else {
            return;
        };
        let same_server = |a: Option<u16>, b: Option<u16>| a.is_none() || b.is_none() || a == b;
        let identified = |row: &Identity| {
            row.player
                && !row.npc
                && !row.pet
                && !row.removed
                && row.owner.is_none()
                && row.class.is_some()
                && row.name.as_deref() == Some(name.as_str())
        };
        if me.class.is_none() {
            let server = me.home_server;
            let mut owners = self
                .identities
                .iter()
                .filter(|(other, row)| **other != id && identified(row) && same_server(server, row.home_server))
                .map(|(other, _)| *other);
            let owner = match (owners.next(), owners.next()) {
                (Some(owner), None) => Some(owner),
                _ => None,
            };
            if let Some(row) = self.identities.get_mut(&id) {
                row.owner = owner;
            }
        } else if identified(me) {
            let server = me.home_server;
            let effects: Vec<u64> = self
                .identities
                .iter()
                .filter(|(other, row)| {
                    **other != id
                        && row.player
                        && !row.npc
                        && !row.pet
                        && !row.removed
                        && row.owner.is_none()
                        && row.class.is_none()
                        && row.name.as_deref() == Some(name.as_str())
                        && same_server(server, row.home_server)
                })
                .map(|(other, _)| *other)
                .collect();
            for effect in effects {
                if let Some(row) = self.identities.get_mut(&effect) {
                    row.owner = Some(id);
                }
            }
        }
    }
    fn owner_in(identities: &HashMap<u64, Identity>, id: u64) -> u64 {
        let mut result = id;
        for _ in 0..8 {
            let Some(owner) = identities.get(&result).and_then(|value| value.owner) else {
                break;
            };
            if owner == id || owner == result {
                break;
            }
            result = owner
        }
        result
    }
    fn local_in(&self, identities: &HashMap<u64, Identity>) -> (Option<u64>, &'static str) {
        if let Some(id) = self.own_id {
            return (Some(id), "server");
        }
        if let Some(id) = self.manual_own_id {
            return (Some(id), "manual");
        }
        if !self.character_name.is_empty() {
            let mut matches = identities
                .iter()
                .filter(|(_, identity)| {
                    identity.player
                        && identity.name.as_deref() == Some(self.character_name.as_str())
                })
                .map(|(id, _)| *id);
            if let Some(id) = matches.next() {
                if matches.next().is_none() {
                    return (Some(id), "name-match");
                }
            }
        }
        (None, "unresolved")
    }
    fn party_name_matches(&self, identity: &Identity, name: &str) -> bool {
        identity.player
            && identity.name.as_deref() == Some(name)
            && identity.home_server.is_none_or(|server| {
                self.party_wire_members.is_empty()
                    || self
                        .party_wire_members
                        .values()
                        .any(|member| member.name == name && member.server == server)
            })
    }
    fn party_in(
        &self,
        identities: &HashMap<u64, Identity>,
        local: Option<u64>,
    ) -> (Vec<u64>, &'static str) {
        let mut ids = std::collections::BTreeSet::new();
        let source = if let Some(names) = &self.party_names {
            for name in names {
                let mut matches = identities
                    .iter()
                    .filter(|(_, identity)| self.party_name_matches(identity, name))
                    .map(|(id, _)| *id);
                if let Some(id) = matches.next() {
                    if matches.next().is_none() {
                        ids.insert(id);
                    }
                }
            }
            "server"
        } else if let Some(members) = &self.manual_party_ids {
            ids.extend(members.iter().copied());
            "manual"
        } else {
            return (Vec::new(), "unresolved");
        };
        if let Some(local) = local {
            ids.insert(local);
        }
        (ids.into_iter().collect(), source)
    }
    fn display_name(&self, id: u64, identity: Option<&Identity>) -> String {
        if self.alias_bound_id == Some(id) && !self.character_name.is_empty() {
            return self.character_name.clone();
        }
        identity
            .and_then(|entry| entry.name.clone())
            .unwrap_or_else(|| format!("#{}", id))
    }
    fn observable_player(&self, id: u64) -> bool {
        id > 0
            && id <= u64::from(u32::MAX)
            && self.identities.get(&id).is_none_or(|entity| {
                !entity.removed && !entity.npc && !entity.pet && entity.owner.is_none()
            })
            && (self.identities.get(&id).is_some_and(|entity| entity.player)
                || self.aggregates.keys().any(|(source, _)| *source == id)
                || self.completed.as_ref().is_some_and(|completed| {
                    completed.generation == self.generation
                        && completed.aggregates.keys().any(|(source, _)| *source == id)
                }))
    }
    /// Explicit user selection is distinct from the server's local identity.
    /// Session entity ids are never valid after connection_changed.
    pub fn set_local_player(&mut self, id: Option<u64>, name: &str) -> Result<(), String> {
        if let Some(id) = id {
            if self.own_id.is_some_and(|own| own != id) {
                return Err("Bu oyuncu oyunun bildirdiği kendi karakterin değil.".into());
            }
            if !self.observable_player(id) {
                return Err("Gözlenen bir oyuncu satırı seçmelisin.".into());
            }
        }
        if self.manual_own_id != id {
            self.cancel_training();
            self.cooldowns.clear();
        }
        self.manual_own_id = id;
        self.alias_bound_id = id;
        self.character_name = clean_alias(name);
        self.dirty();
        Ok(())
    }
    /// A typed name resolves only a unique authoritative player name; it
    /// cannot rename another observed row into the local player.
    pub fn set_character_name(&mut self, name: &str) {
        let name = clean_alias(name);
        if self.character_name == name {
            return;
        }
        let previous_local = self.local_in(&self.identities).0;
        self.character_name = name;
        self.alias_bound_id = self.manual_own_id;
        if previous_local != self.local_in(&self.identities).0 {
            self.cooldowns.clear();
        }
        self.dirty();
    }
    pub fn set_party_members(&mut self, ids: &[u64]) -> Result<(), String> {
        if ids.len() > 12 || ids.iter().any(|id| !self.observable_player(*id)) {
            return Err("Parti için yalnız gözlenen oyuncuları seçebilirsin.".into());
        }
        let mut members = ids.to_vec();
        members.sort_unstable();
        members.dedup();
        self.manual_party_ids = Some(members);
        self.party_names = None;
        self.party_sync_confirmed = false;
        self.party_wire_members.clear();
        self.party_snapshot_complete = false;
        self.party_classes.clear();
        self.dirty();
        Ok(())
    }
    pub fn arm_training(&mut self, duration_ms: u64) -> Result<(), String> {
        self.arm_training_on_target(duration_ms, None)
    }
    pub fn arm_training_on_target(
        &mut self,
        duration_ms: u64,
        target_id: Option<u64>,
    ) -> Result<(), String> {
        if !(10_000..=300_000).contains(&duration_ms) || duration_ms % 1000 != 0 {
            return Err("Antrenman süresi 10–300 arasında tam saniye olmalı.".into());
        }
        let Some(id) = self.local_in(&self.identities).0 else {
            return Err("Önce kendi oyuncu satırını seç veya karakter adını eşleştir.".into());
        };
        if let Some(target) = target_id {
            if target == id
                || self
                    .identities
                    .get(&target)
                    .is_some_and(|entry| entry.player)
            {
                return Err("Antrenman için bir NPC veya dummy hedefi seçmelisin.".into());
            }
            let observed = target > 0
                && self
                    .identities
                    .get(&target)
                    .is_none_or(|identity| !identity.removed)
                && (self.aggregates.keys().any(|(_, id)| *id == target)
                    || self.identities.get(&target).is_some_and(|entry| entry.npc)
                    || self.completed.as_ref().is_some_and(|completed| {
                        completed.generation == self.generation
                            && completed.aggregates.keys().any(|(_, id)| *id == target)
                    }));
            if !observed {
                return Err("Antrenman için gözlenen bir hedef seçmelisin.".into());
            }
        }
        self.training = TrainingState {
            status: "armed".into(),
            duration_ms,
            remaining_ms: duration_ms,
            local_player_id: Some(id),
            target_id,
            ..Default::default()
        };
        self.training_targets.clear();
        Ok(())
    }
    pub fn cancel_training(&mut self) {
        self.training = TrainingState::default();
        self.training_targets.clear();
    }
    fn training_hit(&mut self, hit: &packets::Hit, now: u64) {
        let Some(local) = self.training.local_player_id else {
            return;
        };
        if !pve_pair(&self.identities, hit.source, hit.target, Some(local)) {
            return;
        }
        if self.training.status == "armed" {
            if hit.source != local
                || hit.tick
                || self
                    .training
                    .target_id
                    .is_some_and(|target| target != hit.target)
            {
                return;
            }
            self.training.status = "running".into();
            self.training.started_ms = Some(now);
        }
        if self.training.status != "running" {
            return;
        }
        let start = self.training.started_ms.unwrap_or(now);
        if now >= start.saturating_add(self.training.duration_ms) {
            self.training.status = "complete".into();
            return;
        }
        if now >= start
            && Self::owner_in(&self.identities, hit.source) == local
            && self
                .training
                .target_id
                .is_none_or(|target| target == hit.target)
        {
            self.training.total_damage = self.training.total_damage.saturating_add(hit.amount);
            self.training_targets.insert(hit.target);
        }
    }
    fn training_snapshot(&self, now: u64) -> TrainingState {
        let mut training = self.training.clone();
        if let Some(start) = training.started_ms {
            let elapsed = now.saturating_sub(start).min(training.duration_ms);
            training.remaining_ms = training.duration_ms.saturating_sub(elapsed);
            if elapsed >= training.duration_ms {
                training.status = "complete".into()
            }
            training.dps = training.total_damage as f64 / (elapsed as f64 / 1000.0).max(1.0);
        }
        training
    }
    fn attach_samples(&self, record: &mut Encounter) {
        if let Some(completed) = &self.completed {
            record.damage_samples = completed.record.damage_samples.clone();
            record.received_samples = completed.record.received_samples.clone();
            record.sample_complete = completed.record.sample_complete;
            for sample in &mut record.damage_samples {
                sample.player_id = Self::owner_in(&completed.identities, sample.source);
                sample.metric = sample_metric(
                    &completed.identities,
                    sample.source,
                    sample.target,
                    record.local_player_id,
                )
                .into();
            }
        } else {
            record.damage_samples = self.damage_samples.clone();
            record.sample_complete = self.sample_complete;
            for sample in &mut record.damage_samples {
                sample.player_id = Self::owner_in(&self.identities, sample.source);
                sample.metric = sample_metric(
                    &self.identities,
                    sample.source,
                    sample.target,
                    record.local_player_id,
                )
                .into();
            }
            record.received_samples = record
                .damage_samples
                .iter()
                .filter(|sample| sample.metric == "damage-taken")
                .cloned()
                .collect();
            // Unclassified amounts (heal-like or PvP, between players) are excluded from
            // every damage total and disclosed through `unclassified_player_target_*`.
            // They do not make the PvE damage samples incomplete: only lost or truncated
            // data does. Marking the record incomplete would hide the chart, boss records
            // and comparisons for every fight in which a support class heals.
            record
                .damage_samples
                .retain(|sample| sample.metric == "damage");
        }
    }
    /// Keeps the history within its record limit without losing boss fights: records are
    /// dropped oldest first, zero-damage ones before other fights and boss fights last. The
    /// newest record is never dropped here, so a fight just finished is always visible.
    fn trim_history(&mut self) {
        while self.history.len() > MAX_HISTORY_RECORDS {
            let oldest = |keep: &dyn Fn(&Encounter) -> bool| {
                (1..self.history.len())
                    .rev()
                    .find(|&index| keep(&self.history[index]))
            };
            let index = oldest(&|record| record.total_damage == 0)
                .or_else(|| oldest(&|record| !boss_record(record)))
                .unwrap_or(self.history.len() - 1);
            self.history.remove(index);
        }
    }
    fn bound_history_samples(&mut self) {
        let mut remaining = MAX_HISTORY_SAMPLES;
        let mut spatial_remaining = 50000usize;
        for record in &mut self.history {
            if record.spatial.track.len() > spatial_remaining {
                record.spatial.track.truncate(spatial_remaining);
                record.spatial.retention_limited = true;
            }
            spatial_remaining = spatial_remaining.saturating_sub(record.spatial.track.len());
            if record.damage_samples.len() > remaining {
                record.damage_samples.truncate(remaining);
                record.sample_complete = false;
            }
            remaining = remaining.saturating_sub(record.damage_samples.len());
            if record.received_samples.len() > remaining {
                record.received_samples.truncate(remaining);
                record.sample_complete = false;
            }
            remaining = remaining.saturating_sub(record.received_samples.len());
            if record.healing_samples.len() > remaining {
                record.healing_samples.truncate(remaining);
                record.healing_sample_complete = false;
            }
            remaining = remaining.saturating_sub(record.healing_samples.len());
        }
    }
    fn duration(&self, now: u64) -> u64 {
        if let Some(completed) = &self.completed {
            return completed.record.elapsed_ms;
        }
        let Some(start) = self.started else { return 0 };
        let end = if self.paused {
            self.pause_at.unwrap_or(self.last_hit).min(now)
        } else {
            now.min(self.last_hit)
        };
        end.saturating_sub(start).saturating_sub(self.paused_ms)
    }
    fn build_totals(&self, mode: &str) -> Encounter {
        let (aggregates, identities) = if let Some(completed) = &self.completed {
            (&completed.aggregates, &completed.identities)
        } else {
            (&self.aggregates, &self.identities)
        };
        let bosses = self.report_bosses();
        let mut players = BTreeMap::<u64, BTreeMap<u32, SkillState>>::new();
        let mut targets = BTreeMap::<u64, TargetState>::new();
        let mut target_contributors = BTreeMap::<u64, BTreeMap<u64, u64>>::new();
        let same_generation = self
            .completed
            .as_ref()
            .is_none_or(|completed| completed.generation == self.generation);
        let (local, identity_source) = if same_generation {
            self.local_in(identities)
        } else {
            (None, "unresolved")
        };
        let (party, party_source) = if same_generation {
            self.party_in(identities, local)
        } else {
            (Vec::new(), "unresolved")
        };
        let party_set: std::collections::BTreeSet<_> = party.iter().copied().collect();
        let mut personal_damage = 0u64;
        let mut party_damage = 0u64;
        let mut personal_targets = BTreeMap::<u64, TargetState>::new();
        let mut party_targets = BTreeMap::<u64, TargetState>::new();
        let mut total = 0u64;
        let mut taken = BTreeMap::<u64, BTreeMap<u32, SkillState>>::new();
        let mut partial_taken = std::collections::BTreeSet::new();
        let mut unclassified = BTreeMap::<u64, (u64, u64)>::new();
        for ((source, target), skills) in aggregates {
            if local == Some(*target) || identities.get(target).is_some_and(|entry| entry.player) {
                if verified_npc_source(identities, *source) {
                    let incoming = taken.entry(*target).or_default();
                    for (id, row) in skills {
                        if let Some(existing) = incoming.get_mut(id) {
                            combine_skill(existing, row)
                        } else {
                            incoming.insert(*id, row.clone());
                        }
                    }
                } else {
                    partial_taken.insert(*target);
                }
                players.entry(*target).or_default();
            }
            let owner = Self::owner_in(identities, *source);
            let identity = identities.get(&owner);
            if (local == Some(*target) || identities.get(target).is_some_and(|entry| entry.player))
                && !verified_npc_source(identities, *source)
            {
                let counter = unclassified.entry(owner).or_default();
                for row in skills.values() {
                    counter.0 = counter.0.saturating_add(row.damage);
                    counter.1 = counter.1.saturating_add(row.hits);
                }
                if !identity.is_some_and(|entry| entry.npc && !entry.player) {
                    players.entry(owner).or_default();
                }
            }
            if !pve_pair(identities, *source, *target, local) {
                continue;
            }
            if identity.is_some_and(|identity| {
                identity.npc && !identity.player && identity.owner.is_none()
            }) {
                continue;
            }
            if mode == "boss" && !bosses.contains(target) {
                continue;
            }
            let damage = skills
                .values()
                .map(|row| row.damage)
                .fold(0u64, u64::saturating_add);
            total = total.saturating_add(damage);
            let target_identity = identities.get(target);
            let target_row = targets.entry(*target).or_insert_with(|| TargetState {
                id: *target,
                npc_id: target_identity
                    .and_then(|entry| entry.npc.then_some(entry.npc_model_id).flatten()),
                name: target_identity
                    .and_then(|entry| entry.name.clone())
                    .unwrap_or_else(|| format!("Target #{}", target)),
                is_boss: bosses.contains(target),
                damage: 0,
                current_hp: target_identity.and_then(|entry| entry.hp),
                observed_peak_hp: target_identity.and_then(|entry| entry.peak_hp),
                reported_max_hp: target_identity.and_then(|entry| entry.reported_max_hp),
                health_observed_at_ms: target_identity
                    .and_then(|entry| entry.health_observed_at_ms),
                current_hp_observed_at_ms: target_identity
                    .and_then(|entry| entry.current_hp_observed_at_ms),
                ..Default::default()
            });
            target_row.damage = target_row.damage.saturating_add(damage);
            if damage > 0 {
                let contribution = target_contributors
                    .entry(*target)
                    .or_default()
                    .entry(owner)
                    .or_default();
                *contribution = contribution.saturating_add(damage);
            }
            if local == Some(owner) {
                personal_damage = personal_damage.saturating_add(damage);
                let row = personal_targets.entry(*target).or_insert_with(|| {
                    let mut row = target_row.clone();
                    row.damage = 0;
                    row
                });
                row.damage = row.damage.saturating_add(damage);
            }
            if party_set.contains(&owner) {
                party_damage = party_damage.saturating_add(damage);
                let row = party_targets.entry(*target).or_insert_with(|| {
                    let mut row = target_row.clone();
                    row.damage = 0;
                    row
                });
                row.damage = row.damage.saturating_add(damage);
            }
            let player_skills = players.entry(owner).or_default();
            for (id, row) in skills {
                match player_skills.entry(*id) {
                    std::collections::btree_map::Entry::Vacant(slot) => {
                        slot.insert(row.clone());
                    }
                    std::collections::btree_map::Entry::Occupied(mut slot) => {
                        let combined = slot.get_mut();
                        combined.hits = combined.hits.saturating_add(row.hits);
                        combined.damage = combined.damage.saturating_add(row.damage);
                        combined.crit_hits = combined.crit_hits.saturating_add(row.crit_hits);
                        combined.direct_hits = combined.direct_hits.saturating_add(row.direct_hits);
                        combined.tick_hits = combined.tick_hits.saturating_add(row.tick_hits);
                        combined.quality_hits =
                            combined.quality_hits.saturating_add(row.quality_hits);
                        for (target, value) in [
                            (&mut combined.parry_hits, row.parry_hits),
                            (&mut combined.perfect_hits, row.perfect_hits),
                            (&mut combined.double_hits, row.double_hits),
                            (&mut combined.direction_1_hits, row.direction_1_hits),
                            (&mut combined.direction_2_hits, row.direction_2_hits),
                        ] {
                            if let Some(value) = value {
                                *target = Some(target.unwrap_or(0).saturating_add(value))
                            }
                        }
                        combined.min = combined.min.min(row.min);
                        combined.max = combined.max.max(row.max);
                    }
                }
            }
        }
        let mut player_rows: Vec<_> = players
            .into_iter()
            .map(|(id, skills)| {
                let identity = identities.get(&id);
                let mut skills: Vec<_> = skills.into_values().collect();
                skills.sort_by_key(|row| std::cmp::Reverse(row.damage));
                let damage = skills
                    .iter()
                    .map(|row| row.damage)
                    .fold(0u64, u64::saturating_add);
                PlayerState {
                    id,
                    name: self.display_name(id, identity),
                    class_name: identity
                        .and_then(|entry| entry.class.clone())
                        .or_else(|| {
                            let name = identity.and_then(|entry| entry.name.as_ref())?;
                            let count = identities
                                .values()
                                .filter(|entry| entry.player && entry.name.as_ref() == Some(name))
                                .count();
                            if count != 1
                                || !identity.is_some_and(|row| self.party_name_matches(row, name))
                            {
                                return None;
                            }
                            self.party_classes
                                .get(name)
                                .and_then(|code| class_name(*code))
                                .map(String::from)
                        })
                        .unwrap_or_else(|| "Unknown".into()),
                    damage,
                    dps: 0.0,
                    share: if total == 0 {
                        0.0
                    } else {
                        damage as f64 / total as f64 * 100.0
                    },
                    identity_confirmed: identity.is_some_and(|identity| identity.player),
                    is_local: local == Some(id),
                    in_party: party_set.contains(&id),
                    skills,
                    damage_taken: (local == Some(id) || identity.is_some_and(|entry| entry.player))
                        .then(|| {
                            taken
                                .get(&id)
                                .map(|skills| {
                                    skills
                                        .values()
                                        .map(|row| row.damage)
                                        .fold(0, u64::saturating_add)
                                })
                                .unwrap_or(0)
                        }),
                    incoming_skills: taken
                        .get(&id)
                        .map(|skills| {
                            let mut rows: Vec<_> = skills.values().cloned().collect();
                            rows.sort_by_key(|row| std::cmp::Reverse(row.damage));
                            rows.truncate(500);
                            rows
                        })
                        .unwrap_or_default(),
                    damage_taken_complete: !partial_taken.contains(&id)
                        && self
                            .completed
                            .as_ref()
                            .map(|completed| completed.capture_complete)
                            .unwrap_or(
                                self.diagnostics.stream_gaps == self.encounter_gaps_at_start
                                    && !self.diagnostics.truncated_encounter,
                            ),
                    unclassified_player_target_amount: unclassified
                        .get(&id)
                        .map_or(0, |counter| counter.0),
                    unclassified_player_target_events: unclassified
                        .get(&id)
                        .map_or(0, |counter| counter.1),
                    ..Default::default()
                }
            })
            .collect();
        // An unclassified amount aimed at a player does not prove its source
        // was another player. Keep the uncertainty in encounter diagnostics,
        // without manufacturing a zero-DPS anonymous participant. Confirmed
        // support players and explicitly selected current members remain.
        player_rows
            .retain(|row| row.damage > 0 || row.identity_confirmed || row.is_local || row.in_party);
        player_rows.sort_by_key(|row| std::cmp::Reverse(row.damage));
        let mut record = Encounter {
            spatial: spatial::Snapshot::default(),
            id: self.encounter_id,
            started_ms: self.started.unwrap_or(0),
            ended_ms: self.last_hit,
            total_damage: total,
            players: player_rows,
            targets: targets.into_values().collect(),
            source: "captured".into(),
            actor_scope: "observed".into(),
            local_player_id: local,
            local_player_name: local
                .map(|id| self.display_name(id, identities.get(&id)))
                .unwrap_or_default(),
            local_identity_source: identity_source.into(),
            personal_total_damage: local.map(|_| personal_damage),
            personal_targets: personal_targets.into_values().collect(),
            party_member_ids: party,
            party_membership_source: party_source.into(),
            party_total_damage: (party_source != "unresolved").then_some(party_damage),
            party_targets: party_targets.into_values().collect(),
            personal_damage_taken: local.map(|id| {
                taken
                    .get(&id)
                    .map(|skills| {
                        skills
                            .values()
                            .map(|row| row.damage)
                            .fold(0, u64::saturating_add)
                    })
                    .unwrap_or(0)
            }),
            personal_damage_taken_complete: local.is_some_and(|id| !partial_taken.contains(&id))
                && self
                    .completed
                    .as_ref()
                    .map(|completed| completed.capture_complete)
                    .unwrap_or(
                        self.diagnostics.stream_gaps == self.encounter_gaps_at_start
                            && !self.diagnostics.truncated_encounter,
                    ),
            unclassified_player_target_amount: unclassified
                .values()
                .map(|counter| counter.0)
                .fold(0, u64::saturating_add),
            unclassified_player_target_events: unclassified
                .values()
                .map(|counter| counter.1)
                .fold(0, u64::saturating_add),
            ..Default::default()
        };
        self.populate_target_boards(&mut record, &target_contributors, identities);
        if let Some(completed) = &self.completed {
            record.id = completed.record.id;
            record.started_ms = completed.record.started_ms;
            record.ended_ms = completed.record.ended_ms
        }
        record.context = self
            .completed
            .as_ref()
            .map(|value| value.record.context.clone())
            .unwrap_or_else(|| self.current_context.clone());
        record
    }
    fn populate_target_boards(
        &self,
        record: &mut Encounter,
        contributions: &BTreeMap<u64, BTreeMap<u64, u64>>,
        identities: &HashMap<u64, Identity>,
    ) {
        let pairs = self
            .completed
            .as_ref()
            .map(|value| &value.pair_activity)
            .unwrap_or(&self.pair_activity);
        let focus = record.local_player_id.and_then(|local| {
            pairs
                .iter()
                .filter(|((source, target), span)| {
                    Self::owner_in(identities, *source) == local
                        && pve_pair(identities, *source, *target, Some(local))
                        && span.last_focus_epoch == self.focus_epoch
                })
                .max_by_key(|((_, target), span)| (span.last, std::cmp::Reverse(*target)))
                .map(|((_, target), _)| *target)
        });
        let mut priority: Vec<_> = record.targets.iter().collect();
        priority.sort_by_key(|target| {
            (
                Some(target.id) != focus,
                !target.is_boss,
                std::cmp::Reverse(target.damage),
                target.id,
            )
        });
        let board_ids: std::collections::BTreeSet<_> = priority
            .into_iter()
            .take(64)
            .map(|target| target.id)
            .collect();
        let metadata: BTreeMap<_, _> = record
            .players
            .iter()
            .map(|player| (player.id, player))
            .collect();
        let local = record.local_player_id;
        let party: std::collections::BTreeSet<_> =
            record.party_member_ids.iter().copied().collect();
        let party_known = record.party_membership_source != "unresolved";
        let capture_complete = self
            .completed
            .as_ref()
            .map(|value| value.capture_complete)
            .unwrap_or(
                self.diagnostics.stream_gaps == self.encounter_gaps_at_start
                    && !self.diagnostics.truncated_encounter,
            );
        let participant = |id: u64, damage: u64, total: u64| {
            let player = metadata.get(&id);
            TargetParticipant {
                id,
                name: player
                    .map(|row| row.name.clone())
                    .unwrap_or_else(|| self.display_name(id, identities.get(&id))),
                class_name: player
                    .map(|row| row.class_name.clone())
                    .unwrap_or_else(|| "Unknown".into()),
                damage,
                dps: 0.0,
                share: if total == 0 {
                    0.0
                } else {
                    damage as f64 / total as f64 * 100.0
                },
                identity_confirmed: identities.get(&id).is_some_and(|row| row.player),
                is_local: local == Some(id),
                in_party: party.contains(&id),
            }
        };
        for target in &mut record.targets {
            let Some(rows) = contributions.get(&target.id) else {
                continue;
            };
            target.participant_count = rows.len();
            target.capture_complete = capture_complete;
            target.party_total_damage = party_known.then(|| {
                rows.iter()
                    .filter(|(id, _)| party.contains(id))
                    .map(|(_, amount)| *amount)
                    .fold(0, u64::saturating_add)
            });
            if let Some((id, amount)) =
                local.and_then(|id| rows.get(&id).map(|amount| (id, *amount)))
            {
                target.own_participant = Some(participant(id, amount, target.damage));
                target.own_rank = Some(
                    1 + rows
                        .iter()
                        .filter(|(other, damage)| {
                            **damage > amount || **damage == amount && **other < id
                        })
                        .count(),
                );
            }
            if board_ids.contains(&target.id) {
                let mut ordered: Vec<_> = rows.iter().collect();
                ordered.sort_by_key(|(id, amount)| (std::cmp::Reverse(**amount), **id));
                target.participants = ordered
                    .into_iter()
                    .take(10)
                    .map(|(id, amount)| participant(*id, *amount, target.damage))
                    .collect();
                target.participants_available = true;
            }
        }
    }
    fn snapshot(&self, now: u64, mode: &str) -> Encounter {
        let mut cache = self.cache.borrow_mut();
        let slot = &mut cache[usize::from(mode == "boss")];
        if slot
            .as_ref()
            .is_none_or(|(revision, _)| *revision != self.revision)
        {
            *slot = Some((self.revision, self.build_totals(mode)))
        }
        let mut record = slot.as_ref().unwrap().1.clone();
        drop(cache);
        record.elapsed_ms = self.duration(now);
        let pairs = self
            .completed
            .as_ref()
            .map(|completed| &completed.pair_activity)
            .unwrap_or(&self.pair_activity);
        let identities = self
            .completed
            .as_ref()
            .map(|completed| &completed.identities)
            .unwrap_or(&self.identities);
        let span_for = |eligible: &dyn Fn(u64, u64) -> bool| {
            let mut activity = None::<SourceActivity>;
            for ((source, target), span) in pairs {
                if eligible(*source, *target) {
                    if let Some(activity) = &mut activity {
                        activity.merge_window(span);
                    } else {
                        activity = Some(*span);
                    }
                }
            }
            let end = if let Some(completed) = &self.completed {
                completed.record.ended_ms
            } else if self.paused {
                self.pause_at.unwrap_or(self.last_hit).min(now)
            } else {
                now
            };
            let paused_ms = self
                .completed
                .as_ref()
                .map(|completed| completed.paused_ms)
                .unwrap_or(self.paused_ms);
            (
                activity.map(|span| span.first),
                activity
                    .map(|span| span.elapsed_until(end, paused_ms))
                    .unwrap_or(0),
            )
        };
        let local = record.local_player_id;
        let bosses = self.report_bosses();
        let outgoing = |source, target| {
            pve_pair(identities, source, target, local)
                && (mode != "boss" || bosses.contains(&target))
        };
        let (first, elapsed) = span_for(&outgoing);
        if let Some(first) = first {
            record.started_ms = first;
            record.elapsed_ms = elapsed;
        }
        let divisor = (record.elapsed_ms as f64 / 1000.0).max(1.0);
        record.dps = record.total_damage as f64 / divisor;
        record.personal_elapsed_ms = record
            .local_player_id
            .map(|id| {
                span_for(&|source, target| {
                    outgoing(source, target) && Self::owner_in(identities, source) == id
                })
                .1
            })
            .unwrap_or(0);
        record.personal_started_ms = record.local_player_id.and_then(|local| {
            span_for(&|source, target| {
                outgoing(source, target) && Self::owner_in(identities, source) == local
            })
            .0
        });
        record.party_elapsed_ms = span_for(&|source, target| {
            outgoing(source, target)
                && record
                    .party_member_ids
                    .contains(&Self::owner_in(identities, source))
        })
        .1;
        record.personal_dps = record
            .personal_total_damage
            .map(|damage| damage as f64 / (record.personal_elapsed_ms as f64 / 1000.0).max(1.0));
        record.party_dps = record
            .party_total_damage
            .map(|damage| damage as f64 / (record.party_elapsed_ms as f64 / 1000.0).max(1.0));
        // Target windows share the first received hit on that target. Building
        // them in one pass avoids scanning all encounter pairs per target.
        let mut target_activity = BTreeMap::<u64, (SourceActivity, Option<u64>)>::new();
        let live_focus = self.completed.is_none() && self.started.is_some();
        for ((source, target), span) in pairs {
            if !outgoing(*source, *target) {
                continue;
            }
            let own_last = (live_focus
                && span.last_focus_epoch == self.focus_epoch
                && local == Some(Self::owner_in(identities, *source))
                && !identities.get(target).is_some_and(|entry| entry.removed))
            .then_some(span.last);
            target_activity
                .entry(*target)
                .and_modify(|row| {
                    row.0.merge_window(span);
                    row.1 = row.1.max(own_last);
                })
                .or_insert((*span, own_last));
        }
        let paused_ms = self
            .completed
            .as_ref()
            .map(|value| value.paused_ms)
            .unwrap_or(self.paused_ms);
        for target in &mut record.targets {
            let Some((activity, own_last)) = target_activity.get(&target.id).copied() else {
                continue;
            };
            let end = if let Some(completed) = &self.completed {
                completed.record.ended_ms
            } else if self.paused {
                self.pause_at.unwrap_or(self.last_hit).min(now)
            } else {
                now
            };
            target.started_ms = Some(activity.first);
            target.elapsed_ms = activity.elapsed_until(end, paused_ms);
            target.last_hit_ms = Some(activity.last);
            target.own_last_hit_ms = own_last;
            let divisor = (target.elapsed_ms as f64 / 1000.0).max(1.0);
            for player in &mut target.participants {
                player.dps = player.damage as f64 / divisor;
            }
            if let Some(player) = &mut target.own_participant {
                player.dps = player.damage as f64 / divisor;
            }
            target.party_dps = target
                .party_total_damage
                .map(|damage| damage as f64 / divisor);
        }
        let candidates: Vec<_> = record
            .targets
            .iter()
            .filter_map(|target| {
                let at = target.own_last_hit_ms?;
                (now.checked_sub(at).is_some_and(|age| age < IDLE_MS)).then_some((target.id, at))
            })
            .collect();
        let latest = candidates.iter().map(|(_, at)| *at).max();
        let mut newest = candidates.into_iter().filter(|(_, at)| Some(*at) == latest);
        let focused = newest.next().filter(|_| newest.next().is_none());
        record.focused_target_id = focused.map(|(id, _)| id);
        record.focused_target_observed_at_ms = focused.map(|(_, at)| at);
        let incoming_span = |id: u64| {
            span_for(&|source, target| target == id && verified_npc_source(identities, source))
        };
        if let Some(local) = record.local_player_id {
            let (first, elapsed) = incoming_span(local);
            record.personal_damage_taken_started_ms = first;
            record.personal_damage_taken_elapsed_ms = elapsed;
            record.personal_damage_taken_per_second = record
                .personal_damage_taken
                .map(|damage| damage as f64 / (elapsed as f64 / 1000.0).max(1.0));
        }
        self.apply_healing(&mut record);
        for player in &mut record.players {
            player.dps = player.damage as f64 / divisor;
            player.hps = player.healing.map(|amount| amount as f64 / divisor);
            let (first, elapsed) = incoming_span(player.id);
            player.damage_taken_started_ms = first;
            player.damage_taken_elapsed_ms = elapsed;
            player.damage_taken_per_second = player
                .damage_taken
                .map(|damage| damage as f64 / (elapsed as f64 / 1000.0).max(1.0));
        }
        record.network_latency = if let Some(completed) = &self.completed {
            completed
                .record
                .network_latency
                .within(record.started_ms, record.ended_ms)
        } else {
            self.latency.snapshot(record.started_ms, record.ended_ms)
        };
        record.personal_hps = record
            .personal_healing
            .map(|amount| amount as f64 / divisor);
        record
    }
    fn finish(&mut self, now: u64) {
        if self.started.is_none() || self.hit_count == 0 {
            return;
        }
        // A finished encounter that is still on screen belongs to the past: build this record
        // from the current one only.
        let previous = self.completed.take();
        self.bind_orphans();
        // The cached totals were built for the shown result; rebuild them for this encounter.
        self.dirty();
        let mut record = self.snapshot(now, "all");
        record.ended_ms = now;
        record.network_latency = self.latency.snapshot(record.started_ms, now);
        self.attach_samples(&mut record);
        record.timeline = build_timeline(&record);
        record.character_build = self.encounter_build.clone();
        record.assist = self.assistance.snapshot(now);
        record.spatial = self.spatial.snapshot(now, Some((record.started_ms, now)));
        record
            .assist
            .health_history
            .retain(|row| row.observed_at_ms >= record.started_ms && row.observed_at_ms <= now);
        record
            .assist
            .timeline
            .retain(|event| event.at_ms >= record.started_ms && event.at_ms <= now);
        self.observe_boss_record(&record);
        if measured_record(&record) {
            self.history.push_front(record.clone());
            self.trim_history();
            self.bound_history_samples();
            self.history_revision = self.history_revision.wrapping_add(1)
        }
        let mut relevant = std::collections::HashSet::new();
        for (source, target) in self.aggregates.keys() {
            relevant.insert(*source);
            relevant.insert(*target);
            let mut id = *source;
            for _ in 0..8 {
                if let Some(owner) = self.identities.get(&id).and_then(|identity| identity.owner) {
                    relevant.insert(owner);
                    if owner == id {
                        break;
                    }
                    id = owner
                } else {
                    break;
                }
            }
        }
        for sample in &self.healing_samples {
            relevant.insert(sample.source);
            relevant.insert(sample.target);
            relevant.insert(Self::owner_in(&self.identities, sample.source));
        }
        let identities = relevant
            .into_iter()
            .filter_map(|id| {
                self.identities
                    .get(&id)
                    .cloned()
                    .map(|identity| (id, identity))
            })
            .collect();
        // An encounter that dealt no damage (only damage taken or heals) must not replace the
        // shown result of one that did.
        let keep_previous = record.total_damage == 0
            && previous
                .as_ref()
                .is_some_and(|previous| previous.record.total_damage > 0);
        let finished = Completed {
            aggregates: std::mem::take(&mut self.aggregates),
            identities,
            bosses: self.bosses.clone(),
            record,
            pair_activity: std::mem::take(&mut self.pair_activity),
            paused_ms: self.paused_ms,
            generation: self.generation,
            capture_complete: self.diagnostics.stream_gaps == self.encounter_gaps_at_start
                && !self.diagnostics.truncated_encounter,
        };
        self.completed = if keep_previous {
            previous
        } else {
            Some(finished)
        };
        self.started = None;
        self.damage_samples.clear();
        self.healing_samples.clear();
        self.healing_sample_complete = true;
        self.sample_complete = true;
        self.hit_count = 0;
        self.alive_targets.clear();
        self.pause_at = None;
        self.paused_ms = 0;
        self.encounter_id += 1;
        self.dirty();
    }
    fn state_inner(&self, now: u64, with_history: bool) -> MeterState {
        let current = self.snapshot(now, &self.target_mode);
        // A category filter must not hide the actual target being attacked.
        // Keep its observed board separate from filtered report totals.
        let unfiltered = (self.target_mode == "boss").then(|| self.snapshot(now, "all"));
        let live_view = unfiltered.as_ref().unwrap_or(&current);
        let all_targets_summary = AllTargetsSummary::from(live_view);
        let encounter_started_ms =
            (self.started.is_some() || self.completed.is_some()).then_some(live_view.started_ms);
        let focused_target_id = live_view.focused_target_id;
        let focused_target_observed_at_ms = live_view.focused_target_observed_at_ms;
        let live_target = focused_target_id.and_then(|id| {
            live_view
                .targets
                .iter()
                .find(|target| target.id == id)
                .cloned()
        });
        let mut observed_targets: Vec<_> = live_view
            .targets
            .iter()
            .filter(|target| {
                target.participants_available && (target.is_boss || target.participant_count >= 2)
            })
            .cloned()
            .collect();
        observed_targets.sort_by_key(|target| {
            (
                Some(target.id) != focused_target_id,
                !target.is_boss,
                std::cmp::Reverse(target.last_hit_ms.unwrap_or(0)),
                std::cmp::Reverse(target.damage),
                target.id,
            )
        });
        observed_targets.truncate(100);
        let mut assist = self.assistance.live_snapshot(now);
        assist.casts.sort_by_key(|cast| {
            (
                !self.bosses.contains(&cast.actor_id),
                current.local_player_id != Some(cast.target_id),
                std::cmp::Reverse(cast.started_ms),
            )
        });
        assist.effects.sort_by_key(|effect| {
            (
                current.local_player_id != Some(effect.recipient_id),
                !current.party_member_ids.contains(&effect.recipient_id),
                std::cmp::Reverse(effect.started_ms),
            )
        });
        assist.retention_limited |= assist.casts.len() > 8 || assist.effects.len() > 64;
        assist.stagger.sort_by_key(|row| {
            (
                !self.bosses.contains(&row.actor_id),
                !row.fresh,
                std::cmp::Reverse(row.observed_at_ms),
            )
        });
        assist.retention_limited |= assist.stagger.len() > 8;
        assist.casts.truncate(8);
        assist.effects.truncate(64);
        assist.stagger.truncate(8);
        let cooldown_state = self.cooldowns.snapshot(now);
        let live_team_identity = self.live_team_identity();
        let live_local_id = live_team_identity["local"]["actor_id"].as_u64();
        let live_party_ids: std::collections::BTreeSet<_> = live_team_identity["party_member_ids"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(serde_json::Value::as_u64)
            .collect();
        let server_party = live_team_identity["party_membership_source"] == "server";
        // Filter before any transport/UI row bound. Nearby strangers must not
        // crowd current confirmed allies out of the automatic team board.
        let mut actor_cooldowns: Vec<_> = cooldown_state
            .actors
            .iter()
            .filter(|row| {
                live_local_id == Some(row.actor_id)
                    || server_party && live_party_ids.contains(&row.actor_id)
            })
            .cloned()
            .collect();
        actor_cooldowns.sort_by_key(|row| {
            (
                live_local_id != Some(row.actor_id),
                row.actor_id,
                row.skill_id,
            )
        });
        let direct_families: std::collections::BTreeSet<_> = cooldown_state
            .actors
            .iter()
            .filter(|row| self.own_id == Some(row.actor_id))
            .map(|row| row.skill_family_id)
            .collect();
        let mut cooldowns: Vec<_> = cooldown_state
            .own
            .iter()
            .filter(|row| !direct_families.contains(&cooldowns::skill_family(row.skill_id)))
            .filter_map(|row| serde_json::to_value(row).ok())
            .collect();
        cooldowns.extend(
            cooldown_state
                .actors
                .iter()
                .filter(|row| self.own_id == Some(row.actor_id))
                .filter_map(|row| serde_json::to_value(row).ok()),
        );
        cooldowns.sort_by_key(|row| row["skill_id"].as_u64().unwrap_or(0));
        MeterState {
            spatial: self.spatial.snapshot(now, None),
            pet_collection_owner: self.pet_collection_owner(),
            encounter_started_ms,
            focused_target_id,
            focused_target_observed_at_ms,
            live_target,
            recent_personal_target: self.recent_personal_target(now),
            status: if self.paused {
                "paused"
            } else if self.diagnostics.stream_gaps > 0 {
                "capture-gap"
            } else if self.completed.is_some() {
                "completed"
            } else if self.started.is_some() {
                "combat"
            } else if self.last_seen > 0 {
                "traffic"
            } else {
                "waiting"
            }
            .into(),
            elapsed_ms: current.elapsed_ms,
            total_damage: current.total_damage,
            dps: current.dps,
            paused: self.paused,
            players: current.players,
            targets: current.targets,
            observed_targets,
            all_targets_summary,
            history: if with_history {
                self.history.iter().take(30).cloned().collect()
            } else {
                Vec::new()
            },
            cooldowns,
            observed_casts: cooldown_state.casts,
            actor_cooldowns,
            resources: self.resources.snapshot(now),
            diagnostics: self.diagnostics.clone(),
            target_mode: self.target_mode.clone(),
            history_revision: self.history_revision,
            history_count: self.history.len(),
            encounter_active: self.started.is_some()
                && self.completed.is_none()
                && !self.paused
                && now.saturating_sub(self.last_hit) < IDLE_MS,
            local_player_id: current.local_player_id,
            local_player_name: current.local_player_name,
            local_identity_source: current.local_identity_source,
            personal_total_damage: current.personal_total_damage,
            personal_dps: current.personal_dps,
            personal_elapsed_ms: current.personal_elapsed_ms,
            personal_started_ms: current.personal_started_ms,
            personal_targets: current.personal_targets,
            party_member_ids: current.party_member_ids,
            party_member_names: self.party_names.clone().unwrap_or_default(),
            party_membership_source: current.party_membership_source,
            party_identity_roster: self.party_identity_roster(),
            live_team_identity,
            party_total_damage: current.party_total_damage,
            party_dps: current.party_dps,
            party_elapsed_ms: current.party_elapsed_ms,
            party_targets: current.party_targets,
            training: self.training_snapshot(now),
            assist,
            field_boss_revision: self.field_boss_revision,
            field_boss_available: self.field_boss_available,
            character_revision: self.character_revision,
            character_available: self.character.own_available(),
            personal_healing: current.personal_healing,
            personal_hps: current.personal_hps,
            personal_damage_taken: current.personal_damage_taken,
            personal_damage_taken_per_second: current.personal_damage_taken_per_second,
            personal_damage_taken_elapsed_ms: current.personal_damage_taken_elapsed_ms,
            personal_damage_taken_started_ms: current.personal_damage_taken_started_ms,
            personal_damage_taken_complete: current.personal_damage_taken_complete,
            unclassified_player_target_amount: current.unclassified_player_target_amount,
            unclassified_player_target_events: current.unclassified_player_target_events,
        }
    }
    pub fn state(&self, now: u64) -> MeterState {
        self.state_inner(now, true)
    }
    pub fn live_state(&self, now: u64) -> MeterState {
        self.state_inner(now, false)
    }
    pub fn history_snapshot(&self) -> (u64, Vec<Encounter>) {
        (
            self.history_revision,
            self.history.iter().cloned().collect(),
        )
    }
    /// Hidden Cubes the game has announced within its send radius, nearest first.
    pub fn cube_radar(&self, now: u64) -> cube::Radar {
        self.cubes.radar(now)
    }
    /// Cube templates learned from opening one with a key; the desktop keeps them between runs.
    pub fn cube_templates(&self) -> Vec<u32> {
        self.cubes.learned()
    }
    pub fn learn_cube_templates(&mut self, templates: impl IntoIterator<Item = u32>) {
        self.cubes.learn(templates)
    }
    pub fn history_revision(&self) -> u64 {
        self.history_revision
    }
    /// Removes only imported reports after an explicit user action. Captured
    /// encounters and session identities are retained unchanged.
    pub fn clear_imported_history(&mut self) -> usize {
        let before = self.history.len();
        self.history.retain(|record| record.source != "imported");
        let removed = before - self.history.len();
        if removed > 0 {
            self.history_revision = self.history_revision.wrapping_add(1);
            self.dirty();
        }
        removed
    }
    /// Restore local encounter history without restoring any session entity
    /// identity or affecting current combat. Malformed/oversized rows are
    /// skipped; persisted ids remain collision-free for subsequent records.
    pub fn restore_history(&mut self, history: &[Encounter]) {
        let mut seen = std::collections::HashSet::new();
        self.history = history
            .iter()
            .filter(|record| {
                record.id > 0
                    && record.id <= u64::MAX - 1000
                    && measured_record(record)
                    && record.ended_ms >= record.started_ms
                    && record.players.len() <= 4096
                    && record.targets.len() <= 4096
                    && record.damage_samples.len() <= MAX_SAMPLES
                    && record
                        .players
                        .iter()
                        .all(|player| player.skills.len() <= 4096)
                    && record.dps.is_finite()
                    && record_details_bounded(record)
                    && seen.insert(record.id)
            })
            .take(200)
            .cloned()
            .collect();
        self.encounter_id = self.encounter_id.max(
            self.history
                .iter()
                .map(|record| record.id)
                .max()
                .unwrap_or(0)
                .saturating_add(1),
        );
        self.bound_history_samples();
        self.history_revision = self.history_revision.wrapping_add(1);
    }
    pub fn merge_history(&mut self, records: &[Encounter]) -> Result<usize, String> {
        if records.is_empty()
            || records.len() > 200
            || records.iter().any(|record| {
                !measured_record(record)
                    || record.ended_ms < record.started_ms
                    || !record.dps.is_finite()
                    || !record_details_bounded(record)
                    || record.players.len() > 4096
                    || record.targets.len() > 4096
                    || record.damage_samples.len() > MAX_SAMPLES
                    || record.players.iter().any(|player| {
                        player.skills.len() > 4096
                            || !player.dps.is_finite()
                            || !player.share.is_finite()
                    })
            })
        {
            return Err("Karşılaşma belgesi geçersiz veya desteklenen sınırı aşıyor.".into());
        }
        for imported in records.iter().rev() {
            let mut record = imported.clone();
            record.id = self.encounter_id.saturating_add(1);
            self.encounter_id = record.id.saturating_add(1);
            record.source = "imported".into();
            record.context.source = "imported".into();
            if let Some(build) = &mut record.character_build {
                build.source = "imported".into();
                if let Some(power) = &mut build.combat_power {
                    power.source = "imported".into();
                }
                if let Some(wing) = &mut build.wing {
                    wing.source = "imported".into();
                }
            }
            if !["personal", "party", "observed"].contains(&record.actor_scope.as_str()) {
                record.actor_scope = "observed".into();
            }
            self.history.push_front(record);
        }
        self.trim_history();
        self.bound_history_samples();
        self.history_revision = self.history_revision.wrapping_add(1);
        Ok(records.len())
    }
    pub fn current_record(&self, now: u64) -> Encounter {
        let mut record = self.snapshot(now, &self.target_mode);
        record.spatial = self
            .completed
            .as_ref()
            .map(|c| c.record.spatial.clone())
            .unwrap_or_else(|| {
                self.spatial
                    .snapshot(record.ended_ms, Some((record.started_ms, record.ended_ms)))
            });
        self.attach_samples(&mut record);
        record.character_build = if let Some(completed) = &self.completed {
            completed.record.character_build.clone()
        } else {
            self.encounter_build.clone()
        };
        record.assist = if let Some(completed) = &self.completed {
            completed.record.assist.clone()
        } else {
            self.assistance.snapshot(now)
        };
        if self.completed.is_none() {
            record
                .assist
                .timeline
                .retain(|event| event.at_ms >= record.started_ms && event.at_ms <= now);
        }
        record
            .assist
            .health_history
            .retain(|row| (record.started_ms..=record.ended_ms).contains(&row.observed_at_ms));
        if self.target_mode == "boss" {
            let bosses = self.report_bosses();
            record
                .damage_samples
                .retain(|sample| bosses.contains(&sample.target))
        }
        record
    }

    pub fn observe_latency(&mut self, sample: latency::Sample, now: u64) -> bool {
        self.latency.observe(sample, now)
    }
    pub fn assistance_snapshot(&self, now: u64) -> assistance::AssistSnapshot {
        self.assistance.snapshot(now)
    }
    pub fn field_boss_snapshot(&self) -> field_boss::FieldBossSnapshot {
        self.field_bosses.snapshot()
    }
    pub fn character_snapshot(&self) -> character::CharacterSnapshot {
        let mut snapshot = self.character.snapshot();
        snapshot.pet_collection_owner = self.pet_collection_owner();
        snapshot
    }
    pub fn character_revision(&self) -> u64 {
        self.character_revision
    }
    fn pet_collection_owner(&self) -> Option<character::PetCollectionOwner> {
        let actor_id = self.own_id?;
        let identity = self.identities.get(&actor_id)?;
        let name = identity.name.as_deref()?;
        // Death/despawn invalidates live combat presence, not the receiving
        // character's collection. Only a current server-self binding qualifies.
        if !identity.player
            || identity.npc
            || identity.pet
            || !self.character.matches_server_self(actor_id, name)
        {
            return None;
        }
        Some(character::PetCollectionOwner {
            actor_id,
            source: "server-self".into(),
            generation: self.collection_generation,
        })
    }
    pub fn resources_snapshot(&self, now: u64) -> resources::ResourceSnapshot {
        self.resources.snapshot(now)
    }
    /// Current live bindings are independent of a completed encounter's frozen
    /// damage identities. Manual row/name selections never identify local self.
    pub fn live_team_identity(&self) -> serde_json::Value {
        let local_id = self.own_id.filter(|id| {
            self.identities.get(id).is_some_and(|identity| {
                identity.player
                    && !identity.removed
                    && !identity.npc
                    && !identity.pet
                    && identity.name.is_some()
            })
        });
        let local = local_id.and_then(|actor_id| {
            self.identities.get(&actor_id).map(|identity| {
                serde_json::json!({ "actor_id": actor_id, "name": identity.name,
                "class_name": identity.class, "identity_source": "server" })
            })
        });
        let (mut party_member_ids, mut source) = self.party_in(&self.identities, local_id);
        if source == "server" && !self.party_sync_confirmed {
            party_member_ids.clear();
            source = "unresolved";
        }
        party_member_ids.retain(|id| {
            self.identities.get(id).is_some_and(|identity| {
                identity.player && !identity.removed && !identity.npc && !identity.pet
            })
        });
        serde_json::json!({ "local": local, "party_member_ids": party_member_ids,
            "party_membership_source": source })
    }
    pub fn party_identity_roster(&self) -> serde_json::Value {
        let members: Vec<_> = self
            .party_names
            .as_ref()
            .filter(|_| self.party_sync_confirmed)
            .into_iter()
            .flatten()
            .map(|name| {
                let matches: Vec<_> = self
                    .identities
                    .iter()
                    .filter(|(_, identity)| {
                        !identity.removed && self.party_name_matches(identity, name)
                    })
                    .collect();
                let actor = (matches.len() == 1).then(|| matches[0]);
                let class = actor.and_then(|(_, row)| row.class.as_deref()).or_else(|| {
                    self.party_classes
                        .get(name)
                        .and_then(|class| class_name(*class))
                });
                serde_json::json!({
                    "actor_id": actor.map(|(id, _)| *id), "name": name,
                    "class_name": class, "identity_confirmed": actor.is_some()
                })
            })
            .collect();
        serde_json::json!({
            "source": if self.party_sync_confirmed && self.party_names.is_some() { "server" } else { "unknown" },
            "complete": self.party_sync_confirmed && self.party_snapshot_complete,
            "observation_kind": if self.party_snapshot_complete { "complete" } else { "partial" },
            "members": members
        })
    }
    /// Explicit room-sharing input. Only the server's local-character record
    /// can identify the sender; manual selections and aliases are excluded.
    /// A received roster name can be known before its nearby actor is seen.
    pub fn team_sync_payload(&self, now: u64) -> serde_json::Value {
        let local = self.own_id.and_then(|actor_id| {
            let identity = self.identities.get(&actor_id)?;
            if !identity.player || identity.removed {
                return None;
            }
            Some(serde_json::json!({
                "actor_id": actor_id,
                "name": identity.name.as_deref()?,
                "class_name": identity.class,
                "identity_source": "server"
            }))
        });
        let own = if local.is_some() {
            self.cooldowns.snapshot(now).own
        } else {
            Vec::new()
        };
        serde_json::json!({
            "schema_version": 1,
            "local": local,
            "cooldowns": own,
            "party": self.party_identity_roster()
        })
    }
}

fn clean_alias(name: &str) -> String {
    name.trim()
        .chars()
        .filter(|character| !character.is_control())
        .take(32)
        .collect()
}
fn observed_scope() -> String {
    "observed".into()
}
fn boss_record(record: &Encounter) -> bool {
    record.targets.iter().any(|target| target.is_boss)
}

/// A compact per-second damage series for the whole encounter and each player. Raw samples
/// are dropped from older history to bound memory; this small series keeps the chart.
fn build_timeline(record: &Encounter) -> DamageTimeline {
    let samples = &record.damage_samples;
    let (Some(first), Some(last)) = (
        samples.iter().map(|sample| sample.timestamp_ms).min(),
        samples.iter().map(|sample| sample.timestamp_ms).max(),
    ) else {
        return DamageTimeline::default();
    };
    let start = record.started_ms.min(first);
    let span = last.saturating_sub(start).max(1);
    let interval_ms = span.div_ceil(TIMELINE_BUCKETS).div_ceil(1000).max(1) * 1000;
    let buckets = (span / interval_ms + 1) as usize;
    let mut total = vec![0u64; buckets];
    let mut by_player: BTreeMap<u64, Vec<u64>> = BTreeMap::new();
    for sample in samples {
        let bucket = ((sample.timestamp_ms - start) / interval_ms) as usize;
        total[bucket] = total[bucket].saturating_add(sample.amount);
        let series = by_player
            .entry(sample.player_id)
            .or_insert_with(|| vec![0u64; buckets]);
        series[bucket] = series[bucket].saturating_add(sample.amount);
    }
    let mut players: Vec<TimelinePlayer> = by_player
        .into_iter()
        .map(|(id, damage)| TimelinePlayer { id, damage })
        .collect();
    players.sort_by_key(|player| std::cmp::Reverse(player.damage.iter().sum::<u64>()));
    players.truncate(TIMELINE_PLAYERS);
    DamageTimeline {
        interval_ms,
        started_ms: start,
        total,
        players,
        complete: record.sample_complete,
    }
}

fn measured_record(record: &Encounter) -> bool {
    record.total_damage > 0
        || record.unclassified_player_target_events > 0
        || record
            .personal_damage_taken
            .is_some_and(|amount| amount > 0)
        || record.players.iter().any(|player| {
            player.damage_taken.is_some_and(|amount| amount > 0)
                || player.healing.is_some_and(|amount| amount > 0)
        })
}
fn catalog_boss(identity: &Identity) -> bool {
    identity.npc
        && !identity.player
        && !identity.pet
        && identity.owner.is_none()
        && identity.npc_model_id.is_some_and(npc_catalog::is_boss)
}

fn verified_npc_source(identities: &HashMap<u64, Identity>, source: u64) -> bool {
    identities
        .get(&source)
        .is_some_and(|entry| entry.npc && !entry.player && !entry.pet && entry.owner.is_none())
}
fn pve_pair(
    identities: &HashMap<u64, Identity>,
    source: u64,
    target: u64,
    local: Option<u64>,
) -> bool {
    source != target
        && Some(target) != local
        && !identities.get(&target).is_some_and(|entry| entry.player)
        && !verified_npc_source(identities, source)
}
fn sample_metric(
    identities: &HashMap<u64, Identity>,
    source: u64,
    target: u64,
    local: Option<u64>,
) -> &'static str {
    if identities.get(&target).is_some_and(|entry| entry.player) || Some(target) == local {
        if verified_npc_source(identities, source) {
            "damage-taken"
        } else {
            "unclassified-player-target"
        }
    } else if source == target {
        "unclassified-resource"
    } else if pve_pair(identities, source, target, local) {
        "damage"
    } else {
        "unclassified-resource"
    }
}
fn combine_skill(existing: &mut SkillState, row: &SkillState) {
    existing.hits = existing.hits.saturating_add(row.hits);
    existing.damage = existing.damage.saturating_add(row.damage);
    existing.crit_hits = existing.crit_hits.saturating_add(row.crit_hits);
    existing.direct_hits = existing.direct_hits.saturating_add(row.direct_hits);
    existing.tick_hits = existing.tick_hits.saturating_add(row.tick_hits);
    existing.quality_hits = existing.quality_hits.saturating_add(row.quality_hits);
    existing.min = existing.min.min(row.min);
    existing.max = existing.max.max(row.max);
    for (target, value) in [
        (&mut existing.parry_hits, row.parry_hits),
        (&mut existing.perfect_hits, row.perfect_hits),
        (&mut existing.double_hits, row.double_hits),
        (&mut existing.direction_1_hits, row.direction_1_hits),
        (&mut existing.direction_2_hits, row.direction_2_hits),
    ] {
        if let Some(value) = value {
            *target = Some(target.unwrap_or(0).saturating_add(value));
        }
    }
}
fn record_details_bounded(record: &Encounter) -> bool {
    if !record.spatial.valid(record.started_ms, record.ended_ms) {
        return false;
    }
    let build_valid = record.character_build.as_ref().is_none_or(|build| {
        build.name.len() <= 320
            && build.source.len() <= 64
            && build.equipment.len() <= 64
            && build.skills.len() <= 255
            && build.boards.len() <= 32
            && build.boards.iter().all(|board| board.node_ids.len() <= 255)
            && build.combat_power.as_ref().is_none_or(|row| {
                (1..=100_000_000).contains(&row.current)
                    && (1..=100_000_000).contains(&row.highest)
                    && row.observed_at_ms <= record.ended_ms
                    && ["server-self", "server-self-unbound", "imported"]
                        .contains(&row.source.as_str())
            })
            && build.wing.as_ref().is_none_or(|row| {
                (30_000_000..=30_599_999).contains(&row.wing_id)
                    && !(30_400_000..=30_499_999).contains(&row.wing_id)
                    && row
                        .skin_id
                        .is_none_or(|value| (30_400_000..=30_499_999).contains(&value))
                    && row.observed_at_ms <= record.ended_ms
                    && ["server-self", "server-self-unbound", "imported"]
                        .contains(&row.source.as_str())
            })
            && if build.species.is_empty() {
                build.species_observed_at_ms.is_none()
            } else {
                build.species.len() == 5
                    && build
                        .species_observed_at_ms
                        .is_some_and(|at| at <= record.ended_ms)
                    && build.species.iter().enumerate().all(|(index, row)| {
                        let mut slots = std::collections::HashSet::new();
                        row.species_id == (index + 2) as u8
                            && (1..=99).contains(&row.level)
                            && row.progress <= 9_007_199_254_740_991
                            && row.effects.len() <= 160
                            && row.effects.iter().all(|effect| {
                                (1..=5).contains(&effect.page)
                                    && effect.slot < 32
                                    && effect.stat_id > 0
                                    && effect.value.unsigned_abs() <= 1_000_000_000_000
                                    && slots.insert((effect.page, effect.slot))
                            })
                    })
            }
            && build.equipment.iter().all(|item| {
                item.stones.as_ref().is_none_or(|stones| stones.len() <= 6)
                    && item.stats.as_ref().is_none_or(|stats| stats.len() <= 8)
                    && item
                        .skill_bonuses
                        .as_ref()
                        .is_none_or(|bonuses| bonuses.len() <= 32)
            })
    });
    build_valid
        && record.network_latency.is_valid()
        && record
            .personal_hps
            .is_none_or(|value| value.is_finite() && value >= 0.0)
        && record
            .network_latency
            .samples
            .iter()
            .all(|sample| (record.started_ms..=record.ended_ms).contains(&sample.observed_at_ms))
        && record.healing_samples.len() <= MAX_SAMPLES
        && record.context.source.len() <= 40
        && record.context.session_id.len() <= 128
        && record
            .context
            .map_id
            .is_none_or(|id| (1..=10_000_000).contains(&id))
        && record
            .context
            .zone_observed_at_ms
            .is_none_or(|at| at <= record.ended_ms)
        && record.healing_samples.iter().all(|row| {
            row.metric == "healing"
                && (record.started_ms..=record.ended_ms).contains(&row.timestamp_ms)
                && (1..=u64::from(u32::MAX)).contains(&row.source)
                && (1..=u64::from(u32::MAX)).contains(&row.player_id)
                && (1..=u64::from(u32::MAX)).contains(&row.target)
                && (1..=300_000_000).contains(&row.skill)
                && row.amount <= 2_000_000_000
        })
        && record.assist.health_history.len() <= 512
        && record.assist.health_history.iter().all(|row| {
            (1..=10_000_000).contains(&row.actor_id)
                && (record.started_ms..=record.ended_ms).contains(&row.observed_at_ms)
                && row.current_hp.is_none_or(|hp| hp <= 10_000_000_000_000)
                && row.reported_max_hp.is_none_or(|hp| {
                    hp > 0
                        && hp <= 10_000_000_000_000
                        && row.current_hp.is_none_or(|current| current <= hp)
                })
                && row
                    .observed_peak_hp
                    .is_none_or(|hp| hp <= 10_000_000_000_000)
        })
        && record.received_samples.len() <= MAX_SAMPLES
        && record.assist.casts.len() <= 64
        && record.assist.effects.len() <= 256
        && record.assist.timeline.len() <= 1000
        && record.assist.health.len() <= 256
        && record.assist.stagger.len() <= 64
        && record.assist.stagger.iter().all(|row| {
            row.actor_id > 0
                && row.actor_id <= 10_000_000
                && row.maximum.is_none_or(|maximum| {
                    maximum > 0 && maximum <= 1_000_000 && row.current <= maximum
                })
                && (!row.broken || row.current == 0)
                && row.source.len() <= 40
        })
        && record.local_player_name.len() <= 320
        && record.party_member_ids.len() <= 12
        && record.players.iter().all(|player| {
            player.name.len() <= 512
                && player.class_name.len() <= 128
                && player.skills.iter().all(|skill| skill.name.len() <= 256)
                && player.incoming_skills.len() <= 500
                && player.healing_skills.len() <= 500
                && player
                    .healing_skills
                    .iter()
                    .all(|skill| skill.name.len() <= 256)
                && ["", "explicit-received"].contains(&player.healing_coverage.as_str())
                && player
                    .hps
                    .is_none_or(|value| value.is_finite() && value >= 0.0)
                && player
                    .incoming_skills
                    .iter()
                    .all(|skill| skill.name.len() <= 256)
        })
        && record
            .targets
            .iter()
            .chain(&record.personal_targets)
            .chain(&record.party_targets)
            .filter(|target| target.participants_available || !target.participants.is_empty())
            .take(65)
            .count()
            <= 64
        && record
            .targets
            .iter()
            .chain(&record.personal_targets)
            .chain(&record.party_targets)
            .all(|target| {
                let participant_valid = |row: &TargetParticipant| {
                    (1..=u64::from(u32::MAX)).contains(&row.id)
                        && row.name.len() <= 512
                        && row.class_name.len() <= 128
                        && row.damage <= target.damage
                        && row.dps.is_finite()
                        && row.dps >= 0.0
                        && row.share.is_finite()
                        && (0.0..=100.0).contains(&row.share)
                };
                target.name.len() <= 512
                    && target.participants.len() <= 10
                    && target.participant_count <= MAX_HITS
                    && target.participant_count >= target.participants.len()
                    && target.participants.iter().all(participant_valid)
                    && target
                        .own_participant
                        .as_ref()
                        .is_none_or(participant_valid)
                    && target
                        .own_rank
                        .is_none_or(|rank| rank > 0 && rank <= target.participant_count)
                    && target
                        .party_total_damage
                        .is_none_or(|damage| damage <= target.damage)
                    && target
                        .party_dps
                        .is_none_or(|dps| dps.is_finite() && dps >= 0.0)
                    && target
                        .started_ms
                        .is_none_or(|at| (record.started_ms..=record.ended_ms).contains(&at))
                    && target
                        .last_hit_ms
                        .is_none_or(|at| (record.started_ms..=record.ended_ms).contains(&at))
                    && target
                        .own_last_hit_ms
                        .is_none_or(|at| (record.started_ms..=record.ended_ms).contains(&at))
            })
}

/// The class band of a player skill id (the first two digits of its eight), as the skills of every
/// identified player in the saved history confirm. The shared band 10 is not a class.
fn skill_band(skill: u32) -> Option<u8> {
    ((11..=18).contains(&(skill / 1_000_000))).then_some((skill / 1_000_000) as u8)
}
fn class_band(class: &str) -> Option<u8> {
    Some(match class {
        "Gladiator" => 11,
        "Templar" => 12,
        "Assassin" => 13,
        "Ranger" => 14,
        "Sorcerer" => 15,
        "Spiritmaster" => 16,
        "Cleric" => 17,
        "Chanter" => 18,
        _ => return None,
    })
}
fn class_name(code: u32) -> Option<&'static str> {
    match code {
        5..=8 => Some("Gladiator"),
        9..=12 => Some("Templar"),
        13..=16 => Some("Ranger"),
        17..=20 => Some("Assassin"),
        21..=24 => Some("Spiritmaster"),
        25..=28 => Some("Sorcerer"),
        29..=32 => Some("Cleric"),
        33..=36 => Some("Chanter"),
        37..=40 => Some("Brawler"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn record_fixture() -> MeterEngine {
        let mut engine = MeterEngine::default();
        for id in 1..=3 {
            engine.identities.insert(
                id,
                Identity {
                    player: true,
                    name: Some(format!("Archer{id}")),
                    home_server: Some(1001),
                    class: Some("Ranger".into()),
                    ..Default::default()
                },
            );
        }
        engine.own_id = Some(1);
        engine.identities.insert(
            10,
            Identity {
                npc: true,
                npc_model_id: Some(100),
                name: Some("Test Boss".into()),
                reported_max_hp: Some(1000000),
                ..Default::default()
            },
        );
        engine
    }
    #[test]
    fn records_accept_only_live_self_and_verified_party_at_hit_time() {
        let mut engine = record_fixture();
        engine.ingest_event(hit(1, 10, 10000, false), 1000);
        engine.ingest_event(hit(2, 10, 20000, false), 1001);
        assert_eq!(
            engine
                .take_record_observations()
                .iter()
                .map(|row| row.amount)
                .collect::<Vec<_>>(),
            vec![10000]
        );
        engine.manual_party_ids = Some(vec![2]);
        engine.ingest_event(hit(2, 10, 21000, false), 1002);
        assert!(engine.take_record_observations().is_empty());
        engine.party_names = Some(vec!["Archer2".into()]);
        engine.party_sync_confirmed = true;
        engine.ingest_event(hit(2, 10, 12000, true), 1003);
        engine.ingest_event(hit(3, 10, 30000, false), 1004);
        let rows = engine.take_record_observations();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "Archer2");
        assert!(!rows[0].is_local);
        assert!(rows[0].critical);
        engine.party_names = Some(vec![]);
        engine.ingest_event(hit(2, 10, 90000, false), 1005);
        assert!(engine.take_record_observations().is_empty());
    }
    #[test]
    fn record_queue_coalesces_bursts_ignores_pause_and_credits_confirmed_summons() {
        let mut engine = record_fixture();
        engine.ingest_event(hit(1, 10, 10000, false), 1000);
        engine.ingest_event(hit(1, 10, 12000, false), 1001);
        engine.ingest_event(hit(1, 10, 11000, false), 1002);
        assert_eq!(engine.take_record_observations()[0].amount, 12000);
        assert!(engine.take_record_observations().is_empty());
        engine.identities.insert(
            20,
            Identity {
                pet: true,
                owner: Some(1),
                ..Default::default()
            },
        );
        engine.ingest_event(hit(20, 10, 13000, false), 1003);
        assert_eq!(engine.take_record_observations()[0].actor_id, 1);
        engine.set_paused_at(true, 1004);
        engine.ingest_event(hit(1, 10, 99999, false), 1005);
        assert!(engine.take_record_observations().is_empty());
        engine.set_paused_at(false, 1006);
        engine.identities.get_mut(&1).unwrap().home_server = None;
        engine.ingest_event(hit(1, 10, 99999, false), 1007);
        assert!(engine.take_record_observations().is_empty());
    }
    #[test]
    fn boss_dps_records_require_complete_single_boss_timing_and_comparison_context() {
        let mut engine = record_fixture();
        engine.current_context = EncounterContext {
            source: "server-zone".into(),
            map_id: Some(5),
            ..Default::default()
        };
        engine.set_boss_targets(&[10]);
        for (at, amount) in [(1000, 1000), (6000, 2000), (11000, 3000)] {
            engine.ingest_event(hit(1, 10, amount, false), at);
        }
        engine.take_record_observations();
        engine.reset();
        let rows = engine.take_record_observations();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].metric, "boss-dps");
        assert_eq!(rows[0].amount, 6000);
        assert_eq!(rows[0].elapsed_ms, Some(10000));
        // Losing capture coverage or unknown reported HP cannot create a comparable best.
        for hp in [None, Some(1000000)] {
            engine.identities.get_mut(&10).unwrap().reported_max_hp = hp;
            engine.diagnostics.stream_gaps = u64::from(hp.is_some());
            for at in [20000, 25000, 30000] {
                engine.ingest_event(hit(1, 10, 3000, false), at);
            }
            engine.take_record_observations();
            if hp.is_some() {
                engine.capture_loss();
            }
            engine.reset();
            assert!(engine.take_record_observations().is_empty());
        }
    }
    #[test]
    fn an_earlier_capture_gap_does_not_disqualify_a_later_clean_boss_record() {
        let mut e = record_fixture();
        e.current_context = EncounterContext {
            source: "server-zone".into(),
            map_id: Some(5),
            ..Default::default()
        };
        e.set_boss_targets(&[10]);
        e.ingest_event(hit(1, 10, 1000, false), 1000);
        e.capture_loss();
        e.reset();
        e.take_record_observations();
        for at in [20000, 25000, 30000] {
            e.ingest_event(hit(1, 10, 2000, false), at);
        }
        e.take_record_observations();
        e.reset();
        let best = e.take_record_observations();
        assert_eq!(best.len(), 1);
        assert_eq!(best[0].metric, "boss-dps");
        assert_eq!(best[0].amount, 6000);
        assert_eq!(e.diagnostics.stream_gaps, 1);
    }
    fn hit(source: u64, target: u64, amount: u64, critical: bool) -> Event {
        Event::Damage(Hit {
            source,
            target,
            skill: 14090000,
            amount,
            critical,
            tick: false,
            flags: 0,
            angle: 0,
        })
    }
    fn player(engine: &mut MeterEngine, id: u64) {
        engine.ingest_event(
            Event::Identity {
                id,
                name: format!("Player{id}"),
                class: Some(14),
                own: false,
            },
            0,
        )
    }
    #[test]
    fn sums_percentages_skill_statistics_and_elapsed_time_are_consistent() {
        let mut engine = MeterEngine::default();
        player(&mut engine, 1);
        player(&mut engine, 2);
        engine.ingest_event(hit(1, 10, 100, false), 1000);
        engine.ingest_event(hit(1, 10, 300, true), 2000);
        engine.ingest_event(hit(2, 10, 100, false), 3000);
        let state = engine.state(5000);
        assert_eq!(state.total_damage, 500);
        // The damage clock runs from the first hit to the last, not to the moment of the poll.
        assert_eq!(state.elapsed_ms, 2000);
        assert_eq!(state.dps, 250.0);
        assert_eq!(state.players[0].share, 80.0);
        assert_eq!(state.players[0].skills[0].crit_hits, 1);
        assert_eq!(
            (
                state.players[0].skills[0].min,
                state.players[0].skills[0].max
            ),
            (100, 300)
        );
    }
    #[test]
    fn late_owner_binding_attributes_existing_summon_damage_once() {
        let mut engine = MeterEngine::default();
        player(&mut engine, 1);
        engine.ingest_event(hit(2, 10, 50, false), 0);
        engine.ingest_event(hit(1, 10, 100, false), 1);
        engine.ingest_event(
            Event::Npc {
                id: 2,
                name: None,
                model: 2920620,
                kind: 0x5f,
            },
            1,
        );
        engine.ingest_event(Event::Owner { id: 2, owner: 1 }, 2);
        let state = engine.state(1000);
        assert_eq!(state.players.len(), 1);
        assert_eq!(state.players[0].damage, 150);
    }
    #[test]
    fn boss_selection_is_explicit_and_does_not_invent_a_wire_boss_flag() {
        let mut engine = MeterEngine::default();
        engine.ingest_event(hit(1, 10, 100, false), 0);
        engine.ingest_event(hit(1, 11, 200, false), 1);
        engine.set_target_mode("boss");
        assert_eq!(engine.state(1000).total_damage, 0);
        engine.set_boss_targets(&[11]);
        assert_eq!(engine.state(1000).total_damage, 200);
        engine.set_target_mode("all");
        assert_eq!(engine.state(1000).total_damage, 300);
    }
    #[test]
    fn pause_excludes_damage_and_paused_duration() {
        let mut engine = MeterEngine::default();
        engine.ingest_event(hit(1, 10, 100, false), 1000);
        engine.ingest_event(hit(1, 10, 100, false), 2000);
        engine.set_paused_at(true, 2500);
        engine.ingest_event(hit(1, 10, 1000, false), 3000);
        assert_eq!(engine.state(4000).total_damage, 200);
        assert_eq!(engine.state(4000).elapsed_ms, 1000);
        engine.set_paused_at(false, 5000);
        engine.ingest_event(hit(1, 10, 100, false), 6000);
        // First hit at 1000, last at 6000, less the 2500 ms spent paused in between.
        assert_eq!(engine.state(7000).elapsed_ms, 2500);
    }
    #[test]
    fn reset_saves_a_bounded_encounter_and_clears_the_current_meter() {
        let mut engine = MeterEngine::default();
        engine.ingest_event(hit(1, 10, 123, false), 1000);
        engine.ingest_event(hit(1, 10, 77, true), 2000);
        engine.reset();
        let state = engine.state(5000);
        assert_eq!(state.total_damage, 0);
        assert_eq!(state.history.len(), 1);
        assert_eq!(state.history[0].total_damage, 200);
        assert_eq!(state.history[0].elapsed_ms, 1000);
    }
    #[test]
    fn cooldowns_need_local_identity_and_are_invalidated_on_capture_loss() {
        let mut engine = MeterEngine::default();
        let update = Event::Cooldown {
            skill: 13130000,
            remaining_units: Some(6450),
            charges: None,
        };
        engine.ingest_event(update.clone(), 1000);
        assert!(engine.state(2000).cooldowns.is_empty());
        engine.ingest_event(
            Event::Identity {
                id: 1,
                name: "Local".into(),
                class: Some(14),
                own: true,
            },
            1000,
        );
        engine.ingest_event(update, 1000);
        assert_eq!(engine.state(2000).cooldowns[0]["raw_remaining_units"], 6450);
        assert!(engine.state(2000).cooldowns[0]["estimated_remaining_ms"].is_null());
        engine.capture_loss();
        assert!(engine.state(2000).cooldowns.is_empty());
        assert_eq!(engine.state(2000).diagnostics.stream_gaps, 1);
    }
}
