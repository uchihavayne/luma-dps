use crate::net::Connection;
use std::collections::HashMap;

const MAX_FRAME: usize = 1_048_576;
const MAX_BUFFER: usize = 2_097_152;
const MAX_RECORDS: usize = 10_000;
const MAX_RECOVERY_SCAN: usize = 65_536;
const MAX_RECOVERY_PENDING: usize = 128;
const EXPANSION_BUDGET: usize = 8_388_608;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReadError {
    Short,
    Invalid,
}

pub fn varint(bytes: &[u8], position: &mut usize) -> Result<u32, ReadError> {
    let start = *position;
    let mut result = 0u32;
    for shift in (0..35).step_by(7) {
        let byte = *bytes.get(*position).ok_or(ReadError::Short)?;
        *position += 1;
        if shift == 28 && byte & 0xf0 != 0 {
            return Err(ReadError::Invalid);
        }
        result |= u32::from(byte & 0x7f) << shift;
        if byte & 0x80 == 0 {
            return Ok(result);
        }
    }
    *position = start;
    Err(ReadError::Invalid)
}

#[derive(Clone, Copy)]
struct Candidate {
    start: usize,
    payload: usize,
    end: usize,
}

#[derive(Default)]
struct FrameBuffer {
    bytes: Vec<u8>,
    synchronized: bool,
    search: usize,
    pending: Vec<Candidate>,
    last_used: u64,
}

impl FrameBuffer {
    fn reset_search(&mut self) {
        self.search = 0;
        self.pending.clear();
    }
}

#[derive(Default)]
/// Length framing has no authenticated delimiter. Mid-connection attachment
/// therefore recovers on validated events on a best-effort basis; captured SYN
/// starts and already established boundaries preserve exact record alignment.
pub struct FrameStreams {
    buffers: HashMap<Connection, FrameBuffer>,
    use_counter: u64,
    pub rejected: u64,
}

impl FrameStreams {
    pub fn push(&mut self, connection: &Connection, chunk: &[u8]) -> Vec<Vec<u8>> {
        if self.buffers.len() >= 64 && !self.buffers.contains_key(connection) {
            if let Some(oldest) = self
                .buffers
                .iter()
                .min_by_key(|(_, stream)| stream.last_used)
                .map(|(key, _)| key.clone())
            {
                self.buffers.remove(&oldest);
            }
        }
        self.use_counter = self.use_counter.wrapping_add(1);
        let stream = self.buffers.entry(connection.clone()).or_default();
        stream.last_used = self.use_counter;
        if stream.bytes.len().saturating_add(chunk.len()) > MAX_BUFFER {
            stream.bytes.clear();
            stream.synchronized = false;
            stream.reset_search();
            self.rejected += 1;
        }
        if chunk.len() > MAX_BUFFER {
            return Vec::new();
        }
        stream.bytes.extend_from_slice(chunk);
        extract(stream, &mut self.rejected)
    }

    /// A captured TCP SYN identifies a trustworthy start of the byte stream.
    /// Mid-connection attachment and recovery after packet loss must use `discard`.
    pub fn mark_start(&mut self, connection: &Connection) {
        self.discard(connection);
        self.push(connection, &[]);
        if let Some(stream) = self.buffers.get_mut(connection) {
            stream.synchronized = true;
        }
    }

    pub fn discard(&mut self, connection: &Connection) {
        self.buffers.remove(connection);
    }
}

fn candidate(bytes: &[u8], start: usize) -> Result<Candidate, ReadError> {
    let mut payload = start;
    let encoded = varint(bytes, &mut payload)? as usize;
    if !(6..=MAX_FRAME + 4).contains(&encoded) {
        return Err(ReadError::Invalid);
    }
    let end = payload.checked_add(encoded - 4).ok_or(ReadError::Invalid)?;
    Ok(Candidate {
        start,
        payload,
        end,
    })
}

fn anchor_opcode(frame: &[u8]) -> bool {
    matches!(
        frame.get(..2),
        Some([4, 0x38])
            | Some([5, 0x38])
            | Some([0x33, 0x36])
            | Some([0x45, 0x36])
            | Some([0x44, 0x36])
            | Some([0x42, 0x36])
            | Some([0x41, 0x36])
            | Some([0x40, 0x36])
            | Some([4, 0x8d])
            | Some([0x47, 0x38])
            | Some([0x22, 0x38])
            | Some([0, 0x8d])
            | Some([2, 0x97])
            | Some([0x1f, 0x97])
            | Some([0, 0x92])
            | Some([9, 0x38])
            | Some([2, 0x38])
            | Some([0x2a, 0x38])
            | Some([0x2b, 0x38])
            | Some([0x2c, 0x38])
            | Some([5, 0xe0])
            | Some([1, 0x91])
            | Some([0x11, 0x56])
            | Some([0, 0x51])
            | Some([0x26, 0xe2])
            | Some([0x50, 0x36])
            | Some([0x56, 0x36])
            | Some([0, 0x90])
            | Some([0x0b, 0x61])
            | Some([0x3b, 0xe3])
            | Some([0xff, 0xff])
    )
}

fn decoded_anchor(frame: &[u8]) -> bool {
    use crate::packets::Event;
    match crate::packets::decode(frame) {
        Ok(Some(Event::Damage(hit)))
        | Ok(Some(Event::Healing(hit)))
        | Ok(Some(Event::PeriodicDamage { hit, .. })) => hit.amount > 0,
        Ok(Some(Event::Identity { id, .. }))
        | Ok(Some(Event::Npc { id, .. }))
        | Ok(Some(Event::Health { id, .. }))
        | Ok(Some(Event::Removed { id, .. })) => id != 0,
        Ok(Some(Event::Owner { .. }))
        | Ok(Some(Event::Cooldown { .. }))
        | Ok(Some(Event::SkillCharges { .. })) => true,
        Ok(Some(Event::Updates(events))) => !events.is_empty(),
        Ok(Some(Event::PartyRoster { names })) => !names.is_empty() && names.len() <= 12,
        Ok(Some(Event::PartyProfiles { members })) => !members.is_empty() && members.len() <= 12,
        Ok(Some(Event::PartyMembers { members })) => !members.is_empty() && members.len() <= 12,
        Ok(Some(Event::MemberProfiles { members })) => !members.is_empty() && members.len() <= 12,
        Ok(Some(Event::Assistance(_))) => true,
        Ok(Some(Event::FieldBoss(_))) => true,
        Ok(Some(Event::Resource(event))) => match event {
            crate::resources::ResourceEvent::Snapshot { entries } => !entries.is_empty(),
            crate::resources::ResourceEvent::Membership { expires_at_ms } => {
                expires_at_ms.is_some()
            }
            crate::resources::ResourceEvent::Change { .. } => false,
        },
        Ok(Some(Event::Character(event))) => {
            use crate::character::CharacterEvent;
            match event {
                CharacterEvent::Equipment { items, .. } => {
                    items.iter().any(|item| item.stones.is_some())
                }
                CharacterEvent::Skills { skills, .. } => !skills.is_empty(),
                CharacterEvent::Daevanion { boards } => {
                    boards.iter().any(|board| !board.node_ids.is_empty())
                }
                CharacterEvent::Inspection(profile) => {
                    profile.equipment.iter().any(|item| item.stones.is_some())
                }
                CharacterEvent::PetInventory { pets, .. } => !pets.is_empty(),
                CharacterEvent::CombatPower { .. } => true,
                CharacterEvent::Wing { .. } | CharacterEvent::Species { .. } => false,
                CharacterEvent::PetGains { .. }
                | CharacterEvent::PetLevel { .. }
                | CharacterEvent::PetAdded { .. } => false,
            }
        }
        _ => false,
    }
}

fn validated_anchor(frame: &[u8], budget: &mut usize) -> bool {
    if frame.len() > *budget {
        return false;
    }
    *budget -= frame.len();
    if !frame.starts_with(&[0xff, 0xff]) {
        return decoded_anchor(frame);
    }
    let mut expanded = Vec::new();
    expand_bounded(frame, &mut expanded, 0, budget).is_ok()
        && expanded.iter().any(|frame| decoded_anchor(frame))
}

fn plausible_bundle_header(bytes: &[u8], next: Candidate) -> bool {
    let Some(header) = bytes.get(next.payload..next.payload + 6) else {
        return false;
    };
    if header[..2] != [0xff, 0xff] || next.end < next.payload + 6 {
        return false;
    }
    let size = u32::from_le_bytes(header[2..6].try_into().unwrap()) as usize;
    (1..=MAX_BUFFER).contains(&size)
}

fn remember(stream: &mut FrameBuffer, next: Candidate) {
    if stream.pending.iter().any(|entry| entry.start == next.start) {
        return;
    }
    if stream.pending.len() < MAX_RECOVERY_PENDING {
        stream.pending.push(next);
    } else if let Some((index, furthest)) = stream
        .pending
        .iter()
        .enumerate()
        .max_by_key(|(_, entry)| entry.end)
    {
        if next.end < furthest.end {
            stream.pending[index] = next;
        }
    }
}

// Only a complete, semantically decoded record can recover an unknown boundary.
// Resume the scan on subsequent chunks instead of rescanning an ever-growing buffer.
fn recover(
    stream: &mut FrameBuffer,
    offset: usize,
    scan_budget: &mut usize,
    validation_budget: &mut usize,
) -> Option<usize> {
    stream.pending.sort_unstable_by_key(|entry| entry.start);
    let mut index = 0;
    while index < stream.pending.len() {
        let next = stream.pending[index];
        if next.end > stream.bytes.len() {
            index += 1;
            continue;
        }
        if next.end - next.payload > *validation_budget {
            return None;
        }
        stream.pending.remove(index);
        if validated_anchor(&stream.bytes[next.payload..next.end], validation_budget) {
            return Some(next.start);
        }
    }

    let mut protected_bundle = stream
        .pending
        .iter()
        .filter(|entry| plausible_bundle_header(&stream.bytes, **entry))
        .min_by_key(|entry| (entry.payload, entry.end))
        .copied();
    let mut position = stream.search.max(offset + 1);
    while position < stream.bytes.len() && *scan_budget > 0 {
        if let Some(bundle) = protected_bundle {
            if position >= bundle.payload {
                stream.search = bundle.end;
                return None;
            }
        }
        *scan_budget -= 1;
        let next = match candidate(&stream.bytes, position) {
            Ok(next) => next,
            Err(ReadError::Short) => break,
            Err(ReadError::Invalid) => {
                position += 1;
                continue;
            }
        };
        if next.payload + 2 > stream.bytes.len() {
            break;
        }
        if anchor_opcode(&stream.bytes[next.payload..]) {
            if next.end > stream.bytes.len() {
                remember(stream, next);
                if plausible_bundle_header(&stream.bytes, next) {
                    // A preceding varint suffix can reach the same FF FF header.
                    // Check all prefix starts before protecting the bundle body.
                    if protected_bundle.is_none_or(|previous| {
                        (next.payload, next.end) < (previous.payload, previous.end)
                    }) {
                        protected_bundle = Some(next);
                    }
                }
            } else {
                if next.end - next.payload > *validation_budget {
                    break;
                }
                if validated_anchor(&stream.bytes[next.payload..next.end], validation_budget) {
                    stream.search = position;
                    return Some(position);
                }
                if plausible_bundle_header(&stream.bytes, next) {
                    position = next.end;
                    continue;
                }
            }
        }
        position += 1;
    }
    stream.search = position;
    None
}

fn extract(stream: &mut FrameBuffer, rejected: &mut u64) -> Vec<Vec<u8>> {
    let mut offset = 0;
    let mut result = Vec::new();
    let mut scan_budget = MAX_RECOVERY_SCAN;
    let mut validation_budget = EXPANSION_BUDGET;
    while offset < stream.bytes.len() && result.len() < MAX_RECORDS {
        if stream.bytes[offset] == 0 {
            offset += 1;
            continue;
        }
        let next = match candidate(&stream.bytes, offset) {
            Ok(next) => next,
            Err(ReadError::Short) => break,
            Err(ReadError::Invalid) => {
                stream.synchronized = false;
                stream.reset_search();
                offset += 1;
                *rejected += 1;
                continue;
            }
        };
        if next.end > stream.bytes.len() {
            // LZ4 literal runs can contain complete inner game records. A sane
            // bundle header protects its declared span even on fresh attachment;
            // decompression can validate it once all compressed bytes arrive.
            if plausible_bundle_header(&stream.bytes, next) {
                break;
            }
            if !stream.synchronized {
                if let Some(anchor) =
                    recover(stream, offset, &mut scan_budget, &mut validation_budget)
                {
                    *rejected += 1;
                    offset = anchor;
                    stream.synchronized = true;
                    stream.reset_search();
                    continue;
                }
            }
            break;
        }
        let frame = &stream.bytes[next.payload..next.end];
        if !stream.synchronized && anchor_opcode(frame) {
            stream.synchronized = validated_anchor(frame, &mut validation_budget);
        }
        // Consume the entire declared span even for unknown families/opcodes.
        // Their payload is opaque and may contain bytes resembling game records.
        result.push(frame.to_vec());
        offset = next.end;
        stream.reset_search();
    }
    if offset > 0 {
        stream.bytes.drain(..offset);
        stream.search = stream.search.saturating_sub(offset);
        for pending in &mut stream.pending {
            pending.start -= offset;
            pending.payload -= offset;
            pending.end -= offset;
        }
    }
    result
}

// Decompression provides an exact stream boundary. Never resynchronize inside a
// compressed record: malformed lengths reject the bundle, unknown records stay opaque.
fn extract_exact(bytes: &[u8]) -> Result<Vec<Vec<u8>>, ReadError> {
    let mut offset = 0;
    let mut result = Vec::new();
    while offset < bytes.len() {
        if bytes[offset] == 0 {
            offset += 1;
            continue;
        }
        let next = candidate(bytes, offset)?;
        if next.end > bytes.len() {
            return Err(ReadError::Short);
        }
        if result.len() >= MAX_RECORDS {
            return Err(ReadError::Invalid);
        }
        result.push(bytes[next.payload..next.end].to_vec());
        offset = next.end;
    }
    Ok(result)
}

pub fn expand(frame: &[u8], output: &mut Vec<Vec<u8>>, depth: usize) -> Result<(), ReadError> {
    let mut budget = EXPANSION_BUDGET;
    expand_bounded(frame, output, depth, &mut budget)
}

fn expand_bounded(
    frame: &[u8],
    output: &mut Vec<Vec<u8>>,
    depth: usize,
    budget: &mut usize,
) -> Result<(), ReadError> {
    if depth > 4 || frame.len() > MAX_FRAME {
        return Err(ReadError::Invalid);
    }
    if !frame.starts_with(&[0xff, 0xff]) {
        if output.len() >= MAX_RECORDS || frame.len() > *budget {
            return Err(ReadError::Invalid);
        }
        *budget -= frame.len();
        output.push(frame.to_vec());
        return Ok(());
    }
    let size = u32::from_le_bytes(
        frame
            .get(2..6)
            .ok_or(ReadError::Short)?
            .try_into()
            .map_err(|_| ReadError::Short)?,
    ) as usize;
    if size == 0 || size > MAX_BUFFER {
        return Err(ReadError::Invalid);
    }
    if size > *budget {
        return Err(ReadError::Invalid);
    }
    *budget -= size;
    let decoded = lz4_flex::block::decompress(&frame[6..], size).map_err(|_| ReadError::Invalid)?;
    if decoded.len() != size {
        return Err(ReadError::Invalid);
    }
    let inner = extract_exact(&decoded)?;
    for child in inner {
        expand_bounded(&child, output, depth + 1, budget)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn key() -> Connection {
        Connection {
            source: [0; 16],
            destination: [1; 16],
            source_port: 1,
            destination_port: 2,
        }
    }
    #[test]
    fn frames_split_across_tcp_reads_and_zero_padding() {
        let mut streams = FrameStreams::default();
        assert!(streams.push(&key(), &[0, 9, 4]).is_empty());
        assert_eq!(
            streams.push(&key(), &[0x38, 1, 2, 3, 0, 6, 1, 0x36]),
            vec![vec![4, 0x38, 1, 2, 3], vec![1, 0x36]]
        );
    }
    #[test]
    fn varints_are_bounded_and_detect_overflow() {
        assert_eq!(varint(&[0xac, 2], &mut 0), Ok(300));
        assert_eq!(
            varint(&[0xff, 0xff, 0xff, 0xff, 0x0f], &mut 0),
            Ok(u32::MAX)
        );
        assert_eq!(
            varint(&[0xff, 0xff, 0xff, 0xff, 0x10], &mut 0),
            Err(ReadError::Invalid)
        );
        assert_eq!(varint(&[0x80], &mut 0), Err(ReadError::Short));
    }
    #[test]
    fn compressed_stream_has_the_same_framing() {
        let inner = [6, 4, 0x38, 6, 5, 0x38];
        let compressed = lz4_flex::block::compress(&inner);
        let mut bundle = vec![0xff, 0xff];
        bundle.extend((inner.len() as u32).to_le_bytes());
        bundle.extend(compressed);
        let mut output = Vec::new();
        expand(&bundle, &mut output, 0).unwrap();
        assert_eq!(output, vec![vec![4, 0x38], vec![5, 0x38]]);
    }
    #[test]
    fn oversized_or_corrupt_compression_is_rejected() {
        let mut bundle = vec![0xff, 0xff];
        bundle.extend(u32::MAX.to_le_bytes());
        assert_eq!(expand(&bundle, &mut Vec::new(), 0), Err(ReadError::Invalid));
    }
    #[test]
    fn compressed_record_count_is_bounded() {
        let mut inner = Vec::new();
        for _ in 0..10_001 {
            inner.extend([6, 4, 0x38])
        }
        let mut bundle = vec![255, 255];
        bundle.extend((inner.len() as u32).to_le_bytes());
        bundle.extend(lz4_flex::block::compress(&inner));
        assert_eq!(expand(&bundle, &mut Vec::new(), 0), Err(ReadError::Invalid));
    }
}
