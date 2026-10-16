//! Bounded observations from received cast, effect and health-stat records.
//!
//! Wire facts: docs/feature-parity.md, AionDPS combat-frames.md at
//! 72417dc72457844f514729fd2680fcbbd4423a93. This module does not use a skill
//! database, predict damage timing, classify buffs by name or automate actions.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};

const MAX_FRAME: usize = 4096;
const MAX_CASTS: usize = 64;
const MAX_EFFECTS: usize = 256;
const MAX_HEALTH: usize = 256;
const MAX_HEALTH_HISTORY: usize = 512;
const MAX_TIMELINE: usize = 1000;
const MAX_REMOVALS: usize = 64;
const MAX_STAGGER: usize = 64;
const STAGGER_FRESH_MS: u64 = 5_000;
const MAX_EFFECT_MS: u64 = 86_400_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AssistError {
    Truncated,
    Invalid,
    Unsupported,
    Limit,
}

#[derive(Clone, Debug, PartialEq)]
pub struct CastCooldown {
    pub cooldown_ms: Option<u32>,
    pub charges: Option<u32>,
    pub recharge_ms: Option<u32>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct CastObservation {
    pub actor_id: u64,
    pub skill_id: u32,
    pub target_id: u64,
    pub duration_ms: Option<u64>,
    pub facing: f32,
    pub position: Option<[f32; 3]>,
    pub cooldown: Option<CastCooldown>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EffectObservation {
    pub recipient_id: u64,
    pub caster_id: u64,
    pub instance_id: u64,
    pub effect_id: u32,
    pub duration_ms: u64,
    pub persistent: bool,
    pub refreshed: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub enum AssistEvent {
    Windup(CastObservation),
    Cast(CastObservation),
    Effect(EffectObservation),
    EffectRemove {
        recipient_id: u64,
        instances: Vec<u64>,
    },
    Health {
        actor_id: u64,
        current_hp: Option<u64>,
        reported_max_hp: Option<u64>,
    },
    Stagger {
        actor_id: u64,
        current: u32,
        maximum: Option<u32>,
        broken: bool,
    },
}

struct Reader<'a> {
    bytes: &'a [u8],
    offset: usize,
}
impl<'a> Reader<'a> {
    fn take<const N: usize>(&mut self) -> Result<[u8; N], AssistError> {
        let end = self.offset.checked_add(N).ok_or(AssistError::Limit)?;
        let value = self
            .bytes
            .get(self.offset..end)
            .ok_or(AssistError::Truncated)?;
        self.offset = end;
        value.try_into().map_err(|_| AssistError::Truncated)
    }
    fn byte(&mut self) -> Result<u8, AssistError> {
        Ok(self.take::<1>()?[0])
    }
    fn word(&mut self) -> Result<u32, AssistError> {
        Ok(u32::from_le_bytes(self.take()?))
    }
    fn variable(&mut self) -> Result<u64, AssistError> {
        let mut value = 0u32;
        for index in 0..5 {
            let part = self.byte()?;
            if index == 4 && part > 15 {
                return Err(AssistError::Invalid);
            }
            value |= u32::from(part & 0x7f) << (index * 7);
            if part & 0x80 == 0 {
                if index > 0 && part == 0 {
                    return Err(AssistError::Invalid);
                }
                return Ok(u64::from(value));
            }
        }
        Err(AssistError::Invalid)
    }
    fn actor(&mut self) -> Result<u64, AssistError> {
        let value = self.variable()?;
        if value == 0 {
            Err(AssistError::Invalid)
        } else {
            Ok(value)
        }
    }
    fn float(&mut self, maximum: f32) -> Result<f32, AssistError> {
        let value = f32::from_le_bytes(self.take()?);
        if value.is_finite() && value.abs() <= maximum {
            Ok(value)
        } else {
            Err(AssistError::Invalid)
        }
    }
    fn end(&self) -> Result<(), AssistError> {
        if self.offset == self.bytes.len() {
            Ok(())
        } else {
            Err(AssistError::Invalid)
        }
    }
    fn opaque_tail(&self, maximum: usize) -> Result<(), AssistError> {
        if self.bytes.len().saturating_sub(self.offset) <= maximum {
            Ok(())
        } else {
            Err(AssistError::Limit)
        }
    }
}

fn aim(reader: &mut Reader<'_>, windup: bool) -> Result<CastObservation, AssistError> {
    let actor_id = reader.actor()?;
    let actor_flags = reader.byte()?;
    let skill_id = reader.word()?;
    if skill_id == 0 || skill_id > 300_000_000 {
        return Err(AssistError::Invalid);
    }
    reader.byte()?;
    let flags = reader.byte()?;
    if flags & !2 != 0 {
        return Err(AssistError::Unsupported);
    }
    let target_id = reader.variable()?;
    let facing = reader.float(720.0)?;
    let position = if flags & 2 != 0 {
        Some([
            reader.float(10_000_000.0)?,
            reader.float(10_000_000.0)?,
            reader.float(10_000_000.0)?,
        ])
    } else {
        None
    };
    let duration_ms = if windup {
        let duration = reader.variable()?;
        if !(50..=120_000).contains(&duration) {
            return Err(AssistError::Invalid);
        }
        Some(duration)
    } else {
        None
    };
    let cooldown = if !windup && (11_000_000..20_000_000).contains(&skill_id) {
        // Only the complete, known tail establishes timing. An unfamiliar tail
        // does not erase the independently decoded actor/skill cast event.
        cast_cooldown_tail(reader, actor_flags).ok()
    } else {
        None
    };
    reader.opaque_tail(if windup { 64 } else { MAX_FRAME })?;
    Ok(CastObservation {
        actor_id,
        skill_id,
        target_id,
        duration_ms,
        facing,
        position,
        cooldown,
    })
}

fn cast_cooldown_tail(reader: &Reader<'_>, flags: u8) -> Result<CastCooldown, AssistError> {
    if flags & !0x2c != 0 {
        return Err(AssistError::Unsupported);
    }
    let mut tail = Reader {
        bytes: reader.bytes,
        offset: reader.offset,
    };
    tail.variable()?; // Opaque A: no invented animation/cooldown meaning.
    tail.variable()?; // Opaque B.
    let cooldown = tail.variable()?;
    if cooldown > 3_600_000 {
        return Err(AssistError::Limit);
    }
    let charged = flags & 0x0c != 0;
    if charged && cooldown != 0 {
        return Err(AssistError::Unsupported);
    }
    let charges = if flags & 4 != 0 { tail.variable()? } else { 0 };
    let recharge = if flags & 8 != 0 { tail.variable()? } else { 0 };
    if charges > 9 || recharge > 3_600_000 {
        return Err(AssistError::Limit);
    }
    if flags & 0x20 != 0 {
        let count = tail.variable()?;
        if count > 64 {
            return Err(AssistError::Limit);
        }
        for _ in 0..count {
            tail.actor()?;
            for _ in 0..3 {
                tail.float(10_000_000.0)?;
            }
        }
    }
    tail.end()?;
    Ok(CastCooldown {
        cooldown_ms: (!charged).then_some(cooldown as u32),
        charges: charged.then_some(charges as u32),
        recharge_ms: charged.then_some(recharge as u32),
    })
}

/// Decodes one complete frame without its framing length prefix. Unsupported
/// opcodes return None; supported malformed records fail before any state changes.
pub fn decode(frame: &[u8]) -> Result<Option<AssistEvent>, AssistError> {
    let opcode: [u8; 2] = frame
        .get(..2)
        .ok_or(AssistError::Truncated)?
        .try_into()
        .map_err(|_| AssistError::Truncated)?;
    if !matches!(
        opcode,
        [9, 0x38] | [2, 0x38] | [0x2a, 0x38] | [0x2b, 0x38] | [0x2c, 0x38] | [0, 0x8d] | [5, 0xe0]
    ) {
        return Ok(None);
    }
    if frame.len() > MAX_FRAME {
        return Err(AssistError::Limit);
    }
    let mut reader = Reader {
        bytes: frame,
        offset: 2,
    };
    let event = match opcode {
        [9, 0x38] => AssistEvent::Windup(aim(&mut reader, true)?),
        [2, 0x38] => AssistEvent::Cast(aim(&mut reader, false)?),
        [5, 0xe0] => {
            let actor_id = reader.actor()?;
            if actor_id > 10_000_000 {
                return Err(AssistError::Invalid);
            }
            let (current, maximum, broken) = match [reader.byte()?, reader.byte()?] {
                [3, 1] => {
                    let maximum = reader.word()?;
                    let current = reader.word()?;
                    reader.byte()?; // Opaque trailing status byte.
                    if maximum == 0 || maximum > 1_000_000 || current > maximum {
                        return Err(AssistError::Invalid);
                    }
                    (current, Some(maximum), false)
                }
                [0, 3] => (0, None, true),
                _ => return Err(AssistError::Unsupported),
            };
            reader.end()?;
            AssistEvent::Stagger {
                actor_id,
                current,
                maximum,
                broken,
            }
        }
        [0x2a, 0x38] | [0x2b, 0x38] => {
            let recipient_id = reader.actor()?;
            let refreshed = opcode[0] == 0x2b;
            if !refreshed && reader.byte()? != 1 {
                return Err(AssistError::Unsupported);
            }
            reader.byte()?; // Opaque effect-kind flags, not a buff/debuff classification.
            let instance_id = reader.actor()?;
            let effect_id = reader.word()?;
            let duration_ms = u64::from(reader.word()?);
            let persistent = reader.word()? != 0;
            reader.take::<8>()?; // Server time is not a measured local clock offset.
            let caster_id = reader.actor()?;
            if !(10..=2_999_999_999).contains(&effect_id)
                || !persistent && duration_ms > MAX_EFFECT_MS
            {
                return Err(AssistError::Invalid);
            }
            reader.opaque_tail(256)?;
            AssistEvent::Effect(EffectObservation {
                recipient_id,
                caster_id,
                instance_id,
                effect_id,
                duration_ms,
                persistent,
                refreshed,
            })
        }
        [0x2c, 0x38] => {
            let recipient_id = reader.actor()?;
            let count = usize::from(reader.byte()?);
            if count == 0 || count > MAX_REMOVALS {
                return Err(AssistError::Limit);
            }
            let mut instances = Vec::with_capacity(count);
            for _ in 0..count {
                let kind = reader.byte()?;
                let instance = reader.actor()?;
                reader.byte()?; // The reason is received but not semantically classified.
                match kind {
                    0 => {}
                    7 => {
                        reader.variable()?;
                        reader.take::<8>()?;
                    }
                    _ => return Err(AssistError::Unsupported),
                }
                if !instances.contains(&instance) {
                    instances.push(instance)
                }
            }
            reader.end()?;
            AssistEvent::EffectRemove {
                recipient_id,
                instances,
            }
        }
        [0, 0x8d] => {
            let actor_id = reader.actor()?;
            let format = reader.byte()?;
            if format == 0 || format & !3 != 0 {
                return Err(AssistError::Unsupported);
            }
            if format & 1 != 0 {
                let count = usize::from(reader.byte()?);
                if count > 64 {
                    return Err(AssistError::Limit);
                }
                for _ in 0..count {
                    reader.take::<5>()?;
                }
            }
            let mut current_hp = None;
            let mut reported_max_hp = None;
            if format & 2 != 0 {
                let count = usize::from(reader.byte()?);
                if count > 64 {
                    return Err(AssistError::Limit);
                }
                for _ in 0..count {
                    let kind = reader.byte()?;
                    let value = i64::from_le_bytes(reader.take()?);
                    if (kind == 0 || kind == 7) && value < 0 {
                        return Err(AssistError::Invalid);
                    }
                    match kind {
                        0 => {
                            if current_hp.replace(value as u64).is_some() {
                                return Err(AssistError::Invalid);
                            }
                        }
                        7 => {
                            if reported_max_hp.replace(value as u64).is_some() {
                                return Err(AssistError::Invalid);
                            }
                        }
                        _ => {}
                    }
                }
            }
            reader.end()?;
            if current_hp.is_none() && reported_max_hp.is_none() {
                return Ok(None);
            }
            AssistEvent::Health {
                actor_id,
                current_hp,
                reported_max_hp,
            }
        }
        _ => return Ok(None),
    };
    Ok(Some(event))
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ActiveCast {
    pub actor_id: u64,
    pub skill_id: u32,
    pub target_id: u64,
    pub started_ms: u64,
    pub expires_ms: u64,
    pub duration_ms: u64,
    pub source: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ActiveEffect {
    pub recipient_id: u64,
    pub caster_id: u64,
    pub instance_id: u64,
    pub effect_id: u32,
    pub duration_ms: Option<u64>,
    pub started_ms: u64,
    pub expires_ms: Option<u64>,
    pub persistent: bool,
    pub source: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct AssistTimelineEvent {
    pub kind: String,
    pub at_ms: u64,
    pub actor_id: u64,
    pub skill_id: Option<u32>,
    pub target_id: u64,
    pub instance_id: Option<u64>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct HealthObservation {
    pub actor_id: u64,
    pub current_hp: Option<u64>,
    pub reported_max_hp: Option<u64>,
    pub observed_peak_hp: Option<u64>,
    pub observed_at_ms: u64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct StaggerObservation {
    pub actor_id: u64,
    pub current: u32,
    pub maximum: Option<u32>,
    pub broken: bool,
    pub observed_at_ms: u64,
    pub fresh_for_ms: u64,
    pub fresh: bool,
    pub source: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct AssistSnapshot {
    pub casts: Vec<ActiveCast>,
    pub effects: Vec<ActiveEffect>,
    pub timeline: Vec<AssistTimelineEvent>,
    pub health: Vec<HealthObservation>,
    /// Actual received HP observations. This is not a reconstructed HP curve.
    #[serde(default)]
    pub health_history: Vec<HealthObservation>,
    pub retention_limited: bool,
    #[serde(default)]
    pub stagger: Vec<StaggerObservation>,
}

#[derive(Clone, Debug, Default)]
pub struct AssistState {
    casts: BTreeMap<u64, ActiveCast>,
    effects: BTreeMap<(u64, u64), ActiveEffect>,
    health: BTreeMap<u64, HealthObservation>,
    health_history: VecDeque<HealthObservation>,
    timeline: VecDeque<AssistTimelineEvent>,
    last_ms: Option<u64>,
    limited: bool,
    stagger: BTreeMap<u64, StaggerObservation>,
}

impl AssistState {
    pub fn clear(&mut self) {
        *self = Self::default()
    }
    pub fn remove_actor(&mut self, actor_id: u64, now: u64) {
        self.tick(now);
        self.casts.remove(&actor_id);
        self.health.remove(&actor_id);
        // Entity IDs can be reused after despawn; the replacement must not
        // inherit a previous entity's HP history.
        self.health_history.retain(|row| row.actor_id != actor_id);
        self.stagger.remove(&actor_id);
        // A caster leaving the scene does not remove its buffs from others.
        self.effects
            .retain(|_, effect| effect.recipient_id != actor_id);
    }
    fn log(
        &mut self,
        kind: &str,
        at_ms: u64,
        actor_id: u64,
        skill_id: Option<u32>,
        target_id: u64,
        instance_id: Option<u64>,
    ) {
        if self.timeline.len() == MAX_TIMELINE {
            self.timeline.pop_front();
            self.limited = true
        }
        self.timeline.push_back(AssistTimelineEvent {
            kind: kind.into(),
            at_ms,
            actor_id,
            skill_id,
            target_id,
            instance_id,
        });
    }
    /// Locally elapsed deadlines are distinct from received effect removal or
    /// cast completion. A clock reversal invalidates all timing observations.
    pub fn tick(&mut self, now: u64) {
        if self.last_ms.is_some_and(|previous| now < previous) {
            self.clear()
        }
        self.last_ms = Some(now);
        let casts: Vec<_> = self
            .casts
            .iter()
            .filter(|(_, cast)| cast.expires_ms <= now)
            .map(|(id, cast)| (*id, cast.clone()))
            .collect();
        for (id, cast) in casts {
            self.casts.remove(&id);
            self.log(
                "windup-elapsed",
                cast.expires_ms,
                cast.actor_id,
                Some(cast.skill_id),
                cast.target_id,
                None,
            )
        }
        let effects: Vec<_> = self
            .effects
            .iter()
            .filter(|(_, effect)| effect.expires_ms.is_some_and(|deadline| deadline <= now))
            .map(|(id, effect)| (*id, effect.clone()))
            .collect();
        for (id, effect) in effects {
            self.effects.remove(&id);
            self.log(
                "effect-expired",
                effect.expires_ms.unwrap_or(now),
                effect.caster_id,
                Some(effect.effect_id / 10),
                effect.recipient_id,
                Some(effect.instance_id),
            )
        }
    }
    pub fn ingest(&mut self, event: AssistEvent, now: u64) {
        self.tick(now);
        match event {
            AssistEvent::Stagger {
                actor_id,
                current,
                maximum,
                broken,
            } => {
                if actor_id == 0
                    || actor_id > 10_000_000
                    || maximum.is_some_and(|maximum| {
                        maximum == 0 || maximum > 1_000_000 || current > maximum
                    })
                    || broken && current != 0
                    || !broken && maximum.is_none()
                {
                    return;
                }
                if self.stagger.len() >= MAX_STAGGER && !self.stagger.contains_key(&actor_id) {
                    if let Some(oldest) = self
                        .stagger
                        .values()
                        .min_by_key(|row| row.observed_at_ms)
                        .map(|row| row.actor_id)
                    {
                        self.stagger.remove(&oldest);
                        self.limited = true;
                    }
                }
                let known_maximum =
                    maximum.or_else(|| self.stagger.get(&actor_id).and_then(|old| old.maximum));
                self.stagger.insert(
                    actor_id,
                    StaggerObservation {
                        actor_id,
                        current,
                        maximum: known_maximum,
                        broken,
                        observed_at_ms: now,
                        fresh_for_ms: STAGGER_FRESH_MS,
                        fresh: true,
                        source: "server".into(),
                    },
                );
                if broken {
                    self.log("stagger-break", now, actor_id, None, actor_id, None);
                }
            }
            AssistEvent::Windup(value) => {
                let Some(duration_ms) = value.duration_ms else {
                    return;
                };
                if !(50..=120_000).contains(&duration_ms) {
                    return;
                }
                if self.casts.len() >= MAX_CASTS && !self.casts.contains_key(&value.actor_id) {
                    if let Some(id) = self
                        .casts
                        .values()
                        .min_by_key(|cast| cast.started_ms)
                        .map(|cast| cast.actor_id)
                    {
                        self.casts.remove(&id);
                        self.limited = true
                    }
                }
                self.casts.insert(
                    value.actor_id,
                    ActiveCast {
                        actor_id: value.actor_id,
                        skill_id: value.skill_id,
                        target_id: value.target_id,
                        started_ms: now,
                        expires_ms: now.saturating_add(duration_ms),
                        duration_ms,
                        source: "server-windup".into(),
                    },
                );
                self.log(
                    "windup",
                    now,
                    value.actor_id,
                    Some(value.skill_id),
                    value.target_id,
                    None,
                );
            }
            AssistEvent::Cast(value) => self.log(
                "cast",
                now,
                value.actor_id,
                Some(value.skill_id),
                value.target_id,
                None,
            ),
            AssistEvent::Effect(value) => {
                let key = (value.recipient_id, value.instance_id);
                if self.effects.len() >= MAX_EFFECTS && !self.effects.contains_key(&key) {
                    if let Some(id) = self
                        .effects
                        .iter()
                        .min_by_key(|(_, effect)| effect.started_ms)
                        .map(|(id, _)| *id)
                    {
                        self.effects.remove(&id);
                        self.limited = true
                    }
                }
                self.effects.insert(
                    key,
                    ActiveEffect {
                        recipient_id: value.recipient_id,
                        caster_id: value.caster_id,
                        instance_id: value.instance_id,
                        effect_id: value.effect_id,
                        duration_ms: (!value.persistent).then_some(value.duration_ms),
                        started_ms: now,
                        expires_ms: (!value.persistent)
                            .then_some(now.saturating_add(value.duration_ms)),
                        persistent: value.persistent,
                        source: "server-effect".into(),
                    },
                );
                self.log(
                    if value.refreshed {
                        "effect-refreshed"
                    } else {
                        "effect-applied"
                    },
                    now,
                    value.caster_id,
                    Some(value.effect_id / 10),
                    value.recipient_id,
                    Some(value.instance_id),
                );
            }
            AssistEvent::EffectRemove {
                recipient_id,
                instances,
            } => {
                for instance_id in instances {
                    let removed = self.effects.remove(&(recipient_id, instance_id));
                    self.log(
                        "effect-removed",
                        now,
                        removed.as_ref().map_or(0, |effect| effect.caster_id),
                        removed.as_ref().map(|effect| effect.effect_id / 10),
                        recipient_id,
                        Some(instance_id),
                    );
                }
            }
            AssistEvent::Health {
                actor_id,
                current_hp,
                reported_max_hp,
            } => {
                if actor_id == 0
                    || actor_id > 10_000_000
                    || current_hp.is_none() && reported_max_hp.is_none()
                    || current_hp.is_some_and(|hp| hp > 10_000_000_000_000)
                    || reported_max_hp.is_some_and(|hp| hp > 10_000_000_000_000)
                {
                    return;
                }
                if self.health.len() >= MAX_HEALTH && !self.health.contains_key(&actor_id) {
                    if let Some(id) = self
                        .health
                        .values()
                        .min_by_key(|health| health.observed_at_ms)
                        .map(|health| health.actor_id)
                    {
                        self.health.remove(&id);
                        self.limited = true
                    }
                }
                let row = self
                    .health
                    .entry(actor_id)
                    .or_insert_with(|| HealthObservation {
                        actor_id,
                        ..Default::default()
                    });
                row.observed_at_ms = now;
                if let Some(current) = current_hp {
                    row.current_hp = Some(current);
                    row.observed_peak_hp = Some(row.observed_peak_hp.unwrap_or(0).max(current))
                }
                if let Some(maximum) = reported_max_hp {
                    row.reported_max_hp = (maximum > 0
                        && row.current_hp.is_none_or(|current| maximum >= current))
                    .then_some(maximum)
                }
                if row
                    .reported_max_hp
                    .zip(row.current_hp)
                    .is_some_and(|(maximum, current)| maximum < current)
                {
                    row.reported_max_hp = None
                }
                // A max-only update must not claim the old current HP was
                // measured again. Keep the point's received current separate
                // from the latest merged health state.
                let observation = HealthObservation {
                    actor_id,
                    current_hp,
                    reported_max_hp: row.reported_max_hp,
                    observed_peak_hp: row.observed_peak_hp,
                    observed_at_ms: now,
                };
                if self.health_history.back() != Some(&observation) {
                    if self.health_history.len() == MAX_HEALTH_HISTORY {
                        self.health_history.pop_front();
                        self.limited = true;
                    }
                    self.health_history.push_back(observation);
                }
            }
        }
    }
    /// Filters expired rows without mutating state or emitting new notifications.
    pub fn snapshot(&self, now: u64) -> AssistSnapshot {
        if self.last_ms.is_some_and(|last| now < last) {
            return AssistSnapshot::default();
        }
        AssistSnapshot {
            casts: self
                .casts
                .values()
                .filter(|cast| cast.expires_ms > now)
                .cloned()
                .collect(),
            effects: self
                .effects
                .values()
                .filter(|effect| effect.expires_ms.is_none_or(|deadline| deadline > now))
                .cloned()
                .collect(),
            timeline: self.timeline.iter().cloned().collect(),
            health: self.health.values().cloned().collect(),
            health_history: self.health_history.iter().cloned().collect(),
            retention_limited: self.limited,
            stagger: self.stagger_snapshot(now),
        }
    }
    /// Avoids copying timeline and health collections for frequent live IPC. The
    /// caller can prioritize known actors before applying its presentation cap.
    pub fn live_snapshot(&self, now: u64) -> AssistSnapshot {
        if self.last_ms.is_some_and(|last| now < last) {
            return AssistSnapshot::default();
        }
        AssistSnapshot {
            casts: self
                .casts
                .values()
                .filter(|cast| cast.expires_ms > now)
                .cloned()
                .collect(),
            effects: self
                .effects
                .values()
                .filter(|effect| effect.expires_ms.is_none_or(|deadline| deadline > now))
                .cloned()
                .collect(),
            retention_limited: self.limited,
            stagger: self.stagger_snapshot(now),
            ..Default::default()
        }
    }
    fn stagger_snapshot(&self, now: u64) -> Vec<StaggerObservation> {
        self.stagger
            .values()
            .cloned()
            .map(|mut row| {
                row.fresh =
                    now >= row.observed_at_ms && now - row.observed_at_ms <= STAGGER_FRESH_MS;
                row
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn var(mut value: u64) -> Vec<u8> {
        let mut out = Vec::new();
        loop {
            let part = (value & 127) as u8;
            value >>= 7;
            out.push(part | if value > 0 { 128 } else { 0 });
            if value == 0 {
                return out;
            }
        }
    }
    fn cast(actor: u64, target: u64, ms: Option<u64>) -> Vec<u8> {
        let mut frame = vec![if ms.is_some() { 9 } else { 2 }, 0x38];
        frame.extend(var(actor));
        frame.push(0);
        frame.extend(12345u32.to_le_bytes());
        frame.extend([0, 2]);
        frame.extend(var(target));
        for value in [30f32, 100f32, 200f32, 300f32] {
            frame.extend(value.to_le_bytes())
        }
        if let Some(ms) = ms {
            frame.extend(var(ms))
        }
        frame
    }
    fn effect(instance: u64, duration: u32, persistent: bool, refreshed: bool) -> Vec<u8> {
        let mut frame = vec![if refreshed { 0x2b } else { 0x2a }, 0x38];
        frame.extend(var(7));
        if !refreshed {
            frame.push(1)
        }
        frame.push(0x11);
        frame.extend(var(instance));
        frame.extend(123450u32.to_le_bytes());
        frame.extend(duration.to_le_bytes());
        frame.extend(u32::from(persistent).to_le_bytes());
        frame.extend(0u64.to_le_bytes());
        frame.extend(var(8));
        frame
    }
    fn hp(current: i64, maximum: i64) -> Vec<u8> {
        let mut frame = vec![0, 0x8d, 7, 2, 2, 0];
        frame.extend(current.to_le_bytes());
        frame.push(7);
        frame.extend(maximum.to_le_bytes());
        frame
    }
    fn ingest(state: &mut AssistState, frame: &[u8], now: u64) {
        state.ingest(decode(frame).unwrap().unwrap(), now)
    }
    #[test]
    fn windup_has_reported_deadline_while_cast_has_none() {
        let mut state = AssistState::default();
        ingest(&mut state, &cast(7, 8, Some(1500)), 1000);
        let before = state.snapshot(1200);
        assert_eq!(before.casts[0].expires_ms, 2500);
        assert_eq!(before.casts[0].target_id, 8);
        ingest(&mut state, &cast(9, 8, None), 1500);
        assert_eq!(state.snapshot(1500).casts.len(), 1);
        state.tick(2500);
        assert!(state.snapshot(2500).casts.is_empty());
        assert_eq!(
            state.snapshot(2500).timeline.last().unwrap().kind,
            "windup-elapsed"
        );
    }
    #[test]
    fn effects_refresh_persist_and_remove_without_predicted_readiness() {
        let mut state = AssistState::default();
        ingest(&mut state, &effect(5, 300, false, false), 1000);
        assert_eq!(state.snapshot(1100).effects[0].expires_ms, Some(1300));
        ingest(&mut state, &effect(5, 1000, false, true), 1200);
        assert_eq!(state.snapshot(1400).effects[0].expires_ms, Some(2200));
        ingest(&mut state, &effect(6, 300, true, false), 1500);
        state.tick(2200);
        assert_eq!(state.snapshot(2200).effects.len(), 1);
        assert_eq!(state.snapshot(2200).effects[0].expires_ms, None);
        ingest(&mut state, &[0x2c, 0x38, 7, 1, 0, 6, 1], 2300);
        assert!(state.snapshot(2300).effects.is_empty());
        assert_eq!(
            state.snapshot(2300).timeline.last().unwrap().kind,
            "effect-removed"
        );
    }
    #[test]
    fn removal_batch_is_atomic_and_rejects_unknown_types_and_trailing_data() {
        assert!(decode(&[0x2c, 0x38, 7, 2, 0, 5, 1, 0, 6]).is_err());
        assert_eq!(
            decode(&[0x2c, 0x38, 7, 1, 1, 5, 1]),
            Err(AssistError::Unsupported)
        );
        assert!(decode(&[0x2c, 0x38, 7, 1, 0, 5, 1, 0]).is_err());
    }
    #[test]
    fn numeric_bounds_noncanonical_varints_and_nonfinite_positions_fail() {
        assert!(decode(&cast(0, 1, Some(100))).is_err());
        assert!(decode(&cast(1, 1, Some(49))).is_err());
        assert!(decode(&cast(1, 1, Some(120001))).is_err());
        let mut bad = cast(1, 1, Some(100));
        bad.splice(2..3, [0x81, 0]);
        assert_eq!(decode(&bad), Err(AssistError::Invalid));
        let mut bad = cast(1, 1, Some(100));
        bad[11..15].copy_from_slice(&f32::NAN.to_le_bytes());
        assert!(decode(&bad).is_err());
        assert!(decode(&effect(1, 86_400_001, false, false)).is_err());
    }
    #[test]
    fn health_groups_parse_exactly_and_invalid_maximum_is_not_a_verified_peak() {
        let mut state = AssistState::default();
        ingest(&mut state, &hp(900, 1000), 1000);
        assert_eq!(state.snapshot(1000).health[0].reported_max_hp, Some(1000));
        ingest(&mut state, &hp(1100, 1000), 1100);
        let row = &state.snapshot(1100).health[0];
        assert_eq!(row.reported_max_hp, None);
        assert_eq!(row.observed_peak_hp, Some(1100));
        assert!(decode(&hp(-1, 1000)).is_err());
        let mut bad = hp(1, 2);
        bad.push(0);
        assert!(decode(&bad).is_err());
        let mut both_groups = vec![0, 0x8d, 7, 3, 1, 42];
        both_groups.extend(4u32.to_le_bytes());
        both_groups.extend([1, 7]);
        both_groups.extend(1000i64.to_le_bytes());
        assert!(matches!(
            decode(&both_groups).unwrap(),
            Some(AssistEvent::Health {
                current_hp: None,
                reported_max_hp: Some(1000),
                ..
            })
        ));
    }
    #[test]
    fn clock_reversal_clear_and_snapshot_polling_do_not_repeat_events() {
        let mut state = AssistState::default();
        ingest(&mut state, &effect(1, 1000, true, false), 1000);
        assert_eq!(state.snapshot(1100), state.snapshot(1100));
        assert_eq!(state.snapshot(1100).timeline.len(), 1);
        state.tick(900);
        assert_eq!(state.snapshot(900), AssistSnapshot::default());
        ingest(&mut state, &cast(7, 8, Some(1000)), 1000);
        state.clear();
        assert_eq!(state.snapshot(1000), AssistSnapshot::default());
    }
    #[test]
    fn active_state_and_timeline_have_independent_retention_bounds() {
        let mut state = AssistState::default();
        for actor in 1..=100 {
            ingest(&mut state, &cast(actor, 500, Some(120000)), 1000)
        }
        for instance in 1..=300 {
            ingest(&mut state, &effect(instance, 1000, true, false), 1000)
        }
        for actor in 1..=1200 {
            ingest(&mut state, &cast(actor, 500, None), 1000)
        }
        let snapshot = state.snapshot(1000);
        assert_eq!(snapshot.casts.len(), MAX_CASTS);
        assert_eq!(snapshot.effects.len(), MAX_EFFECTS);
        assert_eq!(snapshot.timeline.len(), MAX_TIMELINE);
        assert!(snapshot.retention_limited);
    }
    #[test]
    fn every_truncated_fixed_header_is_rejected_without_partial_event() {
        let windup = cast(7, 8, Some(1500));
        for end in 0..windup.len() {
            assert!(decode(&windup[..end]).is_err())
        }
        let applied = effect(5, 300, false, false);
        for end in 0..applied.len() {
            assert!(decode(&applied[..end]).is_err())
        }
    }
    #[test]
    fn live_snapshot_omits_retained_history_and_persistent_duration_is_unknown() {
        let mut state = AssistState::default();
        ingest(&mut state, &effect(1, u32::MAX, true, false), 1000);
        ingest(&mut state, &hp(1, 2), 1000);
        let live = state.live_snapshot(1000);
        assert!(live.timeline.is_empty());
        assert!(live.health.is_empty());
        assert!(live.health_history.is_empty());
        assert_eq!(live.effects[0].duration_ms, None);
        let full = state.snapshot(1000);
        assert_eq!(full.timeline.len(), 1);
        assert_eq!(full.health.len(), 1);
    }
    #[test]
    fn health_history_retains_only_received_current_and_never_infers_maximum() {
        let mut state = AssistState::default();
        state.ingest(
            AssistEvent::Health {
                actor_id: 7,
                current_hp: Some(900),
                reported_max_hp: None,
            },
            1000,
        );
        state.ingest(
            AssistEvent::Health {
                actor_id: 7,
                current_hp: None,
                reported_max_hp: Some(1000),
            },
            2000,
        );
        state.ingest(
            AssistEvent::Health {
                actor_id: 7,
                current_hp: Some(0),
                reported_max_hp: None,
            },
            3000,
        );
        let history = state.snapshot(3000).health_history;
        assert_eq!(history.len(), 3);
        assert_eq!(history[0].reported_max_hp, None);
        assert_eq!(history[1].current_hp, None);
        assert_eq!(history[1].reported_max_hp, Some(1000));
        assert_eq!(history[2].current_hp, Some(0));
        assert_eq!(history[2].observed_at_ms, 3000);
        // A read does not repeat or refresh the last observation.
        assert_eq!(state.snapshot(100_000).health_history, history);
    }
    #[test]
    fn health_history_is_bounded_and_removed_actor_ids_do_not_inherit_history() {
        let mut state = AssistState::default();
        for at in 1..=600 {
            state.ingest(
                AssistEvent::Health {
                    actor_id: 7,
                    current_hp: Some(at),
                    reported_max_hp: None,
                },
                at,
            );
        }
        let snapshot = state.snapshot(600);
        assert_eq!(snapshot.health_history.len(), MAX_HEALTH_HISTORY);
        assert_eq!(snapshot.health_history[0].observed_at_ms, 89);
        assert!(snapshot.retention_limited);
        state.remove_actor(7, 601);
        state.ingest(
            AssistEvent::Health {
                actor_id: 7,
                current_hp: Some(50),
                reported_max_hp: None,
            },
            602,
        );
        let replacement = state.snapshot(602);
        assert_eq!(replacement.health_history.len(), 1);
        assert_eq!(replacement.health[0].observed_peak_hp, Some(50));
        state.clear();
        assert!(state.snapshot(603).health_history.is_empty());
    }
}
