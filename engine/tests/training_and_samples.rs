use luma_engine::{
    packets::{Event, Hit},
    Encounter, MeterEngine,
};

fn player(engine: &mut MeterEngine, id: u64, own: bool) {
    engine.ingest_event(
        Event::Identity {
            id,
            name: format!("Player{id}"),
            class: Some(14),
            own,
        },
        0,
    );
}
fn hit(engine: &mut MeterEngine, source: u64, amount: u64, tick: bool, now: u64) {
    engine.ingest_event(
        Event::Damage(Hit {
            source,
            target: 10,
            skill: 14_090_000,
            amount,
            critical: true,
            tick,
            flags: 14,
            angle: 2,
        }),
        now,
    );
}

#[test]
fn training_waits_for_an_own_direct_hit_and_uses_an_exclusive_fixed_cutoff() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    player(&mut engine, 2, false);
    engine.arm_training(60_000).unwrap();
    hit(&mut engine, 2, 1000, false, 1000);
    hit(&mut engine, 1, 5, true, 2000);
    assert_eq!(engine.live_state(2000).training.status, "armed");
    hit(&mut engine, 1, 100, false, 3000);
    engine.ingest_event(
        Event::Npc {
            id: 3,
            name: None,
            model: 2_920_620,
            kind: 0x5f,
        },
        3000,
    );
    engine.ingest_event(Event::Owner { id: 3, owner: 1 }, 3000);
    hit(&mut engine, 3, 25, true, 4000);
    hit(&mut engine, 2, 5000, false, 6000);
    hit(&mut engine, 1, 75, true, 62_999);
    hit(&mut engine, 1, 9000, false, 63_000);
    let training = engine.live_state(100_000).training;
    assert_eq!(training.started_ms, Some(3000));
    assert_eq!(training.status, "complete");
    assert_eq!(training.total_damage, 200);
    assert_eq!(training.remaining_ms, 0);
    assert_eq!(training.dps, 200.0 / 60.0);
    assert!(engine.live_state(100_000).total_damage > training.total_damage);
}

#[test]
fn training_requires_local_binding_valid_duration_and_connection_cancels_it() {
    let mut engine = MeterEngine::default();
    assert!(engine.arm_training(60_000).is_err());
    player(&mut engine, 1, true);
    for duration in [9999, 10_100, 300_001, 301_000] {
        assert!(engine.arm_training(duration).is_err());
    }
    for duration in [10_000, 37_000, 60_000, 61_000, 120_000, 180_000, 300_000] {
        engine.arm_training(duration).unwrap();
        assert_eq!(engine.live_state(0).training.duration_ms, duration);
    }
    engine.connection_changed();
    assert_eq!(engine.live_state(0).training.status, "idle");
}

#[test]
fn training_on_an_observed_target_ignores_own_damage_to_any_other_target() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    hit(&mut engine, 1, 1, false, 0);
    assert!(engine.arm_training_on_target(60_000, Some(99)).is_err());
    engine.arm_training_on_target(60_000, Some(10)).unwrap();
    let damage = |target, amount| {
        Event::Damage(Hit {
            source: 1,
            target,
            skill: 14_090_000,
            amount,
            critical: false,
            tick: false,
            flags: 0,
            angle: 0,
        })
    };
    engine.ingest_event(damage(11, 500), 1000);
    assert_eq!(engine.live_state(1000).training.status, "armed");
    engine.ingest_event(damage(10, 100), 2000);
    engine.ingest_event(damage(11, 900), 3000);
    engine.ingest_event(damage(10, 100), 4000);
    let training = engine.live_state(62_000).training;
    assert_eq!(training.target_id, Some(10));
    assert_eq!(training.total_damage, 200);
    assert_eq!(training.started_ms, Some(2000));
}

#[test]
fn timers_finish_without_more_hits_and_a_capture_gap_marks_the_result_incomplete() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    engine.arm_training(60_000).unwrap();
    hit(&mut engine, 1, 100, false, 1000);
    engine.capture_loss();
    engine.tick(61_000);
    let training = engine.live_state(61_000).training;
    assert_eq!(training.status, "complete");
    assert!(training.capture_incomplete);
    assert_eq!(training.total_damage, 100);
    engine.cancel_training();
    assert_eq!(engine.live_state(61_000).training.status, "idle");
}

#[test]
fn pausing_the_meter_cancels_training_instead_of_certifying_missing_hits() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    engine.arm_training(60_000).unwrap();
    hit(&mut engine, 1, 100, false, 1000);
    engine.set_paused_at(true, 2000);
    hit(&mut engine, 1, 500, false, 3000);
    engine.tick(61_000);
    assert_eq!(engine.live_state(61_000).training.status, "idle");
    assert_eq!(engine.live_state(61_000).training.total_damage, 0);
}

#[test]
fn samples_are_on_demand_time_stamped_and_credit_summons_after_a_late_link() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    hit(&mut engine, 3, 100, false, 1000);
    engine.ingest_event(
        Event::Npc {
            id: 3,
            name: None,
            model: 2_920_620,
            kind: 0x5f,
        },
        1200,
    );
    engine.ingest_event(Event::Owner { id: 3, owner: 1 }, 1300);
    let record = engine.current_record(2000);
    assert_eq!(record.damage_samples.len(), 1);
    let sample = &record.damage_samples[0];
    assert_eq!(
        (
            sample.timestamp_ms,
            sample.source,
            sample.player_id,
            sample.amount
        ),
        (1000, 3, 1, 100)
    );
    assert!(record.sample_complete);
    let live = serde_json::to_value(engine.live_state(2000)).unwrap();
    assert!(live.get("damage_samples").is_none());
    assert_eq!(live["personal_total_damage"], 100);
    engine.reset();
    let history = engine.history_snapshot().1;
    assert_eq!(history[0].damage_samples[0].player_id, 1);
    assert_eq!(history[0].source, "captured");
}

#[test]
fn sample_truncation_is_explicit_while_aggregate_damage_remains_complete() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    for now in 0..20_010 {
        hit(&mut engine, 1, 1, false, now)
    }
    let record = engine.current_record(20_010);
    assert_eq!(record.total_damage, 20_010);
    assert_eq!(record.damage_samples.len(), 20_000);
    assert!(!record.sample_complete);
    assert_eq!(engine.live_state(20_010).players[0].skills[0].hits, 20_010);
}

#[test]
fn only_validated_flag_counters_and_raw_directions_are_reported() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    hit(&mut engine, 1, 100, true, 1000);
    let skill = &engine.live_state(2000).players[0].skills[0];
    assert_eq!(skill.quality_hits, 0);
    assert_eq!(skill.parry_hits, None);
    hit(&mut engine, 1, 100, false, 2000);
    let state = engine.live_state(3000);
    let skill = &state.players[0].skills[0];
    assert_eq!(
        (skill.direct_hits, skill.tick_hits, skill.quality_hits),
        (1, 1, 1)
    );
    assert_eq!(skill.parry_hits, Some(1));
    assert_eq!(skill.perfect_hits, Some(1));
    assert_eq!(skill.double_hits, Some(1));
    assert_eq!(skill.direction_1_hits, Some(0));
    assert_eq!(skill.direction_2_hits, Some(1));
    let value = serde_json::to_value(skill).unwrap();
    assert!(value.get("smite_hits").is_none());
    assert!(value.get("back_hits").is_none());
}

#[test]
fn imports_are_atomic_distinct_and_never_change_live_identity_or_totals() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    hit(&mut engine, 1, 100, false, 1000);
    let record = Encounter {
        id: 1,
        total_damage: 900,
        ended_ms: 10,
        local_player_id: Some(2),
        ..Default::default()
    };
    let invalid = Encounter::default();
    assert!(engine.merge_history(&[record.clone(), invalid]).is_err());
    assert_eq!(engine.history_snapshot().1.len(), 0);
    engine.merge_history(&[record.clone(), record]).unwrap();
    let history = engine.history_snapshot().1;
    assert_eq!(history.len(), 2);
    assert_ne!(history[0].id, history[1].id);
    assert_eq!(history[0].source, "imported");
    assert_eq!(engine.live_state(2000).personal_total_damage, Some(100));
    assert_eq!(engine.live_state(2000).local_player_id, Some(1));
}

#[test]
fn clearing_imports_preserves_captured_reports_live_damage_and_noop_revision() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    hit(&mut engine, 1, 100, false, 1000);
    engine.reset();
    let captured = engine.history_snapshot().1[0].clone();
    engine
        .merge_history(std::slice::from_ref(&captured))
        .unwrap();
    hit(&mut engine, 1, 250, false, 2000);
    let before = engine.history_revision();
    assert_eq!(engine.clear_imported_history(), 1);
    assert_eq!(engine.history_revision(), before + 1);
    assert_eq!(
        serde_json::to_value(engine.history_snapshot().1).unwrap(),
        serde_json::to_value(vec![captured]).unwrap()
    );
    assert_eq!(engine.live_state(3000).personal_total_damage, Some(250));
    assert_eq!(engine.live_state(3000).local_player_id, Some(1));
    assert_eq!(engine.clear_imported_history(), 0);
    assert_eq!(engine.history_revision(), before + 1);
}

#[test]
fn persisted_sample_memory_is_bounded_across_many_encounters() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    for battle in 0..6 {
        for hit_index in 0..20_000 {
            hit(&mut engine, 1, 1, false, battle * 100_000 + hit_index)
        }
        engine.reset();
    }
    let history = engine.history_snapshot().1;
    assert_eq!(history.len(), 6);
    assert_eq!(
        history
            .iter()
            .map(|record| record.damage_samples.len())
            .sum::<usize>(),
        100_000
    );
    assert!(!history.last().unwrap().sample_complete);
    assert_eq!(history.last().unwrap().total_damage, 20_000);
}
