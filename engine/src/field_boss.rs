//! Received game-map boss slots. Slot identity is deliberately separate from a
//! named NPC: the wire list supplies map/slot numbers and timestamps, not names.
//! See docs/observed-character-and-bosses.md for wire-source provenance.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

const MAX_FRAME: usize = 65_536;
const MAX_SLOTS: usize = 64;
const MAX_MAPS: usize = 16;
const MAX_PATHS: usize = 16;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FieldBossError {
    Truncated,
    Invalid,
    Unsupported,
    Limit,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct BossSlot {
    pub slot_id: u8,
    pub alive: bool,
    pub server_time_ms: Option<u64>,
    pub position: Option<[f32; 3]>,
    pub observed_at_ms: u64,
    pub source: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct FieldBossEvent {
    pub map_id: u32,
    pub slots: Vec<BossSlot>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct BossMap {
    pub map_id: u32,
    pub observed_at_ms: u64,
    pub slots: Vec<BossSlot>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct FieldBossSnapshot {
    pub maps: Vec<BossMap>,
    pub retention_limited: bool,
}

fn variable(frame: &[u8], offset: &mut usize) -> Result<u32, FieldBossError> {
    let mut value = 0u32;
    for part in 0..5 {
        let byte = *frame.get(*offset).ok_or(FieldBossError::Truncated)?;
        *offset += 1;
        if part == 4 && byte > 15 {
            return Err(FieldBossError::Invalid);
        }
        value |= u32::from(byte & 127) << (part * 7);
        if byte & 128 == 0 {
            if part > 0 && byte == 0 {
                return Err(FieldBossError::Invalid);
            }
            return Ok(value);
        }
    }
    Err(FieldBossError::Invalid)
}

fn header(frame: &[u8], offset: usize, map: u32) -> Result<(bool, u8, usize), FieldBossError> {
    let alive = *frame.get(offset).ok_or(FieldBossError::Truncated)?;
    if alive > 1 {
        return Err(FieldBossError::Invalid);
    }
    let mut next = offset + 1;
    let place = variable(frame, &mut next)?;
    let slot = place
        .checked_sub(map.checked_mul(100).ok_or(FieldBossError::Invalid)?)
        .ok_or(FieldBossError::Invalid)?;
    if !(1..=99).contains(&slot) {
        return Err(FieldBossError::Invalid);
    }
    Ok((alive == 1, slot as u8, next))
}

#[derive(Clone)]
struct Candidate {
    offset: usize,
    slots: Vec<BossSlot>,
}

/// Reads one complete 01 91 frame. The observed optional byte is resolved by
/// bounded alternatives and the next structural header; ambiguous data fails.
pub fn decode(frame: &[u8]) -> Result<Option<FieldBossEvent>, FieldBossError> {
    if frame.get(..2) != Some(&[1, 0x91]) {
        return Ok(None);
    }
    if frame.len() > MAX_FRAME {
        return Err(FieldBossError::Limit);
    }
    if frame.len() < 9 {
        return Err(FieldBossError::Truncated);
    }
    if frame[2..4] != [0, 0] {
        return Err(FieldBossError::Unsupported);
    }
    let map_id = u32::from_le_bytes(
        frame[4..8]
            .try_into()
            .map_err(|_| FieldBossError::Truncated)?,
    );
    if !(1000..=99999).contains(&map_id) {
        return Err(FieldBossError::Invalid);
    }
    let count = usize::from(frame[8]);
    if count == 0 || count > MAX_SLOTS {
        return Err(FieldBossError::Limit);
    }
    let mut paths = vec![Candidate {
        offset: 9,
        slots: Vec::with_capacity(count),
    }];
    for index in 0..count {
        let mut next_paths = Vec::new();
        for path in paths {
            let Ok((alive, slot_id, mut at)) = header(frame, path.offset, map_id) else {
                continue;
            };
            if path.slots.iter().any(|slot| slot.slot_id == slot_id) {
                continue;
            }
            let position = if alive {
                let Some(raw) = frame.get(at..at + 12) else {
                    continue;
                };
                let xyz: [f32; 3] = std::array::from_fn(|axis| {
                    f32::from_le_bytes(raw[axis * 4..axis * 4 + 4].try_into().unwrap_or([0; 4]))
                });
                if xyz
                    .iter()
                    .any(|value| !value.is_finite() || value.abs() > 10_000_000.0)
                {
                    continue;
                }
                at += 12;
                Some(xyz)
            } else {
                None
            };
            for extra in 0..=1 {
                let Some(raw) = frame.get(at + extra..at + extra + 8) else {
                    continue;
                };
                let timestamp =
                    i64::from_le_bytes(raw.try_into().map_err(|_| FieldBossError::Truncated)?);
                if timestamp != 0 && !(1_600_000_000_000..=2_600_000_000_000).contains(&timestamp) {
                    continue;
                }
                let end = at + extra + 8;
                let fits = if index + 1 == count {
                    frame.len().saturating_sub(end) <= 8
                        && frame[end..].iter().all(|value| *value == 0)
                } else {
                    header(frame, end, map_id).is_ok()
                };
                if !fits {
                    continue;
                }
                let mut candidate = path.clone();
                candidate.offset = end;
                candidate.slots.push(BossSlot {
                    slot_id,
                    alive,
                    server_time_ms: (timestamp > 0).then_some(timestamp as u64),
                    position,
                    observed_at_ms: 0,
                    source: "server-map".into(),
                });
                if !next_paths.iter().any(|previous: &Candidate| {
                    previous.offset == candidate.offset && previous.slots == candidate.slots
                }) {
                    next_paths.push(candidate);
                    if next_paths.len() > MAX_PATHS {
                        return Err(FieldBossError::Limit);
                    }
                }
            }
        }
        if next_paths.is_empty() {
            return Err(FieldBossError::Invalid);
        }
        paths = next_paths;
    }
    let slots = paths.first().ok_or(FieldBossError::Invalid)?.slots.clone();
    if paths.iter().any(|path| path.slots != slots) {
        return Err(FieldBossError::Unsupported);
    }
    Ok(Some(FieldBossEvent { map_id, slots }))
}

#[derive(Clone, Debug, Default)]
pub struct FieldBossStore {
    maps: BTreeMap<u32, BossMap>,
    last_ms: Option<u64>,
    limited: bool,
}
impl FieldBossStore {
    pub fn clear(&mut self) {
        *self = Self::default()
    }
    pub fn ingest(&mut self, mut event: FieldBossEvent, now: u64) {
        if self.last_ms.is_some_and(|previous| now < previous) {
            self.clear()
        }
        self.last_ms = Some(now);
        if self.maps.len() >= MAX_MAPS && !self.maps.contains_key(&event.map_id) {
            if let Some(id) = self
                .maps
                .values()
                .min_by_key(|map| map.observed_at_ms)
                .map(|map| map.map_id)
            {
                self.maps.remove(&id);
                self.limited = true
            }
        }
        for slot in &mut event.slots {
            slot.observed_at_ms = now
        }
        event.slots.sort_by_key(|slot| slot.slot_id);
        self.maps.insert(
            event.map_id,
            BossMap {
                map_id: event.map_id,
                observed_at_ms: now,
                slots: event.slots,
            },
        );
    }
    pub fn snapshot(&self) -> FieldBossSnapshot {
        FieldBossSnapshot {
            maps: self.maps.values().cloned().collect(),
            retention_limited: self.limited,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn var(mut number: u32) -> Vec<u8> {
        let mut bytes = Vec::new();
        loop {
            let byte = (number & 127) as u8;
            number >>= 7;
            bytes.push(byte | if number > 0 { 128 } else { 0 });
            if number == 0 {
                return bytes;
            }
        }
    }
    fn frame(map: u32, slots: &[(u8, bool, i64, bool)]) -> Vec<u8> {
        let mut bytes = vec![1, 0x91, 0, 0];
        bytes.extend(map.to_le_bytes());
        bytes.push(slots.len() as u8);
        for (id, alive, timestamp, extra) in slots {
            bytes.push(u8::from(*alive));
            bytes.extend(var(map * 100 + u32::from(*id)));
            if *alive {
                for value in [100f32, 200f32, 300f32] {
                    bytes.extend(value.to_le_bytes())
                }
            }
            if *extra {
                bytes.push(3)
            }
            bytes.extend(timestamp.to_le_bytes())
        }
        bytes
    }
    #[test]
    fn mixed_alive_and_dead_records_preserve_server_time_and_unknown_names() {
        let bytes = frame(
            3001,
            &[
                (2, true, 1_791_800_000_000, false),
                (7, false, 1_791_800_300_000, true),
            ],
        );
        let event = decode(&bytes).unwrap().unwrap();
        assert_eq!(event.map_id, 3001);
        assert_eq!(event.slots[0].slot_id, 2);
        assert!(event.slots[0].alive);
        assert_eq!(event.slots[1].position, None);
        assert_eq!(event.slots[1].server_time_ms, Some(1_791_800_300_000));
    }
    #[test]
    fn zero_time_is_unknown_and_zero_padding_does_not_fabricate_a_deadline() {
        let mut bytes = frame(3001, &[(1, false, 0, false)]);
        bytes.extend([0, 0, 0]);
        let event = decode(&bytes).unwrap().unwrap();
        assert_eq!(event.slots[0].server_time_ms, None);
        bytes.push(1);
        assert!(decode(&bytes).is_err());
    }
    #[test]
    fn duplicate_slots_wrong_map_invalid_dates_and_noncanonical_ids_fail() {
        assert!(decode(&frame(
            3001,
            &[
                (1, false, 1_791_800_000_000, false),
                (1, false, 1_791_800_000_000, false)
            ]
        ))
        .is_err());
        assert!(decode(&frame(4, &[(1, false, 1_791_800_000_000, false)])).is_err());
        assert!(decode(&frame(3001, &[(1, false, -1, false)])).is_err());
        let mut invalid = frame(3001, &[(1, false, 1_791_800_000_000, false)]);
        invalid[10..13].fill(0x80);
        assert!(decode(&invalid).is_err());
    }
    #[test]
    fn each_truncated_timestamp_is_rejected_atomically() {
        let bytes = frame(
            3001,
            &[
                (1, true, 1_791_800_000_000, false),
                (2, false, 1_791_800_000_100, false),
            ],
        );
        for end in 2..bytes.len() {
            assert!(decode(&bytes[..end]).is_err())
        }
    }
    #[test]
    fn map_refresh_replaces_removed_slots_without_assuming_respawn_has_happened() {
        let mut store = FieldBossStore::default();
        store.ingest(
            decode(&frame(
                3001,
                &[
                    (1, false, 1_791_800_000_000, false),
                    (2, true, 1_791_800_000_000, false),
                ],
            ))
            .unwrap()
            .unwrap(),
            1000,
        );
        store.ingest(
            decode(&frame(3001, &[(1, false, 1_791_800_000_000, false)]))
                .unwrap()
                .unwrap(),
            2000,
        );
        let snapshot = store.snapshot();
        assert_eq!(snapshot.maps[0].slots.len(), 1);
        assert!(!snapshot.maps[0].slots[0].alive);
        assert_eq!(snapshot.maps[0].observed_at_ms, 2000);
    }
    #[test]
    fn retention_and_reset_are_explicit_and_bounded() {
        let mut store = FieldBossStore::default();
        for map in 3001..=3030 {
            store.ingest(
                decode(&frame(map, &[(1, false, 0, false)]))
                    .unwrap()
                    .unwrap(),
                u64::from(map),
            )
        }
        assert_eq!(store.snapshot().maps.len(), MAX_MAPS);
        assert!(store.snapshot().retention_limited);
        store.clear();
        assert_eq!(store.snapshot(), FieldBossSnapshot::default());
    }
}
