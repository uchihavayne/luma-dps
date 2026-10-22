use luma_engine::{packets::Event, spatial::Observation, MeterEngine};

fn spawn_frame(id: u8, kind: u8, model: u32, x: f32, y: f32) -> Vec<u8> {
    let mut frame = vec![0x41, 0x36, id, kind, 0, 0];
    frame.extend(model.to_le_bytes());
    frame.extend([0, 0]);
    frame.extend(x.to_le_bytes());
    frame.extend(y.to_le_bytes());
    frame
}

fn engine_at(x: f32, y: f32) -> MeterEngine {
    let mut engine = MeterEngine::default();
    engine.ingest_event(
        Event::Identity {
            id: 1,
            name: "Local".into(),
            class: None,
            own: true,
        },
        100,
    );
    engine.ingest_event(
        Event::Position(Observation {
            actor_id: 1,
            x,
            y,
            z: None,
            source: "server-position".into(),
            local_only: false,
        }),
        200,
    );
    engine
}

fn near(engine: &MeterEngine, now: u64, radius_m: f32) -> Vec<luma_engine::spatial::Nearby> {
    engine.nearby_objects(now, radius_m, 8).unwrap_or_default()
}

fn ingest(engine: &mut MeterEngine, frame: &[u8], now: u64) {
    if let Some(event) = luma_engine::packets::decode(frame).unwrap() {
        engine.ingest_event(event, now);
    }
}

#[test]
fn an_unlisted_spawn_kind_is_offered_to_the_probe_without_becoming_a_combat_entity() {
    let mut engine = engine_at(1_000.0, 2_000.0);
    ingest(&mut engine, &spawn_frame(9, 0x21, 2_000_123, 1_300.0, 2_400.0), 300);
    let near = near(&engine, 400, 80.0);
    assert_eq!(near.len(), 1);
    assert_eq!((near[0].id, near[0].kind, near[0].model), (9, 0x21, 2_000_123));
    assert!((near[0].distance_cm - 500.0).abs() < 0.01);
    // It was never registered as an NPC, so it cannot appear in the meter or in saved tracks.
    let state = engine.live_state(400);
    assert!(state.spatial.actors.iter().all(|actor| actor.actor_id != 9));
    assert!(state.spatial.positions.iter().all(|point| point.actor_id != 9));
}

#[test]
fn listed_kinds_are_probed_too_but_pets_and_the_local_player_are_not() {
    let mut engine = engine_at(0.5e3, 0.5e3);
    ingest(&mut engine, &spawn_frame(7, 0x0c, 2_100_075, 600.0, 500.0), 300);
    ingest(&mut engine, &spawn_frame(8, 0x5f, 2_920_600, 520.0, 500.0), 300);
    let near = near(&engine, 400, 80.0);
    assert_eq!(near.iter().map(|row| row.id).collect::<Vec<_>>(), vec![7]);
}

#[test]
fn distance_follows_the_player_and_the_object_and_ends_at_removal_zone_change_or_a_gap() {
    let mut engine = engine_at(1_000.0, 1_000.0);
    ingest(&mut engine, &spawn_frame(9, 0x21, 2_000_123, 1_000.0, 2_000.0), 300);
    assert!((near(&engine, 400, 80.0)[0].distance_cm - 1_000.0).abs() < 0.01);
    engine.ingest_event(
        Event::Position(Observation {
            actor_id: 1,
            x: 1_000.0,
            y: 1_600.0,
            z: None,
            source: "server-position".into(),
            local_only: false,
        }),
        500,
    );
    assert!((near(&engine, 600, 80.0)[0].distance_cm - 400.0).abs() < 0.01);
    // Beyond the radius is not reported, and a stale own position reports nothing at all.
    assert!(near(&engine, 600, 3.0).is_empty());
    assert!(engine.nearby_objects(500 + 6_000, 80.0, 8).is_none());
    assert!(MeterEngine::default().nearby_objects(0, 80.0, 8).is_none());
    engine.ingest_event(Event::Removed { id: 9, death: false }, 700);
    assert!(near(&engine, 800, 80.0).is_empty());
    ingest(&mut engine, &spawn_frame(10, 0x21, 2_000_123, 1_000.0, 1_700.0), 900);
    assert_eq!(near(&engine, 1_000, 80.0).len(), 1);
    engine.ingest_event(Event::ZoneChange { zone_id: 42 }, 1_100);
    assert!(near(&engine, 1_200, 80.0).is_empty());
}

#[test]
fn a_malformed_unlisted_spawn_is_dropped_quietly() {
    assert!(luma_engine::packets::decode(&[0x41, 0x36, 9, 0x21, 0, 0, 1, 2])
        .map(|event| event.is_none())
        .unwrap_or(true));
    // No coordinates after the model: nothing to probe.
    let mut frame = vec![0x41, 0x36, 9, 0x21, 0, 0];
    frame.extend(2_000_123u32.to_le_bytes());
    assert!(luma_engine::packets::decode(&frame).unwrap().is_none());
}
