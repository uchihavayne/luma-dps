//! The local player's kills and deaths come from the game's death notice (`04 8D`), with the
//! killer's name and home server when it is a player and the monster's model when it is not.
use luma_engine::{
    packets::{self, DeathRecord, Event, Hit},
    MeterEngine,
};

fn varint(mut value: u32) -> Vec<u8> {
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
    let mut out = varint(value.len() as u32);
    out.extend(value.as_bytes());
    out
}
/// A full death notice: victim, skill, killer, then the killer's server, nickname, guild, emblem,
/// monster model, action, reason and kind.
fn death(victim: u32, skill: u32, killer: u32, server: u16, nickname: &str, npc: u32) -> Vec<u8> {
    let mut frame = vec![0x04, 0x8d];
    frame.extend(varint(victim));
    frame.extend(skill.to_le_bytes());
    frame.extend(varint(killer));
    frame.extend(server.to_le_bytes());
    frame.extend(text(nickname));
    frame.extend(text(""));
    frame.extend([0, 0]);
    frame.extend(varint(npc));
    frame.extend(0i32.to_le_bytes());
    frame.extend([0, 1]);
    frame
}
fn record(frame: &[u8]) -> DeathRecord {
    packets::death_record(frame).expect("a death record")
}
fn identity(engine: &mut MeterEngine, id: u64, own: bool) {
    engine.ingest_event(
        Event::Identity { id, name: format!("Player{id}"), class: Some(14), own },
        0,
    )
}
fn npc(engine: &mut MeterEngine, id: u64) {
    engine.ingest_event(
        Event::Npc { id, name: None, model: 2_100_075, kind: 0x0c },
        0,
    )
}
fn hit(engine: &mut MeterEngine, source: u64, target: u64, skill: u32, amount: u64, now: u64) {
    engine.ingest_event(
        Event::Damage(Hit { source, target, skill, amount, critical: false, tick: false, flags: 0, angle: 0 }),
        now,
    )
}

#[test]
fn a_player_killers_name_and_a_monsters_model_are_read_from_the_tail() {
    let by_player = record(&death(7, 15_050_340, 40, 2315, "Slayer", 0));
    assert_eq!(by_player, DeathRecord { victim: 7, skill: 15_050_340, killer: Some(40), killer_name: Some("Slayer".into()), npc: None });
    let by_monster = record(&death(7, 1_230_560, 41, 0, "", 2_100_075));
    assert_eq!(by_monster, DeathRecord { victim: 7, skill: 1_230_560, killer: Some(41), killer_name: None, npc: Some(2_100_075) });
    // A tail cut short still says who died to what; the bare victim form says nothing.
    let mut cut = death(7, 99, 41, 0, "", 0);
    cut.truncate(2 + 1 + 4 + 1);
    assert_eq!(record(&cut), DeathRecord { victim: 7, skill: 99, killer: Some(41), killer_name: None, npc: None });
    assert!(packets::death_record(&[0x04, 0x8d, 7]).is_none());
    assert!(packets::death_record(&[0x04, 0x8d, 0, 1, 2, 3, 4, 5]).is_none());
    assert!(packets::death_record(&[0x05, 0x8d, 7, 1, 2, 3, 4, 5]).is_none());
    // The server must be a real one for a name to count as a player's.
    let odd = record(&death(7, 1, 40, 5, "Nobody", 0));
    assert_eq!(odd.killer_name, None);
}

#[test]
fn dying_counts_a_death_and_keeps_what_killed_you_and_the_last_ten_seconds_of_damage() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, true);
    npc(&mut engine, 9);
    hit(&mut engine, 9, 1, 1_230_560, 400, 1_000); // too old by the time of the death
    hit(&mut engine, 9, 1, 1_230_560, 900, 20_000);
    hit(&mut engine, 9, 1, 1_230_570, 1_500, 21_000);
    hit(&mut engine, 9, 1, 1_230_560, 600, 22_000);
    engine.observe_death(&record(&death(1, 1_230_560, 9, 0, "", 2_100_075)), 23_000);
    let state = engine.live_state(23_500);
    assert_eq!((state.pvp.kills, state.pvp.deaths), (0, 1));
    let recap = state.pvp.last_death.unwrap();
    assert_eq!(recap.at_ms, 23_000);
    // The monster that struck the blow is named from what was received about it.
    assert_eq!((recap.killer_player, recap.killer_name.as_deref()), (false, Some("Krall Armed Soldier")));
    assert_eq!((recap.skill_id, recap.npc_id), (Some(1_230_560), Some(2_100_075)));
    assert_eq!(recap.npc_name.as_deref(), Some("Krall Armed Soldier"));
    assert_eq!(recap.damage_taken, 3_000);
    let skills: Vec<_> = recap.top_skills.iter().map(|row| (row.skill_id, row.damage, row.hits)).collect();
    assert_eq!(skills, vec![(1_230_560, 1_500, 2), (1_230_570, 1_500, 1)]);
}

#[test]
fn a_player_killer_is_named_and_flagged() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, true);
    engine.observe_death(&record(&death(1, 15_050_340, 40, 2315, "Slayer", 0)), 5_000);
    let recap = engine.live_state(5_100).pvp.last_death.unwrap();
    assert_eq!((recap.killer_player, recap.killer_name.as_deref()), (true, Some("Slayer")));
    assert_eq!(recap.damage_taken, 0);
}

#[test]
fn killing_another_player_counts_whoever_struck_the_blow_for_you() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, true);
    identity(&mut engine, 2, false);
    npc(&mut engine, 9);
    engine.ingest_event(Event::Npc { id: 8, name: None, model: 2_920_620, kind: 0x5f }, 0);
    engine.ingest_event(Event::Owner { id: 8, owner: 1 }, 0);
    engine.observe_death(&record(&death(2, 1, 1, 0, "", 0)), 1_000); // you killed a player
    engine.observe_death(&record(&death(2, 1, 8, 0, "", 0)), 2_000); // your summon did
    engine.observe_death(&record(&death(9, 1, 1, 0, "", 0)), 3_000); // a monster: not PvP
    engine.observe_death(&record(&death(2, 1, 9, 0, "", 0)), 4_000); // a monster killed them
    engine.observe_death(&record(&death(2, 1, 2, 0, "", 0)), 5_000); // someone else's kill
    let state = engine.live_state(5_100);
    assert_eq!((state.pvp.kills, state.pvp.deaths), (2, 0));
    assert!(state.pvp.last_death.is_none());
}

#[test]
fn nothing_is_counted_without_a_known_self_and_a_reset_starts_over() {
    let mut engine = MeterEngine::default();
    engine.observe_death(&record(&death(1, 1, 2, 0, "", 0)), 1_000);
    assert_eq!(engine.live_state(1_100).pvp.deaths, 0);
    identity(&mut engine, 1, true);
    engine.observe_death(&record(&death(1, 1, 2, 0, "", 0)), 2_000);
    assert_eq!(engine.live_state(2_100).pvp.deaths, 1);
    engine.reset();
    let state = engine.live_state(3_000);
    assert_eq!((state.pvp.kills, state.pvp.deaths), (0, 0));
    assert!(state.pvp.last_death.is_none());
}
