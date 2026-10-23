use luma_engine::{packets, packets::Event, spatial::Observation, MeterEngine};

fn hex(text: &str) -> Vec<u8> {
    text.split_whitespace()
        .map(|byte| u8::from_str_radix(byte, 16).unwrap())
        .collect()
}
fn frame(opcode: [u8; 2], body: &[u8]) -> Vec<u8> {
    let mut frame = opcode.to_vec();
    frame.extend(body);
    frame
}
fn floats(x: f32, y: f32, z: f32) -> Vec<u8> {
    [x, y, z].iter().flat_map(|v| v.to_le_bytes()).collect()
}
// Verteron Hidden Cube from a live capture (aion2-cube-radar FINDINGS B5): id 65509, template
// 1200039, at (-50205, 126283, 15449) centimetres.
const SPAWN: &str = "e5 ff 03 04 00 a7 4f 12 00 00 1d 44 c7 80 a5 f6 47 00 64 71 46 00 00 00 00 00 00 00 00 01 01 01 aa e4 a5 34 a1 01 00 00";
const KEY_DONE: &str = "e5 ff 03 dc 47 01 00 00 00 23 c5 9a 25";

fn feed(engine: &mut MeterEngine, frame: &[u8], now: u64) {
    if let Some(event) = packets::decode(frame).unwrap() {
        engine.ingest_event(event, now);
    }
}
fn engine() -> MeterEngine {
    let mut engine = MeterEngine::default();
    engine.ingest_event(
        Event::Identity { id: 9180, name: "Local".into(), class: None, own: true },
        100,
    );
    engine
}
fn me(engine: &mut MeterEngine, x: f32, y: f32, z: f32, now: u64) {
    engine.ingest_event(
        Event::Position(Observation {
            actor_id: 9180,
            x,
            y,
            z: Some(z),
            source: "server-effect".into(),
            local_only: true,
        }),
        now,
    );
}

#[test]
fn a_cube_in_range_has_a_distance_a_height_and_no_direction_until_the_player_walks() {
    let mut engine = engine();
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 1_000);
    let radar = engine.cube_radar(1_100);
    assert_eq!(radar.cubes.len(), 1);
    assert_eq!((radar.cubes[0].id, radar.cubes[0].template), (65509, 1_200_039));
    // The server announced it but no position of ours has arrived yet.
    assert_eq!((radar.cubes[0].distance_m, radar.fix_age_ms), (None, None));
    me(&mut engine, -50_205.0, 126_283.0 + 6_000.0, 15_000.0, 2_000);
    let radar = engine.cube_radar(4_000);
    assert_eq!(radar.fix_age_ms, Some(2_000));
    let cube = &radar.cubes[0];
    assert_eq!((cube.distance_m, cube.vertical_m, cube.direction_deg), (Some(60), Some(4), None));
}

#[test]
fn the_direction_follows_the_last_walk_and_fades_when_it_is_old() {
    let mut engine = engine();
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 0);
    // Walking towards -y with the Cube straight ahead.
    me(&mut engine, -50_205.0, 126_283.0 + 6_000.0, 15_449.0, 1_000);
    me(&mut engine, -50_205.0, 126_283.0 + 4_000.0, 15_449.0, 3_000);
    assert_eq!(engine.cube_radar(3_100).cubes[0].direction_deg, Some(0));
    // Walking towards +x with the Cube 40 m to the player's right (+y is right of +x).
    let mut engine = self::engine();
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 0);
    me(&mut engine, -50_205.0 - 6_000.0, 126_283.0 - 4_000.0, 15_449.0, 1_000);
    me(&mut engine, -50_205.0 - 3_000.0, 126_283.0 - 4_000.0, 15_449.0, 3_000);
    let cube = engine.cube_radar(3_100).cubes.remove(0);
    assert_eq!(cube.distance_m, Some(50));
    assert!((cube.direction_deg.unwrap() - 53).abs() <= 1, "{:?}", cube.direction_deg);
    // Behind and to the left are negative or large, and an old walk gives nothing.
    me(&mut engine, -50_205.0 + 3_000.0, 126_283.0 + 4_000.0, 15_449.0, 5_000);
    let cube = engine.cube_radar(5_100).cubes.remove(0);
    assert!(cube.direction_deg.unwrap().abs() > 90, "{:?}", cube.direction_deg);
    me(&mut engine, -50_205.0 + 3_000.0, 126_283.0 + 4_000.0, 15_449.0, 40_000);
    assert_eq!(engine.cube_radar(40_100).cubes[0].direction_deg, None);
}

#[test]
fn a_position_older_than_thirty_seconds_gives_no_distance() {
    let mut engine = engine();
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 0);
    me(&mut engine, -50_205.0, 126_283.0 + 6_000.0, 15_449.0, 1_000);
    assert_eq!(engine.cube_radar(20_000).cubes[0].distance_m, Some(60));
    let radar = engine.cube_radar(32_000);
    assert_eq!((radar.cubes.len(), radar.cubes[0].distance_m, radar.fix_age_ms), (1, None, None));
}

#[test]
fn someone_opening_it_is_shown_and_it_is_gone_once_opened_or_out_of_range() {
    let mut engine = engine();
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 0);
    feed(&mut engine, &frame([0x38, 0x36], &hex("e5 ff 03 bb 2c 01")), 1_000);
    assert!(engine.cube_radar(1_100).cubes[0].opening);
    feed(&mut engine, &frame([0x3a, 0x36], &hex(KEY_DONE)), 5_000);
    feed(&mut engine, &frame([0x35, 0x36], &hex("e5 ff 03 04")), 5_100);
    assert!(engine.cube_radar(5_200).cubes.is_empty());
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 6_000);
    feed(&mut engine, &frame([0x35, 0x36], &hex("e5 ff 03 01")), 7_000);
    assert!(engine.cube_radar(7_100).cubes.is_empty());
}

#[test]
fn other_objects_are_ignored_until_one_is_opened_with_a_key_and_then_remembered() {
    let mut engine = engine();
    let mut unknown = hex(SPAWN);
    unknown[5..9].copy_from_slice(&1_301_500u32.to_le_bytes());
    feed(&mut engine, &frame([0x34, 0x36], &unknown), 0);
    assert!(engine.cube_radar(100).cubes.is_empty());
    // An object opened with something else than the key is not a Cube.
    feed(&mut engine, &frame([0x3a, 0x36], &hex("e5 ff 03 dc 47 01 00 00 00 11 22 33 44")), 500);
    assert!(engine.cube_templates().is_empty());
    feed(&mut engine, &frame([0x3a, 0x36], &hex(KEY_DONE)), 1_000);
    assert_eq!(engine.cube_templates(), vec![1_301_500]);
    assert_eq!(engine.cube_radar(1_100).cubes.len(), 1);
    // A later run starts from the saved templates.
    let mut next = self::engine();
    next.learn_cube_templates([1_301_500, 5, 123_456_789]);
    assert_eq!(next.cube_templates(), vec![1_301_500]);
    feed(&mut next, &frame([0x34, 0x36], &unknown), 0);
    assert_eq!(next.cube_radar(100).cubes.len(), 1);
}

#[test]
fn a_map_load_a_stream_gap_and_a_teleport_are_handled() {
    let mut engine = engine();
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 0);
    // A teleport only moves the player; the map load resends what is in range, so it clears.
    let mut teleport = vec![0; 6];
    teleport.extend(floats(-50_205.0, 126_283.0 + 3_000.0, 15_449.0));
    feed(&mut engine, &frame([0x23, 0x36], &teleport), 1_000);
    assert_eq!(engine.cube_radar(1_100).cubes[0].distance_m, Some(30));
    let mut load = hex("0b 00 00 00 f2 03 00 00 3a 03 87 00 00 00 00 00");
    load.extend(floats(-62_578.0, 85_692.0, 13_231.0));
    load.extend([0; 12]);
    feed(&mut engine, &frame([0x21, 0x36], &load), 2_000);
    assert!(engine.cube_radar(2_100).cubes.is_empty());
    // The map load also gives the player's position, with its height.
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 2_500);
    assert_eq!(engine.cube_radar(2_600).fix_age_ms, Some(600));
}

#[test]
fn malformed_cube_frames_are_dropped_without_error() {
    for bad in [
        frame([0x34, 0x36], &hex("e5 ff 03 04 00 a7 4f")),
        frame([0x34, 0x36], &hex("00 04 00 a7 4f 12 00")),
        frame([0x35, 0x36], &[]),
        frame([0x38, 0x36], &hex("e5 ff 03")),
        frame([0x23, 0x36], &[0; 10]),
    ] {
        assert!(packets::decode(&bad).unwrap().is_none(), "{bad:?}");
    }
    let mut not_a_position = hex("e5 ff 03 04 00 a7 4f 12 00");
    not_a_position.extend(floats(f32::NAN, 1.0, 1.0));
    assert!(packets::decode(&frame([0x34, 0x36], &not_a_position)).unwrap().is_none());
}

fn cast_at(target: u64, position: [f32; 3]) -> Event {
    Event::Assistance(luma_engine::assistance::AssistEvent::Cast(
        luma_engine::assistance::CastObservation {
            actor_id: 40_714,
            skill_id: 1_234_567,
            target_id: target,
            duration_ms: None,
            facing: 0.0,
            position: Some(position),
            cooldown: None,
        },
    ))
}

#[test]
fn a_cast_aimed_at_the_player_is_a_position_fix_and_one_aimed_at_someone_else_is_not() {
    let mut engine = engine();
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 0);
    engine.ingest_event(cast_at(9180, [-50_205.0, 126_283.0 + 5_000.0, 15_449.0]), 1_000);
    let radar = engine.cube_radar(1_500);
    assert_eq!((radar.cubes[0].distance_m, radar.cubes[0].vertical_m, radar.fix_age_ms), (Some(50), Some(0), Some(500)));
    // Aimed at a party member: that is their position, not ours.
    engine.ingest_event(cast_at(77, [-50_205.0, 126_283.0 + 90_000.0, 15_449.0]), 2_000);
    assert_eq!(engine.cube_radar(2_100).cubes[0].distance_m, Some(50));
    // Small values near the origin are not coordinates.
    engine.ingest_event(cast_at(9180, [-108.0, -31.0, -95.0]), 3_000);
    assert_eq!(engine.cube_radar(3_100).fix_age_ms, Some(2_100));
}

#[test]
fn a_crowd_of_ordinary_objects_never_pushes_a_cube_out() {
    let mut engine = engine();
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 0);
    for id in 1..=600u16 {
        let mut other = hex(SPAWN);
        other[5..9].copy_from_slice(&1_500_041u32.to_le_bytes());
        other[..3].copy_from_slice(&[(id & 0x7f) as u8 | 0x80, ((id >> 7) & 0x7f) as u8 | 0x80, 0]);
        feed(&mut engine, &frame([0x34, 0x36], &other), 10 + u64::from(id));
    }
    assert_eq!(engine.cube_radar(1_000).cubes.len(), 1);
}
