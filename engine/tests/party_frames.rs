//! The party's health, the game's battle score (assists), what gathering gave and the monsters you
//! killed. The frames are built from the layouts the game's party, score and gathering messages are
//! documented with; none of them could be captured here, so the checks are of the decoders'
//! structure and of how the engine uses what they read.
use luma_engine::{
    packets::{self, BattleScore, Event, Hit, PartyHealth, PartyVital},
    MeterEngine,
};

fn varint(mut value: u64) -> Vec<u8> {
    let mut out = Vec::new();
    loop {
        let mut byte = (value & 127) as u8;
        value >>= 7;
        if value != 0 {
            byte |= 128;
        }
        out.push(byte);
        if value == 0 {
            return out;
        }
    }
}
fn text(value: &str) -> Vec<u8> {
    let mut out = varint(value.len() as u64);
    out.extend(value.as_bytes());
    out
}
const GUID: &str = "0123abcd-4567-89ab-cdef-0123456789ab";
fn dbid(server: u16, number: u64) -> u64 {
    u64::from(server) << 48 | number
}
/// One party member record: flags, slot, entity key, home and current server, account id, character
/// id, nickname, class, health, mana and some of what follows.
fn member(key: u32, server: u16, name: &str, hp: u64, hp_max: u64) -> Vec<u8> {
    let mut out = vec![0, 1];
    out.extend(key.to_le_bytes());
    out.extend(server.to_le_bytes());
    out.extend(server.to_le_bytes());
    out.extend(text(GUID));
    out.extend(dbid(server, u64::from(key)).to_le_bytes());
    out.extend(text(name));
    out.extend(7i32.to_le_bytes());
    out.extend(varint(hp));
    out.extend(varint(hp_max));
    out.extend(500i32.to_le_bytes());
    out.extend(800i32.to_le_bytes());
    out.extend([0; 70]);
    out
}
fn party_info(members: &[Vec<u8>]) -> Vec<u8> {
    let mut frame = vec![0x00, 0x92, 0];
    frame.extend([9; 20]);
    frame.push(members.len() as u8);
    for row in members {
        frame.extend(row);
    }
    frame
}
fn health(key: u64, hp: u64, hp_max: u64) -> Vec<u8> {
    let mut frame = vec![0x1b, 0x92];
    frame.extend(varint(key));
    frame.extend(varint(hp));
    frame.extend(varint(hp_max));
    frame.extend([0; 30]);
    frame
}
fn scores(rows: &[(u64, u8, u8, u8)]) -> Vec<u8> {
    let mut frame = vec![0x26, 0xe3];
    frame.extend(varint(rows.len() as u64));
    for (id, kills, deaths, assists) in rows {
        frame.extend(id.to_le_bytes());
        frame.extend([0, *kills, *deaths, *assists, 0]);
    }
    frame
}
fn death(victim: u32, killer: u32) -> Vec<u8> {
    let mut frame = vec![0x04, 0x8d];
    frame.extend(varint(u64::from(victim)));
    frame.extend(0u32.to_le_bytes());
    frame.extend(varint(u64::from(killer)));
    frame.extend(0u16.to_le_bytes());
    frame.extend(text(""));
    frame.extend(text(""));
    frame.extend([0, 0]);
    frame.extend(varint(0));
    frame.extend(0i32.to_le_bytes());
    frame.extend([0, 1]);
    frame
}
fn hit(source: u64, target: u64) -> Event {
    Event::Damage(Hit { source, target, skill: 14_090_000, amount: 100, critical: false, tick: false, flags: 0, angle: 0 })
}

#[test]
fn a_party_list_gives_every_member_with_character_id_and_health() {
    let frame = party_info(&[member(11939, 2315, "Mira", 6200, 10_000), member(30011, 2315, "Aster", 9000, 9000)]);
    let rows = packets::party_vitals(&frame);
    assert_eq!(
        rows,
        vec![
            PartyVital { key: 11939, dbid: dbid(2315, 11939), server: 2315, name: "Mira".into(), hp: 6200, hp_max: 10_000 },
            PartyVital { key: 30011, dbid: dbid(2315, 30011), server: 2315, name: "Aster".into(), hp: 9000, hp_max: 9000 },
        ]
    );
    // One member added later arrives in the same record shape.
    let mut added = vec![0x0d, 0x92];
    added.extend(member(40001, 2316, "Nox", 50, 100));
    assert_eq!(packets::party_vitals(&added)[0].name, "Nox");
    // Not the party opcodes, no record, a wrong server in the id, or health above maximum: nothing.
    let mut wrong = frame.clone();
    wrong[0] = 0x01;
    assert!(packets::party_vitals(&wrong).is_empty());
    assert!(packets::party_vitals(&[0x00, 0x92, 1, 2, 3]).is_empty());
    let mut forged = party_info(&[member(11939, 2315, "Mira", 6200, 10_000)]);
    let at = forged.windows(4).position(|window| window == 11939u32.to_le_bytes()).unwrap();
    forged[at + 51] ^= 0xff;
    assert!(packets::party_vitals(&forged).is_empty());
    assert!(packets::party_vitals(&party_info(&[member(5, 2315, "Over", 200, 100)])).is_empty());
}

#[test]
fn a_member_health_push_and_the_battle_score_are_read_strictly() {
    assert_eq!(packets::party_health(&health(11939, 4000, 10_000)), Some(PartyHealth { key: 11939, hp: 4000, hp_max: 10_000 }));
    assert_eq!(packets::party_health(&health(11939, 20_000, 10_000)), None);
    assert_eq!(packets::party_health(&health(0, 1, 2)), None);
    let list = scores(&[(dbid(2315, 11939), 3, 1, 5), (dbid(2315, 30011), 0, 2, 7)]);
    assert_eq!(
        packets::battle_scores(&list),
        vec![
            BattleScore { dbid: dbid(2315, 11939), kills: 3, deaths: 1, assists: 5 },
            BattleScore { dbid: dbid(2315, 30011), kills: 0, deaths: 2, assists: 7 },
        ]
    );
    // A list that does not fit its frame is not read.
    let mut long = list.clone();
    long.push(0);
    assert!(packets::battle_scores(&long).is_empty());
    assert!(packets::battle_scores(&list[..list.len() - 1]).is_empty());
    assert!(packets::battle_scores(&[0x26, 0xe3, 0]).is_empty());
    assert!(packets::party_ended(&[0x1f, 0x92, 0]) && packets::party_ended(&[0x19, 0x92, 1]));
    assert!(!packets::party_ended(&[0x1f, 0x92]) && !packets::party_ended(&[0x1f, 0x97, 0]));
}

#[test]
fn gathering_gives_its_item_and_an_extra_one() {
    let mut frame = vec![0x33, 0x8d, 0, 0];
    frame.extend(varint(500));
    for value in [531_900_003u32, 2, 1, 210_460_018, 4] {
        frame.extend(value.to_le_bytes());
    }
    let rows = packets::gathered(&frame);
    assert_eq!(rows.iter().map(|row| (row.item, row.count)).collect::<Vec<_>>(), vec![(531_900_003, 3), (210_460_018, 4)]);
    let mut nothing = vec![0x33, 0x8d, 0, 0];
    nothing.extend(varint(500));
    for value in [531_900_003u32, 0, 0, 0, 0] {
        nothing.extend(value.to_le_bytes());
    }
    assert!(packets::gathered(&nothing).is_empty());
    assert!(packets::gathered(&frame[..10]).is_empty());
}

#[test]
fn party_frames_follow_the_game_and_assists_need_the_local_character_in_the_list() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(Event::Identity { id: 11939, name: "Mira".into(), class: Some(18), own: true }, 0);
    engine.observe_game_frame(&party_info(&[member(30011, 2315, "Aster", 9000, 9000), member(11939, 2315, "Mira", 6200, 10_000)]), 1000);
    let state = engine.live_state(1500);
    assert_eq!(state.party.iter().map(|row| (row.name.as_str(), row.is_self, row.hp, row.hp_max)).collect::<Vec<_>>(), vec![("Mira", true, 6200, 10_000), ("Aster", false, 9000, 9000)]);
    // A health push changes the member and stamps it.
    engine.observe_game_frame(&health(30011, 3000, 9000), 2000);
    let aster = engine.live_state(2100).party.into_iter().find(|row| row.name == "Aster").unwrap();
    assert_eq!((aster.hp, aster.observed_at_ms), (3000, 2000));
    // A push for someone who is not in the list invents nobody.
    engine.observe_game_frame(&health(77, 1, 2), 2100);
    assert_eq!(engine.live_state(2200).party.len(), 2);
    // Assists: unknown until the score comes, and then the local character's own.
    assert_eq!(engine.live_state(2200).pvp.assists, None);
    engine.observe_game_frame(&scores(&[(dbid(2315, 30011), 9, 9, 9), (dbid(2315, 11939), 3, 1, 5)]), 2300);
    assert_eq!(engine.live_state(2400).pvp.assists, Some(5));
    // A member who left, then the party ending.
    engine.ingest_event(Event::PartyMemberRemoved { key: 30011, server: 2315 }, 2500);
    assert_eq!(engine.live_state(2600).party.len(), 1);
    engine.observe_game_frame(&[0x1f, 0x92, 0], 2700);
    let state = engine.live_state(2800);
    assert!(state.party.is_empty());
    assert_eq!(state.pvp.assists, None, "without the party list the local character id is unknown again");

    // Someone else's score is never taken for the local player's.
    let mut stranger = MeterEngine::default();
    stranger.ingest_event(Event::Identity { id: 11939, name: "Mira".into(), class: Some(18), own: true }, 0);
    stranger.observe_game_frame(&party_info(&[member(30011, 2315, "Aster", 9000, 9000)]), 1000);
    stranger.observe_game_frame(&scores(&[(dbid(2315, 30011), 1, 1, 9)]), 1100);
    assert_eq!(stranger.live_state(1200).pvp.assists, None);
    // Reconnecting forgets the party.
    engine.observe_game_frame(&party_info(&[member(11939, 2315, "Mira", 1, 2)]), 3000);
    engine.connection_changed();
    assert!(engine.live_state(3100).party.is_empty());
}

#[test]
fn the_tracker_counts_monsters_you_hit_that_died_and_what_you_gathered() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(Event::Identity { id: 1, name: "Local".into(), class: Some(14), own: true }, 0);
    for (id, model) in [(9u64, 2_100_075u32), (10, 2_100_075), (11, 2_100_093)] {
        engine.ingest_event(Event::Npc { id, name: None, model, kind: 0x0c }, 0);
    }
    engine.ingest_event(hit(1, 9), 1000);
    engine.ingest_event(hit(1, 11), 1000);
    // Monster 10 was never hit by you, and the player 2 who killed it is not you.
    engine.observe_game_frame(&death(9, 2), 2000);
    engine.observe_game_frame(&death(10, 2), 2000);
    engine.observe_game_frame(&death(11, 1), 2000);
    // The same monster dying again is not counted twice.
    engine.observe_game_frame(&death(9, 2), 2100);
    let tracker = engine.live_state(2500).tracker;
    assert_eq!(tracker.kills_total, 2);
    assert_eq!(tracker.kills.iter().map(|row| (row.model, row.count)).collect::<Vec<_>>(), vec![(2_100_075, 1), (2_100_093, 1)]);
    let mut gathered = vec![0x33, 0x8d, 0, 0];
    gathered.extend(varint(500));
    for value in [531_900_003u32, 2, 0, 0, 0] {
        gathered.extend(value.to_le_bytes());
    }
    engine.observe_game_frame(&gathered, 3000);
    engine.observe_game_frame(&gathered, 3100);
    assert_eq!(engine.live_state(3200).tracker.gathered.iter().map(|row| (row.item, row.count)).collect::<Vec<_>>(), vec![(531_900_003, 4)]);
    engine.reset();
    let tracker = engine.live_state(3300).tracker;
    assert!(tracker.kills.is_empty() && tracker.gathered.is_empty() && tracker.kills_total == 0);
}
