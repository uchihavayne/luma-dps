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
    let cube = engine.cube_radar(3_000).cubes.remove(0);
    assert_eq!(cube.distance_m, Some(50));
    assert!((cube.direction_deg.unwrap() - 53).abs() <= 1, "{:?}", cube.direction_deg);
    // Walking away from it, the Cube is behind: the angle is large. An old walk gives nothing.
    me(&mut engine, -53_205.0 - 1_200.0, 122_283.0 - 1_600.0, 15_449.0, 5_000);
    let cube = engine.cube_radar(5_000).cubes.remove(0);
    assert!(cube.direction_deg.unwrap().abs() > 150, "{:?}", cube.direction_deg);
    me(&mut engine, -53_205.0 - 1_200.0, 122_283.0 - 1_600.0, 15_449.0, 40_000);
    assert_eq!(engine.cube_radar(40_100).cubes[0].direction_deg, None);
}

#[test]
fn a_turn_shows_after_a_few_steps_and_a_teleport_is_never_a_walk() {
    let mut engine = engine();
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 0);
    // Walking towards the Cube (-y), then a step of a metre: too little to be a new direction.
    me(&mut engine, -50_205.0, 126_283.0 + 8_000.0, 15_449.0, 1_000);
    me(&mut engine, -50_205.0, 126_283.0 + 7_000.0, 15_449.0, 2_000);
    me(&mut engine, -50_205.0 + 100.0, 126_283.0 + 7_000.0, 15_449.0, 2_500);
    assert!(engine.cube_radar(2_500).cubes[0].direction_deg.unwrap().abs() <= 1, "a step of a metre is not a turn");
    // Two metres to the side is: the Cube was straight ahead of the old way, and is now to the left of the new one.
    me(&mut engine, -50_205.0 + 100.0 + 200.0, 126_283.0 + 7_000.0, 15_449.0, 3_000);
    let turned = engine.cube_radar(3_000).cubes[0].direction_deg.unwrap();
    assert!((turned + 90).abs() <= 8, "{turned}");
    assert_eq!(engine.cube_radar(3_000).heading_age_ms, Some(0));
    assert_eq!(engine.cube_radar(5_000).heading_age_ms, Some(2_000));
    // A map load, a gate or a teleport: 800 m in one second. The way the player was going means nothing after it.
    me(&mut engine, -50_205.0 + 80_000.0, 126_283.0, 15_449.0, 4_000);
    let radar = engine.cube_radar(4_000);
    assert_eq!((radar.heading_age_ms, radar.cubes.first().and_then(|cube| cube.direction_deg)), (None, None));
    assert!(!radar.estimated, "no speed is carried over a teleport");
}

#[test]
fn the_position_is_carried_forward_at_the_speed_the_player_was_moving_and_says_so() {
    let mut engine = engine();
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 0);
    // Running at 10 m/s straight at the Cube, 40 m away at the second fix.
    me(&mut engine, -50_205.0, 126_283.0 + 6_000.0, 15_449.0, 1_000);
    me(&mut engine, -50_205.0, 126_283.0 + 4_000.0, 15_449.0, 3_000);
    let radar = engine.cube_radar(3_000);
    assert_eq!((radar.cubes[0].distance_m, radar.estimated), (Some(40), false));
    // A third of a second on it is not yet called an estimate; a second on it is, and the Cube is 10 m nearer.
    let radar = engine.cube_radar(3_300);
    assert_eq!((radar.cubes[0].distance_m, radar.estimated), (Some(37), false));
    let radar = engine.cube_radar(4_000);
    assert_eq!((radar.cubes[0].distance_m, radar.estimated, radar.fix_age_ms), (Some(30), true, Some(1_000)));
    // It stops being carried forward after three seconds: the player may have stopped.
    assert_eq!(engine.cube_radar(6_000).cubes[0].distance_m, Some(10));
    assert_eq!(engine.cube_radar(20_000).cubes[0].distance_m, Some(10));
    // Standing still is not a speed: nothing is carried forward.
    me(&mut engine, -50_205.0, 126_283.0 + 4_000.0, 15_449.0, 21_000);
    me(&mut engine, -50_205.0, 126_283.0 + 4_000.0, 15_449.0, 23_000);
    let radar = engine.cube_radar(25_000);
    assert_eq!((radar.cubes[0].distance_m, radar.estimated), (Some(40), false));
    // Fixes too far apart in time give no speed either.
    me(&mut engine, -50_205.0, 126_283.0 + 1_000.0, 15_449.0, 33_000);
    assert_eq!((engine.cube_radar(35_000).cubes[0].distance_m, engine.cube_radar(35_000).estimated), (Some(10), false));
}

#[test]
fn the_players_own_movement_notice_is_a_position_even_without_a_height() {
    let mut engine = engine();
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 0);
    me(&mut engine, -50_205.0, 126_283.0 + 6_000.0, 15_449.0, 1_000);
    // A movement notice for the player carries no height: the last one is kept.
    engine.ingest_event(
        Event::Position(Observation { actor_id: 9180, x: -50_205.0, y: 126_283.0 + 5_000.0, z: None, source: "server-position".into(), local_only: false }),
        1_500,
    );
    let radar = engine.cube_radar(1_500);
    assert_eq!((radar.cubes[0].distance_m, radar.cubes[0].vertical_m, radar.fix_age_ms), (Some(50), Some(0), Some(0)));
    // Someone else's movement is not the player's position.
    engine.ingest_event(
        Event::Position(Observation { actor_id: 77, x: -50_205.0, y: 126_283.0, z: None, source: "server-position".into(), local_only: false }),
        1_600,
    );
    assert_eq!(engine.cube_radar(1_500).cubes[0].distance_m, Some(50));
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
fn someone_opening_it_is_shown_it_stays_listed_as_taken_for_a_moment_and_out_of_range_forgets_it() {
    let mut engine = engine();
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 0);
    feed(&mut engine, &frame([0x38, 0x36], &hex("e5 ff 03 bb 2c 01")), 1_000);
    assert!(engine.cube_radar(1_100).cubes[0].opening);
    feed(&mut engine, &frame([0x3a, 0x36], &hex(KEY_DONE)), 5_000);
    feed(&mut engine, &frame([0x35, 0x36], &hex("e5 ff 03 04")), 5_100);
    // Opened: still listed, marked taken, for eight seconds.
    let taken = engine.cube_radar(5_200).cubes;
    assert_eq!(taken.len(), 1);
    assert!(taken[0].taken && !taken[0].opening);
    assert!(engine.cube_radar(5_100 + 7_900).cubes[0].taken);
    assert!(engine.cube_radar(5_100 + 8_100).cubes.is_empty());
    // Out of range: forgotten at once.
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 20_000);
    assert!(!engine.cube_radar(20_100).cubes[0].taken);
    feed(&mut engine, &frame([0x35, 0x36], &hex("e5 ff 03 01")), 21_000);
    assert!(engine.cube_radar(21_100).cubes.is_empty());
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

// The creation time of the sample Cube, milliseconds on the server's clock.
const CREATED_MS: u64 = 0x01a1_34a5_e4aa;

fn cube_with(template: u32, reason: Option<u8>) -> Vec<u8> {
    let mut body = hex(SPAWN);
    body[5..9].copy_from_slice(&template.to_le_bytes());
    if let Some(reason) = reason {
        body[31] = reason;
    }
    frame([0x34, 0x36], &body)
}

#[test]
fn all_nineteen_cube_templates_are_cubes_with_their_look_and_other_objects_are_not() {
    use luma_engine::cube::{known_look, Look};
    let red = [1_200_039, 1_200_040, 1_200_041, 1_201_503, 1_201_504, 1_301_199, 1_301_200, 1_301_244, 1_301_245];
    let gold = [1_200_036, 1_200_037, 1_200_667, 1_201_502, 1_201_505, 1_300_081, 1_300_082, 1_300_754, 1_301_242, 1_301_243];
    assert!(red.iter().all(|t| known_look(*t) == Some(Look::Red)));
    assert!(gold.iter().all(|t| known_look(*t) == Some(Look::Gold)));
    for (template, look) in [(1_200_036, "gold"), (1_301_245, "red")] {
        let mut engine = engine();
        feed(&mut engine, &cube_with(template, None), 0);
        let cubes = engine.cube_radar(100).cubes;
        assert_eq!((cubes.len(), cubes[0].look.name()), (1, look));
    }
    let mut engine = engine();
    feed(&mut engine, &cube_with(1_500_041, None), 0);
    assert!(engine.cube_radar(100).cubes.is_empty());
}

#[test]
fn a_cube_that_spawned_in_view_is_live_and_its_age_comes_from_the_servers_clock() {
    use luma_engine::cube::Event as CubeEvent;
    let mut engine = engine();
    feed(&mut engine, &cube_with(1_200_039, Some(6)), 1_000);
    feed(&mut engine, &cube_with(1_200_041, Some(1)), 1_000);
    // No clock yet: no age.
    assert!(engine.cube_radar(1_100).cubes.iter().all(|cube| cube.age_s.is_none()));
    engine.ingest_event(Event::Cube(CubeEvent::Clock { server_ms: CREATED_MS + 125_000 }), 10_000);
    let cubes = engine.cube_radar(10_000).cubes;
    assert_eq!(cubes.len(), 1); // both used the same object id: the second replaced the first
    assert!(!cubes[0].live);
    assert_eq!(cubes[0].age_s, Some(125));
    // The age keeps growing with the local clock.
    assert_eq!(engine.cube_radar(40_000).cubes[0].age_s, Some(155));
    let mut engine = self::engine();
    feed(&mut engine, &cube_with(1_200_039, Some(6)), 1_000);
    assert!(engine.cube_radar(1_100).cubes[0].live);
    // A creation time from the future of the clock is never a negative age.
    engine.ingest_event(Event::Cube(CubeEvent::Clock { server_ms: CREATED_MS - 50_000 }), 2_000);
    assert_eq!(engine.cube_radar(2_100).cubes[0].age_s, Some(0));
}

#[test]
fn the_map_bearing_points_east_when_the_cube_is_east_and_north_is_world_minus_y() {
    for (dx, dy, bearing) in [(3_000.0, 0.0, 0), (0.0, -3_000.0, 90), (-3_000.0, 0.0, 180), (0.0, 3_000.0, -90)] {
        let mut engine = engine();
        feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 0);
        me(&mut engine, -50_205.0 - dx, 126_283.0 - dy, 15_449.0, 1_000);
        let cube = engine.cube_radar(1_100).cubes.remove(0);
        assert_eq!(cube.bearing_deg, Some(bearing), "cube offset ({dx}, {dy})");
        assert_eq!(cube.distance_m, Some(30));
    }
    // No position of the player, no bearing.
    let mut engine = engine();
    feed(&mut engine, &frame([0x34, 0x36], &hex(SPAWN)), 0);
    assert_eq!(engine.cube_radar(100).cubes[0].bearing_deg, None);
}

#[test]
fn the_map_frame_gives_the_server_clock_and_an_object_with_a_nickname_still_parses() {
    use luma_engine::cube::Event as CubeEvent;
    let mut clock = CREATED_MS.to_le_bytes().to_vec();
    clock.extend([0, 0]);
    assert_eq!(
        packets::decode(&frame([0x00, 0x36], &clock)).unwrap(),
        Some(Event::Cube(CubeEvent::Clock { server_ms: CREATED_MS }))
    );
    // A heartbeat that is too small to be a clock is ignored.
    assert!(packets::decode(&frame([0x00, 0x36], &[1, 0, 0, 0, 0, 0, 0, 0])).unwrap().is_none());
    // A named object: flags, descriptor flags with a nickname, then the template.
    let mut body = hex("e5 ff 03 04 01 03 61 62 63");
    body.extend(1_200_041u32.to_le_bytes());
    body.extend(floats(-50_205.0, 126_283.0, 15_449.0));
    body.extend([0; 8]);
    body.extend([1, 1, 6]);
    body.extend(CREATED_MS.to_le_bytes());
    let Some(Event::Cube(CubeEvent::Spawn { template, reason, created_ms, .. })) =
        packets::decode(&frame([0x34, 0x36], &body)).unwrap()
    else {
        panic!("expected a spawn");
    };
    assert_eq!((template, reason, created_ms), (1_200_041, 6, Some(CREATED_MS)));
}
