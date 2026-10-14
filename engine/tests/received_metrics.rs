use luma_engine::{
    packets::{Event, Hit},
    MeterEngine,
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
    )
}
fn npc(engine: &mut MeterEngine, id: u64) {
    engine.ingest_event(
        Event::Npc {
            id,
            name: Some(format!("NPC{id}")),
            model: 2_900_000,
            kind: 0x0c,
        },
        0,
    )
}
fn hit(engine: &mut MeterEngine, source: u64, target: u64, amount: u64, now: u64) {
    engine.ingest_event(
        Event::Damage(Hit {
            source,
            target,
            amount,
            skill: 14_090_000,
            critical: false,
            tick: false,
            flags: 0,
            angle: 0,
        }),
        now,
    )
}

#[test]
fn known_npc_damage_taken_does_not_become_outgoing_damage_and_keeps_exact_body_time() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    npc(&mut engine, 9);
    hit(&mut engine, 9, 1, 300, 1000);
    hit(&mut engine, 9, 1, 200, 2000);
    let state = engine.live_state(3000);
    assert_eq!(state.total_damage, 0);
    assert_eq!(state.personal_damage_taken, Some(500));
    assert_eq!(state.personal_damage_taken_started_ms, Some(1000));
    assert_eq!(state.personal_damage_taken_elapsed_ms, 2000);
    assert_eq!(state.personal_damage_taken_per_second, Some(250.0));
    assert!(state.personal_damage_taken_complete);
    assert_eq!(state.players.len(), 1);
    assert_eq!(state.players[0].id, 1);
    assert_eq!(state.players[0].incoming_skills[0].damage, 500);
    assert_eq!(state.players[0].healing, None);
    let record = engine.current_record(3000);
    assert!(record.damage_samples.is_empty());
    assert_eq!(record.received_samples.len(), 2);
    engine.reset();
    assert_eq!(
        engine.history_snapshot().1[0].personal_damage_taken,
        Some(500)
    );
}

#[test]
fn player_to_player_heal_or_pvp_stays_unclassified_and_cannot_inflate_pve_or_taken() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    player(&mut engine, 2, false);
    npc(&mut engine, 9);
    hit(&mut engine, 2, 1, 800, 1000);
    hit(&mut engine, 1, 2, 500, 2000);
    hit(&mut engine, 9, 1, 100, 3000);
    hit(&mut engine, 1, 10, 200, 4000);
    let state = engine.live_state(5000);
    assert_eq!(state.personal_total_damage, Some(200));
    assert_eq!(state.total_damage, 200);
    assert_eq!(state.personal_damage_taken, Some(100));
    assert!(!state.personal_damage_taken_complete);
    assert_eq!(state.personal_damage_taken_started_ms, Some(3000));
    assert_eq!(state.unclassified_player_target_amount, 1300);
    assert_eq!(state.unclassified_player_target_events, 2);
    assert_eq!(state.personal_started_ms, Some(4000));
    assert_eq!(state.personal_elapsed_ms, 1000);
    assert_eq!(state.personal_healing, None);
    assert_eq!(state.personal_hps, None);
    let record = engine.current_record(5000);
    assert_eq!(record.damage_samples.len(), 1);
    assert_eq!(record.damage_samples[0].amount, 200);
    assert!(!record.sample_complete);
}

#[test]
fn late_player_identity_reclassifies_amount_duration_and_damage_samples_together() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    hit(&mut engine, 1, 2, 500, 1000);
    hit(&mut engine, 1, 10, 100, 3000);
    player(&mut engine, 2, false);
    let state = engine.live_state(4000);
    assert_eq!(state.total_damage, 100);
    assert_eq!(state.elapsed_ms, 1000);
    assert_eq!(state.personal_started_ms, Some(3000));
    assert_eq!(state.personal_dps, Some(100.0));
    let record = engine.current_record(4000);
    assert_eq!(record.damage_samples.len(), 1);
    assert_eq!(record.damage_samples[0].target, 10);
    assert_eq!(record.unclassified_player_target_amount, 500);
}

#[test]
fn heals_cannot_arm_damage_training_and_late_player_target_invalidates_a_run() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    player(&mut engine, 2, false);
    hit(&mut engine, 1, 10, 1, 0);
    assert!(engine.arm_training_on_target(60_000, Some(2)).is_err());
    engine.arm_training(60_000).unwrap();
    hit(&mut engine, 1, 2, 500, 1000);
    hit(&mut engine, 1, 1, 600, 2000);
    assert_eq!(engine.live_state(2000).training.status, "armed");
    hit(&mut engine, 1, 10, 100, 3000);
    assert_eq!(engine.live_state(4000).training.started_ms, Some(3000));
    player(&mut engine, 10, false);
    assert_eq!(engine.live_state(4000).training.status, "idle");
}

#[test]
fn pet_restoration_is_unknown_and_damage_received_by_a_pet_is_not_its_owner_body() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    npc(&mut engine, 9);
    engine.ingest_event(
        Event::Npc {
            id: 3,
            name: Some("Player1".into()),
            model: 2_920_620,
            kind: 0x5f,
        },
        0,
    );
    engine.ingest_event(Event::Owner { id: 3, owner: 1 }, 0);
    hit(&mut engine, 3, 1, 50, 1000);
    hit(&mut engine, 9, 3, 500, 2000);
    let state = engine.live_state(3000);
    assert_eq!(state.personal_damage_taken, Some(0));
    assert!(!state.personal_damage_taken_complete);
    assert_eq!(state.personal_total_damage, Some(0));
    assert_eq!(state.unclassified_player_target_amount, 50);
}

#[test]
fn incoming_only_other_players_archive_and_later_capture_loss_does_not_rewrite_coverage() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 2, false);
    npc(&mut engine, 9);
    hit(&mut engine, 9, 2, 100, 1000);
    engine.ingest_event(Event::Removed { id: 2, death: true }, 2000);
    assert_eq!(engine.history_snapshot().1.len(), 1);
    assert_eq!(
        engine.history_snapshot().1[0].players[0].damage_taken,
        Some(100)
    );
    assert!(engine.live_state(3000).players[0].damage_taken_complete);
    engine.capture_loss();
    assert!(engine.live_state(4000).players[0].damage_taken_complete);
    assert!(engine.history_snapshot().1[0].players[0].damage_taken_complete);
}
