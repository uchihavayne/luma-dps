//! The party finder room (gear score, combat power, ready, leader) and the player's items
//! (currencies, loot). The frames are built by an encoder that mirrors the game's layouts, bit-shared
//! booleans included; none could be captured here, so these check the decoders against the layout
//! as documented and how the engine uses what they read.
use luma_engine::{
    items::{self, Change, Stack},
    lobby::{self, Room, RoomEvent, RoomMember},
    packets::Event,
    MeterEngine,
};

struct Frame {
    out: Vec<u8>,
    bit_at: Option<usize>,
    bit: u8,
}
impl Frame {
    fn new(opcode: [u8; 2]) -> Self {
        Self { out: opcode.to_vec(), bit_at: None, bit: 0 }
    }
    fn u8(&mut self, value: u8) -> &mut Self {
        self.out.push(value);
        self
    }
    fn u16(&mut self, value: u16) -> &mut Self {
        self.out.extend(value.to_le_bytes());
        self
    }
    fn i32(&mut self, value: i32) -> &mut Self {
        self.out.extend(value.to_le_bytes());
        self
    }
    fn i64(&mut self, value: i64) -> &mut Self {
        self.out.extend(value.to_le_bytes());
        self
    }
    fn varint(&mut self, mut value: u32) -> &mut Self {
        loop {
            let mut byte = (value & 127) as u8;
            value >>= 7;
            if value != 0 {
                byte |= 128;
            }
            self.out.push(byte);
            if value == 0 {
                return self;
            }
        }
    }
    fn text(&mut self, value: &str) -> &mut Self {
        self.varint(value.len() as u32);
        self.out.extend(value.as_bytes());
        self
    }
    /// A boolean takes the next free bit of the current byte, or a new byte here when none is open.
    fn bool(&mut self, value: bool) -> &mut Self {
        let at = match self.bit_at {
            Some(at) => at,
            None => {
                self.out.push(0);
                let at = self.out.len() - 1;
                self.bit_at = Some(at);
                self.bit = 0;
                at
            }
        };
        if value {
            self.out[at] |= 1 << self.bit;
        }
        self.bit += 1;
        if self.bit > 7 {
            self.bit_at = None;
            self.bit = 0;
        }
        self
    }
}

fn dbid(server: u16, number: u64) -> i64 {
    (u64::from(server) << 48 | number) as i64
}
struct Seat {
    number: u64,
    name: &'static str,
    class_id: i32,
    gear: i32,
    power: i64,
    ready: bool,
}
fn member(frame: &mut Frame, seat: &Seat, server: u16) {
    // Flags 2 (a ready bit is sent) and 4 (the home server is sent).
    frame.u8(6).u8(1).i64(dbid(server, seat.number)).text(seat.name).i32(seat.class_id).i32(50).i32(seat.gear);
    frame.bool(false).bool(seat.ready);
    frame.u16(server).u16(4024).u8(4).i64(seat.power).u8(1).u8(0).u8(0);
}
fn empty_seat(frame: &mut Frame) {
    frame.u8(0).u8(2).i64(0).text("").i32(0).i32(0).i32(0).bool(false).u8(0).i64(0).u8(0).u8(0).u8(0);
}
fn room(seats: &[Seat], leader: u64) -> Vec<u8> {
    let mut frame = Frame::new([0x02, 0x97]);
    frame.i32(41).text("Fire Temple").u8(3).i32(2_000_031).u8(0).u8(0).i64(dbid(2315 + seats.iter().position(|row| row.number == leader).unwrap_or(0) as u16, leader)).bool(false).u8(0).u8(0);
    frame.varint(seats.len() as u32 + 1);
    for (index, seat) in seats.iter().enumerate() {
        member(&mut frame, seat, 2315 + index as u16);
        if index == 1 {
            empty_seat(&mut frame);
        }
    }
    frame.out
}
fn seat(number: u64, name: &'static str, class_id: i32, gear: i32, power: i64, ready: bool) -> Seat {
    Seat { number, name, class_id, gear, power, ready }
}
fn five() -> Vec<Seat> {
    vec![
        seat(11, "ShizoiDa", 14, 2262, 122_800, false),
        seat(12, "MakiAhA", 30, 2319, 108_900, true),
        seat(13, "Twelve", 26, 2198, 108_700, true),
        seat(14, "Astorf", 33, 2130, 104_200, false),
        seat(15, "Opchico", 22, 2219, 88_900, true),
    ]
}

#[test]
fn a_room_lists_every_member_with_gear_power_server_and_ready_across_shared_boolean_bytes() {
    let Some(RoomEvent::Group(parsed)) = lobby::decode(&room(&five(), 13)) else {
        panic!("a room")
    };
    assert_eq!((parsed.id, parsed.title.as_str(), parsed.kind, parsed.dungeon_id, parsed.leader), (41, "Fire Temple", 3, 2_000_031, dbid(2317, 13) as u64));
    // The empty seat between the second and third members is skipped; five seats are read.
    let rows: Vec<_> = parsed.members.iter().map(|row| (row.name.as_str(), row.gear_score, row.combat_power, row.ready, row.server)).collect();
    assert_eq!(
        rows,
        vec![
            ("ShizoiDa", 2262, 122_800, false, 2315),
            ("MakiAhA", 2319, 108_900, true, 2316),
            ("Twelve", 2198, 108_700, true, 2317),
            ("Astorf", 2130, 104_200, false, 2318),
            ("Opchico", 2219, 88_900, true, 2319),
        ]
    );
    assert_eq!(parsed.members[0].dbid, dbid(2315, 11) as u64);
    // Truncated or oversized frames read nothing rather than something wrong.
    let frame = room(&five(), 13);
    let Some(RoomEvent::Group(cut)) = lobby::decode(&frame[..frame.len() - 3]) else {
        panic!("a cut room still reads its complete members")
    };
    assert_eq!(cut.members.len(), 4);
    assert!(lobby::decode(&[0x02, 0x97, 1, 2, 3]).is_none());
}

#[test]
fn class_ids_come_in_fours_per_class() {
    assert_eq!(lobby::class_name(1), None);
    assert_eq!(lobby::class_name(5), Some("Gladiator"));
    assert_eq!(lobby::class_name(8), Some("Gladiator"));
    assert_eq!(lobby::class_name(14), Some("Ranger"));
    assert_eq!(lobby::class_name(30), Some("Cleric"));
    assert_eq!(lobby::class_name(33), Some("Chanter"));
    assert_eq!(lobby::class_name(45), Some("Brawler"));
    assert_eq!(lobby::class_name(0), None);
    assert_eq!(lobby::class_name(400), None);
}

#[test]
fn a_join_an_update_a_ready_change_and_leaving_are_read() {
    let mut joined = Frame::new([0x0b, 0x97]);
    member(&mut joined, &seat(21, "Newcomer", 14, 2000, 90_000, true), 2315);
    let Some(RoomEvent::Joined(RoomMember { name, gear_score, ready, .. })) = lobby::decode(&joined.out) else {
        panic!("a join")
    };
    assert_eq!((name.as_str(), gear_score, ready), ("Newcomer", 2000, true));
    let mut updated = Frame::new([0x1f, 0x97]);
    member(&mut updated, &seat(21, "Newcomer", 14, 2100, 95_000, false), 2315);
    assert!(matches!(lobby::decode(&updated.out), Some(RoomEvent::Updated(row)) if row.gear_score == 2100 && !row.ready));
    let mut ready = Frame::new([0x16, 0x97]);
    ready.i64(dbid(2315, 21)).bool(true);
    assert_eq!(lobby::decode(&ready.out), Some(RoomEvent::Ready { dbid: Some(dbid(2315, 21) as u64), ready: true }));
    let mut own = Frame::new([0x15, 0x97]);
    own.u16(0).bool(true);
    assert_eq!(lobby::decode(&own.out), Some(RoomEvent::Ready { dbid: None, ready: true }));
    let mut refused = Frame::new([0x15, 0x97]);
    refused.u16(7).bool(true);
    assert_eq!(lobby::decode(&refused.out), None);
    assert_eq!(lobby::decode(&[0x1d, 0x97, 0, 0]), Some(RoomEvent::Left));
    assert_eq!(lobby::decode(&[0x1d, 0x97, 5, 0]), None);
    assert_eq!(lobby::decode(&[0x2a, 0x97, 1]), Some(RoomEvent::Left));
    let _ = Room { id: 0, title: String::new(), kind: 0, dungeon_id: 0, leader: 0, members: vec![] };
}

#[test]
fn the_engine_keeps_the_room_current_and_finds_the_local_character_in_it() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(Event::Identity { id: 11939, name: "MakiAhA".into(), class: Some(14), own: true }, 0);
    engine.observe_game_frame(&room(&five(), 13), 1000);
    let state = engine.live_state(1100);
    let frame = state.room.expect("a room");
    assert_eq!((frame.title.as_str(), frame.members.len()), ("Fire Temple", 5));
    let named = |name: &str| frame.members.iter().find(|row| row.name == name).unwrap().clone();
    assert!(named("MakiAhA").is_self && named("MakiAhA").ready && !named("MakiAhA").leader);
    assert!(named("Twelve").leader && !named("Twelve").is_self);
    assert_eq!(named("Twelve").class.as_deref(), Some("Sorcerer"));
    assert_eq!(named("ShizoiDa").class.as_deref(), Some("Ranger"));
    // Someone joins, the local player un-readies, and another member readies.
    let mut joined = Frame::new([0x0b, 0x97]);
    member(&mut joined, &seat(99, "Late", 22, 1900, 80_000, false), 2315);
    engine.observe_game_frame(&joined.out, 1200);
    let mut own = Frame::new([0x15, 0x97]);
    own.u16(0).bool(false);
    engine.observe_game_frame(&own.out, 1300);
    let mut other = Frame::new([0x16, 0x97]);
    other.i64(dbid(2315, 99)).bool(true);
    engine.observe_game_frame(&other.out, 1400);
    let frame = engine.live_state(1500).room.unwrap();
    assert_eq!(frame.members.len(), 6);
    assert!(!frame.members.iter().find(|row| row.is_self).unwrap().ready);
    assert!(frame.members.iter().find(|row| row.name == "Late").unwrap().ready);
    // Assists come from the battle score once the local character is found in the room.
    let mut score = vec![0x26, 0xe3, 1];
    score.extend(dbid(2316, 12).to_le_bytes());
    score.extend([0, 4, 2, 9, 0]);
    engine.observe_game_frame(&score, 1600);
    assert_eq!(engine.live_state(1700).pvp.assists, Some(9));
    engine.observe_game_frame(&[0x1d, 0x97, 0, 0], 1800);
    assert!(engine.live_state(1900).room.is_none());
    engine.observe_game_frame(&room(&five(), 13), 2000);
    engine.connection_changed();
    assert!(engine.live_state(2100).room.is_none());
}

fn stack(frame: &mut Frame, key: i64, item: i32, count: i64, equipment: bool) {
    frame.u8(u8::from(equipment)).i64(key).i32(item).i64(count).u8(1).i32(3);
    frame.bool(false).text("").i64(0).bool(false);
    if equipment {
        frame.u8(5).i32(0).i32(0).u8(0).i32(0).i32(120).bool(false).u8(3);
        frame.varint(1).i32(700_001).u16(4).u8(2); // a magic stone
        frame.i64(0).u8(0);
        frame.varint(1).i32(900_001); // a godstone
        for rows in [1u32, 2, 0] {
            frame.varint(rows);
            for _ in 0..rows {
                frame.u16(12).i32(34);
            }
        }
        for rows in [1u32, 0] {
            frame.varint(rows);
            for _ in 0..rows {
                frame.i32(5_000_001).u8(2);
            }
        }
        frame.varint(0).varint(0).u8(0);
    }
}
fn inventory(rows: &[(i64, i32, i64, bool)]) -> Vec<u8> {
    let mut frame = Frame::new([0x11, 0x56]);
    frame.u16(0).varint(rows.len() as u32);
    for (key, item, count, equipment) in rows {
        stack(&mut frame, *key, *item, *count, *equipment);
    }
    frame.u8(1).u8(1).u8(1).u8(1).u8(1).u8(1);
    frame.out
}
fn modification(rows: &[(u8, i64, i32, i64, bool, u8)]) -> Vec<u8> {
    let mut frame = Frame::new([0x1b, 0x56]);
    frame.varint(rows.len() as u32);
    for (kind, key, item, count, equipment, reason) in rows {
        frame.u8(*kind);
        stack(&mut frame, *key, *item, *count, *equipment);
        frame.u8(*reason).u8(0).u8(0);
    }
    frame.out
}

#[test]
fn the_item_list_reads_through_equipment_details_and_changes_say_what_grew() {
    let list = inventory(&[(1, 930_100_001, 249_000, false), (2, 500_100_001, 3, true), (3, 930_100_003, 6000, false), (4, 530_000_001, 10, false)]);
    let stacks = items::inventory(&list).expect("an item list");
    assert_eq!(
        stacks,
        vec![
            Stack { key: 1, item: 930_100_001, count: 249_000 },
            Stack { key: 2, item: 500_100_001, count: 3 },
            Stack { key: 3, item: 930_100_003, count: 6000 },
            Stack { key: 4, item: 530_000_001, count: 10 },
        ]
    );
    assert!(items::is_currency(930_100_031) && !items::is_currency(930_099_999) && !items::is_currency(512_000_014));
    // A list that is cut short is not read at all.
    assert!(items::inventory(&list[..list.len() - 20]).is_none());
    let changes = items::changes(&modification(&[(1, 4, 530_000_001, 14, false, 5), (2, 3, 930_100_003, 0, false, 0), (0, 9, 531_900_001, 2, true, 58), (1, 4, 530_000_001, 15, false, 13)]));
    assert_eq!(
        changes,
        vec![
            Change { key: 4, item: 530_000_001, count: 14, loot: true },
            Change { key: 3, item: 930_100_003, count: 0, loot: false },
            Change { key: 9, item: 531_900_001, count: 2, loot: true },
            Change { key: 4, item: 530_000_001, count: 15, loot: false },
        ]
    );
    // What was read before a broken entry is kept.
    let mut broken = modification(&[(1, 4, 530_000_001, 14, false, 5), (1, 4, 530_000_001, 15, false, 5)]);
    broken.truncate(broken.len() - 6);
    assert_eq!(items::changes(&broken).len(), 1);
}

#[test]
fn currencies_and_loot_follow_the_item_list_and_a_move_between_bags_is_not_loot() {
    let mut engine = MeterEngine::default();
    // Changes before the full list cannot be told from the bag's contents: nothing is counted.
    engine.observe_game_frame(&modification(&[(1, 4, 530_000_001, 5, false, 5)]), 500);
    assert!(engine.live_state(600).tracker.looted.is_empty());
    engine.observe_game_frame(&inventory(&[(1, 930_100_001, 249_000, false), (3, 930_100_003, 6000, false), (4, 530_000_001, 10, false)]), 1000);
    let rows = engine.live_state(1100).currencies;
    assert_eq!(rows.iter().map(|row| (row.item, row.count)).collect::<Vec<_>>(), vec![(930_100_001, 249_000), (930_100_003, 6000)]);
    // Ten become fourteen by loot; six hundred Kinah more by a reward; a move changes nothing.
    engine.observe_game_frame(&modification(&[(1, 4, 530_000_001, 14, false, 5), (1, 1, 930_100_001, 249_600, false, 55), (1, 4, 530_000_001, 14, false, 13)]), 1200);
    engine.observe_game_frame(&modification(&[(1, 4, 530_000_001, 20, false, 13)]), 1300);
    let state = engine.live_state(1400);
    assert_eq!(state.currencies[0].count, 249_600);
    let looted: Vec<_> = state.tracker.looted.iter().map(|row| (row.item, row.count)).collect();
    assert_eq!(looted, vec![(930_100_001, 600), (530_000_001, 4)]);
    // Spending the whole stack removes it from the currency list.
    engine.observe_game_frame(&modification(&[(2, 3, 930_100_003, 0, false, 0)]), 1500);
    assert_eq!(engine.live_state(1600).currencies.len(), 1);
    engine.reset();
    assert!(engine.live_state(1700).tracker.looted.is_empty());
    assert_eq!(engine.live_state(1700).currencies.len(), 1, "the reset button does not forget what you carry");
    engine.connection_changed();
    assert!(engine.live_state(1800).currencies.is_empty());
}

#[test]
fn the_hidden_cube_keys_are_counted_from_the_item_list_and_unknown_before_it() {
    let mut engine = MeterEngine::default();
    assert_eq!(engine.live_state(0).cube_keys, None);
    engine.observe_game_frame(&inventory(&[(1, 610_900_001, 2, false), (2, 630_900_003, 3, false), (3, 660_900_003, 1, false), (4, 600_900_001, 9, false), (5, 530_000_001, 40, false)]), 1000);
    // Three kinds of key count; a timed key and other items do not.
    assert_eq!(engine.live_state(1100).cube_keys, Some(6));
    // Using one lowers it, opening the last of a stack removes it.
    engine.observe_game_frame(&modification(&[(1, 2, 630_900_003, 2, false, 0), (2, 3, 660_900_003, 0, false, 0)]), 1200);
    assert_eq!(engine.live_state(1300).cube_keys, Some(4));
    engine.connection_changed();
    assert_eq!(engine.live_state(1400).cube_keys, None);
}
