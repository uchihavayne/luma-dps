//! The party finder room: who is in it, with gear score, combat power and ready state, and who
//! leads. The layouts are the game's own party finder messages (`02 97` the room, `0b 97` one
//! member joined, `1f 97` one member updated, `16 97` / `15 97` a ready change, `1d 97` / `2a 97`
//! leaving or being removed), read the way a second meter documents them. A member record is
//! flags, slot, character id, nickname, class id, level, gear score, a byte of booleans, the home
//! server when flagged, combat power.
use crate::wire::Wire;

const MAX_MEMBERS: usize = 30;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RoomMember {
    pub dbid: u64,
    pub name: String,
    pub class_id: u32,
    pub level: u32,
    pub gear_score: u32,
    pub combat_power: u64,
    pub server: u16,
    pub ready: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Room {
    pub id: u32,
    pub title: String,
    pub kind: u8,
    pub dungeon_id: u32,
    pub leader: u64,
    pub members: Vec<RoomMember>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RoomEvent {
    Group(Room),
    Joined(RoomMember),
    Updated(RoomMember),
    /// A ready change: of one member, or of the local player when no character id is given.
    Ready { dbid: Option<u64>, ready: bool },
    Left,
}

/// The class a class id belongs to: ids come in fours (the race and sex variants of one class).
pub fn class_name(class_id: u32) -> Option<&'static str> {
    const CLASSES: [Option<&str>; 12] = [
        None,
        Some("Gladiator"),
        Some("Templar"),
        Some("Ranger"),
        Some("Assassin"),
        Some("Spiritmaster"),
        Some("Sorcerer"),
        Some("Cleric"),
        Some("Chanter"),
        None,
        None,
        Some("Brawler"),
    ];
    let index = usize::try_from(class_id.checked_sub(1)? / 4).ok()?;
    CLASSES.get(index).copied().flatten()
}

fn member(wire: &mut Wire) -> Option<RoomMember> {
    let flags = wire.u8();
    wire.u8(); // slot
    let dbid = wire.i64() as u64;
    let name = wire.text();
    let class_id = wire.i32() as u32;
    let level = wire.i32() as u32;
    let gear_score = wire.i32() as u32;
    wire.bool();
    let ready = flags & 2 != 0 && wire.bool();
    let mut server = 0;
    if flags & 4 != 0 {
        server = wire.u16();
        wire.u16();
    }
    wire.u8();
    let combat_power = wire.i64().max(0) as u64;
    wire.u8();
    if flags & 16 != 0 {
        wire.i64();
    }
    wire.u8();
    wire.u8();
    let sane = wire.ok()
        && dbid != 0
        && !name.is_empty()
        && name.chars().count() <= 24
        && !name.chars().any(char::is_control)
        && (1..=200).contains(&level)
        && gear_score <= 100_000
        && combat_power <= 100_000_000_000;
    sane.then_some(RoomMember {
        dbid,
        name,
        class_id,
        level,
        gear_score,
        combat_power,
        server,
        ready,
    })
}

pub fn decode(frame: &[u8]) -> Option<RoomEvent> {
    if frame.len() > 8192 {
        return None;
    }
    match frame.get(..2)? {
        [0x02, 0x97] => {
            let mut wire = Wire::new(frame, 2);
            let id = wire.i32() as u32;
            let title = wire.text();
            let kind = wire.u8();
            let dungeon_id = wire.i32() as u32;
            wire.u8();
            wire.u8();
            let leader = wire.i64() as u64;
            wire.bool();
            wire.u8();
            wire.u8();
            let count = wire.count(MAX_MEMBERS);
            if !wire.ok() || title.chars().count() > 64 || title.chars().any(char::is_control) {
                return None;
            }
            let mut members = Vec::new();
            for _ in 0..count {
                // A record the reader cannot make sense of ends the list: what follows cannot be
                // placed any more. Empty seats (character id zero) are skipped, not errors.
                let before = wire.position();
                let flags_at = frame.get(before).copied();
                let row = member(&mut wire);
                match row {
                    Some(row) => members.push(row),
                    None if wire.ok() && flags_at.is_some() => continue,
                    None => break,
                }
            }
            Some(RoomEvent::Group(Room {
                id,
                title,
                kind,
                dungeon_id,
                leader,
                members,
            }))
        }
        [0x0b, 0x97] => member(&mut Wire::new(frame, 2)).map(RoomEvent::Joined),
        [0x1f, 0x97] => member(&mut Wire::new(frame, 2)).map(RoomEvent::Updated),
        [0x16, 0x97] if frame.len() == 11 => {
            let mut wire = Wire::new(frame, 2);
            let dbid = wire.i64() as u64;
            let ready = wire.bool();
            (wire.ok() && dbid != 0).then_some(RoomEvent::Ready { dbid: Some(dbid), ready })
        }
        [0x15, 0x97] if frame.len() == 5 => {
            let mut wire = Wire::new(frame, 2);
            let result = wire.u16();
            let ready = wire.bool();
            (wire.ok() && result == 0).then_some(RoomEvent::Ready { dbid: None, ready })
        }
        [0x1d, 0x97] if frame.len() == 4 => {
            let mut wire = Wire::new(frame, 2);
            (wire.u16() == 0 && wire.ok()).then_some(RoomEvent::Left)
        }
        [0x2a, 0x97] if frame.len() == 3 => Some(RoomEvent::Left),
        _ => None,
    }
}
