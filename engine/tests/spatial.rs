use luma_engine::{
    assistance::{AssistEvent, CastObservation},
    packets::{decode, Event, Hit},
    spatial::{self, Observation, Store},
    MeterEngine,
};
fn point(id: u64, x: f32) -> Observation {
    Observation {
        actor_id: id,
        x,
        y: 2000.0,
        z: Some(100.0),
        source: "server-position".into(),
        local_only: false,
    }
}
fn self_identity(e: &mut MeterEngine, at: u64) {
    e.ingest_event(
        Event::Identity {
            id: 7,
            name: "TestArcher".into(),
            class: Some(14),
            own: true,
        },
        at,
    );
}
fn hit(e: &mut MeterEngine, at: u64) {
    e.ingest_event(
        Event::Damage(Hit {
            source: 7,
            target: 10,
            skill: 14090000,
            amount: 100,
            critical: false,
            tick: false,
            flags: 0,
            angle: 0,
        }),
        at,
    );
}
#[test]
fn movement_decoding_requires_canonical_actor_and_plausible_finite_coordinates() {
    for opcode in [
        0x1a, 0x1b, 0x1c, 0x1e, 0x20, 0x28, 0x29, 0x2a, 0x1f, 0x2f, 0x3c,
    ] {
        let mut bytes = vec![opcode, 0x37, 7];
        bytes.extend(if [0x1f, 0x2f, 0x3c].contains(&opcode) {
            vec![3]
        } else {
            vec![0, 0]
        });
        bytes.extend(1000f32.to_le_bytes());
        bytes.extend(2000f32.to_le_bytes());
        assert!(
            matches!(decode(&bytes),Ok(Some(Event::Position(p))) if p.actor_id==7 && p.x==1000.0)
        );
        for end in 0..bytes.len() {
            assert!(spatial::position(&bytes[..end]).is_none());
        }
        let len = bytes.len();
        bytes[len - 4..].copy_from_slice(&f32::NAN.to_le_bytes());
        assert!(spatial::position(&bytes).is_none());
    }
    assert!(spatial::position(&[0x1f, 0x37, 0x87, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0]).is_none());
}
#[test]
fn sampling_retains_slow_motion_and_bounds_history_without_making_polls_observations() {
    let mut s = Store::default();
    s.map(5);
    s.register(7, "TestArcher", "Ranger", "player", None);
    for at in 0..800 {
        s.observe(point(7, 1000.0 + at as f32 * 0.01), at);
    }
    let record = s.snapshot(800, Some((0, 800)));
    assert_eq!(record.track.len(), 2);
    assert_eq!(s.snapshot(30000, None).positions.len(), 0);
    assert_eq!(s.snapshot(30000, None).sampled_at_ms, 799);
    for at in 800..14000 {
        s.observe(point(7, at as f32 * 100.0 % 100000.0), at);
    }
    let record = s.snapshot(14000, Some((0, 14000)));
    assert_eq!(record.track.len(), spatial::MAX_TRACK);
    assert!(record.retention_limited);
}
#[test]
fn reuse_and_removal_keep_old_names_with_old_coordinates() {
    let mut s = Store::default();
    s.map(5);
    s.register(7, "First", "Ranger", "player", None);
    s.observe(point(7, 1000.0), 1000);
    s.replace(7, 1100);
    s.register(7, "Second", "Sorcerer", "player", None);
    s.observe(point(7, 3000.0), 1200);
    let r = s.snapshot(1300, Some((1000, 1300)));
    assert_eq!(r.actors.len(), 2);
    assert_ne!(r.track[0].generation, r.track[2].generation);
    assert!(!r.track[1].present);
    assert!(r.valid(1000, 1300));
    s.map(6);
    assert!(s.snapshot(1300, None).positions.is_empty());
}
#[test]
fn aim_points_never_become_caster_positions_and_nonlocal_effects_are_ignored() {
    let mut e = MeterEngine::default();
    self_identity(&mut e, 0);
    e.ingest_event(
        Event::Assistance(AssistEvent::Cast(CastObservation {
            actor_id: 7,
            target_id: 10,
            skill_id: 14090000,
            duration_ms: Some(1000),
            position: Some([9000.0, 8000.0, 100.0]),
            facing: 90.0,
            cooldown: None,
        })),
        1000,
    );
    let state = e.live_state(1100);
    assert!(state.spatial.positions.is_empty());
    assert_eq!(state.spatial.aims.len(), 1);
    let mut other = point(8, 1000.0);
    other.local_only = true;
    other.source = "server-effect".into();
    e.ingest_event(Event::Position(other), 1200);
    assert!(e.live_state(1300).spatial.positions.is_empty());
}
#[test]
fn coordinates_continue_while_damage_is_paused_and_history_survives_reset() {
    let mut e = MeterEngine::default();
    self_identity(&mut e, 0);
    e.ingest_event(Event::Position(point(7, 1000.0)), 1000);
    hit(&mut e, 1100);
    e.set_paused_at(true, 1200);
    e.ingest_event(Event::Position(point(7, 2000.0)), 1300);
    assert_eq!(e.live_state(1400).spatial.positions[0].x, 2000.0);
    e.set_paused_at(false, 1500);
    hit(&mut e, 1600);
    let record = e.current_record(1700);
    assert!(!record.spatial.track.is_empty());
    assert!(record.spatial.valid(record.started_ms, record.ended_ms));
    e.reset();
    assert!(!e
        .history_snapshot()
        .1
        .last()
        .unwrap()
        .spatial
        .track
        .is_empty());
}
#[test]
fn imported_spatial_data_rejects_duplicate_keys_future_samples_and_unbounded_aims() {
    let mut s = Store::default();
    s.register(7, "Test", "Ranger", "player", None);
    s.observe(point(7, 1000.0), 1000);
    let mut r = s.snapshot(2000, Some((1000, 2000)));
    assert!(r.valid(1000, 2000));
    r.actors.push(r.actors[0].clone());
    assert!(!r.valid(1000, 2000));
    r.actors.pop();
    r.track[0].at_ms = 2001;
    assert!(!r.valid(1000, 2000));
}
