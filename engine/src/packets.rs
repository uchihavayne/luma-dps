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
    /// A flag-0A tick retains its distinct effect code for contextual
    /// classification. Some NPC effects triggered by player skills restore the
    /// NPC's HP and must not be silently credited as player damage.
    PeriodicDamage {
        hit: Hit,
        effect_id: u32,
    },
    /// A received tick's explicit healing field. Effective healing and overheal
    /// are not supplied by this record.
    Healing(Hit),
    /// The local player's announced zone, not a field-monster map list.
    ZoneChange {
        zone_id: u32,
    },
    Assistance(crate::assistance::AssistEvent),
    Position(crate::spatial::Observation),
    Cube(crate::cube::Event),
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
    PartyContext {
        party_id: u32,
        capacity: u8,
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
    fn canonical_variable(&mut self) -> Result<u32, ReadError> {
        let start = self.offset;
        let value = self.variable()?;
        let width = self.offset - start;
        if width > 1 && value < (1u32 << ((width - 1) * 7)) {
            return Err(ReadError::Invalid);
        }
        Ok(value)
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

fn character_identity(
    frame: &[u8],
    id: u64,
    name_at: usize,
    own: bool,
    require_class: bool,
) -> Result<Event, ReadError> {
    let mut bytes = Bytes {
        data: frame,
        offset: name_at,
    };
    let name = bytes.character_text()?;
    let mut home_server = None;
    let class = if own {
        let server = u16::from(bytes.byte()?) | u16::from(bytes.byte()?) << 8;
        if !(1000..3000).contains(&server) {
            return Err(ReadError::Invalid);
        }
        home_server = Some(server);
        Some(bytes.word()?)
    } else {
        bytes.word().ok().filter(|code| (5..=64).contains(code))
    };
    if require_class && class.is_none_or(|code| !(5..=64).contains(&code)) {
        return Err(ReadError::Invalid);
    }
    let profile = home_server.map(|server| MemberProfile {
        id,
        server,
        name: name.clone(),
    });
    let identity = Event::Identity {
        id,
        name,
        class,
        own,
    };
    Ok(if let Some(profile) = profile {
        Event::Updates(vec![
            identity,
            Event::MemberProfiles {
                members: vec![profile],
            },
        ])
    } else {
        identity
    })
}

/// A bounded nickname prefix followed by the complete typed character suffix:
/// server u16, class u32, faction byte and level u32. A name-shaped guild or
/// chat string without this suffix cannot establish a combat actor identity.
fn nearby_profile(frame: &[u8], id: u64, prefix: usize) -> Result<Option<Event>, ReadError> {
    let mut result = None;
    for at in prefix..frame.len().min(prefix + 17) {
        let mut reader = Bytes {
            data: frame,
            offset: at,
        };
        let Ok(name) = reader.character_text() else {
            continue;
        };
        let after = reader.offset;
        let Some(tail) = frame.get(after..after + 11) else {
            continue;
        };
        let server = u16::from_le_bytes([tail[0], tail[1]]);
        let class = u32::from_le_bytes(tail[2..6].try_into().map_err(|_| ReadError::Invalid)?);
        let level = u32::from_le_bytes(tail[7..11].try_into().map_err(|_| ReadError::Invalid)?);
        if !(1000..3000).contains(&server)
            || !(5..=40).contains(&class)
            || ![1, 2].contains(&tail[6])
            || !(1..=100).contains(&level)
        {
            continue;
        }
        let event = Event::Updates(vec![
            Event::Identity {
                id,
                name: name.clone(),
                class: Some(class),
                own: false,
            },
            Event::MemberProfiles {
                members: vec![MemberProfile { id, name, server }],
            },
        ]);
        if result.as_ref().is_some_and(|old| *old != event) {
            return Err(ReadError::Invalid);
        }
        result = Some(event);
    }
    Ok(result)
}

// The subtree position has two documented mask widths. Names at any other
// position in an opaque packet are not a source of entity identity.
fn npc_subtree(
    data: &[u8],
    mask_start: usize,
    width: usize,
) -> Result<(Option<String>, u32, usize), ReadError> {
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
    Ok((name, model, bytes.offset))
}

fn explicit_spawn_owner(frame: &[u8], id: u64) -> Option<u64> {
    if frame.len() > 16_384 {
        return None;
    }
    let mut markers = frame
        .windows(8)
        .enumerate()
        .filter(|(_, bytes)| bytes.iter().all(|value| *value == 0xff))
        .map(|(offset, _)| offset);
    let marker = markers.next()?;
    if markers.next().is_some() {
        return None;
    }
    let mut leading = Bytes {
        data: frame,
        offset: marker.checked_add(16)?,
    };
    let owner = u64::from(leading.canonical_variable().ok()?);
    if owner == 0 || owner == id || owner > u64::from(u16::MAX) {
        return None;
    }
    // The spawn's varint owner is independently repeated as u16 in a tagged
    // owner subrecord. Both must agree; a self-valued monster record, unrelated
    // 07 02 01 field or an old tag cannot establish player-summon ownership.
    let tail = frame.get(leading.offset..leading.offset.saturating_add(256).min(frame.len()))?;
    for tag in [6, 1] {
        let candidates: Vec<_> = tail
            .windows(5)
            .filter(|bytes| bytes[..3] == [7, 2, tag])
            .map(|bytes| u64::from(u16::from_le_bytes([bytes[3], bytes[4]])))
            .collect();
        if !candidates.is_empty() {
            return (candidates.len() == 1 && candidates[0] == owner).then_some(owner);
        }
    }
    None
}

/// Read only complete framed 02 97 rosters. Optional member tails are bounded;
/// slot, UTF-8 name, level and repeated world id validate each next boundary.
/// A counted update is merged into live membership; missing slots are not a
/// disband signal. The first complete typed prefix is the next member, before
/// any later member that also falls inside the bounded opaque tail window.
fn party_header(frame: &[u8]) -> Result<(u32, u8, usize), ReadError> {
    let mut bytes = Bytes::new(frame);
    let party_id = bytes.word()?;
    let title_len = usize::from(bytes.byte()?);
    if title_len > 96 {
        return Err(ReadError::Invalid);
    }
    let title_start = bytes.offset;
    bytes.skip(title_len)?;
    let title =
        std::str::from_utf8(&frame[title_start..bytes.offset]).map_err(|_| ReadError::Invalid)?;
    if title.chars().any(char::is_control) {
        return Err(ReadError::Invalid);
    }
    let capacity = bytes.byte()?;
    if !(1..=12).contains(&capacity) {
        return Err(ReadError::Invalid);
    }
    Ok((party_id, capacity, bytes.offset))
}

fn party_roster(frame: &[u8]) -> Result<Vec<PartyMember>, ReadError> {
    let (_, capacity, offset) = party_header(frame)?;
    let mut bytes = Bytes {
        data: frame,
        offset,
    };
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

/// A direct damage record and the attacker's power scalar (1/100 %, which an owned summon shares
/// with its owner), read before the damage amount.
fn damage_record(frame: &[u8]) -> Result<Option<(Hit, u32)>, ReadError> {
    let mut bytes = Bytes::new(frame);
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
        5..=7 => {
            let flags = bytes.byte()?;
            bytes.byte()?;
            let angle = bytes.byte()?;
            bytes.skip(8)?;
            (flags, angle)
        }
        _ => return Ok(None),
    };
    let scalar = bytes.variable()?;
    let amount = u64::from(bytes.variable()?);
    if source == 0 || target == 0 || skill == 0 || kind > 8 || amount > 2_000_000_000 {
        return Err(ReadError::Invalid);
    }
    Ok(Some((
        Hit {
            source,
            target,
            skill,
            amount,
            critical: kind == 3,
            tick: false,
            flags,
            angle,
        },
        scalar,
    )))
}

/// The attacker and power scalar of a direct damage frame, when it has one.
pub fn power_scalar(frame: &[u8]) -> Option<(u64, u32)> {
    if frame.get(..2) != Some(&[4, 0x38]) {
        return None;
    }
    let (hit, scalar) = damage_record(frame).ok()??;
    (1..=1_000_000).contains(&scalar).then_some((hit.source, scalar))
}

pub fn decode(frame: &[u8]) -> Result<Option<Event>, ReadError> {
    let Some(opcode) = frame.get(..2) else {
        return Err(ReadError::Short);
    };
    if let Some(position) = crate::spatial::position(frame) {
        return Ok(Some(Event::Position(position)));
    }
    if matches!(
        opcode,
        [9, 0x38] | [2, 0x38] | [0x2a, 0x38] | [0x2b, 0x38] | [0x2c, 0x38] | [0, 0x8d] | [5, 0xe0]
    ) {
        return crate::assistance::decode(frame)
            .map(|event| {
                event.map(|event| {
                    let event = Event::Assistance(event);
                    if let Some(position) = crate::assistance::local_effect_position(frame) {
                        Event::Updates(vec![event, Event::Position(position)])
                    } else {
                        event
                    }
                })
            })
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
            | [9, 0x90]
            | [0x56, 0x36]
    ) {
        if opcode == [0, 0x90] {
            let pets = crate::character::decode(frame).map_err(|_| ReadError::Invalid)?;
            let species = crate::character::decode_species(frame).ok().flatten();
            let updates: Vec<_> = pets
                .into_iter()
                .chain(species)
                .map(Event::Character)
                .collect();
            return Ok(match updates.len() {
                0 => None,
                1 => updates.into_iter().next(),
                _ => Some(Event::Updates(updates)),
            });
        }
        return crate::character::decode(frame)
            .map(|event| event.map(Event::Character))
            .map_err(|_| ReadError::Invalid);
    }
    if matches!(opcode, [0x34 | 0x35 | 0x38 | 0x3a | 0x23, 0x36]) {
        return Ok(crate::cube::decode(frame).map(Event::Cube));
    }
    let mut bytes = Bytes::new(frame);
    match opcode {
        [0x21, 0x36] => {
            // Login/loading route: counter u32, then the actual local zone id.
            // The optional body carries position and transfer context; no
            // coordinate or run grouping inference is made here.
            if !(10..=4096).contains(&frame.len()) {
                return Err(ReadError::Invalid);
            }
            bytes.word()?;
            let zone_id = bytes.word()?;
            if !(1..=10_000_000).contains(&zone_id) {
                return Err(ReadError::Invalid);
            }
            let zone = Event::ZoneChange { zone_id };
            if let (Some(x), Some(y)) = (frame.get(18..22), frame.get(22..26)) {
                let x = f32::from_le_bytes(x.try_into().map_err(|_| ReadError::Invalid)?);
                let y = f32::from_le_bytes(y.try_into().map_err(|_| ReadError::Invalid)?);
                if crate::spatial::coordinates(x, y, None) && x.abs() > 100.0 && y.abs() > 100.0 {
                    let mut updates = vec![
                        zone,
                        Event::Position(crate::spatial::Observation {
                            actor_id: 0,
                            x,
                            y,
                            z: None,
                            source: "server-zone".into(),
                            local_only: true,
                        }),
                    ];
                    // A load sends everything in range again, and carries the player's height.
                    updates.push(Event::Cube(crate::cube::Event::Reset));
                    updates.extend(
                        crate::cube::position(frame, 18)
                            .map(|pos| Event::Cube(crate::cube::Event::Fix { pos })),
                    );
                    return Ok(Some(Event::Updates(updates)));
                }
            }
            Ok(Some(zone))
        }
        [4, 0x38] => Ok(damage_record(frame)?.map(|(hit, _)| Event::Damage(hit))),
        [5, 0x38] => {
            let target = u64::from(bytes.variable()?);
            let kind = bytes.byte()?;
            let source = u64::from(bytes.variable()?);
            bytes.variable()?;
            if ![2, 10, 11].contains(&kind) {
                return Ok(None);
            }
            // The first u32 is an effect-instance code, not the skill. A
            // 0x08 flag supplies a trailing skill; the old flags=2 form has
            // only the legacy code and remains supported as such.
            let effect_id = bytes.word()?;
            let amount = u64::from(bytes.variable()?);
            let healed = if kind & 1 != 0 {
                Some(u64::from(bytes.variable()?))
            } else {
                None
            };
            let skill = if kind & 8 != 0 {
                bytes.word()?
            } else {
                effect_id
            };
            if bytes.offset != frame.len()
                || source == 0
                || target == 0
                || skill == 0
                || amount > 2_000_000_000
                || healed.is_some_and(|value| value > 2_000_000_000)
            {
                return Err(ReadError::Invalid);
            }
            let hit = Hit {
                source,
                target,
                skill,
                // In a healing tick `amount` is the remaining heal total.
                // It must never be added to either DPS or the tick's HPS.
                amount: healed.unwrap_or(amount),
                critical: false,
                tick: true,
                flags: 0,
                angle: 0,
            };
            Ok(Some(if healed.is_some() {
                Event::Healing(hit)
            } else if kind == 10 {
                Event::PeriodicDamage { hit, effect_id }
            } else {
                Event::Damage(hit)
            }))
        }
        [0x33, 0x36] | [0x45, 0x36] | [0x44, 0x36] => {
            let own = opcode[0] == 0x33;
            let id = u64::from(bytes.variable()?);
            if id == 0 {
                return Ok(None);
            }
            let prefix = bytes.offset;
            if !own {
                if let Some(profile) = nearby_profile(frame, id, prefix)? {
                    return Ok(Some(profile));
                }
            }
            let fixed = (|| {
                bytes.word()?;
                let mask = bytes.byte()?;
                if mask & 1 == 0 {
                    return Ok(None);
                }
                character_identity(frame, id, bytes.offset, own, false).map(Some)
            })();
            // The two opaque prefix values are variable-length on supported
            // character snapshots. A fixed four-byte skip misses names when
            // either width changes. Decode this typed prefix, with a required
            // profile class suffix, rather than searching body/guild strings.
            let variable = (|| {
                let mut header = Bytes {
                    data: frame,
                    offset: prefix,
                };
                header.canonical_variable()?;
                header.canonical_variable()?;
                header.byte()?;
                character_identity(frame, id, header.offset, own, true).map(Some)
            })();
            let identity = match (fixed, variable) {
                (Ok(Some(a)), Ok(Some(b))) if a != b => return Err(ReadError::Invalid),
                (Ok(Some(a)), _) | (_, Ok(Some(a))) => a,
                (fixed, _) => return fixed,
            };
            if own {
                if let Some(wing) = crate::character::decode_own_wing(frame) {
                    let mut updates = match identity {
                        Event::Updates(updates) => updates,
                        identity => vec![identity],
                    };
                    updates.push(Event::Character(wing));
                    return Ok(Some(Event::Updates(updates)));
                }
            }
            Ok(Some(identity))
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
            let (name, model, model_end) = match (narrow, wide) {
                (Some(a), Some(b)) if a != b => return Err(ReadError::Invalid),
                (Some(a), _) | (_, Some(a)) => a,
                _ => return Ok(None),
            };
            let owner = [0x1f, 0x5f]
                .contains(&kind)
                .then(|| explicit_spawn_owner(frame, id))
                .flatten();
            let spawn = Event::Npc {
                id,
                name,
                model,
                kind: if owner.is_some() { 0x5f } else { kind },
            };
            let mut events = vec![spawn];
            if let Some(owner) = owner {
                events.push(Event::Owner { id, owner });
            }
            if let (Some(x), Some(y)) = (
                frame.get(model_end + 2..model_end + 6),
                frame.get(model_end + 6..model_end + 10),
            ) {
                let x = f32::from_le_bytes(x.try_into().map_err(|_| ReadError::Invalid)?);
                let y = f32::from_le_bytes(y.try_into().map_err(|_| ReadError::Invalid)?);
                if crate::spatial::coordinates(x, y, None) && x.abs() > 1.0 && y.abs() > 1.0 {
                    events.push(Event::Position(crate::spatial::Observation {
                        actor_id: id,
                        x,
                        y,
                        z: None,
                        source: "server-spawn".into(),
                        local_only: false,
                    }));
                }
            }
            Ok(Some(if events.len() == 1 {
                events.remove(0)
            } else {
                Event::Updates(events)
            }))
        }
        [4, 0x8d] => {
            let id = u64::from(bytes.variable()?);
            // Some supported regions use this opcode for a death notice with
            // exactly one actor varint. Its complete shape is distinct from
            // appearance/ownership; a partial longer frame is never dispatched
            // by the length-framing layer as this short record.
            if bytes.offset == frame.len() {
                return Ok((id > 0).then_some(Event::Removed { id, death: true }));
            }
            bytes.skip(4)?;
            let owner = u64::from(bytes.variable()?);
            // A longer record may announce an acting nearby player, followed
            // by the acting character's home server and name.
            // Read that typed tail in place: scanning arbitrary later bytes
            // can mistake a guild name for the acting character's name.
            if bytes.offset < frame.len() {
                if frame.len() > 4096 || owner == 0 {
                    return Err(ReadError::Invalid);
                }
                let server = u16::from(bytes.byte()?) | u16::from(bytes.byte()?) << 8;
                if !(1000..3000).contains(&server) {
                    return Err(ReadError::Invalid);
                }
                let name = bytes.character_text()?;
                return Ok(Some(Event::MemberProfiles {
                    members: vec![MemberProfile {
                        id: owner,
                        name,
                        server,
                    }],
                }));
            }
            // A bare target/skill/actor prefix is not verified ownership.
            // Real ownership is decoded only from a complete spawn above.
            Ok(None)
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
        [2, 0x97] => {
            let members = party_roster(frame)?;
            let (party_id, capacity, _) = party_header(frame)?;
            let event = Event::PartyMembers { members };
            // Zero is not a validated disband signal. It cannot clear a known
            // party or establish a new party context.
            Ok(Some(if party_id == 0 {
                event
            } else {
                Event::Updates(vec![Event::PartyContext { party_id, capacity }, event])
            }))
        }
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
    fn extended_hit_forms_five_six_and_seven_share_fixed_byte_region() {
        let base = raw("0438e9de020600c80b9147ff003f02020002aff4b76301000000e4506a0100");
        for form in 5..=7 {
            let mut frame = base.clone();
            let mut offset = 2;
            varint(&frame, &mut offset).unwrap();
            frame[offset] = form;
            let Some(Event::Damage(hit)) = decode(&frame).unwrap() else {
                panic!("missing extended form");
            };
            assert_eq!((hit.source, hit.target, hit.amount), (1480, 44905, 106));
            // The opaque region byte is fixed-width; a high bit does not
            // consume the following direction byte as a ULEB continuation.
            let mut fields = Bytes::new(&frame);
            fields.variable().unwrap();
            fields.variable().unwrap();
            fields.variable().unwrap();
            fields.variable().unwrap();
            fields.word().unwrap();
            fields.byte().unwrap();
            fields.variable().unwrap();
            fields.byte().unwrap();
            let middle = fields.offset;
            frame[middle] = 0x80;
            let Some(Event::Damage(high)) = decode(&frame).unwrap() else {
                panic!("high-bit byte lost hit");
            };
            assert_eq!((high.amount, high.angle), (hit.amount, hit.angle));
        }
    }
    #[test]
    fn server_tick_amount_is_damage_but_healing_is_not() {
        let Some(Event::PeriodicDamage { hit, effect_id }) =
            decode(&raw("0538812a0abdd1019002bb1227073332931200")).unwrap()
        else {
            panic!("missing tick")
        };
        assert_eq!((hit.source, hit.target, hit.amount), (26813, 5377, 51));
        assert_eq!(hit.skill, 1_217_330);
        assert_eq!(effect_id, 120_001_211);
        assert!(hit.tick);
        assert!(decode(&raw("0538b12701b127b601032c530bb739"))
            .unwrap()
            .is_none());
    }
    #[test]
    fn periodic_heal_uses_explicit_healed_value_and_never_remaining_amount_as_damage() {
        let mut frame = vec![5, 0x38, 8, 11, 7, 1];
        frame.extend(1_700_000_022u32.to_le_bytes());
        frame.extend([123, 83]); // remaining total, actual tick heal
        frame.extend(17_050_000u32.to_le_bytes());
        let Some(Event::Healing(hit)) = decode(&frame).unwrap() else {
            panic!("missing heal");
        };
        assert_eq!(
            (hit.source, hit.target, hit.amount, hit.skill),
            (7, 8, 83, 17_050_000)
        );
        assert!(hit.tick);
        for end in 0..frame.len() {
            assert!(!matches!(
                decode(&frame[..end]),
                Ok(Some(Event::Damage(_) | Event::Healing(_)))
            ));
        }
        let mut trailing = frame.clone();
        trailing.push(0);
        assert!(decode(&trailing).is_err());
        frame[3] = 9; // announcement: no actual tick amount
        assert!(decode(&frame).unwrap().is_none());
    }
    #[test]
    fn self_identity_is_bound_to_its_own_frame() {
        let decoded=decode(&raw("3336ed745e91c12837064e616963686118051e000000011c0000007f0100007f0100001c000000d002040000000000")).unwrap();
        assert_eq!(
            decoded,
            Some(Event::Updates(vec![
                Event::Identity {
                    id: 14957,
                    name: "Naicha".into(),
                    class: Some(30),
                    own: true
                },
                Event::MemberProfiles {
                    members: vec![MemberProfile {
                        id: 14957,
                        server: 1304,
                        name: "Naicha".into(),
                    }]
                }
            ]))
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
