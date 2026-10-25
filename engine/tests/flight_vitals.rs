//! Flight points (the time one can still fly) come from the same point update as health, and a
//! spawned creature carries its health pool in its state, so a boss has a bar before it is hit.
use luma_engine::{
    assistance::AssistEvent,
    packets::{self, Event},
    MeterEngine,
};

const WATER: &str = "4136A5AE011F1000C18E2C0000020028A04500788245008031440E86B1437AFC01DF28DF2819070000190700000000000000000000000000005892010064000000F04902000100000000000000A08601000000000090D00300010111010F329A09FFFFFFFFFFFFFFFF8075D52ABB0300008E5509022B5A9B45CADA7B4590C525440702068E2A000002CD00C4040000D0003D0100001E000000E31D030000";
const FIRE: &str = "4136B7DD011F1000B28E2C00400200E8E44500F06B4500806C443AAF7D4366B40198639863630B0000630B000000000000000000000000000060B2010064000000F04902000100000000000000A08601000000000000E20400010101110144AA9809FFFFFFFFFFFFFFFF8075D52ABB030000CF190E02FB71E7451296784571BE6044070206CF0C000002CD005A000000D000300100002D000000DD1D030000";

fn raw(hex: &str) -> Vec<u8> {
    hex.as_bytes().chunks_exact(2).map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap()).collect()
}

/// `00 8d`: the actor, then a 32-bit group (type + i32), then a 64-bit group (type + i64).
fn points(actor: u8, narrow: &[(u8, i32)], wide: &[(u8, i64)]) -> Vec<u8> {
    let mut frame = vec![0, 0x8d, actor, u8::from(!narrow.is_empty()) | u8::from(!wide.is_empty()) << 1];
    if !narrow.is_empty() {
        frame.push(narrow.len() as u8);
        for (kind, value) in narrow {
            frame.push(*kind);
            frame.extend(value.to_le_bytes());
        }
    }
    if !wide.is_empty() {
        frame.push(wide.len() as u8);
        for (kind, value) in wide {
            frame.push(*kind);
            frame.extend(value.to_le_bytes());
        }
    }
    frame
}

fn flying() -> MeterEngine {
    let mut engine = MeterEngine::default();
    engine.ingest_event(Event::Identity { id: 7, name: "Pilot".into(), class: Some(18), own: true }, 0);
    engine
}

fn flight(frame: &[u8], engine: &mut MeterEngine, now: u64) {
    match packets::decode(frame).unwrap().expect("a flight update") {
        event @ (Event::Flight { .. } | Event::Updates(_)) => engine.ingest_event(event, now),
        other => panic!("{other:?}"),
    }
}

#[test]
fn flight_points_are_read_from_either_group_of_a_point_update() {
    assert_eq!(
        packets::decode(&points(7, &[], &[(6, 90_000), (13, 120_000)])).unwrap(),
        Some(Event::Flight { id: 7, fp: Some(90_000), fp_max: Some(120_000) })
    );
    assert_eq!(
        packets::decode(&points(7, &[(13, 150_000), (1, 5)], &[])).unwrap(),
        Some(Event::Flight { id: 7, fp: None, fp_max: Some(150_000) })
    );
    // Health in the same frame still arrives, next to the flight points.
    match packets::decode(&points(7, &[], &[(0, 4_000), (7, 5_000), (6, 70_000)])).unwrap() {
        Some(Event::Updates(events)) => {
            assert!(matches!(events[0], Event::Flight { id: 7, fp: Some(70_000), fp_max: None }));
            assert!(matches!(events[1], Event::Assistance(AssistEvent::Health { actor_id: 7, current_hp: Some(4_000), reported_max_hp: Some(5_000) })));
        }
        other => panic!("{other:?}"),
    }
    // Other points and impossible values are not flight.
    assert_eq!(packets::decode(&points(7, &[], &[(2, 300)])).unwrap(), None);
    assert!(!matches!(packets::decode(&points(7, &[], &[(6, -5)])).unwrap(), Some(Event::Flight { .. })));
    assert!(!matches!(packets::decode(&points(7, &[], &[(6, 5_000_000_000)])).unwrap(), Some(Event::Flight { .. })));
}

#[test]
fn the_time_left_follows_how_fast_the_points_run_out() {
    let mut engine = flying();
    assert_eq!(engine.live_state(0).flight, None, "nothing before the game has said anything");
    flight(&points(7, &[], &[(13, 100_000), (6, 100_000)]), &mut engine, 10_000);
    let rested = engine.live_state(10_000).flight.expect("flight");
    assert_eq!((rested.fp, rested.max, rested.drain_per_s), (100_000, Some(100_000), None));
    flight(&points(7, &[], &[(6, 99_000)]), &mut engine, 11_000);
    flight(&points(7, &[], &[(6, 98_000)]), &mut engine, 12_000);
    let live = engine.live_state(12_000).flight.unwrap();
    assert_eq!((live.fp, live.max), (98_000, Some(100_000)));
    assert!((live.drain_per_s.unwrap() - 1_000.0).abs() < 1.0, "{:?}", live.drain_per_s);
    // A drain that stopped coming says nothing about flying any more.
    assert_eq!(engine.live_state(20_000).flight.unwrap().drain_per_s, None);
    // Flying again after a pause starts a fresh drain; points that rise (landed, resting) clear it.
    flight(&points(7, &[], &[(6, 98_000)]), &mut engine, 20_000);
    flight(&points(7, &[], &[(6, 97_000)]), &mut engine, 20_500);
    assert!(engine.live_state(20_600).flight.unwrap().drain_per_s.is_some());
    flight(&points(7, &[], &[(6, 98_500)]), &mut engine, 21_000);
    assert_eq!(engine.live_state(21_100).flight.unwrap().drain_per_s, None);
    // Another creature's points are never the player's.
    flight(&points(9, &[], &[(6, 5)]), &mut engine, 21_200);
    assert_eq!(engine.live_state(21_300).flight.unwrap().fp, 98_500);
}

#[test]
fn a_spawned_creature_brings_its_health_pool() {
    for (hex, id, hp) in [(WATER, 22_309, 5_215), (FIRE, 28_597 + 0, 12_696)] {
        let event = packets::decode(&raw(hex)).unwrap().expect("a spawn");
        let Event::Updates(events) = event else { panic!("a spawn with health is several events") };
        let health = events.iter().find_map(|event| match event {
            Event::Assistance(AssistEvent::Health { actor_id, current_hp, reported_max_hp }) => Some((*actor_id, *current_hp, *reported_max_hp)),
            _ => None,
        });
        let (actor, current, maximum) = health.expect("the health pool");
        assert_eq!((current, maximum), (Some(hp), Some(hp)), "{id}");
        assert!(actor > 0);
    }
}

#[test]
fn a_spawn_whose_state_cannot_be_a_health_pool_brings_none() {
    let mut frame = raw(WATER);
    // The pair of health varints sits after the heading; spoil the maximum so it is below the current.
    let at = frame.windows(2).position(|pair| pair == [0xDF, 0x28]).unwrap();
    frame[at + 2..at + 4].copy_from_slice(&[0x01, 0x00]);
    let events = match packets::decode(&frame).unwrap() {
        Some(Event::Updates(events)) => events,
        Some(event) => vec![event],
        None => vec![],
    };
    assert!(!events.iter().any(|event| matches!(event, Event::Assistance(AssistEvent::Health { .. }))));
}
