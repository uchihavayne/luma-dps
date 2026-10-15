use crate::framing::{varint, ReadError};

#[derive(Clone, Debug, PartialEq)]
pub struct Hit {
    pub source: u64,
    pub target: u64,
    pub skill: u32,
    pub amount: u64,
    pub critical: bool,
    pub tick: bool,
    pub flags: u8,
    pub angle: u8,
}

#[derive(Clone, Debug, PartialEq)]
pub struct PartyMember {
    pub key: u32,
    pub server: u16,
    pub slot: u8,
    pub name: String,
    pub class: u32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct MemberProfile {
    pub id: u64,
    pub server: u16,
    pub name: String,
}

#[derive(Clone, Debug, PartialEq)]
pub enum Event {
    Damage(Hit),
    Assistance(crate::assistance::AssistEvent),
    FieldBoss(crate::field_boss::FieldBossEvent),
    Character(crate::character::CharacterEvent),
    Resource(crate::resources::ResourceEvent),
    Identity {
        id: u64,
        name: String,
        class: Option<u32>,
        own: bool,
    },
    Removed {
        id: u64,
        death: bool,
    },
    Npc {
        id: u64,
        name: Option<String>,
        model: u32,
        kind: u8,
    },
    Owner {
        id: u64,
        owner: u64,
    },
    Cooldown {
        skill: u32,
        remaining_units: Option<u32>,
        charges: Option<u32>,
    },
    SkillCharges {
        skill: u32,
        charges: u32,
        recharge_ms: u32,
    },
    Health {
        id: u64,
        current: u64,
    },
    Updates(Vec<Event>),
    /// Complete party membership, expressed as names rather than account ids.
    PartyRoster {
        names: Vec<String>,
    },
    PartyProfiles {
        members: Vec<(String, u32)>,
    },
    PartyMembers {
        members: Vec<PartyMember>,
    },
    PartyMemberRemoved {
        key: u32,
        server: u16,
    },
    MemberProfiles {
        members: Vec<MemberProfile>,
    },
}

struct Bytes<'a> {
    data: &'a [u8],
    offset: usize,
}
impl<'a> Bytes<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, offset: 2 }
    }
    fn byte(&mut self) -> Result<u8, ReadError> {
        let v = *self.data.get(self.offset).ok_or(ReadError::Short)?;
        self.offset += 1;
        Ok(v)
    }
    fn variable(&mut self) -> Result<u32, ReadError> {
        varint(self.data, &mut self.offset)
    }
    fn skip(&mut self, n: usize) -> Result<(), ReadError> {
        if self
            .offset
            .checked_add(n)
            .is_none_or(|end| end > self.data.len())
        {
            return Err(ReadError::Short);
        };
        self.offset += n;
        Ok(())
    }
    fn word(&mut self) -> Result<u32, ReadError> {
        let raw = self
            .data
            .get(self.offset..self.offset + 4)
            .ok_or(ReadError::Short)?;
        self.offset += 4;
        Ok(u32::from_le_bytes(
            raw.try_into().map_err(|_| ReadError::Short)?,
        ))
    }
    fn text(&mut self) -> Result<String, ReadError> {
        let length = self.byte()? as usize;
        if length == 0 || length > 96 {
            return Err(ReadError::Invalid);
        };
        let raw = self
            .data
            .get(self.offset..self.offset + length)
            .ok_or(ReadError::Short)?;
        self.offset += length;
        let value = std::str::from_utf8(raw)
            .map_err(|_| ReadError::Invalid)?
            .trim();
        if value.is_empty() || value.chars().any(char::is_control) {
            return Err(ReadError::Invalid);
        };
        Ok(value.into())
    }
    fn character_text(&mut self) -> Result<String, ReadError> {
        let field = self.offset;
        let name = self.text()?;
        if self.data.get(field + 1..self.offset) != Some(name.as_bytes())
            || !(1..=12).contains(&name.chars().count())
            || !name.chars().all(char::is_alphanumeric)
            || !name.chars().any(char::is_alphabetic)
        {
            return Err(ReadError::Invalid);
        }
        Ok(name)
    }
}

// The subtree position has two documented mask widths. Names at any other
// position in an opaque packet are not a source of entity identity.
fn npc_subtree(
    data: &[u8],
    mask_start: usize,
    width: usize,
) -> Result<(Option<String>, u32), ReadError> {
    let mut bytes = Bytes {
        data,
        offset: mask_start + width,
    };
    let flags = bytes.byte()?;
    let name = if flags & 1 != 0 {
        Some(bytes.text()?)
    } else {
        None
    };
    let model = bytes.word()?;
    if !(100_000..=9_999_999).contains(&model) {
        return Err(ReadError::Invalid);
    }
    Ok((name, model))
}

/// Read only complete framed 02 97 rosters. Optional member tails are bounded;
/// slot, UTF-8 name, level and repeated world id validate each next boundary.
/// A counted update is merged into live membership; missing slots are not a
/// disband signal. The first complete typed prefix is the next member, before
/// any later member that also falls inside the bounded opaque tail window.
fn party_roster(frame: &[u8]) -> Result<Vec<PartyMember>, ReadError> {
    let mut bytes = Bytes::new(frame);
    bytes.word()?;
    bytes.text()?;
    let capacity = bytes.byte()?;
    if !(1..=12).contains(&capacity) {
        return Err(ReadError::Invalid);
    }
    bytes.skip(17)?;
    let count = bytes.variable()?;
    if count > u32::from(capacity) {
        return Err(ReadError::Invalid);
    }
    let mut cursor = bytes.offset;
    let mut members = Vec::new();
    let mut slots = std::collections::BTreeSet::new();
    let mut previous_slot = 0;
    for index in 1..=count as u8 {
        let mut choices = Vec::new();
        let end = if index == 1 {
            cursor
        } else {
            cursor.saturating_add(48).min(frame.len())
        };
        for start in cursor..=end {
            if frame
                .get(start + 1)
                .is_none_or(|slot| !(1..=capacity).contains(slot) || *slot <= previous_slot)
            {
                continue;
            }
            let mut member = Bytes {
                data: frame,
                offset: start,
            };
            let parsed = (|| {
                let presence = member.byte()?;
                let slot = member.byte()?;
                let account = frame
                    .get(member.offset..member.offset + 8)
                    .ok_or(ReadError::Short)?;
                let world = u16::from_le_bytes([account[6], account[7]]);
                let key =
                    u32::from_le_bytes(account[..4].try_into().map_err(|_| ReadError::Invalid)?);
                member.skip(8)?;
                if presence == 0 {
                    if account.iter().any(|byte| *byte != 0) || member.byte()? != 0 {
                        return Err(ReadError::Invalid);
                    }
                    return Ok((None, slot, member.offset));
                }
                if !(1000..3000).contains(&world) || key == 0 {
                    return Err(ReadError::Invalid);
                }
                let name = member.character_text()?;
                let class = member.word()?;
                let level = member.word()?;
                let gear = member.word()?;
                if !(1..=200).contains(&level) || gear > 1_000_000 {
                    return Err(ReadError::Invalid);
                }
                let mut anchors = Vec::new();
                for extra in 0..=10 {
                    let at = member.offset + extra;
                    let Some(tail) = frame.get(at..at + 16) else {
                        continue;
                    };
                    let first = u16::from_le_bytes([tail[0], tail[1]]);
                    let second = u16::from_le_bytes([tail[2], tail[3]]);
                    let power =
                        u64::from_le_bytes(tail[5..13].try_into().map_err(|_| ReadError::Invalid)?);
                    if first == world && second == world && power <= 100_000_000 {
                        anchors.push(at + 13)
                    }
                }
                if anchors.len() != 1 {
                    return Err(ReadError::Invalid);
                }
                Ok((
                    Some(PartyMember {
                        key,
                        server: world,
                        slot,
                        name,
                        class,
                    }),
                    slot,
                    anchors[0],
                ))
            })();
            if let Ok(parsed) = parsed {
                choices.push(parsed);
                break;
            }
        }
        if choices.len() != 1 {
            return Err(ReadError::Invalid);
        }
        let (member, slot, end) = choices.pop().unwrap();
        if !slots.insert(slot) {
            return Err(ReadError::Invalid);
        }
        previous_slot = slot;
        if let Some(member) = member {
            if members.iter().any(|old: &PartyMember| {
                old.key == member.key && old.server == member.server
                    || old.name == member.name && old.server == member.server
            }) {
                return Err(ReadError::Invalid);
            }
            members.push(member);
        }
        cursor = end;
    }
    Ok(members)
}

fn party_member_update(frame: &[u8]) -> Result<PartyMember, ReadError> {
    if frame.len() < 40 || frame.len() > 256 {
        return Err(ReadError::Invalid);
    }
    let mut bytes = Bytes::new(frame);
    let _mask = bytes.byte()?;
    let slot = bytes.byte()?;
    let key = bytes.word()?;
    bytes.skip(2)?; // Opaque upper handle bytes, not a combat actor id.
    let server = u16::from_le_bytes(
        frame
            .get(bytes.offset..bytes.offset + 2)
            .ok_or(ReadError::Short)?
            .try_into()
            .map_err(|_| ReadError::Invalid)?,
    );
    bytes.skip(2)?;
    let name = bytes.character_text()?;
    let class = bytes.word()?;
    let level = bytes.word()?;
    let gear = bytes.word()?;
    if !(1..=12).contains(&slot)
        || key == 0
        || !(1000..3000).contains(&server)
        || !(1..=200).contains(&level)
        || gear > 1_000_000
        || !(5..=64).contains(&class)
    {
        return Err(ReadError::Invalid);
    }
    // Known complete member updates carry a bounded metadata tail, including a
    // repeated home server. Its other values stay opaque and are not gear data.
    let tail = frame.get(bytes.offset..).ok_or(ReadError::Short)?;
    if tail.len() < 23
        || tail.len() > 96
        || !tail[..6]
            .windows(2)
            .any(|part| part == server.to_le_bytes())
        || !tail[..8].contains(&4)
    {
        return Err(ReadError::Invalid);
    }
    Ok(PartyMember {
        key,
        server,
        slot,
        name,
        class,
    })
}

fn member_profiles(frame: &[u8]) -> Result<Vec<MemberProfile>, ReadError> {
    if frame.len() > 16_384 {
        return Err(ReadError::Invalid);
    }
    let mut result = Vec::new();
    let mut end = 2;
    // Match a full structural record, not an isolated nickname-shaped byte run.
    for start in 2..frame.len().saturating_sub(54) {
        if start < end || frame.get(start + 8) != Some(&36) {
            continue;
        }
        let guid = &frame[start + 9..start + 45];
        if !guid.iter().enumerate().all(|(index, byte)| {
            if [8, 13, 18, 23].contains(&index) {
                *byte == b'-'
            } else {
                byte.is_ascii_hexdigit()
            }
        }) {
            continue;
        }
        let id = u32::from_le_bytes(
            frame[start..start + 4]
                .try_into()
                .map_err(|_| ReadError::Invalid)?,
        );
        let server = u16::from_le_bytes([frame[start + 4], frame[start + 5]]);
        if id == 0
            || !(1000..3000).contains(&server)
            || frame[start + 51..start + 53] != server.to_le_bytes()
        {
            continue;
        }
        let mut bytes = Bytes {
            data: frame,
            offset: start + 53,
        };
        let Ok(name) = bytes.character_text() else {
            continue;
        };
        if result.iter().any(|row: &MemberProfile| {
            row.id == u64::from(id) || row.name == name && row.server == server
        }) {
            return Err(ReadError::Invalid);
        }
        end = bytes.offset;
        result.push(MemberProfile {
            id: u64::from(id),
            server,
            name,
        });
        if result.len() > 12 {
            return Err(ReadError::Invalid);
        }
    }
    if result.is_empty() {
        return Err(ReadError::Invalid);
    }
    Ok(result)
}

pub fn decode(frame: &[u8]) -> Result<Option<Event>, ReadError> {
    let Some(opcode) = frame.get(..2) else {
        return Err(ReadError::Short);
    };
    if matches!(
        opcode,
        [9, 0x38] | [2, 0x38] | [0x2a, 0x38] | [0x2b, 0x38] | [0x2c, 0x38] | [0, 0x8d] | [5, 0xe0]
    ) {
        return crate::assistance::decode(frame)
            .map(|event| event.map(Event::Assistance))
            .map_err(|_| ReadError::Invalid);
    }
    if opcode == [1, 0x91] {
        return crate::field_boss::decode(frame)
            .map(|event| event.map(Event::FieldBoss))
            .map_err(|_| ReadError::Invalid);
    }
    if matches!(opcode, [0x0b, 0x61] | [0x0c, 0x61] | [0x3b, 0xe3]) {
        return crate::resources::decode(frame)
            .map(|event| event.map(Event::Resource))
            .map_err(|_| ReadError::Invalid);
    }
    if matches!(
        opcode,
        [0x11, 0x56]
            | [0, 0x51]
            | [0x26, 0xe2]
            | [0x50, 0x36]
            | [0, 0x90]
            | [0x0d, 0x90]
            | [0x14, 0x90]
    ) {
        return crate::character::decode(frame)
            .map(|event| event.map(Event::Character))
            .map_err(|_| ReadError::Invalid);
    }
    let mut bytes = Bytes::new(frame);
    match opcode {
        [4, 0x38] => {
            let target = u64::from(bytes.variable()?);
            let switch = bytes.variable()?;
            bytes.variable()?;
            let source = u64::from(bytes.variable()?);
            let skill = bytes.word()?;
            bytes.byte()?;
            let kind = bytes.variable()?;
            if kind == 1 || kind == 6 || switch & 4 == 0 {
                return Ok(None);
            }
            let (flags, angle) = match switch & 15 {
                4 => {
                    bytes.skip(8)?;
                    (0, 0)
                }
                6 => {
                    let flags = bytes.byte()?;
                    bytes.variable()?;
                    let angle = bytes.byte()?;
                    bytes.skip(8)?;
                    (flags, angle)
                }
                _ => return Ok(None),
            };
            bytes.variable()?;
            let amount = u64::from(bytes.variable()?);
            if source == 0 || target == 0 || skill == 0 || kind > 8 || amount > 2_000_000_000 {
                return Err(ReadError::Invalid);
            }
            Ok(Some(Event::Damage(Hit {
                source,
                target,
                skill,
                amount,
                critical: kind == 3,
                tick: false,
                flags,
                angle,
            })))
        }
        [5, 0x38] => {
            let target = u64::from(bytes.variable()?);
            let kind = bytes.byte()?;
            let source = u64::from(bytes.variable()?);
            bytes.variable()?;
            if ![2, 10].contains(&kind) {
                return Ok(None);
            }
            let skill = bytes.word()?;
            let amount = u64::from(bytes.variable()?);
            if source == 0 || target == 0 || skill == 0 || amount > 2_000_000_000 {
                return Err(ReadError::Invalid);
            }
            Ok(Some(Event::Damage(Hit {
                source,
                target,
                skill,
                amount,
                critical: false,
                tick: true,
                flags: 0,
                angle: 0,
            })))
        }
        [0x33, 0x36] | [0x45, 0x36] | [0x44, 0x36] => {
            let own = opcode[0] == 0x33;
            let id = u64::from(bytes.variable()?);
            bytes.word()?;
            let mask = bytes.byte()?;
            if mask & 1 == 0 || id == 0 {
                return Ok(None);
            }
            let name = bytes.character_text()?;
            let class = if own {
                let server = u16::from(bytes.byte()?) | u16::from(bytes.byte()?) << 8;
                if !(1000..3000).contains(&server) {
                    return Err(ReadError::Invalid);
                }
                Some(bytes.word()?)
            } else {
                None
            };
            Ok(Some(Event::Identity {
                id,
                name,
                class,
                own,
            }))
        }
        [0x42, 0x36] => {
            let id = u64::from(bytes.variable()?);
            bytes.variable()?;
            let reason = bytes.variable()?;
            Ok(Some(Event::Removed {
                id,
                death: [1, 3].contains(&reason),
            }))
        }
        [0x41, 0x36] | [0x40, 0x36] => {
            let id = u64::from(bytes.variable()?);
            let mask_start = bytes.offset;
            let kind = bytes.byte()?;
            if ![0x0c, 0x0d, 0x1c, 0x1f, 0x5f].contains(&kind) {
                return Ok(None);
            }
            if id == 0 {
                return Ok(None);
            }
            let narrow = npc_subtree(frame, mask_start, 2).ok();
            let wide = npc_subtree(frame, mask_start, 4).ok();
            let (name, model) = match (narrow, wide) {
                (Some(a), Some(b)) if a != b => return Err(ReadError::Invalid),
                (Some(a), _) | (_, Some(a)) => a,
                _ => return Ok(None),
            };
            Ok(Some(Event::Npc {
                id,
                name,
                model,
                kind,
            }))
        }
        [4, 0x8d] => {
            let id = u64::from(bytes.variable()?);
            bytes.skip(4)?;
            let owner = u64::from(bytes.variable()?);
            if id == 0 || owner == 0 || id == owner {
                return Ok(None);
            }
            Ok(Some(Event::Owner { id, owner }))
        }
        [0x47, 0x38] => {
            let count = bytes.byte()? as usize;
            if count == 0 || count > 64 {
                return Ok(None);
            }
            let mut updates = Vec::with_capacity(count);
            let mut skills = std::collections::BTreeSet::new();
            for _ in 0..count {
                let skill = bytes.word()?;
                let remaining = bytes.variable()?;
                if skill == 0 || remaining > 3_600_000 || !skills.insert(skill) {
                    return Err(ReadError::Invalid);
                }
                updates.push(Event::Cooldown {
                    skill,
                    remaining_units: Some(remaining),
                    charges: None,
                });
            }
            if bytes.offset != frame.len() {
                return Err(ReadError::Invalid);
            }
            Ok(Some(Event::Updates(updates)))
        }
        [0x22, 0x38] => {
            let mask = bytes.byte()?;
            if mask == 0 || mask & !3 != 0 {
                return Err(ReadError::Invalid);
            }
            let skill = bytes.word()?;
            let charges = if mask & 1 != 0 { bytes.variable()? } else { 0 };
            let recharge_ms = if mask & 2 != 0 { bytes.variable()? } else { 0 };
            if !(11_000_000..20_000_000).contains(&skill)
                || charges > 9
                || recharge_ms > 3_600_000
                || bytes.offset != frame.len()
            {
                return Err(ReadError::Invalid);
            }
            Ok(Some(Event::SkillCharges {
                skill,
                charges,
                recharge_ms,
            }))
        }
        [0, 0x8d] => {
            let id = u64::from(bytes.variable()?);
            if [bytes.byte()?, bytes.byte()?, bytes.byte()?] != [2, 1, 0] {
                return Ok(None);
            }
            let current = u64::from(bytes.word()?);
            if bytes.word()? != 0 {
                return Ok(None);
            }
            Ok(Some(Event::Health { id, current }))
        }
        [2, 0x97] => Ok(Some(Event::PartyMembers {
            members: party_roster(frame)?,
        })),
        [0x1f, 0x97] => Ok(Some(Event::PartyMembers {
            members: vec![party_member_update(frame)?],
        })),
        [0x22, 0x96] => {
            if !(10..=128).contains(&frame.len()) {
                return Err(ReadError::Invalid);
            }
            let key = bytes.word()?;
            bytes.skip(2)?;
            let server =
                u16::from_le_bytes(frame[8..10].try_into().map_err(|_| ReadError::Invalid)?);
            if key == 0 || !(1000..3000).contains(&server) {
                return Err(ReadError::Invalid);
            }
            Ok(Some(Event::PartyMemberRemoved { key, server }))
        }
        [0, 0x92] => Ok(Some(Event::MemberProfiles {
            members: member_profiles(frame)?,
        })),
        _ => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn raw(hex: &str) -> Vec<u8> {
        hex.as_bytes()
            .chunks_exact(2)
            .map(|s| u8::from_str_radix(std::str::from_utf8(s).unwrap(), 16).unwrap())
            .collect()
    }
    #[test]
    fn observed_direct_hit_variants_preserve_total_without_adding_extra_hits() {
        for (hex, source, target, total, critical) in [
            (
                "0438e9de020600c80b9147ff003f02020002aff4b76301000000e4506a0100",
                1480,
                44905,
                106,
                false,
            ),
            (
                "0438fcc2010600bf6bc759d1003203020002c711c75101000000904e660100",
                13759,
                24956,
                102,
                true,
            ),
            (
                "0438cac20406009e389147ff00e102040000aff4b76301000000a4587f0100",
                7198,
                74058,
                127,
                false,
            ),
            (
                "0438bfe6020600d23310ffd6006f0208000055a2fb5302000000aa56d20e0200",
                6610,
                45887,
                1874,
                false,
            ),
            (
                "0438b1ea013600f30a40c0f4007a038000010b199b5f01000000ac52a40d021818",
                1395,
                30001,
                1700,
                true,
            ),
            (
                "0438b1ea013400f30ae0b7f800cd028bd3276101000000ac52d330010159",
                1395,
                30001,
                6227,
                false,
            ),
        ] {
            let Some(Event::Damage(hit)) = decode(&raw(hex)).unwrap() else {
                panic!("missing hit")
            };
            assert_eq!(
                (hit.source, hit.target, hit.amount, hit.critical),
                (source, target, total, critical)
            );
        }
    }
    #[test]
    fn server_tick_amount_is_damage_but_healing_is_not() {
        let Some(Event::Damage(hit)) =
            decode(&raw("0538812a0abdd1019002bb1227073332931200")).unwrap()
        else {
            panic!("missing tick")
        };
        assert_eq!((hit.source, hit.target, hit.amount), (26813, 5377, 51));
        assert!(hit.tick);
        assert!(decode(&raw("0538b12701b127b601032c530bb739"))
            .unwrap()
            .is_none());
    }
    #[test]
    fn self_identity_is_bound_to_its_own_frame() {
        let decoded=decode(&raw("3336ed745e91c12837064e616963686118051e000000011c0000007f0100007f0100001c000000d002040000000000")).unwrap();
        assert_eq!(
            decoded,
            Some(Event::Identity {
                id: 14957,
                name: "Naicha".into(),
                class: Some(30),
                own: true
            })
        );
        assert!(decode(&raw("3336ed745e91c12837064e6169")).is_err());
    }
    #[test]
    fn any_truncation_of_a_direct_hit_never_creates_partial_damage() {
        let data = raw("0438e9de020600c80b9147ff003f02020002aff4b76301000000e4506a0100");
        for end in 0..27 {
            assert!(!matches!(decode(&data[..end]), Ok(Some(Event::Damage(_)))));
        }
    }
    #[test]
    fn arbitrary_bounded_input_never_panics() {
        let mut state = 0xace123u32;
        for length in 0..128 {
            for _ in 0..64 {
                let bytes: Vec<u8> = (0..length)
                    .map(|_| {
                        state = state.wrapping_mul(1664525).wrapping_add(1013904223);
                        (state >> 24) as u8
                    })
                    .collect();
                let _ = decode(&bytes);
            }
        }
    }
}
