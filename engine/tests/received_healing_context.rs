use luma_engine::{
    assistance::{AssistEvent, CastCooldown, CastObservation, HealthObservation},
    character::{
        CharacterBuild, ObservedCombatPower, ObservedSpecies, ObservedSpeciesEffect, ObservedWing,
    },
    packets::{Event, Hit, PartyMember},
    DamageSample, Encounter, MeterEngine, PlayerState, SkillState,
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
fn amount(source: u64, target: u64, value: u64) -> Hit {
    Hit {
        source,
        target,
        amount: value,
        skill: 17_050_000,
        tick: true,
        critical: false,
        flags: 0,
        angle: 0,
    }
}
fn hit(engine: &mut MeterEngine, now: u64) {
    let mut value = amount(1, 10, 100);
    value.tick = false;
    value.skill = 14_090_000;
    engine.ingest_event(Event::Damage(value), now);
}
fn hp(engine: &mut MeterEngine, current: u64, now: u64) {
    engine.ingest_event(
        Event::Assistance(AssistEvent::Health {
            actor_id: 10,
            current_hp: Some(current),
            reported_max_hp: Some(1000),
        }),
        now,
    );
}

#[test]
fn received_heal_is_separate_from_damage_and_cannot_start_damage_training() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    player(&mut engine, 2, false);
    engine.arm_training(60_000).unwrap();
    engine.ingest_event(Event::Healing(amount(1, 2, 83)), 1000);
    let state = engine.live_state(2000);
    assert_eq!(state.total_damage, 0);
    assert_eq!(state.personal_total_damage, Some(0));
    assert_eq!(state.personal_healing, Some(83));
    assert_eq!(state.training.status, "armed");
    assert!(state.players[0].skills.is_empty());
    assert_eq!(state.players[0].healing_skills[0].damage, 83);
    assert_eq!(state.players[0].healing_coverage, "explicit-received");
    let record = engine.current_record(2000);
    assert!(record.damage_samples.is_empty());
    assert_eq!(record.healing_samples.len(), 1);
    assert_eq!(record.healing_samples[0].metric, "healing");
    engine.reset();
    let history = engine.history_snapshot().1;
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].total_damage, 0);
    assert_eq!(history[0].personal_healing, Some(83));
    assert!(engine.current_record(3000).healing_samples.is_empty());
}

#[test]
fn only_known_player_body_healing_is_credited_and_owned_pet_casters_keep_owner() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    player(&mut engine, 2, false);
    for (id, kind) in [(3, 0x5f), (9, 0x0c)] {
        engine.ingest_event(
            Event::Npc {
                id,
                name: None,
                model: 2_920_620,
                kind,
            },
            0,
        );
    }
    engine.ingest_event(Event::Owner { id: 3, owner: 1 }, 0);
    engine.ingest_event(Event::Healing(amount(3, 2, 40)), 1000);
    for (source, target) in [(4, 2), (9, 2), (1, 3), (1, 10)] {
        engine.ingest_event(Event::Healing(amount(source, target, 9000)), 2000);
    }
    let mut classless = amount(1, 1, 9000);
    classless.skill = 20;
    engine.ingest_event(Event::Healing(classless), 2000);
    let record = engine.current_record(3000);
    assert_eq!(record.personal_healing, Some(40));
    assert_eq!(record.healing_samples.len(), 1);
    assert_eq!(
        (
            record.healing_samples[0].source,
            record.healing_samples[0].player_id
        ),
        (3, 1)
    );
    assert_eq!(record.total_damage, 0);
}

#[test]
fn pre_pull_heal_does_not_follow_the_later_outgoing_measurement_window() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    player(&mut engine, 2, false);
    engine.ingest_event(Event::Healing(amount(1, 2, 500)), 1000);
    hit(&mut engine, 2000);
    engine.ingest_event(Event::Healing(amount(1, 2, 83)), 3000);
    let record = engine.current_record(4000);
    assert_eq!(record.started_ms, 2000);
    assert_eq!(record.total_damage, 100);
    assert_eq!(record.personal_healing, Some(83));
    assert_eq!(record.healing_samples.len(), 1);
    assert_eq!(record.healing_samples[0].timestamp_ms, 3000);
    engine.reset();
    assert_eq!(engine.history_snapshot().1[0].personal_healing, Some(83));
}

fn member(id: u32) -> PartyMember {
    PartyMember {
        key: id + 100,
        server: 1304,
        slot: id as u8,
        name: format!("Player{id}"),
        class: 14,
    }
}

#[test]
fn a_changed_party_id_clears_previous_ally_cooldowns_but_same_id_does_not() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    player(&mut engine, 2, false);
    engine.ingest_event(
        Event::PartyContext {
            party_id: 77,
            capacity: 5,
        },
        10,
    );
    engine.ingest_event(
        Event::PartyMembers {
            members: vec![member(1), member(2)],
        },
        20,
    );
    engine.ingest_event(
        Event::Assistance(AssistEvent::Cast(CastObservation {
            actor_id: 2,
            target_id: 10,
            skill_id: 14_220_050,
            duration_ms: None,
            facing: 0.0,
            position: None,
            cooldown: Some(CastCooldown {
                cooldown_ms: Some(81_100),
                charges: None,
                recharge_ms: None,
            }),
        })),
        30,
    );
    assert_eq!(engine.live_state(40).actor_cooldowns.len(), 1);
    engine.ingest_event(
        Event::PartyContext {
            party_id: 77,
            capacity: 5,
        },
        50,
    );
    assert_eq!(engine.live_state(60).actor_cooldowns.len(), 1);
    engine.ingest_event(
        Event::PartyContext {
            party_id: 88,
            capacity: 5,
        },
        70,
    );
    engine.ingest_event(
        Event::PartyMembers {
            members: vec![member(1)],
        },
        80,
    );
    assert!(engine.live_state(90).actor_cooldowns.is_empty());
}

#[test]
fn actual_zone_change_finishes_old_encounter_and_starts_new_context_without_tcp_reset() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    engine.ingest_event(Event::ZoneChange { zone_id: 600001 }, 100);
    engine.set_boss_targets(&[10]);
    hit(&mut engine, 1000);
    hit(&mut engine, 2000);
    engine.ingest_event(Event::ZoneChange { zone_id: 600002 }, 3000);
    let history = engine.history_snapshot().1;
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].context.map_id, Some(600001));
    let session = history[0].context.session_id.clone();
    hit(&mut engine, 4000);
    let record = engine.current_record(5000);
    assert_eq!(record.context.map_id, Some(600002));
    assert_ne!(record.context.session_id, session);
    assert_eq!(record.total_damage, 100);
    assert!(!record.targets[0].is_boss);
    assert_eq!(record.local_player_id, Some(1));
    assert_eq!(engine.live_state(5000).diagnostics.stream_gaps, 0);
}

#[test]
fn current_and_frozen_hp_history_are_clipped_to_actual_record_window() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    hp(&mut engine, 1000, 1000);
    hit(&mut engine, 2000);
    hp(&mut engine, 900, 2100);
    hit(&mut engine, 3000);
    hp(&mut engine, 800, 3100);
    let record = engine.current_record(4000);
    assert!(record.assist.health_history.iter().all(
        |row| row.observed_at_ms >= record.started_ms && row.observed_at_ms <= record.ended_ms
    ));
    assert!(!record
        .assist
        .health_history
        .iter()
        .any(|row| row.observed_at_ms == 1000));
    engine.reset();
    let frozen = engine.history_snapshot().1[0].clone();
    assert!(frozen.assist.health_history.iter().all(
        |row| row.observed_at_ms >= frozen.started_ms && row.observed_at_ms <= frozen.ended_ms
    ));
    hp(&mut engine, 1, 5000);
    assert_eq!(
        engine.history_snapshot().1[0].assist.health_history,
        frozen.assist.health_history
    );
}

fn valid_record() -> Encounter {
    Encounter {
        id: 1,
        started_ms: 1000,
        ended_ms: 2000,
        elapsed_ms: 1000,
        total_damage: 100,
        character_build: Some(CharacterBuild {
            combat_power: Some(ObservedCombatPower {
                current: 356559,
                highest: 400000,
                observed_at_ms: 900,
                source: "server-self".into(),
            }),
            wing: Some(ObservedWing {
                wing_id: 30_500_200,
                skin_id: None,
                observed_at_ms: 950,
                source: "server-self".into(),
            }),
            species: (2..=6)
                .map(|species_id| ObservedSpecies {
                    species_id,
                    level: 12,
                    progress: 0,
                    effects: vec![],
                })
                .collect(),
            species_observed_at_ms: Some(950),
            ..Default::default()
        }),
        healing_samples: vec![DamageSample {
            timestamp_ms: 1500,
            source: 1,
            player_id: 1,
            target: 2,
            skill: 17_050_000,
            amount: 83,
            metric: "healing".into(),
            ..Default::default()
        }],
        ..Default::default()
    }
}

#[test]
fn new_nested_import_fields_reject_invalid_bounds_before_restore_or_merge() {
    let valid = valid_record();
    let mut imported = MeterEngine::default();
    assert!(imported.merge_history(&[valid.clone()]).is_ok());
    let archive = imported.history_snapshot().1;
    assert_eq!(archive[0].source, "imported");
    assert_eq!(archive[0].context.source, "imported");
    let build = archive[0].character_build.as_ref().unwrap();
    assert_eq!(build.source, "imported");
    assert_eq!(build.combat_power.as_ref().unwrap().source, "imported");
    assert_eq!(build.wing.as_ref().unwrap().source, "imported");
    let mut bad_values = Vec::new();
    let mut bad = valid.clone();
    bad.character_build.as_mut().unwrap().species[0].effects = vec![
        ObservedSpeciesEffect {
            page: 1,
            slot: 0,
            kind: 1,
            stat_id: 42,
            value: 1
        };
        161
    ];
    bad_values.push(bad);
    let mut bad = valid.clone();
    bad.character_build
        .as_mut()
        .unwrap()
        .combat_power
        .as_mut()
        .unwrap()
        .current = 0;
    bad_values.push(bad);
    let mut bad = valid.clone();
    bad.character_build
        .as_mut()
        .unwrap()
        .wing
        .as_mut()
        .unwrap()
        .skin_id = Some(30_500_200);
    bad_values.push(bad);
    let mut bad = valid.clone();
    bad.healing_samples[0].amount = 2_000_000_001;
    bad_values.push(bad);
    let mut bad = valid.clone();
    bad.healing_samples[0].source = 0;
    bad_values.push(bad);
    let mut bad = valid.clone();
    bad.healing_samples[0].timestamp_ms = 2001;
    bad_values.push(bad);
    let mut bad = valid.clone();
    bad.assist.health_history.push(HealthObservation {
        actor_id: 10,
        current_hp: Some(1000),
        reported_max_hp: Some(900),
        observed_at_ms: 1500,
        ..Default::default()
    });
    bad_values.push(bad);
    let mut bad = valid.clone();
    bad.players.push(PlayerState {
        healing_skills: vec![SkillState::default(); 501],
        ..Default::default()
    });
    bad_values.push(bad);
    let mut bad = valid.clone();
    bad.context.map_id = Some(0);
    bad_values.push(bad);
    let mut bad = valid.clone();
    bad.context.zone_observed_at_ms = Some(2001);
    bad_values.push(bad);
    let mut bad = valid;
    bad.personal_hps = Some(f64::NAN);
    bad_values.push(bad);
    for bad in bad_values {
        let mut engine = MeterEngine::default();
        assert!(engine.merge_history(&[bad.clone()]).is_err());
        engine.restore_history(&[bad]);
        assert!(engine.history_snapshot().1.is_empty());
    }
}

#[test]
fn documented_npc_effect_triggered_by_player_skill_is_flagged_without_inflating_dps_or_training() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    engine.ingest_event(
        Event::Npc {
            id: 10,
            name: None,
            model: 2_900_000,
            kind: 0x0c,
        },
        0,
    );
    engine.arm_training(60_000).unwrap();
    hit(&mut engine, 1000);
    let mut proc = amount(1, 10, 122788);
    proc.skill = 14_090_000;
    engine.ingest_event(
        Event::PeriodicDamage {
            hit: proc,
            effect_id: 160_466_011,
        },
        2000,
    );
    let record = engine.current_record(3000);
    assert_eq!(record.total_damage, 100);
    assert_eq!(record.personal_total_damage, Some(100));
    assert_eq!(record.personal_healing, None);
    assert_eq!(record.damage_samples.len(), 1);
    assert!(!record.sample_complete);
    let live = engine.live_state(3000);
    assert_eq!(live.training.total_damage, 100);
    assert_eq!(live.diagnostics.ambiguous_periodic_events, 1);
    assert_eq!(live.diagnostics.ambiguous_periodic_amount, 122788);
    engine.set_paused_at(true, 3100);
    let mut paused_proc = amount(1, 10, 9999);
    paused_proc.skill = 14_090_000;
    engine.ingest_event(
        Event::PeriodicDamage {
            hit: paused_proc,
            effect_id: 160_466_011,
        },
        3200,
    );
    assert_eq!(
        engine
            .live_state(3300)
            .diagnostics
            .ambiguous_periodic_events,
        1
    );
    engine.set_paused_at(false, 3400);
    engine.reset();
    hit(&mut engine, 4000);
    assert_eq!(
        engine
            .live_state(5000)
            .diagnostics
            .ambiguous_periodic_events,
        0
    );
    assert!(engine.current_record(5000).sample_complete);
    assert!(!engine.history_snapshot().1[0].sample_complete);
}

#[test]
fn normal_player_dots_and_other_actor_effect_shapes_are_not_broadly_suppressed() {
    for (source, target, effect_id, skill) in [
        (1, 10, 1_400_000_022, 14_090_000), // normal player effect
        (1, 10, 160_466_010, 14_090_000),   // different effect shape
        (1, 10, 160_466_011, 1_604_660),    // NPC-family skill, not player skill
        (1, 11, 160_466_011, 14_090_000),   // target not confirmed NPC
        (9, 10, 160_466_011, 14_090_000),   // caster not a confirmed player
    ] {
        let mut engine = MeterEngine::default();
        player(&mut engine, 1, true);
        engine.ingest_event(
            Event::Npc {
                id: 10,
                name: None,
                model: 2_900_000,
                kind: 0x0c,
            },
            0,
        );
        hit(&mut engine, 1000);
        let mut tick = amount(source, target, 7);
        tick.skill = skill;
        engine.ingest_event(
            Event::PeriodicDamage {
                hit: tick,
                effect_id,
            },
            2000,
        );
        let live = engine.live_state(3000);
        assert_eq!(live.diagnostics.ambiguous_periodic_events, 0);
        if source == 1 {
            assert_eq!(live.total_damage, 107);
        }
    }
}

#[test]
fn a_new_tcp_start_invalidates_live_build_but_preserves_frozen_build_and_raw_self_binding() {
    use luma_engine::character::CharacterEvent;
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    engine.ingest_event(
        Event::Character(CharacterEvent::CombatPower {
            current: 356559,
            highest: 400000,
        }),
        100,
    );
    hit(&mut engine, 1000);
    assert!(engine.live_state(1100).character_available);
    let mut syn = vec![0u8; 40];
    syn[0] = 0x45;
    syn[2..4].copy_from_slice(&40u16.to_be_bytes());
    syn[9] = 6;
    syn[12..16].copy_from_slice(&[10, 0, 0, 1]);
    syn[16..20].copy_from_slice(&[10, 0, 0, 2]);
    syn[20..22].copy_from_slice(&13328u16.to_be_bytes());
    syn[22..24].copy_from_slice(&50000u16.to_be_bytes());
    syn[24..28].copy_from_slice(&100u32.to_be_bytes());
    syn[32] = 0x50;
    syn[33] = 2;
    engine.ingest_tcp(&syn, true, 1200);
    assert!(!engine.live_state(1300).character_available);
    assert!(engine
        .character_snapshot()
        .own
        .as_ref()
        .unwrap()
        .combat_power
        .is_none());
    assert_eq!(
        engine
            .current_record(1300)
            .character_build
            .unwrap()
            .combat_power
            .unwrap()
            .current,
        356559
    );
    engine.ingest_event(
        Event::Cooldown {
            skill: 14_090_000,
            remaining_units: Some(1000),
            charges: None,
        },
        1400,
    );
    assert_eq!(engine.live_state(1500).cooldowns.len(), 1);
    engine.ingest_event(
        Event::Character(CharacterEvent::CombatPower {
            current: 500000,
            highest: 500000,
        }),
        1600,
    );
    assert_eq!(
        engine
            .character_snapshot()
            .own
            .unwrap()
            .combat_power
            .unwrap()
            .current,
        500000
    );
    engine.reset();
    assert_eq!(
        engine.history_snapshot().1[0]
            .character_build
            .as_ref()
            .unwrap()
            .combat_power
            .as_ref()
            .unwrap()
            .current,
        356559
    );
}
