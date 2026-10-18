//! Observed local login lists and unbound inspection profiles. No item/skill
//! catalog or game image is bundled. Structural gear coverage stays partial;
//! absent enchants, stones and rolled stats are unknown rather than zero.
//! Wire provenance and supported boundaries: docs/observed-character-and-bosses.md.
//! Own pet list/gain layouts are independently implemented from AionDPS
//! observations at 72417dc72457844f514729fd2680fcbbd4423a93. Level (14 90)
//! and registration (09 90) prefixes/reset semantics were rechecked against
//! 29c416ff96fb1b798e17391974816842897e1a18; opaque suffixes are not decoded.
//! No pet name/icon/spawn catalog or soul thresholds are bundled.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, VecDeque};

const MAX_FRAME: usize = 65_536;
const MAX_ITEMS: usize = 64;
const MAX_SKILLS: usize = 255;
const MAX_BOARDS: usize = 32;
const MAX_NODES: usize = 255;
const MAX_INSPECTIONS: usize = 16;
const PENDING_MS: u64 = 30_000;
const MAX_PETS: usize = 2_000;
const MAX_PET_CHANGE_FRAME: usize = 4_096;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CharacterError {
    Truncated,
    Invalid,
    Unsupported,
    Limit,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Stone {
    pub stat_id: u16,
    pub tier: u8,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct RolledStat {
    pub stat_id: u16,
    pub value: u32,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct SkillBonus {
    pub skill_id: u32,
    pub levels: u8,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ObservedItem {
    pub entry_index: u8,
    pub slot: Option<u8>,
    pub item_id: u32,
    pub enchant: Option<u8>,
    pub stones: Option<Vec<Stone>>,
    pub stats: Option<Vec<RolledStat>>,
    pub godstone_id: Option<u32>,
    pub skill_bonuses: Option<Vec<SkillBonus>>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ObservedSkill {
    pub skill_id: u32,
    pub level: u8,
    pub base_level: u8,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ObservedBoard {
    pub board_id: u32,
    pub node_ids: Vec<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ObservedCombatPower {
    pub current: u32,
    pub highest: u32,
    pub observed_at_ms: u64,
    pub source: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ObservedWing {
    pub wing_id: u32,
    pub skin_id: Option<u32>,
    pub observed_at_ms: u64,
    pub source: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ObservedSpeciesEffect {
    pub page: u8,
    pub slot: u8,
    pub kind: u8,
    pub stat_id: u16,
    pub value: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ObservedSpecies {
    pub species_id: u8,
    pub level: u32,
    pub progress: u64,
    pub effects: Vec<ObservedSpeciesEffect>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct CharacterBuild {
    pub actor_id: Option<u64>,
    pub name: String,
    pub server_id: Option<u32>,
    pub observed_at_ms: u64,
    pub equipment: Vec<ObservedItem>,
    pub skills: Vec<ObservedSkill>,
    pub boards: Vec<ObservedBoard>,
    pub equipment_observed_at_ms: Option<u64>,
    pub skills_observed_at_ms: Option<u64>,
    pub boards_observed_at_ms: Option<u64>,
    pub equipment_complete: bool,
    pub skills_complete: bool,
    pub source: String,
    #[serde(default)]
    pub combat_power: Option<ObservedCombatPower>,
    #[serde(default)]
    pub wing: Option<ObservedWing>,
    #[serde(default)]
    pub species: Vec<ObservedSpecies>,
    #[serde(default)]
    pub species_observed_at_ms: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct InspectedCharacter {
    pub name: String,
    pub class_code: u32,
    pub level: u32,
    pub gear_score: Option<u32>,
    pub equipment: Vec<ObservedItem>,
    pub equipment_complete: bool,
    pub observed_at_ms: u64,
    pub source: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CharacterEvent {
    CombatPower {
        current: u32,
        highest: u32,
    },
    Wing {
        wing_id: u32,
        skin_id: Option<u32>,
    },
    Species {
        species: Vec<ObservedSpecies>,
    },
    Equipment {
        items: Vec<ObservedItem>,
        complete: bool,
    },
    Skills {
        skills: Vec<ObservedSkill>,
        complete: bool,
    },
    Daevanion {
        boards: Vec<ObservedBoard>,
    },
    Inspection(InspectedCharacter),
    PetInventory {
        active_pet_id: Option<u32>,
        active_pet_known: bool,
        pets: Vec<ObservedPetProgress>,
    },
    PetGains {
        gains: Vec<(u32, u32)>,
    },
    PetLevel {
        pet_id: u32,
        level: u32,
    },
    PetAdded {
        pet_id: u32,
        level: u32,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ObservedPetProgress {
    pub pet_id: u32,
    pub level: Option<u32>,
    pub progress: Option<u64>,
    pub progress_source: String,
    pub required_progress: Option<u64>,
    pub session_gained: u64,
    pub observed_at_ms: u64,
    #[serde(default)]
    pub session_started_at_ms: Option<u64>,
    /// Already-observed gains at the timing baseline, excluded from a rate.
    /// A first delta has no measured interval preceding its arrival.
    #[serde(default)]
    pub session_baseline_gained: u64,
    #[serde(default)]
    pub session_gain_events: u64,
    #[serde(default)]
    pub last_gain_at_ms: Option<u64>,
    /// A discontinuity broke the absolute counter's baseline. The received
    /// value remains useful history, but subsequent deltas cannot advance it.
    #[serde(default)]
    pub progress_stale: bool,
}

impl ObservedPetProgress {
    fn observed(pet_id: u32, level: Option<u32>, progress: Option<u64>, now: u64) -> Self {
        Self {
            pet_id,
            level,
            progress,
            progress_source: if progress.is_some() {
                "server-absolute"
            } else {
                "unknown"
            }
            .into(),
            required_progress: None,
            session_gained: 0,
            observed_at_ms: now,
            session_started_at_ms: Some(now),
            session_baseline_gained: 0,
            session_gain_events: 0,
            last_gain_at_ms: None,
            progress_stale: false,
        }
    }

    fn inherit_session(&mut self, previous: &Self) {
        self.session_gained = previous.session_gained;
        if let Some(started_at_ms) = previous.session_started_at_ms {
            self.session_started_at_ms = Some(started_at_ms);
            self.session_baseline_gained = previous.session_baseline_gained;
        } else {
            // A legacy snapshot without timing cannot supply an elapsed rate.
            self.session_baseline_gained = previous.session_gained;
        }
        self.session_gain_events = previous.session_gain_events;
        self.last_gain_at_ms = previous.last_gain_at_ms;
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PetContinuity {
    #[default]
    Live,
    LastKnown,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct PetProgressSnapshot {
    pub actor_id: Option<u64>,
    pub source: String,
    pub observed_at_ms: u64,
    pub active_pet_id: Option<u32>,
    pub active_pet_known: bool,
    pub inventory_complete: bool,
    pub pets: Vec<ObservedPetProgress>,
    #[serde(default)]
    pub continuity: PetContinuity,
    #[serde(default)]
    pub stale_reason: Option<String>,
    #[serde(default)]
    pub stale_at_ms: Option<u64>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct PetCollectionOwner {
    pub actor_id: u64,
    pub source: String,
    pub generation: u64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct CharacterSnapshot {
    #[serde(default)]
    pub pet_collection_owner: Option<PetCollectionOwner>,
    pub own: Option<CharacterBuild>,
    pub unbound_own: Option<CharacterBuild>,
    pub inspected: Vec<InspectedCharacter>,
    pub retention_limited: bool,
    #[serde(default)]
    pub pet_progress: Option<PetProgressSnapshot>,
}

struct Reader<'a> {
    bytes: &'a [u8],
    offset: usize,
}
impl<'a> Reader<'a> {
    fn take<const N: usize>(&mut self) -> Result<[u8; N], CharacterError> {
        let end = self.offset.checked_add(N).ok_or(CharacterError::Limit)?;
        let raw = self
            .bytes
            .get(self.offset..end)
            .ok_or(CharacterError::Truncated)?;
        self.offset = end;
        raw.try_into().map_err(|_| CharacterError::Truncated)
    }
    fn byte(&mut self) -> Result<u8, CharacterError> {
        Ok(self.take::<1>()?[0])
    }
    fn short(&mut self) -> Result<u16, CharacterError> {
        Ok(u16::from_le_bytes(self.take()?))
    }
    fn word(&mut self) -> Result<u32, CharacterError> {
        Ok(u32::from_le_bytes(self.take()?))
    }
    fn variable(&mut self) -> Result<u32, CharacterError> {
        crate::framing::varint(self.bytes, &mut self.offset).map_err(|error| match error {
            crate::framing::ReadError::Short => CharacterError::Truncated,
            crate::framing::ReadError::Invalid => CharacterError::Invalid,
        })
    }
    fn end(&self) -> Result<(), CharacterError> {
        if self.offset == self.bytes.len() {
            Ok(())
        } else {
            Err(CharacterError::Invalid)
        }
    }
}

fn word_at(bytes: &[u8], offset: usize) -> Option<u32> {
    Some(u32::from_le_bytes(
        bytes.get(offset..offset + 4)?.try_into().ok()?,
    ))
}
fn zeros(bytes: &[u8], start: usize, count: usize) -> bool {
    bytes
        .get(start..start.saturating_add(count))
        .is_some_and(|raw| raw.iter().all(|byte| *byte == 0))
}
fn plausible_item_id(value: u32) -> bool {
    (100_000..=1_000_000_000).contains(&value)
}

#[derive(Clone)]
struct ItemDetails {
    slot: u8,
    stones: Vec<Stone>,
    stats: Option<Vec<RolledStat>>,
    godstone: u32,
    bonuses: Option<Vec<SkillBonus>>,
}

fn stats(reader: &mut Reader<'_>) -> Result<Vec<RolledStat>, CharacterError> {
    let count = usize::from(reader.byte()?);
    if count > 8 {
        return Err(CharacterError::Limit);
    }
    let mut values = Vec::with_capacity(count);
    for _ in 0..count {
        values.push(RolledStat {
            stat_id: reader.short()?,
            value: reader.word()?,
        })
    }
    Ok(values)
}

fn detail_at(bytes: &[u8], size: usize, expected_slot: Option<u8>) -> Option<ItemDetails> {
    let size_word = word_at(bytes, size)?;
    if !(1..=512).contains(&size_word) {
        return None;
    }
    let mut accepted = None;
    for opaque_flags in 0..=2 {
        let slot_offset = size.checked_add(4 + opaque_flags)?;
        let slot = *bytes.get(slot_offset)?;
        if !(1..=64).contains(&slot) || expected_slot.is_some_and(|expected| expected != slot) {
            continue;
        }
        let count = usize::from(*bytes.get(slot_offset + 1)?);
        if !(1..=6).contains(&count) {
            continue;
        }
        let mut reader = Reader {
            bytes,
            offset: slot_offset + 2,
        };
        let mut stones = Vec::with_capacity(count);
        let mut constant = None;
        let mut valid = true;
        for _ in 0..count {
            let Ok(marker) = reader.word() else {
                valid = false;
                break;
            };
            let Ok(stat_id) = reader.short() else {
                valid = false;
                break;
            };
            let Ok(tier) = reader.byte() else {
                valid = false;
                break;
            };
            if marker == 0
                || constant.is_some_and(|old| old != marker)
                || tier > 4
                || (stat_id == 0) != (tier == 0)
            {
                valid = false;
                break;
            }
            constant = Some(marker);
            stones.push(Stone { stat_id, tier });
        }
        if !valid {
            continue;
        }
        let Ok(owner) = reader.take::<10>() else {
            continue;
        };
        if owner[4..6] != [0, 0] || owner[9] != 3 {
            continue;
        }
        let Ok(godstone) = reader.word() else {
            continue;
        };
        let Ok(reserved) = reader.take::<9>() else {
            continue;
        };
        if reserved != [0; 9] {
            continue;
        }
        let rolled = stats(&mut reader).ok();
        let bonuses = if rolled.is_some() && stats(&mut reader).is_ok() {
            let count = reader.byte().ok().map(usize::from);
            if let Some(count) = count.filter(|count| *count <= 8) {
                let mut values = Vec::with_capacity(count);
                let mut complete = true;
                for _ in 0..count {
                    match (reader.word(), reader.byte()) {
                        (Ok(skill_id), Ok(levels)) if skill_id > 0 && levels <= 60 => {
                            values.push(SkillBonus { skill_id, levels })
                        }
                        _ => {
                            complete = false;
                            break;
                        }
                    }
                }
                complete.then_some(values)
            } else {
                None
            }
        } else {
            None
        };
        let candidate = ItemDetails {
            slot,
            stones,
            stats: rolled,
            godstone,
            bonuses,
        };
        if accepted.as_ref().is_some_and(|old: &ItemDetails| {
            old.slot != candidate.slot || old.stones != candidate.stones
        }) {
            return None;
        }
        accepted = Some(candidate);
    }
    accepted
}

fn item_from_boundary(
    bytes: &[u8],
    id_offset: usize,
    slot: Option<u8>,
    index: usize,
    inspected: bool,
) -> Option<ObservedItem> {
    let item_id = word_at(bytes, id_offset)?;
    if !plausible_item_id(item_id) {
        return None;
    }
    let shift = if inspected && matches!(*bytes.get(id_offset + 13)?, 0x9c | 0x1c) {
        1
    } else {
        0
    };
    let mut enchant = if inspected {
        bytes
            .get(id_offset + 13 + shift)
            .copied()
            .filter(|value| *value <= 30)
    } else {
        None
    };
    let first = if inspected {
        id_offset + 14 + shift
    } else {
        id_offset + 34
    };
    let last = if inspected {
        id_offset + 34 + shift
    } else {
        id_offset + 45
    };
    let mut found = None;
    let mut enchant_boundary_seen = inspected;
    for size_offset in first..last.min(bytes.len()) {
        if word_at(bytes, size_offset).is_none_or(|size| !(1..=512).contains(&size)) {
            continue;
        }
        let details = detail_at(bytes, size_offset, slot);
        if !enchant_boundary_seen {
            if let Some(value) = bytes
                .get(size_offset.saturating_sub(14))
                .copied()
                .filter(|value| *value <= 30)
            {
                enchant = Some(value)
            }
            enchant_boundary_seen = true;
        }
        if let Some(details) = details {
            found = Some(details);
            break;
        }
    }
    // Inspection records have no explicit inventory slot at their item prefix.
    // Accept them only when the stone/owner block establishes a real boundary.
    if inspected && found.is_none() {
        return None;
    }
    Some(ObservedItem {
        entry_index: index as u8,
        slot: slot.or_else(|| found.as_ref().map(|details| details.slot)),
        item_id,
        enchant,
        stones: found.as_ref().map(|details| details.stones.clone()),
        stats: found.as_ref().and_then(|details| details.stats.clone()),
        godstone_id: found.as_ref().map(|details| details.godstone),
        skill_bonuses: found.and_then(|details| details.bonuses),
    })
}

fn equipment(frame: &[u8]) -> Result<Option<CharacterEvent>, CharacterError> {
    let mut starts = Vec::new();
    for offset in 2..frame.len().saturating_sub(13) {
        if word_at(frame, offset).is_some_and(plausible_item_id)
            && frame.get(offset + 4..offset + 8) == Some(&[1, 0, 0, 0])
            && zeros(frame, offset + 8, 4)
            && frame.get(offset + 12) == Some(&0x0b)
            && frame
                .get(offset + 13)
                .is_some_and(|slot| (1..=64).contains(slot))
        {
            starts.push(offset);
            if starts.len() > MAX_ITEMS {
                return Err(CharacterError::Limit);
            }
        }
    }
    if starts.is_empty() {
        return Ok(None);
    }
    let mut items = Vec::with_capacity(starts.len());
    let mut slots = BTreeSet::new();
    for (index, offset) in starts.iter().copied().enumerate() {
        let end = starts.get(index + 1).copied().unwrap_or(frame.len());
        let slot = frame[offset + 13];
        if !slots.insert(slot) {
            return Err(CharacterError::Invalid);
        }
        let mut entry = item_from_boundary(&frame[..end], offset, Some(slot), index, false)
            .ok_or(CharacterError::Invalid)?;
        // A signature alone proves no complete details block or list count.
        if end < offset + 34 {
            entry.enchant = None
        }
        items.push(entry);
    }
    Ok(Some(CharacterEvent::Equipment {
        items,
        complete: false,
    }))
}

fn skills(frame: &[u8]) -> Result<Option<CharacterEvent>, CharacterError> {
    let mut reader = Reader {
        bytes: frame,
        offset: 2,
    };
    let count = usize::from(reader.byte()?);
    if count > MAX_SKILLS {
        return Err(CharacterError::Limit);
    }
    let mut skills = Vec::with_capacity(count);
    let mut seen = BTreeSet::new();
    for _ in 0..count {
        let kind = reader.byte()?;
        if kind != 1 && kind != 5 {
            return Err(CharacterError::Unsupported);
        }
        let skill_id = reader.word()?;
        let level = reader.byte()?;
        let base_level = reader.byte()?;
        reader.take::<9>()?;
        if kind == 5 {
            reader.byte()?;
        }
        if skill_id == 0
            || skill_id > 300_000_000
            || level == 0
            || level > 60
            || base_level > level
            || !seen.insert(skill_id)
        {
            return Err(CharacterError::Invalid);
        }
        skills.push(ObservedSkill {
            skill_id,
            level,
            base_level,
        });
    }
    reader.end()?;
    Ok(Some(CharacterEvent::Skills {
        skills,
        complete: true,
    }))
}

fn daevanion(frame: &[u8]) -> Result<Option<CharacterEvent>, CharacterError> {
    let mut reader = Reader {
        bytes: frame,
        offset: 2,
    };
    let count = usize::from(reader.byte()?);
    if count > MAX_BOARDS {
        return Err(CharacterError::Limit);
    }
    let mut boards = Vec::with_capacity(count);
    let mut seen = BTreeSet::new();
    for _ in 0..count {
        let board_id = reader.word()?;
        if board_id == 0 || !seen.insert(board_id) {
            return Err(CharacterError::Invalid);
        }
        let count = usize::from(reader.byte()?);
        if count > MAX_NODES {
            return Err(CharacterError::Limit);
        }
        let mut nodes = Vec::with_capacity(count);
        let mut unique = BTreeSet::new();
        for _ in 0..count {
            let node = reader.word()?;
            if node == 0 || !unique.insert(node) {
                return Err(CharacterError::Invalid);
            }
            nodes.push(node)
        }
        boards.push(ObservedBoard {
            board_id,
            node_ids: nodes,
        });
    }
    reader.end()?;
    Ok(Some(CharacterEvent::Daevanion { boards }))
}

fn inspect(frame: &[u8]) -> Result<Option<CharacterEvent>, CharacterError> {
    let length = usize::from(*frame.get(5).ok_or(CharacterError::Truncated)?);
    if length == 0 || length > 80 {
        return Err(CharacterError::Invalid);
    }
    let after = 6 + length;
    let raw_name = frame.get(6..after).ok_or(CharacterError::Truncated)?;
    let name = std::str::from_utf8(raw_name).map_err(|_| CharacterError::Invalid)?;
    if name.chars().any(char::is_control) || name.trim() != name {
        return Err(CharacterError::Invalid);
    }
    let class_code = word_at(frame, after).ok_or(CharacterError::Truncated)?;
    let level = word_at(frame, after + 6).ok_or(CharacterError::Truncated)?;
    let gear_score = word_at(frame, after + 14).ok_or(CharacterError::Truncated)?;
    if !matches!(class_code % 4, 1 | 2)
        || !(1..=9).contains(&(class_code / 4))
        || !(1..=200).contains(&level)
    {
        return Err(CharacterError::Invalid);
    }
    let mut items = Vec::new();
    let mut occupied = BTreeSet::new();
    let mut offset = after + 18;
    while offset + 14 <= frame.len() {
        if word_at(frame, offset).is_some_and(plausible_item_id) && zeros(frame, offset + 4, 9) {
            if let Some(entry) = item_from_boundary(frame, offset, None, items.len(), true) {
                if items.len() >= MAX_ITEMS {
                    return Err(CharacterError::Limit);
                }
                if entry.slot.is_some_and(|slot| !occupied.insert(slot)) {
                    return Err(CharacterError::Invalid);
                }
                items.push(entry);
                offset += 14;
                continue;
            }
        }
        offset += 1;
    }
    Ok(Some(CharacterEvent::Inspection(InspectedCharacter {
        name: name.into(),
        class_code,
        level,
        gear_score: Some(gear_score),
        equipment: items,
        equipment_complete: false,
        observed_at_ms: 0,
        source: "server-inspection-unbound".into(),
    })))
}

fn pet_inventory_prefix(frame: &[u8]) -> Result<(CharacterEvent, usize), CharacterError> {
    let mut reader = Reader {
        bytes: frame,
        offset: 2,
    };
    // This word matches the summoned pet on the observed client. Other
    // published captures leave its meaning unknown, so an unrecognized value
    // cannot invalidate the independently counted collection which follows.
    let active = reader.word()?;
    let count = reader.variable()? as usize;
    if count > MAX_PETS {
        return Err(CharacterError::Limit);
    }
    let mut ids = BTreeSet::new();
    let mut pets = Vec::with_capacity(count);
    for _ in 0..count {
        let id = reader.word()?;
        let repeated_id = reader.word()?;
        let level = reader.word()?;
        if !(1_000..=99_999).contains(&id) || id != repeated_id || level > 3 || !ids.insert(id) {
            return Err(CharacterError::Invalid);
        }
        pets.push(ObservedPetProgress::observed(id, Some(level), None, 0));
    }
    let active_pet_known = active == 0 || ids.contains(&active);
    let progress_count = reader.variable()? as usize;
    if progress_count > MAX_PETS {
        return Err(CharacterError::Limit);
    }
    let mut progress_ids = BTreeSet::new();
    for _ in 0..progress_count {
        let id = reader.word()?;
        let progress = reader.word()?;
        if !(1_000..=99_999).contains(&id) || !progress_ids.insert(id) {
            return Err(CharacterError::Invalid);
        }
        let index = if let Some(index) = pets.iter().position(|pet| pet.pet_id == id) {
            index
        } else {
            if pets.len() >= MAX_PETS {
                return Err(CharacterError::Limit);
            }
            // Points and levels are separate server lists. A points-only row
            // is a real observation, but supplies no explicit level.
            pets.push(ObservedPetProgress::observed(id, None, None, 0));
            pets.len() - 1
        };
        let pet = &mut pets[index];
        pet.progress = Some(u64::from(progress));
        pet.progress_source = "server-absolute".into();
    }
    // The same login frame continues with independently counted species data.
    // Only the validated pet prefix is used; that tail is not a pet catalog.
    pets.sort_by_key(|pet| pet.pet_id);
    Ok((
        CharacterEvent::PetInventory {
            active_pet_id: (active_pet_known && active != 0).then_some(active),
            active_pet_known,
            pets,
        },
        reader.offset,
    ))
}

/// Species knowledge shares the pet login frame. Only a complete, unique chain
/// of all five received blocks is accepted. Names and stat meanings are not
/// guessed from an external catalog.
pub fn decode_species(frame: &[u8]) -> Result<Option<CharacterEvent>, CharacterError> {
    if frame.get(..2) != Some(&[0, 0x90]) {
        return Ok(None);
    }
    if frame.len() > MAX_FRAME {
        return Err(CharacterError::Limit);
    }
    let (_, start) = pet_inventory_prefix(frame)?;
    let mut found = None;
    let mut candidates = 0;
    for offset in start..frame.len().saturating_sub(14) {
        if frame.get(offset..offset + 2) != Some(&[2, 2]) {
            continue;
        }
        candidates += 1;
        if candidates > 32 {
            return Err(CharacterError::Limit);
        }
        if let Ok(species) = species_chain(frame, offset) {
            if found.is_some() {
                return Err(CharacterError::Invalid);
            }
            found = Some(CharacterEvent::Species { species });
        }
    }
    Ok(found)
}

fn species_chain(frame: &[u8], offset: usize) -> Result<Vec<ObservedSpecies>, CharacterError> {
    let mut reader = Reader {
        bytes: frame,
        offset,
    };
    let mut species = Vec::with_capacity(5);
    for species_id in 2..=6 {
        if species_id > 2
            && reader
                .bytes
                .get(reader.offset)
                .is_some_and(|byte| *byte > 9)
        {
            reader.byte()?;
        }
        if reader.byte()? != species_id || reader.byte()? != species_id {
            return Err(CharacterError::Invalid);
        }
        let level = reader.word()?;
        let progress = u64::from_le_bytes(reader.take()?);
        let pages = reader.byte()?;
        if !(1..=99).contains(&level)
            || progress > 9_007_199_254_740_991
            || !(1..=5).contains(&pages)
        {
            return Err(CharacterError::Invalid);
        }
        let mut effects = Vec::new();
        for page in 1..=pages {
            if reader
                .bytes
                .get(reader.offset)
                .is_some_and(|byte| *byte > 9)
            {
                reader.byte()?;
            }
            if reader.byte()? != page {
                return Err(CharacterError::Invalid);
            }
            let slots = reader.byte()?;
            if slots > 32 {
                return Err(CharacterError::Limit);
            }
            for slot in 0..slots {
                if reader
                    .bytes
                    .get(reader.offset)
                    .is_some_and(|byte| *byte != slot && *byte > 9)
                {
                    reader.byte()?;
                }
                if reader.byte()? != slot {
                    return Err(CharacterError::Invalid);
                }
                let kind = reader.byte()?;
                let stat_id = u16::from_le_bytes(reader.take()?);
                let value = i64::from_le_bytes(reader.take()?);
                if value.unsigned_abs() > 1_000_000_000_000 || stat_id == 0 && value != 0 {
                    return Err(CharacterError::Invalid);
                }
                if stat_id != 0 {
                    effects.push(ObservedSpeciesEffect {
                        page,
                        slot,
                        kind,
                        stat_id,
                        value,
                    });
                }
            }
        }
        species.push(ObservedSpecies {
            species_id,
            level,
            progress,
            effects,
        });
    }
    Ok(species)
}

/// A wing observation is accepted only by the caller after validating the own
/// character identity record. An ambiguous anchor never establishes ownership.
pub fn decode_own_wing(frame: &[u8]) -> Option<CharacterEvent> {
    if frame.get(..2) != Some(&[0x33, 0x36]) || frame.len() > MAX_FRAME {
        return None;
    }
    let anchor = [0xa0, 0x86, 1, 0, 0xa0, 0x86, 1, 0];
    let anchors: Vec<_> = frame
        .windows(anchor.len())
        .enumerate()
        .filter_map(|(index, bytes)| (bytes == anchor).then_some(index))
        .take(2)
        .collect();
    if anchors.len() != 1 {
        return None;
    }
    let flags = anchors[0].checked_add(16)?;
    let wing_at = if frame.get(flags..flags + 5) == Some(&[1, 0, 0, 0, 1]) {
        flags + 5
    } else if frame.get(flags) == Some(&1) {
        flags + 1
    } else {
        return None;
    };
    let wing_id = word_at(frame, wing_at)?;
    if !(30_000_000..=30_599_999).contains(&wing_id) || (30_400_000..=30_499_999).contains(&wing_id)
    {
        return None;
    }
    let skin_id =
        word_at(frame, wing_at + 4).filter(|value| (30_400_000..=30_499_999).contains(value));
    Some(CharacterEvent::Wing { wing_id, skin_id })
}

fn combat_power(frame: &[u8]) -> Result<Option<CharacterEvent>, CharacterError> {
    if frame.len() != 18 {
        return Err(CharacterError::Invalid);
    }
    let current = word_at(frame, 2).ok_or(CharacterError::Truncated)?;
    let highest = word_at(frame, 10).ok_or(CharacterError::Truncated)?;
    if !zeros(frame, 6, 4)
        || !zeros(frame, 14, 4)
        || !(1..=100_000_000).contains(&current)
        || !(1..=100_000_000).contains(&highest)
    {
        return Err(CharacterError::Invalid);
    }
    // Ordering is not a gate: the server can update current/highest separately.
    Ok(Some(CharacterEvent::CombatPower { current, highest }))
}

fn pet_gains(frame: &[u8]) -> Result<Option<CharacterEvent>, CharacterError> {
    let mut reader = Reader {
        bytes: frame,
        offset: 2,
    };
    let count = usize::from(reader.byte()?);
    let mut gains = Vec::with_capacity(count);
    let mut ids = BTreeSet::new();
    for _ in 0..count {
        let id = reader.word()?;
        let gained = reader.word()?;
        if !(1_000..=99_999).contains(&id) || !(1..1_000).contains(&gained) || !ids.insert(id) {
            return Err(CharacterError::Invalid);
        }
        gains.push((id, gained));
    }
    reader.end()?;
    Ok(Some(CharacterEvent::PetGains { gains }))
}

fn pet_change_prefix(frame: &[u8]) -> Result<(u32, u32), CharacterError> {
    if frame.len() > MAX_PET_CHANGE_FRAME {
        return Err(CharacterError::Limit);
    }
    let mut reader = Reader {
        bytes: frame,
        offset: 4,
    };
    let pet_id = reader.word()?;
    let level = reader.word()?;
    if !(1_000..=99_999).contains(&pet_id) || !(1..=3).contains(&level) {
        return Err(CharacterError::Invalid);
    }
    // Both event families carry independently documented fixed fields followed
    // by additional opaque data. The enclosing frame provides their boundary;
    // those unneeded suffix fields must not invalidate a received level.
    Ok((pet_id, level))
}

fn pet_level(frame: &[u8]) -> Result<Option<CharacterEvent>, CharacterError> {
    if !zeros(frame, 2, 2) {
        return Err(if frame.len() < 4 {
            CharacterError::Truncated
        } else {
            CharacterError::Invalid
        });
    }
    let (pet_id, level) = pet_change_prefix(frame)?;
    Ok(Some(CharacterEvent::PetLevel { pet_id, level }))
}

fn pet_added(frame: &[u8]) -> Result<Option<CharacterEvent>, CharacterError> {
    // The two bytes following 09 90 are opaque in the published capture
    // layout. They are not the reserved-zero field of the 14 90 family.
    let (pet_id, level) = pet_change_prefix(frame)?;
    Ok(Some(CharacterEvent::PetAdded { pet_id, level }))
}

fn valid_pet_event(event: &CharacterEvent) -> bool {
    let valid_id = |id: u32| (1_000..=99_999).contains(&id);
    match event {
        CharacterEvent::PetInventory {
            active_pet_id,
            active_pet_known,
            pets,
        } => {
            if pets.len() > MAX_PETS {
                return false;
            }
            let mut ids = BTreeSet::new();
            pets.iter().all(|pet| {
                valid_id(pet.pet_id)
                    && ids.insert(pet.pet_id)
                    && pet.level.is_none_or(|level| level <= 3)
                    && (pet.level.is_some() || pet.progress.is_some())
                    && pet
                        .progress
                        .is_none_or(|progress| progress <= u64::from(u32::MAX))
            }) && active_pet_id.is_none_or(|id| *active_pet_known && ids.contains(&id))
        }
        CharacterEvent::PetGains { gains } => {
            let mut ids = BTreeSet::new();
            gains.len() <= usize::from(u8::MAX)
                && gains.iter().all(|(id, gained)| {
                    valid_id(*id) && (1..1_000).contains(gained) && ids.insert(*id)
                })
        }
        CharacterEvent::PetLevel { pet_id, level } | CharacterEvent::PetAdded { pet_id, level } => {
            valid_id(*pet_id) && (1..=3).contains(level)
        }
        _ => false,
    }
}

pub fn decode(frame: &[u8]) -> Result<Option<CharacterEvent>, CharacterError> {
    let opcode = frame.get(..2).ok_or(CharacterError::Truncated)?;
    if !matches!(
        opcode,
        [0x11, 0x56]
            | [0, 0x51]
            | [0x26, 0xe2]
            | [0x50, 0x36]
            | [0, 0x90]
            | [0x0d, 0x90]
            | [0x14, 0x90]
            | [9, 0x90]
            | [0x56, 0x36]
    ) {
        return Ok(None);
    }
    if frame.len() > MAX_FRAME {
        return Err(CharacterError::Limit);
    }
    match opcode {
        [0x11, 0x56] => equipment(frame),
        [0, 0x51] => skills(frame),
        [0x26, 0xe2] => daevanion(frame),
        [0x50, 0x36] => inspect(frame),
        [0, 0x90] => pet_inventory_prefix(frame).map(|(event, _)| Some(event)),
        [0x0d, 0x90] => pet_gains(frame),
        [0x14, 0x90] => pet_level(frame),
        [9, 0x90] => pet_added(frame),
        [0x56, 0x36] => combat_power(frame),
        _ => Ok(None),
    }
}

#[derive(Clone, Debug, Default)]
pub struct CharacterStore {
    own: Option<CharacterBuild>,
    unbound: Option<CharacterBuild>,
    inspected: VecDeque<InspectedCharacter>,
    last_ms: Option<u64>,
    limited: bool,
    pets: Option<PetProgressSnapshot>,
    unbound_pets: Option<PetProgressSnapshot>,
}
impl CharacterStore {
    pub fn matches_server_self(&self, actor_id: u64, name: &str) -> bool {
        self.own.as_ref().is_some_and(|own| {
            own.source == "server-self"
                && own.actor_id == Some(actor_id)
                && !name.is_empty()
                && own.name == name
        })
    }
    pub fn clear(&mut self) {
        *self = Self::default()
    }
    pub fn clear_pets(&mut self) {
        self.pets = None;
        self.unbound_pets = None;
    }
    /// Preserve last received collection values only while the same verified
    /// self identity survives a transport discontinuity. All other character
    /// observations and unbound lists are discarded as before.
    pub fn invalidate_capture(&mut self, now: u64, reason: &str) {
        let verified_own = self.own.as_ref().filter(|own| {
            own.source == "server-self" && own.actor_id.is_some() && !own.name.is_empty()
        });
        let mut pets = self.pets.take().filter(|pets| {
            verified_own.is_some_and(|own| pets.actor_id == own.actor_id)
                && pets.source == "server-self"
        });
        let own = verified_own.map(|own| CharacterBuild {
            actor_id: own.actor_id,
            name: own.name.clone(),
            server_id: own.server_id,
            source: own.source.clone(),
            ..Default::default()
        });
        let at = self.last_ms.unwrap_or(now).max(now);
        if let Some(snapshot) = &mut pets {
            snapshot.continuity = PetContinuity::LastKnown;
            snapshot.stale_reason = Some(reason.into());
            snapshot.stale_at_ms.get_or_insert(at);
            for pet in &mut snapshot.pets {
                pet.progress_stale = true;
                pet.session_gained = 0;
                pet.session_started_at_ms = None;
                pet.session_baseline_gained = 0;
                pet.session_gain_events = 0;
                pet.last_gain_at_ms = None;
            }
        }
        *self = Self {
            own,
            pets,
            last_ms: Some(now),
            ..Default::default()
        };
    }
    fn clock(&mut self, now: u64) {
        if self.last_ms.is_some_and(|old| now < old) {
            self.invalidate_capture(now, "clock-reversal")
        }
        self.last_ms = Some(now)
    }
    pub fn bind_self(&mut self, actor_id: u64, name: &str, server_id: Option<u32>, now: u64) {
        self.clock(now);
        if actor_id == 0 || actor_id > u64::from(u32::MAX) {
            return;
        }
        let name: String = name
            .chars()
            .filter(|character| !character.is_control())
            .take(80)
            .collect();
        let same_character = self.own.as_ref().is_some_and(|old| {
            old.actor_id == Some(actor_id)
                && !name.is_empty()
                && old.name == name
                && !old.server_id.zip(server_id).is_some_and(|(a, b)| a != b)
        });
        let first_binding = self.own.is_none();
        let mut pets = if same_character {
            self.pets.take()
        } else if first_binding {
            self.unbound_pets.take().filter(|pending| {
                now >= pending.observed_at_ms && now - pending.observed_at_ms <= PENDING_MS
            })
        } else {
            self.unbound_pets = None;
            None
        };
        if let Some(pets) = &mut pets {
            pets.actor_id = Some(actor_id);
            pets.source = "server-self".into();
        }
        self.pets = pets;
        let mut build = if same_character {
            self.own.take().unwrap_or_default()
        } else if first_binding {
            self.unbound
                .take()
                .filter(|pending| {
                    now >= pending.observed_at_ms && now - pending.observed_at_ms <= PENDING_MS
                })
                .unwrap_or_default()
        } else {
            self.unbound = None;
            CharacterBuild::default()
        };
        build.actor_id = Some(actor_id);
        build.name = name;
        // Rebinding after a transport gap does not carry a new server field.
        // Its omission must not erase the server used to isolate this profile.
        build.server_id = server_id.or(build.server_id);
        build.source = "server-self".into();
        if !same_character {
            build.combat_power = build.combat_power.filter(|value| {
                now >= value.observed_at_ms && now - value.observed_at_ms <= PENDING_MS
            });
            build.wing = build.wing.filter(|value| {
                now >= value.observed_at_ms && now - value.observed_at_ms <= PENDING_MS
            });
            if build
                .species_observed_at_ms
                .is_none_or(|at| now < at || now - at > PENDING_MS)
            {
                build.species.clear();
                build.species_observed_at_ms = None;
            }
        }
        self.own = Some(build);
    }
    pub fn ingest(&mut self, event: CharacterEvent, now: u64) {
        if matches!(
            event,
            CharacterEvent::PetInventory { .. }
                | CharacterEvent::PetGains { .. }
                | CharacterEvent::PetLevel { .. }
                | CharacterEvent::PetAdded { .. }
        ) {
            if !valid_pet_event(&event) {
                return;
            }
            if let CharacterEvent::PetAdded { pet_id, .. } = &event {
                let snapshot = if self.own.is_some() {
                    self.pets.as_ref()
                } else {
                    self.unbound_pets.as_ref()
                };
                // Registration notifications are not upgrades for a pet that
                // is already registered. A duplicate must preserve its current
                // tier counter, observation time and rate baseline.
                if snapshot.is_some_and(|snapshot| {
                    snapshot.pets.iter().any(|pet| {
                        pet.pet_id == *pet_id && pet.level.is_some_and(|level| level > 0)
                    })
                }) {
                    return;
                }
            }
            self.clock(now);
            self.ingest_pets(event, now);
            return;
        }
        self.clock(now);
        if let CharacterEvent::Inspection(mut inspected) = event {
            inspected.observed_at_ms = now;
            self.inspected.retain(|old| {
                !(old.name == inspected.name
                    && old.class_code == inspected.class_code
                    && old.level == inspected.level
                    && old.gear_score == inspected.gear_score
                    && old.equipment == inspected.equipment)
            });
            if self.inspected.len() >= MAX_INSPECTIONS {
                self.inspected.pop_back();
                self.limited = true
            }
            self.inspected.push_front(inspected);
            return;
        }
        let build = if let Some(build) = &mut self.own {
            build
        } else {
            self.unbound.get_or_insert_with(|| CharacterBuild {
                source: "server-self-unbound".into(),
                ..Default::default()
            })
        };
        build.observed_at_ms = now;
        match event {
            CharacterEvent::CombatPower { current, highest } => {
                if !(1..=100_000_000).contains(&current) || !(1..=100_000_000).contains(&highest) {
                    return;
                }
                build.combat_power = Some(ObservedCombatPower {
                    current,
                    highest,
                    observed_at_ms: now,
                    source: "server-self".into(),
                });
            }
            CharacterEvent::Wing { wing_id, skin_id } => {
                if !(30_000_000..=30_599_999).contains(&wing_id)
                    || (30_400_000..=30_499_999).contains(&wing_id)
                    || skin_id.is_some_and(|value| !(30_400_000..=30_499_999).contains(&value))
                {
                    return;
                }
                build.wing = Some(ObservedWing {
                    wing_id,
                    skin_id,
                    observed_at_ms: now,
                    source: "server-self".into(),
                });
            }
            CharacterEvent::Species { species } => {
                if species.len() != 5
                    || species.iter().enumerate().any(|(index, row)| {
                        row.species_id != (index + 2) as u8
                            || !(1..=99).contains(&row.level)
                            || row.progress > 9_007_199_254_740_991
                            || row.effects.len() > 160
                    })
                {
                    return;
                }
                build.species = species;
                build.species_observed_at_ms = Some(now);
            }
            CharacterEvent::Equipment { items, complete } => {
                build.equipment = items;
                build.equipment_complete = complete;
                build.equipment_observed_at_ms = Some(now)
            }
            CharacterEvent::Skills { skills, complete } => {
                build.skills = skills;
                build.skills_complete = complete;
                build.skills_observed_at_ms = Some(now)
            }
            CharacterEvent::Daevanion { boards } => {
                build.boards = boards;
                build.boards_observed_at_ms = Some(now)
            }
            CharacterEvent::Inspection(_)
            | CharacterEvent::PetInventory { .. }
            | CharacterEvent::PetGains { .. }
            | CharacterEvent::PetLevel { .. }
            | CharacterEvent::PetAdded { .. } => {}
        }
    }

    fn ingest_pets(&mut self, event: CharacterEvent, now: u64) {
        let state = if let Some(own) = &self.own {
            self.pets.get_or_insert_with(|| PetProgressSnapshot {
                actor_id: own.actor_id,
                source: "server-self".into(),
                ..Default::default()
            })
        } else {
            self.unbound_pets
                .get_or_insert_with(|| PetProgressSnapshot {
                    source: "server-self-unbound".into(),
                    ..Default::default()
                })
        };
        state.observed_at_ms = now;
        match event {
            CharacterEvent::PetInventory {
                active_pet_id,
                active_pet_known,
                mut pets,
            } => {
                for pet in &mut pets {
                    let mut received =
                        ObservedPetProgress::observed(pet.pet_id, pet.level, pet.progress, now);
                    if let Some(previous) = state.pets.iter().find(|old| old.pet_id == pet.pet_id) {
                        received.inherit_session(previous);
                    }
                    *pet = received;
                }
                pets.sort_by_key(|pet| pet.pet_id);
                state.active_pet_id = active_pet_id;
                state.active_pet_known = active_pet_known;
                state.inventory_complete = true;
                state.continuity = PetContinuity::Live;
                state.stale_reason = None;
                state.stale_at_ms = None;
                state.pets = pets;
            }
            CharacterEvent::PetGains { gains } => {
                for (id, gained) in gains {
                    let (index, first_observation) =
                        match state.pets.binary_search_by_key(&id, |pet| pet.pet_id) {
                            Ok(index) => (index, false),
                            Err(index) => {
                                if state.pets.len() >= MAX_PETS {
                                    state.inventory_complete = false;
                                    self.limited = true;
                                    continue;
                                }
                                state.pets.insert(
                                    index,
                                    ObservedPetProgress::observed(id, None, None, now),
                                );
                                state.inventory_complete = false;
                                (index, true)
                            }
                        };
                    let pet = &mut state.pets[index];
                    let first_timed_gain = first_observation || pet.session_started_at_ms.is_none();
                    pet.session_gained = pet.session_gained.saturating_add(u64::from(gained));
                    if first_timed_gain {
                        pet.session_started_at_ms = Some(now);
                        pet.session_baseline_gained = pet.session_gained;
                    }
                    pet.session_gain_events = pet.session_gain_events.saturating_add(1);
                    pet.last_gain_at_ms = Some(now);
                    if pet.level == Some(3) && !pet.progress_stale {
                        pet.progress = None;
                        pet.progress_source = "unknown".into();
                    } else if !pet.progress_stale {
                        if let Some(progress) = pet.progress {
                            pet.progress = progress
                                .checked_add(u64::from(gained))
                                .filter(|value| *value <= u64::from(u32::MAX));
                            pet.progress_source = if pet.progress.is_some() {
                                "server-delta"
                            } else {
                                "unknown"
                            }
                            .into();
                        }
                    }
                    if !pet.progress_stale {
                        pet.observed_at_ms = now;
                    }
                }
            }
            CharacterEvent::PetLevel { pet_id, level }
            | CharacterEvent::PetAdded { pet_id, level } => {
                let index = match state.pets.binary_search_by_key(&pet_id, |pet| pet.pet_id) {
                    Ok(index) => index,
                    Err(index) => {
                        if state.pets.len() >= MAX_PETS {
                            state.inventory_complete = false;
                            self.limited = true;
                            return;
                        }
                        state.pets.insert(
                            index,
                            ObservedPetProgress::observed(pet_id, None, None, now),
                        );
                        state.inventory_complete = false;
                        index
                    }
                };
                let pet = &mut state.pets[index];
                let level_changed = pet.level != Some(level);
                if level_changed {
                    // The observed server level event starts that tier at
                    // zero. This is a new received baseline, not a level
                    // inferred from locally counted souls or an old overflow.
                    // Repeated same-level notifications must not reset it.
                    pet.progress = Some(0);
                    pet.progress_source = "server-level-reset".into();
                    pet.progress_stale = false;
                    if pet.session_started_at_ms.is_none() {
                        pet.session_started_at_ms = Some(now);
                        pet.session_baseline_gained = pet.session_gained;
                    }
                }
                pet.level = Some(level);
                if level_changed || !pet.progress_stale {
                    pet.observed_at_ms = now;
                }
            }
            _ => {}
        }
    }
    pub fn own_available(&self) -> bool {
        self.own.as_ref().is_some_and(|build| {
            build.equipment_observed_at_ms.is_some()
                || build.skills_observed_at_ms.is_some()
                || build.boards_observed_at_ms.is_some()
                || build.combat_power.is_some()
                || build.wing.is_some()
                || build.species_observed_at_ms.is_some()
        })
    }
    pub fn own_snapshot(&self) -> Option<CharacterBuild> {
        self.own.as_ref().filter(|_| self.own_available()).cloned()
    }
    pub fn snapshot(&self) -> CharacterSnapshot {
        CharacterSnapshot {
            pet_collection_owner: None,
            own: self.own.clone(),
            unbound_own: self.unbound.clone(),
            inspected: self.inspected.iter().cloned().collect(),
            retention_limited: self.limited,
            pet_progress: self.pets.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn board() -> Vec<u8> {
        let mut frame = vec![0x26, 0xe2, 1];
        frame.extend(11u32.to_le_bytes());
        frame.push(2);
        frame.extend(110001u32.to_le_bytes());
        frame.extend(110002u32.to_le_bytes());
        frame
    }
    fn skill_list() -> Vec<u8> {
        let mut frame = vec![0, 0x51, 2];
        for (kind, id, level, base) in [(1, 11010000u32, 12u8, 10u8), (5, 4900202u32, 1u8, 1u8)] {
            frame.push(kind);
            frame.extend(id.to_le_bytes());
            frame.extend([level, base]);
            frame.extend([0; 9]);
            if kind == 5 {
                frame.push(3)
            }
        }
        frame
    }
    fn detail(slot: u8) -> Vec<u8> {
        let mut body = 88u32.to_le_bytes().to_vec();
        body.extend([slot, 2]);
        for (stat, tier) in [(255u16, 2u8), (317u16, 1u8)] {
            body.extend(0x1fab1234u32.to_le_bytes());
            body.extend(stat.to_le_bytes());
            body.push(tier)
        }
        body.extend([1, 0, 0, 0, 0, 0, 1, 0, 1, 3]);
        body.extend(19950016u32.to_le_bytes());
        body.extend([0; 9]);
        body.push(1);
        body.extend(282u16.to_le_bytes());
        body.extend(1068u32.to_le_bytes());
        body.push(0);
        body.push(1);
        body.extend(11170000u32.to_le_bytes());
        body.push(1);
        body
    }
    fn item(slot: u8, id: u32, enchant: u8) -> Vec<u8> {
        let mut entry = id.to_le_bytes().to_vec();
        entry.extend(1u32.to_le_bytes());
        entry.extend([0; 4]);
        entry.extend([0x0b, slot]);
        entry.extend([0; 12]);
        entry.push(enchant);
        entry.extend([0; 13]);
        entry.extend(detail(slot));
        entry
    }
    #[test]
    fn skill_counted_records_and_daevanion_preserve_unknown_ids_without_catalog() {
        let Some(CharacterEvent::Skills { skills, complete }) = decode(&skill_list()).unwrap()
        else {
            panic!()
        };
        assert!(complete);
        assert_eq!(
            skills[0],
            ObservedSkill {
                skill_id: 11010000,
                level: 12,
                base_level: 10
            }
        );
        assert_eq!(skills[1].skill_id, 4900202);
        let Some(CharacterEvent::Daevanion { boards }) = decode(&board()).unwrap() else {
            panic!()
        };
        assert_eq!(boards[0].node_ids, vec![110001, 110002]);
    }
    #[test]
    fn gear_has_received_slot_enchant_stones_stats_and_explicit_partial_coverage() {
        let mut frame = vec![0x11, 0x56];
        frame.extend(item(1, 110150026, 10));
        let Some(CharacterEvent::Equipment { items, complete }) = decode(&frame).unwrap() else {
            panic!()
        };
        assert!(!complete);
        assert_eq!(items[0].slot, Some(1));
        assert_eq!(items[0].enchant, Some(10));
        assert_eq!(
            items[0].stones.as_ref().unwrap()[0],
            Stone {
                stat_id: 255,
                tier: 2
            }
        );
        assert_eq!(
            items[0].stats.as_ref().unwrap()[0],
            RolledStat {
                stat_id: 282,
                value: 1068
            }
        );
        assert_eq!(items[0].godstone_id, Some(19950016));
        assert_eq!(items[0].skill_bonuses.as_ref().unwrap()[0].levels, 1);
    }
    #[test]
    fn missing_gear_details_stay_unknown_and_do_not_borrow_next_items_fields() {
        let mut frame = vec![0x11, 0x56];
        let mut first = 110150026u32.to_le_bytes().to_vec();
        first.extend(1u32.to_le_bytes());
        first.extend([0; 4]);
        first.extend([0x0b, 1]);
        frame.extend(first);
        frame.extend(item(2, 215250001, 4));
        let Some(CharacterEvent::Equipment { items, .. }) = decode(&frame).unwrap() else {
            panic!()
        };
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].enchant, None);
        assert_eq!(items[0].stones, None);
        assert_eq!(items[1].enchant, Some(4));
    }
    #[test]
    fn later_small_metadata_words_do_not_overwrite_the_enchant_boundary() {
        let mut entry = 311040001u32.to_le_bytes().to_vec();
        entry.extend(1u32.to_le_bytes());
        entry.extend([0; 4]);
        entry.extend([0x0b, 22]);
        entry.resize(45, 0);
        entry[20] = 3;
        entry[34..38].copy_from_slice(&39u32.to_le_bytes());
        entry[38..42].copy_from_slice(&22u32.to_le_bytes());
        let mut frame = vec![0x11, 0x56];
        frame.extend(entry);
        let Some(CharacterEvent::Equipment { items, .. }) = decode(&frame).unwrap() else {
            panic!()
        };
        assert_eq!(items[0].enchant, Some(3));
    }
    #[test]
    fn incomplete_counted_lists_and_duplicate_slots_are_atomic_errors() {
        let skills = skill_list();
        for end in 2..skills.len() {
            assert!(decode(&skills[..end]).is_err())
        }
        let boards = board();
        for end in 2..boards.len() {
            assert!(decode(&boards[..end]).is_err())
        }
        let mut duplicate = vec![0x11, 0x56];
        duplicate.extend(item(1, 110150026, 10));
        duplicate.extend(item(1, 215250001, 4));
        assert!(decode(&duplicate).is_err());
    }
    #[test]
    fn inspections_are_unbound_even_when_the_name_matches_local_character() {
        let mut frame = vec![0x50, 0x36, 0, 0, 7, 4];
        frame.extend(b"Self");
        frame.extend(6u32.to_le_bytes());
        frame.extend([1, 2]);
        frame.extend(45u32.to_le_bytes());
        frame.extend([0; 4]);
        frame.extend(1234u32.to_le_bytes());
        let mut inspected = 110150026u32.to_le_bytes().to_vec();
        inspected.extend([0; 9]);
        inspected.push(10);
        inspected.extend([0; 12]);
        inspected.extend(detail(1));
        frame.extend(inspected);
        let event = decode(&frame).unwrap().unwrap();
        let mut store = CharacterStore::default();
        store.bind_self(7, "Self", Some(1), 1000);
        store.ingest(event, 1100);
        assert!(!store.own_available());
        assert_eq!(store.snapshot().inspected[0].name, "Self");
        assert_eq!(store.snapshot().inspected[0].equipment[0].slot, Some(1));
    }
    #[test]
    fn only_fresh_server_self_binding_attaches_login_lists_and_snapshots_are_immutable() {
        let mut store = CharacterStore::default();
        store.ingest(decode(&skill_list()).unwrap().unwrap(), 1000);
        assert!(store.own_snapshot().is_none());
        assert!(store.snapshot().unbound_own.is_some());
        store.bind_self(7, "Self", None, 2000);
        let snapshot = store.own_snapshot().unwrap();
        assert_eq!(snapshot.actor_id, Some(7));
        store.ingest(decode(&board()).unwrap().unwrap(), 3000);
        assert!(snapshot.boards.is_empty());
        store.bind_self(8, "Other", None, 4000);
        assert!(store.own_snapshot().is_none());
        store.clear();
        store.ingest(decode(&skill_list()).unwrap().unwrap(), 1000);
        store.bind_self(9, "Third", None, 32000);
        assert!(!store.own_available());
    }
    #[test]
    fn connection_clear_removes_build_and_inspection_and_no_identity_is_inferred() {
        let mut store = CharacterStore::default();
        store.bind_self(7, "Self", None, 1000);
        store.ingest(decode(&board()).unwrap().unwrap(), 1100);
        assert!(store.own_available());
        store.clear();
        assert_eq!(store.snapshot(), CharacterSnapshot::default());
    }
}
