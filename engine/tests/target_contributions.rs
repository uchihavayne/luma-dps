use luma_engine::{
    assistance::AssistEvent,
    packets::{Event, Hit},
    MeterEngine, TargetState,
};

fn identity(engine: &mut MeterEngine, id: u64, name: &str, own: bool) {
    engine.ingest_event(
        Event::Identity {
            id,
            name: name.into(),
            class: Some(14),
            own,
        },
        0,
    );
}
fn npc(engine: &mut MeterEngine, id: u64, name: &str) {
    engine.ingest_event(
        Event::Npc {
            id,
            name: Some(name.into()),
            model: 123,
            kind: 0x1c,
        },
        0,
    );
}
fn hit(engine: &mut MeterEngine, source: u64, target: u64, amount: u64, at: u64) {
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
        at,
    );
}

#[test]
fn unpartied_target_top_ten_excludes_other_mobs_and_keeps_own_rank_below_ten() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 99, "Local", true);
    npc(&mut engine, 900, "Received target");
    npc(&mut engine, 901, "Unrelated add");
    for id in 1..=12 {
        identity(&mut engine, id, &format!("P{id}"), false);
        hit(&mut engine, id, 900, (13 - id) * 100, 1000);
    }
    hit(&mut engine, 99, 900, 50, 3000);
    hit(&mut engine, 2, 901, 100_000, 3500);
    let state = engine.live_state(11_000);
    let boss = state.targets.iter().find(|row| row.id == 900).unwrap();
    assert_eq!(boss.name, "Received target");
    assert!(
        !boss.is_boss,
        "NPC kind alone must not invent a boss classification"
    );
    assert_eq!(boss.damage, 7850);
    assert_eq!(boss.participant_count, 13);
    assert_eq!(boss.participants.len(), 10);
    assert_eq!(
        boss.participants
            .iter()
            .map(|row| row.id)
            .collect::<Vec<_>>(),
        (1..=10).collect::<Vec<_>>()
    );
    assert!(boss.participants.iter().all(|row| !row.in_party));
    assert_eq!(boss.started_ms, Some(1000));
    assert_eq!(boss.elapsed_ms, 10_000);
    assert_eq!(boss.participants[0].dps, 120.0);
    assert_eq!(boss.own_rank, Some(13));
    assert_eq!(boss.own_participant.as_ref().unwrap().damage, 50);
    assert_eq!(boss.own_participant.as_ref().unwrap().dps, 5.0);
    assert_eq!(boss.party_total_damage, None);
    assert_eq!(state.focused_target_id, Some(900));
    assert_eq!(state.encounter_started_ms, Some(1000));
    assert_eq!(state.observed_targets.len(), 1);
    assert_eq!(state.observed_targets[0].id, 900);
}

#[test]
fn party_summary_uses_all_target_contributors_and_confirmed_pet_damage_merges_with_owner() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 99, "Local", true);
    for id in 1..=12 {
        identity(&mut engine, id, &format!("P{id}"), false);
        hit(&mut engine, id, 900, (13 - id) * 100, 1000);
    }
    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Local".into(), "P12".into()],
        },
        1100,
    );
    hit(&mut engine, 99, 900, 50, 2000);
    engine.ingest_event(
        Event::Npc {
            id: 90,
            name: Some("Pet".into()),
            model: 123,
            kind: 0x5f,
        },
        2500,
    );
    engine.ingest_event(Event::Owner { id: 90, owner: 99 }, 2500);
    hit(&mut engine, 90, 900, 100, 3000);
    let state = engine.live_state(11_000);
    let target = &state.targets[0];
    assert_eq!(target.participant_count, 13);
    assert!(target.participants.iter().all(|row| row.id != 90));
    assert_eq!(target.own_participant.as_ref().unwrap().damage, 150);
    assert_eq!(target.party_total_damage, Some(250));
    assert_eq!(target.party_dps, Some(25.0));
    assert_eq!(state.all_targets_summary.party_total_damage, Some(250));
    assert_eq!(state.all_targets_summary.party_dps, Some(25.0));
    assert_eq!(state.all_targets_summary.party_elapsed_ms, Some(10_000));
    assert_eq!(state.focused_target_observed_at_ms, Some(3000));
}

#[test]
fn unnamed_damage_contributors_are_ranked_but_npc_attacks_and_zero_damage_are_not() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    npc(&mut engine, 900, "Target");
    npc(&mut engine, 800, "Attacking NPC");
    hit(&mut engine, 1, 900, 100, 1000);
    hit(&mut engine, 22, 900, 200, 1000);
    hit(&mut engine, 23, 900, 0, 1000);
    hit(&mut engine, 800, 900, 999_999, 1000);
    let state = engine.live_state(2000);
    let target = &state.targets[0];
    assert_eq!(target.damage, 300);
    assert_eq!(target.participant_count, 2);
    assert_eq!(target.participants[0].id, 22);
    assert!(!target.participants[0].identity_confirmed);
}

#[test]
fn focus_switches_on_own_hits_and_clears_on_gap_completion_or_connection_change() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    hit(&mut engine, 1, 900, 10_000, 1000);
    hit(&mut engine, 1, 901, 10, 2000);
    engine.ingest_event(
        Event::Health {
            id: 901,
            current: 100,
        },
        2400,
    );
    assert_eq!(engine.live_state(2500).focused_target_id, Some(901));
    engine.capture_loss();
    let lost = engine.live_state(2500);
    assert_eq!(lost.focused_target_id, None);
    assert!(lost.targets.iter().all(|row| row.own_last_hit_ms.is_none()));
    let previous_hp = lost.targets.iter().find(|row| row.id == 901).unwrap();
    assert_eq!(previous_hp.current_hp, Some(100));
    assert_eq!(previous_hp.current_hp_observed_at_ms, None);
    hit(&mut engine, 1, 901, 10, 2600);
    let resumed = engine.live_state(2700);
    assert_eq!(resumed.focused_target_id, Some(901));
    assert!(
        !resumed
            .targets
            .iter()
            .find(|row| row.id == 901)
            .unwrap()
            .capture_complete
    );
    engine.tick(12_600);
    assert_eq!(engine.live_state(12_600).focused_target_id, None);
    engine.connection_changed();
    assert_eq!(engine.live_state(12_700).focused_target_id, None);
}

#[test]
fn current_hp_timestamp_does_not_refresh_when_only_a_maximum_is_received_and_zero_is_kept() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    hit(&mut engine, 1, 900, 100, 1000);
    engine.ingest_event(
        Event::Assistance(AssistEvent::Health {
            actor_id: 900,
            current_hp: Some(50),
            reported_max_hp: Some(100),
        }),
        1500,
    );
    engine.ingest_event(
        Event::Assistance(AssistEvent::Health {
            actor_id: 900,
            current_hp: None,
            reported_max_hp: Some(200),
        }),
        2500,
    );
    let state = engine.live_state(3000);
    let target = &state.targets[0];
    assert_eq!(target.current_hp, Some(50));
    assert_eq!(target.reported_max_hp, Some(200));
    assert_eq!(target.health_observed_at_ms, Some(2500));
    assert_eq!(target.current_hp_observed_at_ms, Some(1500));
    engine.ingest_event(
        Event::Health {
            id: 900,
            current: 0,
        },
        3500,
    );
    let state = engine.live_state(3600);
    assert_eq!(state.targets[0].current_hp, Some(0));
    assert_eq!(state.targets[0].current_hp_observed_at_ms, Some(3500));
}

#[test]
fn contribution_payload_is_bounded_but_the_focused_target_keeps_its_board() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    identity(&mut engine, 2, "Other", false);
    for index in 0..65 {
        hit(&mut engine, 2, 1000 + index, 1000 - index, 1000);
    }
    hit(&mut engine, 1, 1064, 1, 2000);
    let state = engine.live_state(2500);
    assert_eq!(state.targets.len(), 65);
    assert_eq!(
        state
            .targets
            .iter()
            .filter(|target| target.participants_available)
            .count(),
        64
    );
    assert!(
        state
            .targets
            .iter()
            .find(|target| target.id == 1064)
            .unwrap()
            .participants_available
    );
    assert_eq!(state.focused_target_id, Some(1064));
}

#[test]
fn legacy_target_records_deserialize_without_new_scope_or_hp_claims() {
    let target: TargetState =
        serde_json::from_str(r#"{"id":900,"name":"Old target","damage":100}"#).unwrap();
    assert!(target.participants.is_empty());
    assert!(!target.participants_available);
    assert!(target.own_participant.is_none());
    assert_eq!(target.current_hp_observed_at_ms, None);
}

#[test]
fn simultaneous_own_hits_on_multiple_targets_do_not_guess_an_active_target() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    hit(&mut engine, 1, 900, 100, 1000);
    hit(&mut engine, 1, 901, 200, 1000);
    assert_eq!(engine.live_state(1500).focused_target_id, None);
    hit(&mut engine, 1, 901, 1, 1501);
    assert_eq!(engine.live_state(1600).focused_target_id, Some(901));
}

#[test]
fn boss_filter_keeps_unmarked_live_target_separate_from_filtered_totals_and_reports() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    identity(&mut engine, 2, "Other", false);
    npc(&mut engine, 900, "Received field target");
    hit(&mut engine, 2, 900, 500, 1000);
    hit(&mut engine, 1, 900, 100, 2000);
    engine.ingest_event(
        Event::Assistance(AssistEvent::Health {
            actor_id: 900,
            current_hp: Some(1500),
            reported_max_hp: Some(2000),
        }),
        2100,
    );
    engine.set_target_mode("boss");
    let state = engine.live_state(2500);
    assert_eq!(state.total_damage, 0);
    assert!(state.targets.is_empty());
    assert!(state.players.iter().all(|player| player.damage == 0));
    assert_eq!(state.all_targets_summary.total_damage, 600);
    assert_eq!(state.all_targets_summary.dps, 400.0);
    assert_eq!(state.all_targets_summary.elapsed_ms, 1500);
    assert_eq!(state.all_targets_summary.personal_total_damage, Some(100));
    assert_eq!(state.all_targets_summary.personal_dps, Some(100.0));
    assert_eq!(state.all_targets_summary.personal_elapsed_ms, Some(500));
    assert_eq!(state.all_targets_summary.party_total_damage, None);
    assert_eq!(state.all_targets_summary.party_dps, None);
    assert_eq!(state.all_targets_summary.party_elapsed_ms, None);
    assert_eq!(state.focused_target_id, Some(900));
    let target = state.live_target.as_ref().unwrap();
    assert_eq!(state.encounter_started_ms, Some(1000));
    assert_eq!(state.observed_targets.len(), 1);
    assert_eq!(state.observed_targets[0].id, 900);
    assert_eq!(target.name, "Received field target");
    assert!(!target.is_boss);
    assert_eq!(target.damage, 600);
    assert_eq!(target.current_hp, Some(1500));
    assert_eq!(target.participant_count, 2);
    assert_eq!(target.participants[0].id, 2);
    assert_eq!(target.own_participant.as_ref().unwrap().damage, 100);
    let report = engine.current_record(2500);
    assert_eq!(report.total_damage, 0);
    assert!(report.targets.is_empty());

    // Repeated mode snapshots update elapsed values; a new hit invalidates
    // both cache slots while preserving the selected filter's totals.
    assert_eq!(
        engine
            .live_state(2600)
            .live_target
            .as_ref()
            .unwrap()
            .elapsed_ms,
        1600
    );
    hit(&mut engine, 1, 900, 20, 2700);
    let boss_mode = engine.live_state(2800);
    assert_eq!(boss_mode.total_damage, 0);
    assert_eq!(boss_mode.live_target.as_ref().unwrap().damage, 620);
    engine.set_target_mode("all");
    let all_mode = engine.live_state(2900);
    assert_eq!(all_mode.total_damage, 620);
    assert_eq!(all_mode.targets[0].damage, 620);
    assert_eq!(all_mode.live_target.as_ref().unwrap().damage, 620);
}

#[test]
fn imported_private_target_boards_cannot_exceed_the_captured_64_board_bound() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    for index in 0..65 {
        hit(&mut engine, 1, 1000 + index, 10, 1000 + index);
    }
    let mut record = engine.current_record(2000);
    assert_eq!(
        record
            .targets
            .iter()
            .filter(|target| target.participants_available)
            .count(),
        64
    );
    for target in &mut record.targets {
        target.participants_available = true;
    }
    assert!(engine.merge_history(&[record]).is_err());
}

#[test]
fn pausing_after_an_idle_personal_target_does_not_rewrite_its_elapsed_time_or_dps() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    identity(&mut engine, 2, "Other", false);
    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Local".into()],
        },
        0,
    );
    hit(&mut engine, 1, 900, 100, 1000);
    hit(&mut engine, 2, 901, 200, 9000);
    let before = engine.live_state(11_000);
    assert_eq!(before.personal_elapsed_ms, 10_000);
    assert_eq!(before.personal_dps, Some(10.0));

    engine.set_paused_at(true, 12_000);
    engine.set_paused_at(false, 22_000);
    hit(&mut engine, 2, 901, 200, 23_000);
    let after = engine.live_state(24_000);
    let original = after
        .targets
        .iter()
        .find(|target| target.id == 900)
        .unwrap();
    assert_eq!(after.personal_elapsed_ms, 10_000);
    assert_eq!(after.party_elapsed_ms, 10_000);
    assert_eq!(after.personal_dps, Some(10.0));
    assert_eq!(after.party_dps, Some(10.0));
    assert_eq!(original.elapsed_ms, 10_000);
    assert_eq!(original.own_participant.as_ref().unwrap().dps, 10.0);
    let other = after
        .targets
        .iter()
        .find(|target| target.id == 901)
        .unwrap();
    assert_eq!(other.elapsed_ms, 5000);
    assert_eq!(other.participants[0].dps, 80.0);
}

#[test]
fn pausing_inside_a_personal_target_window_does_not_spend_its_idle_time() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    identity(&mut engine, 2, "Other", false);
    hit(&mut engine, 1, 900, 100, 1000);
    hit(&mut engine, 2, 901, 100, 1500);
    engine.set_paused_at(true, 2000);
    engine.set_paused_at(false, 12_000);
    hit(&mut engine, 2, 901, 100, 12_500);
    let state = engine.live_state(13_000);
    assert_eq!(state.personal_elapsed_ms, 2000);
    assert_eq!(state.personal_dps, Some(50.0));
    let target = state
        .targets
        .iter()
        .find(|target| target.id == 900)
        .unwrap();
    assert_eq!(target.elapsed_ms, 2000);
    assert_eq!(target.own_participant.as_ref().unwrap().dps, 50.0);
}

#[test]
fn shared_observed_boards_survive_the_boss_filter_and_a_brief_personal_attack_pause() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    identity(&mut engine, 2, "Other", false);
    identity(&mut engine, 3, "Another", false);
    npc(&mut engine, 900, "Received shared target");
    hit(&mut engine, 1, 900, 100, 1000);
    hit(&mut engine, 2, 900, 200, 2000);
    engine.set_target_mode("boss");
    hit(&mut engine, 2, 900, 200, 9000);
    hit(&mut engine, 3, 900, 300, 12_000);
    let state = engine.live_state(12_500);
    assert!(state.encounter_active);
    assert!(state.targets.is_empty());
    assert_eq!(state.total_damage, 0);
    assert_eq!(state.focused_target_id, None);
    assert!(state.live_target.is_none());
    assert_eq!(state.encounter_started_ms, Some(1000));
    let target = &state.observed_targets[0];
    assert!(!target.is_boss);
    assert_eq!(target.id, 900);
    assert_eq!(target.participant_count, 3);
    assert_eq!(target.damage, 800);
    assert_eq!(target.own_last_hit_ms, Some(1000));
    assert_eq!(target.last_hit_ms, Some(12_000));
    assert_eq!(target.own_participant.as_ref().unwrap().damage, 100);
    assert_eq!(engine.current_record(12_500).total_damage, 0);

    engine.capture_loss();
    let state = engine.live_state(12_600);
    assert!(!state.observed_targets[0].capture_complete);
    assert_eq!(state.observed_targets[0].own_last_hit_ms, None);
}

#[test]
fn a_shared_observed_board_without_a_personal_hit_is_selectable_but_not_an_automatic_focus() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    identity(&mut engine, 2, "Other", false);
    identity(&mut engine, 3, "Another", false);
    hit(&mut engine, 2, 900, 200, 1000);
    hit(&mut engine, 3, 900, 300, 2000);
    engine.set_target_mode("boss");
    let state = engine.live_state(2500);
    assert!(state.targets.is_empty());
    assert!(state.live_target.is_none());
    assert_eq!(state.focused_target_id, None);
    assert_eq!(state.encounter_started_ms, Some(1000));
    let target = &state.observed_targets[0];
    assert_eq!(target.participant_count, 2);
    assert!(target.own_participant.is_none());
    assert_eq!(target.own_last_hit_ms, None);
    assert_eq!(target.party_total_damage, None);
    assert_eq!(target.participants[0].id, 3);
    assert_eq!(target.participants[0].dps, 200.0);
}

#[test]
fn observed_board_choices_remain_bounded_and_prioritize_the_actual_focus() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    identity(&mut engine, 2, "Other", false);
    identity(&mut engine, 3, "Another", false);
    for index in 0..110 {
        hit(&mut engine, 2, 1000 + index, 1000 - index, 1000);
        hit(&mut engine, 3, 1000 + index, 1000 - index, 1000);
    }
    hit(&mut engine, 1, 1109, 1, 2000);
    engine.set_target_mode("boss");
    let state = engine.live_state(2500);
    assert!(state.targets.is_empty());
    assert_eq!(state.observed_targets.len(), 64);
    assert_eq!(state.observed_targets[0].id, 1109);
    assert!(state
        .observed_targets
        .iter()
        .all(|target| target.participants_available && target.participants.len() <= 10));
    assert_eq!(
        state.observed_targets[0]
            .own_participant
            .as_ref()
            .unwrap()
            .damage,
        1
    );
}

#[test]
fn finishing_a_paused_session_keeps_saved_rates_within_the_declared_end_time() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    hit(&mut engine, 1, 900, 100, 1000);
    hit(&mut engine, 1, 900, 200, 3000);
    engine.set_paused_at(true, 4000);
    assert_eq!(engine.live_state(8000).personal_elapsed_ms, 3000);

    // A connection end closes at its last received hit, before the pause.
    engine.connection_changed();
    let record = engine.history_snapshot().1.remove(0);
    assert_eq!(record.started_ms, 1000);
    assert_eq!(record.ended_ms, 3000);
    assert_eq!(record.elapsed_ms, 2000);
    assert_eq!(record.personal_elapsed_ms, 2000);
    assert_eq!(record.dps, 150.0);
    assert_eq!(record.personal_dps, Some(150.0));
    assert_eq!(record.targets[0].elapsed_ms, 2000);
    assert_eq!(record.targets[0].participants[0].dps, 150.0);
    let current = engine.live_state(10_000);
    assert_eq!(current.elapsed_ms, record.elapsed_ms);
    assert_eq!(current.dps, record.dps);
}

#[test]
fn unfiltered_summary_preserves_a_known_observed_zero_without_guessing_party_membership() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    identity(&mut engine, 2, "Other", false);
    hit(&mut engine, 2, 900, 100, 1000);
    engine.set_target_mode("boss");
    let state = engine.live_state(2000);
    assert_eq!(state.all_targets_summary.total_damage, 100);
    assert_eq!(state.all_targets_summary.personal_total_damage, Some(0));
    assert_eq!(state.all_targets_summary.personal_dps, Some(0.0));
    assert_eq!(state.all_targets_summary.personal_elapsed_ms, Some(0));
    assert_eq!(state.all_targets_summary.party_total_damage, None);
    assert_eq!(state.all_targets_summary.party_dps, None);
    assert_eq!(state.all_targets_summary.party_elapsed_ms, None);

    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Local".into()],
        },
        2100,
    );
    let state = engine.live_state(2500);
    assert_eq!(state.all_targets_summary.party_total_damage, Some(0));
    assert_eq!(state.all_targets_summary.party_dps, Some(0.0));
    assert_eq!(state.all_targets_summary.party_elapsed_ms, Some(0));
    let value = serde_json::to_value(&state.all_targets_summary).unwrap();
    assert_eq!(value["personal_total_damage"], 0);
    assert_eq!(value["personal_elapsed_ms"], 0);
    assert_eq!(value["party_total_damage"], 0);
    assert_eq!(value["party_elapsed_ms"], 0);
}
