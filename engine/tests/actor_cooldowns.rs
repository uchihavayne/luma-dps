use luma_engine::{
    assistance::{AssistEvent, CastCooldown},
    cooldowns::Ledger,
    packets::{decode, Event},
    MeterEngine,
};

fn variable(mut value: u32) -> Vec<u8> {
    let mut bytes = Vec::new();
    loop {
        let part = (value & 127) as u8;
        value >>= 7;
        bytes.push(if value == 0 { part } else { part | 128 });
        if value == 0 {
            return bytes;
        }
    }
}

fn cast(actor: u32, skill: u32, flags: u8, cooldown: u32, charges: u32, recharge: u32) -> Vec<u8> {
    let mut bytes = vec![2, 0x38];
    bytes.extend(variable(actor));
    bytes.push(flags);
    bytes.extend(skill.to_le_bytes());
    bytes.extend([1, 0]); // Sequence byte, no target position.
    bytes.extend(variable(actor));
    bytes.extend(0f32.to_le_bytes());
    for value in [10_000, 1, cooldown] {
        bytes.extend(variable(value));
    }
    if flags & 4 != 0 {
        bytes.extend(variable(charges));
    }
    if flags & 8 != 0 {
        bytes.extend(variable(recharge));
    }
    bytes
}

fn timing(frame: &[u8]) -> Option<CastCooldown> {
    match decode(frame).unwrap().unwrap() {
        Event::Assistance(AssistEvent::Cast(value)) => value.cooldown,
        _ => panic!("expected an actor-bound cast"),
    }
}

fn own(engine: &mut MeterEngine, actor: u64, name: &str, now: u64) {
    engine.ingest_event(
        Event::Identity {
            id: actor,
            name: name.into(),
            class: Some(14),
            own: true,
        },
        now,
    );
}

fn receive(engine: &mut MeterEngine, frame: &[u8], now: u64) {
    engine.ingest_event(decode(frame).unwrap().unwrap(), now);
}

fn raw(hex: &str) -> Vec<u8> {
    hex.split_ascii_whitespace()
        .map(|part| u8::from_str_radix(part, 16).unwrap())
        .collect()
}

#[test]
fn published_wire_examples_decode_actual_duration_and_independent_charge_fields() {
    // Public protocol examples at Waffle cf885f1, not a private capture.
    let plain = raw("02 38 EF 01 00 12 FB D8 00 52 00 EF 01 85 75 0B 43 BC 9D 01 01 CC F9 04");
    assert_eq!(
        timing(&plain).unwrap(),
        CastCooldown {
            cooldown_ms: Some(81_100),
            charges: None,
            recharge_ms: None
        }
    );
    let charged = raw("02 38 D1 14 0C 98 86 A9 00 0C 00 D1 14 1A D9 E3 42 90 4E 01 00 01 AA 6F");
    assert_eq!(
        timing(&charged).unwrap(),
        CastCooldown {
            cooldown_ms: None,
            charges: Some(1),
            recharge_ms: Some(14_250)
        }
    );
    let empty = raw("02 38 D1 14 08 98 86 A9 00 3B 00 D1 14 1C CD E5 42 90 4E 01 00 84 20");
    assert_eq!(
        timing(&empty).unwrap(),
        CastCooldown {
            cooldown_ms: None,
            charges: Some(0),
            recharge_ms: Some(4100)
        }
    );
}

#[test]
fn known_tail_is_exactly_consumed_and_unknown_shapes_keep_only_cast_evidence() {
    let valid = cast(8, 14_220_050, 0, 81_100, 0, 0);
    assert_eq!(timing(&valid).unwrap().cooldown_ms, Some(81_100));
    let mut trailing = valid.clone();
    trailing.push(0);
    assert!(timing(&trailing).is_none());
    let mut truncated = valid.clone();
    truncated.pop();
    assert!(timing(&truncated).is_none());
    assert!(timing(&cast(8, 14_220_050, 0x10, 81_100, 0, 0)).is_none());
    assert!(timing(&cast(8, 14_220_050, 0x0c, 50, 1, 1000)).is_none());
    assert!(timing(&cast(8, 14_220_050, 0x0c, 0, 10, 1000)).is_none());
    assert!(timing(&cast(8, 14_220_050, 0, 3_600_001, 0, 0)).is_none());
    for end in 0..valid.len() {
        if let Ok(Some(Event::Assistance(AssistEvent::Cast(value)))) = decode(&valid[..end]) {
            assert!(value.cooldown.is_none());
        }
    }
}

#[test]
fn multi_target_coordinates_never_become_the_last_cooldown_varint() {
    let mut frame = cast(8, 14_220_050, 0x20, 40_000, 0, 0);
    frame.extend(variable(2));
    for actor in [9, 10] {
        frame.extend(variable(actor));
        for position in [1.5f32, 2.5, 3.5] {
            frame.extend(position.to_le_bytes());
        }
    }
    assert_eq!(timing(&frame).unwrap().cooldown_ms, Some(40_000));
    let mut bad = frame.clone();
    bad.pop();
    assert!(timing(&bad).is_none());
    let mut nonfinite = frame.clone();
    let end = nonfinite.len();
    nonfinite[end - 4..].copy_from_slice(&f32::NAN.to_le_bytes());
    assert!(timing(&nonfinite).is_none());
}

#[test]
fn all_actors_get_separate_native_deadlines_without_room_or_damage_prerequisites() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, "Local", 1000);
    for (id, name) in [(8, "First"), (9, "Second")] {
        engine.ingest_event(
            Event::Identity {
                id,
                name: name.into(),
                class: Some(14),
                own: false,
            },
            1100,
        );
    }
    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Local".into(), "First".into(), "Second".into()],
        },
        1200,
    );
    for actor in [7, 8, 9] {
        receive(&mut engine, &cast(actor, 14_220_050, 0, 81_100, 0, 0), 2000);
    }
    let state = engine.live_state(22_000);
    assert_eq!(state.total_damage, 0);
    assert_eq!(state.actor_cooldowns.len(), 3);
    for row in &state.actor_cooldowns {
        assert_eq!(row.remaining_ms, Some(61_100));
        assert_eq!(row.unit, "milliseconds");
        assert_eq!(row.source, "server-cast");
        assert!(row.fresh);
        assert!(!row.ready_confirmed);
        assert_eq!(row.readiness, "cooling");
    }
    assert_eq!(state.cooldowns.len(), 1);
    assert_eq!(state.cooldowns[0]["actor_id"], 7);
    assert_eq!(state.cooldowns[0]["remaining_ms"], 61_100);
    assert_eq!(
        state.cooldowns[0]["raw_remaining_units"],
        serde_json::Value::Null
    );
    assert_eq!(state.party_membership_source, "server");
}

#[test]
fn elapsed_and_provisional_cast_deadlines_never_mean_server_ready() {
    let mut ledger = Ledger::default();
    ledger.observe_actor_cooldown(8, 14_220_050, 1000, 1000);
    let initial = &ledger.snapshot(1100).actors[0];
    assert_eq!(initial.readiness, "provisional");
    assert!(!initial.ready_confirmed);
    let elapsed = &ledger.snapshot(2001).actors[0];
    assert_eq!(elapsed.readiness, "elapsed");
    assert_eq!(elapsed.remaining_ms, Some(0));
    assert!(!elapsed.ready_confirmed);
    assert_eq!(ledger.snapshot(32_001).actors[0].readiness, "stale");
}

#[test]
fn own_counter_zero_can_confirm_only_its_ordinary_matching_skill_family() {
    let mut ledger = Ledger::default();
    ledger.bind_self(Some(7));
    ledger.observe_actor_cooldown(7, 14_220_050, 81_100, 1000);
    ledger.observe_actor_cooldown(8, 14_220_050, 81_100, 1000);
    ledger.observe_local(14_220_000, Some(0), None, 1300);
    let rows = ledger.snapshot(1400).actors;
    assert!(rows[0].ready_confirmed);
    assert_eq!(
        rows[0].confirmation_source.as_deref(),
        Some("local-counter-zero")
    );
    assert!(!rows[1].ready_confirmed);
    assert!(!ledger.snapshot(7301).actors[0].ready_confirmed);
    ledger.observe_local(14_220_000, Some(5000), None, 1500);
    assert!(ledger
        .snapshot(1500)
        .actors
        .iter()
        .all(|row| row.actor_id != 7));
    ledger.observe_actor_charges(7, 14_090_450, 0, 5000, 1500, false);
    ledger.observe_local(14_090_000, Some(0), None, 1600);
    let charge = ledger
        .snapshot(1700)
        .actors
        .into_iter()
        .find(|row| row.skill_family_id == 14_090_000)
        .unwrap();
    assert!(!charge.ready_confirmed);
    assert_eq!(charge.charges, Some(0));
    assert_eq!(charge.recharge_remaining_ms, Some(4800));
}

#[test]
fn charges_and_recharge_are_separate_and_elapsed_timer_does_not_increment_count() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, "Local", 1000);
    engine.ingest_event(
        Event::Identity {
            id: 8,
            name: "Ally".into(),
            class: Some(14),
            own: false,
        },
        1100,
    );
    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Local".into(), "Ally".into()],
        },
        1200,
    );
    receive(&mut engine, &cast(8, 11_110_040, 0x0c, 0, 1, 14_250), 2000);
    let first = engine.live_state(2500).actor_cooldowns.remove(0);
    assert_eq!(first.charges, Some(1));
    assert_eq!(first.max_charges, None);
    assert!(first.available_use_confirmed);
    assert!(!first.ready_confirmed);
    assert_eq!(first.cooldown_ms, None);
    assert_eq!(first.remaining_ms, None);
    receive(&mut engine, &cast(8, 11_110_040, 8, 0, 0, 4100), 12_050);
    let empty = engine.live_state(12_550).actor_cooldowns.remove(0);
    assert_eq!(empty.charges, Some(0));
    assert_eq!(empty.recharge_remaining_ms, Some(3600));
    assert!(!empty.available_use_confirmed);
    let elapsed = engine.live_state(17_000).actor_cooldowns.remove(0);
    assert_eq!(elapsed.charges, Some(0));
    assert_eq!(elapsed.readiness, "elapsed");
    assert!(!elapsed.ready_confirmed);
    assert!(!elapsed.available_use_confirmed);
}

#[test]
fn self_charge_notice_masks_are_exact_and_never_attach_to_an_ally() {
    for (bytes, count, recharge) in [
        ("22 38 03 98 86 A9 00 01 E8 6B", 1, 13_800),
        ("22 38 02 98 86 A9 00 C2 1C", 0, 3650),
        ("22 38 01 D2 00 D7 00 02", 2, 0),
    ] {
        let event = decode(&raw(bytes)).unwrap().unwrap();
        assert!(
            matches!(event, Event::SkillCharges { charges, recharge_ms, .. } if charges == count && recharge_ms == recharge)
        );
        let mut engine = MeterEngine::default();
        engine.ingest_event(event.clone(), 1000);
        assert!(engine.live_state(1100).actor_cooldowns.is_empty());
        own(&mut engine, 7, "Local", 1200);
        engine.ingest_event(event, 1300);
        let row = engine.live_state(1400).actor_cooldowns.remove(0);
        assert_eq!(row.actor_id, 7);
        assert_eq!(row.source, "server-charge");
        assert_eq!(row.charges, Some(count));
        assert_eq!(row.ready_confirmed, count > 0 && recharge == 0);
    }
    for bytes in [
        "22 38 95 98 86 A9 00 01 E8 6B",
        "22 38 00 98 86 A9 00",
        "22 38 03 98 86 A9 00 01 E8 6B 00",
        "22 38 03 98 86 A9 00 01 E8",
        "22 38 01 6A C5 4A 00 03",
    ] {
        assert!(decode(&raw(bytes)).is_err());
    }
}

#[test]
fn a_new_cast_can_replace_a_variant_but_no_shared_group_is_guessed() {
    let mut ledger = Ledger::default();
    ledger.observe_actor_cooldown(8, 14_220_050, 80_000, 1000);
    ledger.observe_actor_cooldown(8, 14_220_020, 60_000, 2000);
    ledger.observe_actor_cooldown(8, 14_230_020, 40_000, 2000);
    let state = ledger.snapshot(3000);
    assert_eq!(state.actors.len(), 2);
    assert_eq!(state.actors[0].skill_id, 14_220_020);
    assert_eq!(state.actors[0].remaining_ms, Some(59_000));
    ledger.observe_actor_cooldown(8, 14_220_050, 0, 3500);
    assert_eq!(ledger.snapshot(3500).actors[0].remaining_ms, Some(58_500));
}

#[test]
fn binding_capture_loss_death_identity_reuse_and_clock_reversal_invalidate_timing() {
    let mut engine = MeterEngine::default();
    receive(&mut engine, &cast(8, 14_220_050, 0, 80_000, 0, 0), 1000);
    own(&mut engine, 7, "Local", 1100);
    assert!(engine.live_state(1200).actor_cooldowns.is_empty());
    engine.ingest_event(
        Event::Identity {
            id: 8,
            name: "First".into(),
            class: Some(14),
            own: false,
        },
        1300,
    );
    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Local".into(), "First".into()],
        },
        1350,
    );
    assert_eq!(engine.live_state(1400).actor_cooldowns.len(), 1);
    engine.ingest_event(
        Event::Identity {
            id: 8,
            name: "Different".into(),
            class: Some(14),
            own: false,
        },
        1500,
    );
    assert!(engine.live_state(1600).actor_cooldowns.is_empty());
    receive(&mut engine, &cast(8, 14_220_050, 0, 80_000, 0, 0), 1700);
    engine.ingest_event(Event::Removed { id: 8, death: true }, 1800);
    assert!(engine.live_state(1900).actor_cooldowns.is_empty());
    receive(&mut engine, &cast(9, 14_220_050, 0, 80_000, 0, 0), 2000);
    engine.capture_loss();
    assert!(engine.live_state(2100).actor_cooldowns.is_empty());
    receive(&mut engine, &cast(9, 14_220_050, 0, 80_000, 0, 0), 2200);
    assert!(engine.live_state(2100).actor_cooldowns.is_empty());
    engine.connection_changed();
    assert!(engine.live_state(2300).actor_cooldowns.is_empty());
}

#[test]
fn actor_counter_storage_is_bounded_and_invalid_observations_do_not_invalidate_it() {
    let mut ledger = Ledger::default();
    for actor in 1..=1200 {
        ledger.observe_actor_cooldown(actor, 14_220_050, 50_000, actor);
    }
    assert_eq!(ledger.snapshot(2000).actors.len(), 1024);
    assert_eq!(ledger.snapshot(2000).actors[0].actor_id, 177);
    ledger.observe_actor_cooldown(0, 14_220_050, 50_000, 2100);
    ledger.observe_actor_cooldown(1201, 1, 50_000, 2100);
    ledger.observe_actor_charges(1201, 14_220_050, 10, 1000, 2100, false);
    ledger.observe_actor_charges(1201, 14_220_050, 1, 3_600_001, 2100, false);
    assert_eq!(ledger.snapshot(2200).actors.len(), 1024);
}
