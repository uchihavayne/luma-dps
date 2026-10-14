pub mod assistance;
pub mod character;
pub mod field_boss;
pub mod framing;
pub mod net;
pub mod packets;

use packets::Event;
#[cfg(test)]
use packets::Hit;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap, VecDeque};

const IDLE_MS: u64 = 10_000;
const MAX_HITS: usize = 250_000;
const MAX_SAMPLES: usize = 20_000;
const MAX_HISTORY_SAMPLES: usize = 100_000;

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
pub struct TargetState {
    pub id: u64,
    pub name: String,
    pub is_boss: bool,
    pub damage: u64,
    pub current_hp: Option<u64>,
    pub observed_peak_hp: Option<u64>,
    pub reported_max_hp: Option<u64>,
    pub health_observed_at_ms: Option<u64>,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Encounter {
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
pub struct Diagnostics {
    pub tcp_packets: u64,
    pub frames: u64,
    pub damage_events: u64,
    pub rejected_frames: u64,
    pub stream_gaps: u64,
    pub truncated_encounter: bool,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct MeterState {
    pub status: String,
    pub elapsed_ms: u64,
    pub total_damage: u64,
    pub dps: f64,
    pub paused: bool,
    pub players: Vec<PlayerState>,
    pub targets: Vec<TargetState>,
    pub history: Vec<Encounter>,
    pub cooldowns: Vec<serde_json::Value>,
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
    name: Option<String>,
    class: Option<String>,
    player: bool,
    npc: bool,
    pet: bool,
    owner: Option<u64>,
    hp: Option<u64>,
    peak_hp: Option<u64>,
    reported_max_hp: Option<u64>,
    health_observed_at_ms: Option<u64>,
}
struct Cooldown {
    expires: Option<u64>,
    charges: Option<u32>,
}

type Aggregate = BTreeMap<(u64, u64), BTreeMap<u32, SkillState>>;
struct Completed {
    aggregates: Aggregate,
    identities: HashMap<u64, Identity>,
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
}
#[derive(Default)]
struct StreamPrefix {
    bytes: Vec<u8>,
    decided: bool,
    tls: bool,
}

pub struct MeterEngine {
    streams: net::StreamSet,
    frames: framing::FrameStreams,
    prefixes: HashMap<net::Connection, StreamPrefix>,
    identities: HashMap<u64, Identity>,
    own_id: Option<u64>,
    manual_own_id: Option<u64>,
    character_name: String,
    alias_bound_id: Option<u64>,
    party_names: Option<Vec<String>>,
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
    character_revision: u64,
    encounter_build: Option<character::CharacterBuild>,
    encounter_build_taken: bool,
    bosses: Vec<u64>,
    cooldowns: BTreeMap<u32, Cooldown>,
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
    cache: RefCell<Option<(u64, String, Encounter)>>,
}
impl Default for MeterEngine {
    fn default() -> Self {
        Self {
            streams: Default::default(),
            frames: Default::default(),
            prefixes: HashMap::new(),
            identities: HashMap::new(),
            own_id: None,
            manual_own_id: None,
            character_name: String::new(),
            alias_bound_id: None,
            party_names: None,
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
            character_revision: 0,
            encounter_build: None,
            encounter_build_taken: false,
            bosses: Vec::new(),
            cooldowns: BTreeMap::new(),
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
            cache: RefCell::new(None),
        }
    }
}
impl MeterEngine {
    fn dirty(&mut self) {
        self.revision = self.revision.wrapping_add(1);
        self.cache.get_mut().take();
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
        self.diagnostics.tcp_packets = self.diagnostics.tcp_packets.saturating_add(1);
        self.last_seen = now;
        let previous_gaps = self.streams.gaps;
        let chunk = self.streams.push(&segment, now);
        if segment.syn || segment.reset || self.streams.gaps != previous_gaps {
            self.frames.discard(&segment.connection);
            self.prefixes.remove(&segment.connection);
            self.cooldowns.clear();
            if segment.syn {
                self.frames.mark_start(&segment.connection)
            }
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
                match packets::decode(&payload) {
                    Ok(Some(event)) => self.ingest_event(event, now),
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
                self.alias_bound_id = None
            }
            if let Some(ids) = &mut self.manual_party_ids {
                ids.retain(|value| *value != id)
            }
        }
    }
    pub fn ingest_event(&mut self, event: Event, now: u64) {
        match event {
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
                if let assistance::AssistEvent::Health {
                    actor_id,
                    current_hp,
                    reported_max_hp,
                } = &event
                {
                    let entry = self.identities.entry(*actor_id).or_default();
                    entry.health_observed_at_ms = Some(now);
                    if let Some(current) = current_hp {
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
                    self.cooldowns.clear();
                    self.manual_own_id = None;
                    self.manual_party_ids = None;
                    self.party_names = None;
                    self.party_classes.clear();
                    self.alias_bound_id = None;
                    self.character_name.clear();
                    self.completed = None;
                    self.assistance.clear();
                    self.field_bosses.clear();
                    self.field_boss_available = false;
                    self.field_boss_revision = self.field_boss_revision.wrapping_add(1);
                    self.bosses.clear();
                    self.character.clear();
                    self.encounter_build = None;
                    self.encounter_build_taken = false;
                    self.character_revision = self.character_revision.wrapping_add(1);
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
                    self.character.bind_self(id, &name, None, now);
                    self.character_revision = self.character_revision.wrapping_add(1);
                    if self.manual_own_id.is_some_and(|selected| selected != id) {
                        self.manual_own_id = None;
                        self.alias_bound_id = None;
                    }
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
                if let Some(completed) = &mut self.completed {
                    if completed.generation == self.generation {
                        completed.identities.insert(id, identity.clone());
                    }
                }
                self.dirty();
            }
            Event::Npc {
                id,
                name,
                model: _,
                kind,
            } => {
                if self.identities.get(&id).is_some_and(|entry| entry.player)
                    && self
                        .aggregates
                        .keys()
                        .any(|(source, target)| *source == id || *target == id)
                {
                    self.finish(now);
                }
                self.prepare_entity(id, now);
                let entry = self.identities.entry(id).or_default();
                entry.player = false;
                entry.npc = matches!(kind, 0x0c | 0x0d | 0x1c);
                entry.pet = kind == 0x5f;
                if !entry.pet {
                    entry.owner = None
                }
                if entry.pet {
                    entry.owner = self.pending_owners.remove(&id).or(entry.owner)
                }
                entry.removed = false;
                if let Some(name) = name {
                    entry.name = Some(name)
                }
                if entry.npc || entry.pet {
                    if self.own_id == Some(id) {
                        self.own_id = None;
                        self.alias_bound_id = None;
                        self.cancel_training()
                    }
                    if self.manual_own_id == Some(id) {
                        self.manual_own_id = None;
                        self.alias_bound_id = None;
                        self.cancel_training()
                    }
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
                self.party_names = Some(names.into_iter().take(12).collect());
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
            Event::Cooldown {
                skill,
                remaining_ms,
                charges,
            } => {
                if self.local_in(&self.identities).0.is_some() {
                    self.cooldowns.insert(
                        skill,
                        Cooldown {
                            expires: remaining_ms
                                .map(|duration| now.saturating_add(u64::from(duration))),
                            charges,
                        },
                    );
                }
            }
            Event::Health { id, current } => {
                let entry = self.identities.entry(id).or_default();
                entry.health_observed_at_ms = Some(now);
                entry.hp = Some(current);
                entry.peak_hp = Some(entry.peak_hp.unwrap_or(0).max(current));
                self.dirty();
            }
            Event::Removed { id, death } => {
                // Keep attribution until the encounter ends; an entity leaving
                // the scene does not change damage it already dealt.
                self.identities.entry(id).or_default().removed = true;
                // A death/despawn keeps existing attribution. A later spawn
                // reusing this id, or a connection change, invalidates it.
                if death && self.alive_targets.remove(&id) {
                    let boss_ended = self.bosses.contains(&id)
                        && !self
                            .alive_targets
                            .iter()
                            .any(|target| self.bosses.contains(target));
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
                self.training_hit(&hit, now);
                if self.started.is_some() && now.saturating_sub(self.last_hit) >= IDLE_MS {
                    self.finish(self.last_hit.saturating_add(IDLE_MS))
                }
                if self.started.is_none() {
                    self.completed = None;
                    self.damage_samples.clear();
                    self.sample_complete = true;
                    self.encounter_build = None;
                    self.encounter_build_taken = false;
                    self.started = Some(now);
                    self.paused_ms = 0;
                    self.diagnostics.truncated_encounter = false;
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
                        .and_modify(|span| span.last = now)
                        .or_insert(SourceActivity {
                            first: now,
                            last: now,
                            paused_at_start: self.paused_ms,
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
        if !self.paused && self.started.is_some() && now.saturating_sub(self.last_hit) >= IDLE_MS {
            self.finish(self.last_hit.saturating_add(IDLE_MS))
        }
    }
    pub fn connection_changed(&mut self) {
        self.finish(self.last_hit);
        self.streams = Default::default();
        self.frames = Default::default();
        self.prefixes.clear();
        self.identities.clear();
        self.cooldowns.clear();
        self.own_id = None;
        self.generation = self.generation.wrapping_add(1);
        self.pending_owners.clear();
        self.bosses.clear();
        self.assistance.clear();
        self.field_bosses.clear();
        self.field_boss_available = false;
        self.field_boss_revision = self.field_boss_revision.wrapping_add(1);
        self.cancel_training();
        self.character.clear();
        self.character_revision = self.character_revision.wrapping_add(1);
        self.encounter_build = None;
        self.encounter_build_taken = false;
        self.manual_own_id = None;
        self.alias_bound_id = None;
        self.party_names = None;
        self.party_classes.clear();
        self.manual_party_ids = None;
        self.last_seen = 0;
        self.diagnostics = Default::default();
        self.dirty();
    }
    pub fn capture_loss(&mut self) {
        self.streams.invalidate();
        self.frames = Default::default();
        // A loss does not create a new TCP generation. Keep established TLS/game
        // classification, while discarding incomplete classifier prefix bytes.
        self.prefixes.retain(|_, prefix| prefix.decided);
        self.cooldowns.clear();
        self.character.clear();
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
        self.dirty();
    }
    pub fn reset(&mut self) {
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
                    .filter(|(_, identity)| {
                        identity.player && identity.name.as_deref() == Some(name.as_str())
                    })
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
            self.cancel_training()
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
        self.character_name = name;
        self.alias_bound_id = self.manual_own_id;
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
        if ![60_000, 120_000, 180_000, 300_000].contains(&duration_ms) {
            return Err("Antrenman süresi 60, 120, 180 veya 300 saniye olmalı.".into());
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
            if record
                .damage_samples
                .iter()
                .any(|sample| sample.metric.starts_with("unclassified"))
            {
                record.sample_complete = false;
            }
            record
                .damage_samples
                .retain(|sample| sample.metric == "damage");
        }
    }
    fn bound_history_samples(&mut self) {
        let mut remaining = MAX_HISTORY_SAMPLES;
        for record in &mut self.history {
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
        }
    }
    fn duration(&self, now: u64) -> u64 {
        if let Some(completed) = &self.completed {
            return completed.record.elapsed_ms;
        }
        let Some(start) = self.started else { return 0 };
        let end = if self.paused {
            self.pause_at.unwrap_or(self.last_hit)
        } else {
            now.min(self.last_hit.saturating_add(IDLE_MS))
        };
        end.saturating_sub(start).saturating_sub(self.paused_ms)
    }
    fn build_totals(&self, mode: &str) -> Encounter {
        let (aggregates, identities) = if let Some(completed) = &self.completed {
            (&completed.aggregates, &completed.identities)
        } else {
            (&self.aggregates, &self.identities)
        };
        let mut players = BTreeMap::<u64, BTreeMap<u32, SkillState>>::new();
        let mut targets = BTreeMap::<u64, TargetState>::new();
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
            if mode == "boss" && !self.bosses.contains(target) {
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
                name: target_identity
                    .and_then(|entry| entry.name.clone())
                    .unwrap_or_else(|| format!("Target #{}", target)),
                is_boss: self.bosses.contains(target),
                damage: 0,
                current_hp: target_identity.and_then(|entry| entry.hp),
                observed_peak_hp: target_identity.and_then(|entry| entry.peak_hp),
                reported_max_hp: target_identity.and_then(|entry| entry.reported_max_hp),
                health_observed_at_ms: target_identity
                    .and_then(|entry| entry.health_observed_at_ms),
            });
            target_row.damage = target_row.damage.saturating_add(damage);
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
                            if count != 1 {
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
                                self.diagnostics.stream_gaps == 0
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
        player_rows.sort_by_key(|row| std::cmp::Reverse(row.damage));
        let mut record = Encounter {
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
                        self.diagnostics.stream_gaps == 0 && !self.diagnostics.truncated_encounter,
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
        if let Some(completed) = &self.completed {
            record.id = completed.record.id;
            record.started_ms = completed.record.started_ms;
            record.ended_ms = completed.record.ended_ms
        }
        record
    }
    fn snapshot(&self, now: u64, mode: &str) -> Encounter {
        let mut cache = self.cache.borrow_mut();
        if cache.as_ref().is_none_or(|(revision, cached_mode, _)| {
            *revision != self.revision || cached_mode != mode
        }) {
            *cache = Some((self.revision, mode.into(), self.build_totals(mode)))
        }
        let mut record = cache.as_ref().unwrap().2.clone();
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
            let mut first = None::<u64>;
            let mut last = 0;
            let mut pause_before_first = 0;
            for ((source, target), span) in pairs {
                if eligible(*source, *target) {
                    if first.is_none_or(|start| span.first < start) {
                        first = Some(span.first);
                        pause_before_first = span.paused_at_start
                    }
                    last = last.max(span.last)
                }
            }
            let end = if let Some(completed) = &self.completed {
                completed.record.ended_ms.min(last.saturating_add(IDLE_MS))
            } else if self.paused {
                self.pause_at
                    .unwrap_or(last)
                    .min(last.saturating_add(IDLE_MS))
            } else {
                now.min(last.saturating_add(IDLE_MS))
            };
            let paused_ms = self
                .completed
                .as_ref()
                .map(|completed| completed.paused_ms)
                .unwrap_or(self.paused_ms);
            let elapsed = first
                .map(|start| {
                    end.saturating_sub(start)
                        .saturating_sub(paused_ms.saturating_sub(pause_before_first))
                })
                .unwrap_or(0);
            (first, elapsed)
        };
        let local = record.local_player_id;
        let outgoing = |source, target| {
            pve_pair(identities, source, target, local)
                && (mode != "boss" || self.bosses.contains(&target))
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
        for player in &mut record.players {
            player.dps = player.damage as f64 / divisor;
            let (first, elapsed) = incoming_span(player.id);
            player.damage_taken_started_ms = first;
            player.damage_taken_elapsed_ms = elapsed;
            player.damage_taken_per_second = player
                .damage_taken
                .map(|damage| damage as f64 / (elapsed as f64 / 1000.0).max(1.0));
        }
        record
    }
    fn finish(&mut self, now: u64) {
        if self.started.is_none() || self.hit_count == 0 {
            return;
        }
        let mut record = self.snapshot(now, "all");
        record.ended_ms = now;
        self.attach_samples(&mut record);
        record.character_build = self.encounter_build.clone();
        record.assist = self.assistance.snapshot(now);
        record
            .assist
            .timeline
            .retain(|event| event.at_ms >= record.started_ms && event.at_ms <= now);
        if measured_record(&record) {
            self.history.push_front(record.clone());
            self.history.truncate(200);
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
        let identities = relevant
            .into_iter()
            .filter_map(|id| {
                self.identities
                    .get(&id)
                    .cloned()
                    .map(|identity| (id, identity))
            })
            .collect();
        self.completed = Some(Completed {
            aggregates: std::mem::take(&mut self.aggregates),
            identities,
            record,
            pair_activity: std::mem::take(&mut self.pair_activity),
            paused_ms: self.paused_ms,
            generation: self.generation,
            capture_complete: self.diagnostics.stream_gaps == 0
                && !self.diagnostics.truncated_encounter,
        });
        self.started = None;
        self.damage_samples.clear();
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
        assist.casts.truncate(8);
        assist.effects.truncate(64);
        let cooldowns=self.cooldowns.iter().map(|(id,cooldown)|serde_json::json!({"id":id,"skill_id":id,"name":format!("Skill #{}",id),"remaining_ms":cooldown.expires.map(|expires|expires.saturating_sub(now)),"charges":cooldown.charges,"observed":true,"source":"server"})).collect();
        MeterState {
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
            history: if with_history {
                self.history.iter().take(30).cloned().collect()
            } else {
                Vec::new()
            },
            cooldowns,
            diagnostics: self.diagnostics.clone(),
            target_mode: self.target_mode.clone(),
            history_revision: self.history_revision,
            history_count: self.history.len(),
            encounter_active: self.started.is_some()
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
    pub fn history_revision(&self) -> u64 {
        self.history_revision
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
            if !["personal", "party", "observed"].contains(&record.actor_scope.as_str()) {
                record.actor_scope = "observed".into();
            }
            self.history.push_front(record);
        }
        self.history.truncate(200);
        self.bound_history_samples();
        self.history_revision = self.history_revision.wrapping_add(1);
        Ok(records.len())
    }
    pub fn current_record(&self, now: u64) -> Encounter {
        let mut record = self.snapshot(now, &self.target_mode);
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
        if self.target_mode == "boss" {
            record
                .damage_samples
                .retain(|sample| self.bosses.contains(&sample.target))
        }
        record
    }
    pub fn assistance_snapshot(&self, now: u64) -> assistance::AssistSnapshot {
        self.assistance.snapshot(now)
    }
    pub fn field_boss_snapshot(&self) -> field_boss::FieldBossSnapshot {
        self.field_bosses.snapshot()
    }
    pub fn character_snapshot(&self) -> character::CharacterSnapshot {
        self.character.snapshot()
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
    let build_valid = record.character_build.as_ref().is_none_or(|build| {
        build.name.len() <= 320
            && build.source.len() <= 64
            && build.equipment.len() <= 64
            && build.skills.len() <= 255
            && build.boards.len() <= 32
            && build.boards.iter().all(|board| board.node_ids.len() <= 255)
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
        && record.received_samples.len() <= MAX_SAMPLES
        && record.assist.casts.len() <= 64
        && record.assist.effects.len() <= 256
        && record.assist.timeline.len() <= 1000
        && record.assist.health.len() <= 256
        && record.local_player_name.len() <= 320
        && record.party_member_ids.len() <= 12
        && record.players.iter().all(|player| {
            player.name.len() <= 512
                && player.class_name.len() <= 128
                && player.skills.iter().all(|skill| skill.name.len() <= 256)
                && player.incoming_skills.len() <= 500
                && player
                    .incoming_skills
                    .iter()
                    .all(|skill| skill.name.len() <= 256)
        })
        && record.targets.iter().all(|target| target.name.len() <= 512)
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
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
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
        assert_eq!(state.elapsed_ms, 4000);
        assert_eq!(state.dps, 125.0);
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
        engine.set_paused_at(true, 2000);
        engine.ingest_event(hit(1, 10, 1000, false), 3000);
        assert_eq!(engine.state(4000).total_damage, 100);
        assert_eq!(engine.state(4000).elapsed_ms, 1000);
        engine.set_paused_at(false, 5000);
        engine.ingest_event(hit(1, 10, 100, false), 6000);
        assert_eq!(engine.state(7000).elapsed_ms, 3000);
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
            remaining_ms: Some(6450),
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
        assert_eq!(engine.state(2000).cooldowns[0]["remaining_ms"], 5450);
        engine.capture_loss();
        assert!(engine.state(2000).cooldowns.is_empty());
        assert_eq!(engine.state(2000).diagnostics.stream_gaps, 1);
    }
}
