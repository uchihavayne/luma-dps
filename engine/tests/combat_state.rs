//! The game's own combat state (`21 8D`) can end an encounter instead of a quiet spell after the
//! last hit, a boss's frenzy time on the server clock becomes a countdown, and a monster cast is
//! marked lethal only when that skill has already hit the player for the HP they have left.
use luma_engine::{
    assistance::{AssistEvent, CastObservation},
    cube,
    packets::{self, Event, Hit},
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
fn state_frame(key: u32, flags: u8, state: u8, berserk: Option<u64>) -> Vec<u8> {
    let mut frame = vec![0x21, 0x8d];
    frame.extend(varint(key));
    frame.push(flags);
    frame.push(state);
    if let Some(ms) = berserk {
        frame.extend(ms.to_le_bytes());
    }
    frame
}
fn combat(engine: &mut MeterEngine, key: u64, in_combat: bool, berserk_ms: Option<u64>, now: u64) {
    engine.ingest_event(Event::CombatState { key, in_combat, berserk_ms }, now)
}
fn hit(source: u64, target: u64, skill: u32, amount: u64) -> Event {
    Event::Damage(Hit { source, target, skill, amount, critical: false, tick: false, flags: 0, angle: 0 })
}
fn local_engine() -> MeterEngine {
    let mut engine = MeterEngine::default();
    engine.ingest_event(
        Event::Identity { id: 1, name: "Local".into(), class: Some(18), own: true },
        0,
    );
    engine.ingest_event(
        Event::Npc { id: 9, name: Some("Boss".into()), model: 2_900_000, kind: 0x0c },
        0,
    );
    engine
}
fn windup(actor: u64, target: u64, skill: u32) -> Event {
    Event::Assistance(AssistEvent::Windup(CastObservation {
        actor_id: actor,
        skill_id: skill,
        target_id: target,
        duration_ms: Some(3000),
        facing: 0.0,
        position: None,
        cooldown: None,
    }))
}

#[test]
fn the_combat_state_frame_is_read_with_and_without_a_berserk_time() {
    let plain = packets::decode(&state_frame(1, 0, 1, None)).unwrap();
    assert_eq!(plain, Some(Event::CombatState { key: 1, in_combat: true, berserk_ms: None }));
    let out = packets::decode(&state_frame(300, 0, 0, None)).unwrap();
    assert_eq!(out, Some(Event::CombatState { key: 300, in_combat: false, berserk_ms: None }));
    let boss = packets::decode(&state_frame(9, 1, 1, Some(1_760_000_000_000))).unwrap();
    assert_eq!(boss, Some(Event::CombatState { key: 9, in_combat: true, berserk_ms: Some(1_760_000_000_000) }));
    // A time that cannot be a real clock is dropped, and a short frame is an error, not a guess.
    let odd = packets::decode(&state_frame(9, 1, 1, Some(5))).unwrap();
    assert_eq!(odd, Some(Event::CombatState { key: 9, in_combat: true, berserk_ms: None }));
    assert!(packets::decode(&state_frame(9, 1, 1, Some(5))[..8]).is_err());
}

#[test]
fn by_default_a_quiet_spell_after_the_last_hit_ends_the_encounter() {
    let mut engine = local_engine();
    engine.ingest_event(hit(1, 9, 18_000_001, 1000), 1000);
    combat(&mut engine, 1, true, None, 1000);
    engine.tick(5_000);
    assert!(engine.history_snapshot().1.is_empty());
    engine.tick(12_000);
    assert_eq!(engine.history_snapshot().1.len(), 1, "ten quiet seconds close it");
}

#[test]
fn with_the_game_state_the_encounter_lasts_as_long_as_the_game_says_you_are_in_combat() {
    let mut engine = local_engine();
    engine.set_combat_detection("game", 10).unwrap();
    combat(&mut engine, 1, true, None, 500);
    engine.ingest_event(hit(1, 9, 18_000_001, 1000), 1000);
    // A phase with no damage for a minute: the game still says you are in combat.
    engine.tick(61_000);
    assert!(engine.history_snapshot().1.is_empty());
    engine.ingest_event(hit(1, 9, 18_000_001, 1000), 62_000);
    assert!(engine.history_snapshot().1.is_empty());
    // The game says you left combat; the tail counts from that moment.
    combat(&mut engine, 1, false, None, 70_000);
    engine.tick(75_000);
    assert!(engine.history_snapshot().1.is_empty());
    engine.tick(80_500);
    let record = engine.history_snapshot().1.remove(0);
    assert_eq!(record.total_damage, 2000);
    // The clock still stops at the last hit, never at the end of the tail.
    assert_eq!(record.elapsed_ms, 61_000);
}

#[test]
fn until_the_game_has_said_anything_the_game_source_falls_back_to_hits() {
    let mut engine = local_engine();
    engine.set_combat_detection("game", 10).unwrap();
    engine.ingest_event(hit(1, 9, 18_000_001, 1000), 1000);
    engine.tick(12_000);
    assert_eq!(engine.history_snapshot().1.len(), 1);
    // Someone else's state never decides the local fight.
    let mut other = local_engine();
    other.set_combat_detection("game", 10).unwrap();
    other.ingest_event(hit(1, 9, 18_000_001, 1000), 1000);
    combat(&mut other, 77, true, None, 1500);
    other.tick(12_000);
    assert_eq!(other.history_snapshot().1.len(), 1);
}

#[test]
fn the_combat_setting_is_validated_and_reported() {
    let mut engine = local_engine();
    assert!(engine.set_combat_detection("game", 4).is_err());
    assert!(engine.set_combat_detection("game", 301).is_err());
    assert!(engine.set_combat_detection("party", 10).is_err());
    assert!(engine.set_combat_detection("hits", 5).is_ok());
    let info = engine.live_state(0).combat;
    assert_eq!((info.source.as_str(), info.tail_ms, info.game_in_combat), ("hits", 5000, None));
    engine.set_combat_detection("game", 45).unwrap();
    combat(&mut engine, 1, true, None, 10);
    let info = engine.live_state(20).combat;
    assert_eq!((info.source.as_str(), info.tail_ms, info.game_in_combat), ("game", 45_000, Some(true)));
    // A reconnect forgets what the old session said.
    engine.connection_changed();
    assert_eq!(engine.live_state(30).combat.game_in_combat, None);
}

#[test]
fn a_frenzy_time_is_turned_into_a_countdown_on_the_local_clock() {
    let mut engine = local_engine();
    let server = 1_760_000_000_000u64;
    combat(&mut engine, 9, true, Some(server + 90_000), 1000);
    // Without the server clock the time cannot be placed, so nothing is claimed.
    assert!(engine.live_state(1000).frenzy.is_none());
    // The server clock reads `server` when the local clock reads 10 000.
    engine.ingest_event(Event::Cube(cube::Event::Clock { server_ms: server }), 10_000);
    let frenzy = engine.live_state(10_000).frenzy.expect("a frenzy");
    assert_eq!((frenzy.target_id, frenzy.at_ms), (9, 100_000));
    assert_eq!(frenzy.target_name.as_deref(), Some("Boss"));
    // The soonest of several wins; a boss that left combat has no frenzy.
    combat(&mut engine, 10, true, Some(server + 30_000), 10_000);
    assert_eq!(engine.live_state(10_000).frenzy.unwrap().at_ms, 40_000);
    combat(&mut engine, 10, false, None, 11_000);
    assert_eq!(engine.live_state(11_000).frenzy.unwrap().target_id, 9);
    // A time hours away is not a countdown worth showing.
    combat(&mut engine, 9, true, Some(server + 8 * 3_600_000), 12_000);
    assert!(engine.live_state(12_000).frenzy.is_none());
    engine.connection_changed();
    assert!(engine.live_state(13_000).frenzy.is_none());
}

#[test]
fn a_cast_is_lethal_only_when_that_skill_already_hit_you_for_your_remaining_health() {
    let mut engine = local_engine();
    engine.ingest_event(Event::Health { id: 1, current: 5000 }, 1000);
    engine.ingest_event(hit(9, 1, 2_000_123, 6000), 1500);
    engine.ingest_event(hit(9, 1, 2_000_456, 800), 1600);
    // One cast per monster: a monster has one wind-up at a time.
    for (offset, (skill, target)) in [(2_000_123, 1), (2_000_456, 1), (2_000_999, 1), (2_000_123, 2)].into_iter().enumerate() {
        let actor = 20 + offset as u64;
        engine.ingest_event(Event::Npc { id: actor, name: None, model: 2_900_000, kind: 0x0c }, 0);
        engine.ingest_event(windup(actor, target, skill), 2000);
    }
    let state = engine.live_state(2200);
    let lethal = |skill: u32, target: u64| {
        state
            .assist
            .casts
            .iter()
            .find(|cast| cast.skill_id == skill && cast.target_id == target)
            .map(|cast| cast.lethal)
    };
    assert_eq!(lethal(2_000_123, 1), Some(true), "it hit for 6000 and you have 5000");
    assert_eq!(lethal(2_000_456, 1), Some(false), "it only ever hit for 800");
    assert_eq!(lethal(2_000_999, 1), Some(false), "never seen: no claim");
    assert_eq!(lethal(2_000_123, 2), Some(false), "aimed at someone else");
    // Healed above what it hit for, the same cast is no longer lethal.
    engine.ingest_event(Event::Health { id: 1, current: 9000 }, 2300);
    let state = engine.live_state(2400);
    assert!(state.assist.casts.iter().all(|cast| !cast.lethal));
}

#[test]
fn your_own_health_needs_a_reported_maximum_before_it_is_a_percentage() {
    let mut engine = local_engine();
    assert!(engine.live_state(0).own_health.is_none());
    engine.ingest_event(Event::Health { id: 1, current: 4200 }, 1000);
    let health = engine.live_state(1000).own_health.expect("health");
    assert_eq!((health.hp, health.max_hp), (4200, None));
    engine.ingest_event(
        Event::Assistance(AssistEvent::Health { actor_id: 1, current_hp: Some(4000), reported_max_hp: Some(10_000) }),
        2000,
    );
    let health = engine.live_state(2000).own_health.unwrap();
    assert_eq!((health.hp, health.max_hp), (4000, Some(10_000)));
}
