use luma_engine::{
    assistance::{self, AssistEvent, AssistState},
    packets::{self, Event},
    MeterEngine,
};

fn reading(actor: u8, maximum: u32, current: u32) -> Vec<u8> {
    let mut frame = vec![5, 0xe0, actor, 3, 1];
    frame.extend(maximum.to_le_bytes());
    frame.extend(current.to_le_bytes());
    frame.push(0);
    frame
}

fn receive(engine: &mut MeterEngine, frame: &[u8], at: u64) {
    engine.ingest_event(packets::decode(frame).unwrap().unwrap(), at);
}

#[test]
fn actual_stagger_values_and_break_observation_are_distinct_from_a_timed_break_prediction() {
    let mut engine = MeterEngine::default();
    receive(&mut engine, &reading(10, 1200, 750), 1000);
    let before = engine.live_state(2000).assist.stagger.remove(0);
    assert_eq!(before.actor_id, 10);
    assert_eq!(before.maximum, Some(1200));
    assert_eq!(before.current, 750);
    assert!(!before.broken);
    assert!(before.fresh);
    assert_eq!(before.source, "server");
    receive(&mut engine, &[5, 0xe0, 10, 0, 3], 2100);
    let broken = engine.live_state(2200).assist.stagger.remove(0);
    assert!(broken.broken);
    assert_eq!(broken.current, 0);
    assert_eq!(broken.maximum, Some(1200));
    let snapshot = engine.assistance_snapshot(2200);
    assert_eq!(snapshot.timeline.last().unwrap().kind, "stagger-break");
    let json = serde_json::to_value(broken).unwrap();
    assert!(json.get("expires_ms").is_none());
    assert!(json.get("remaining_ms").is_none());
    assert_eq!(engine.live_state(7200).assist.stagger[0].fresh, false);
    receive(&mut engine, &reading(10, 1200, 1100), 7300);
    let refreshed = engine.live_state(7400).assist.stagger.remove(0);
    assert!(refreshed.fresh && !refreshed.broken);
}

#[test]
fn a_break_without_a_bar_never_invents_the_maximum() {
    let mut engine = MeterEngine::default();
    receive(&mut engine, &[5, 0xe0, 11, 0, 3], 1000);
    let row = engine.live_state(1100).assist.stagger.remove(0);
    assert_eq!(row.maximum, None);
    assert_eq!(row.current, 0);
    assert!(row.broken && row.fresh);
    assert!(engine.live_state(1100).players.is_empty());
    assert_eq!(engine.live_state(1100).total_damage, 0);
}

#[test]
fn malformed_or_truncated_stagger_never_changes_previous_observation() {
    let frame = reading(10, 1200, 750);
    for end in 2..frame.len() {
        assert!(assistance::decode(&frame[..end]).is_err(), "prefix {end}");
    }
    for invalid in [
        reading(0, 1200, 750),
        reading(10, 0, 0),
        reading(10, 1200, 1201),
        reading(10, 1_000_001, 1),
    ] {
        assert!(assistance::decode(&invalid).is_err());
    }
    let mut tail = frame;
    tail.push(0);
    assert!(assistance::decode(&tail).is_err());
    assert!(assistance::decode(&[5, 0xe0, 10, 0, 3, 0]).is_err());
    let mut state = AssistState::default();
    state.ingest(
        AssistEvent::Stagger {
            actor_id: 10,
            maximum: Some(1200),
            current: 750,
            broken: false,
        },
        1000,
    );
    state.ingest(
        AssistEvent::Stagger {
            actor_id: 10,
            maximum: Some(1200),
            current: 1300,
            broken: false,
        },
        1100,
    );
    assert_eq!(state.snapshot(1200).stagger[0].current, 750);
    assert_eq!(state.snapshot(1200).stagger[0].observed_at_ms, 1000);
}

#[test]
fn stagger_is_bounded_prioritizes_marked_boss_and_clears_on_removal_or_capture_loss() {
    let mut engine = MeterEngine::default();
    engine.set_boss_targets(&[1]);
    for id in 1..=64 {
        receive(&mut engine, &reading(id, 1200, 700), 1000 + u64::from(id));
    }
    let live = engine.live_state(2000).assist;
    assert_eq!(live.stagger.len(), 8);
    assert_eq!(live.stagger[0].actor_id, 1);
    assert!(live.retention_limited);
    assert_eq!(engine.assistance_snapshot(2000).stagger.len(), 64);
    receive(&mut engine, &reading(65, 1200, 700), 2100);
    assert_eq!(engine.assistance_snapshot(2200).stagger.len(), 64);
    assert!(!engine
        .assistance_snapshot(2200)
        .stagger
        .iter()
        .any(|row| row.actor_id == 1));
    engine.ingest_event(
        Event::Removed {
            id: 65,
            death: false,
        },
        2300,
    );
    assert!(!engine
        .assistance_snapshot(2400)
        .stagger
        .iter()
        .any(|row| row.actor_id == 65));
    engine.capture_loss();
    assert!(engine.live_state(2500).assist.stagger.is_empty());
    receive(&mut engine, &reading(10, 1200, 700), 2600);
    engine.connection_changed();
    assert!(engine.live_state(2700).assist.stagger.is_empty());
}

#[test]
fn stagger_clock_reversal_expires_all_timings_and_stale_bar_is_not_freshened_by_polling() {
    let mut state = AssistState::default();
    state.ingest(
        AssistEvent::Stagger {
            actor_id: 10,
            maximum: Some(1200),
            current: 750,
            broken: false,
        },
        1000,
    );
    assert!(state.snapshot(999).stagger.is_empty());
    assert!(state.snapshot(6000).stagger[0].fresh);
    assert!(!state.live_snapshot(6001).stagger[0].fresh);
    assert_eq!(state.live_snapshot(9000).stagger[0].observed_at_ms, 1000);
    state.tick(999);
    assert!(state.snapshot(1000).stagger.is_empty());
}

#[test]
fn imported_stagger_collections_are_bounded_before_history_merge() {
    let mut engine = MeterEngine::default();
    let record = luma_engine::Encounter {
        id: 1,
        total_damage: 100,
        ended_ms: 10,
        assist: assistance::AssistSnapshot {
            stagger: vec![
                assistance::StaggerObservation {
                    actor_id: 10,
                    current: 750,
                    maximum: Some(1200),
                    source: "server".into(),
                    ..Default::default()
                };
                65
            ],
            ..Default::default()
        },
        ..Default::default()
    };
    assert!(engine.merge_history(&[record.clone()]).is_err());
    assert!(engine.history_snapshot().1.is_empty());
    engine.restore_history(&[record]);
    assert!(engine.history_snapshot().1.is_empty());
}
