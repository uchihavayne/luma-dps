use luma_engine::{
    packets::{decode, Event, Hit},
    Encounter, MeterEngine,
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
    );
}

#[test]
fn strangers_on_the_same_target_are_not_personal_or_party_damage() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    identity(&mut engine, 2, "Friend", false);
    identity(&mut engine, 3, "Stranger", false);
    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Local".into(), "Friend".into()],
        },
        0,
    );
    hit(&mut engine, 3, 10, 900, 1000);
    hit(&mut engine, 1, 10, 100, 2000);
    hit(&mut engine, 2, 10, 200, 3000);
    let state = engine.live_state(4000);
    assert_eq!(state.total_damage, 1200);
    assert_eq!(state.personal_total_damage, Some(100));
    assert_eq!(state.personal_elapsed_ms, 2000);
    assert_eq!(state.personal_dps, Some(50.0));
    assert_eq!(state.party_total_damage, Some(300));
    assert_eq!(state.personal_targets[0].damage, 100);
    assert_eq!(state.party_targets[0].damage, 300);
    assert_eq!(
        state
            .players
            .iter()
            .filter(|player| player.is_local)
            .count(),
        1
    );
    assert!(
        !state
            .players
            .iter()
            .find(|player| player.id == 3)
            .unwrap()
            .in_party
    );
}

#[test]
fn an_unknown_local_identity_is_null_and_never_the_largest_attacker() {
    let mut engine = MeterEngine::default();
    hit(&mut engine, 1, 10, 9000, 1000);
    hit(&mut engine, 2, 10, 100, 1000);
    let state = engine.live_state(2000);
    assert_eq!(state.local_player_id, None);
    assert_eq!(state.personal_total_damage, None);
    assert_eq!(state.personal_dps, None);
    assert_eq!(state.party_total_damage, None);
    assert_eq!(state.local_identity_source, "unresolved");
}

#[test]
fn explicit_mid_session_binding_names_an_unnamed_observed_row() {
    let mut engine = MeterEngine::default();
    hit(&mut engine, 1, 10, 1000, 1000);
    hit(&mut engine, 2, 10, 100, 1000);
    engine.set_local_player(Some(2), "MyRanger").unwrap();
    let state = engine.live_state(2000);
    assert_eq!(state.local_player_id, Some(2));
    assert_eq!(state.local_player_name, "MyRanger");
    assert_eq!(state.local_identity_source, "manual");
    assert_eq!(state.personal_total_damage, Some(100));
    assert!(
        !state
            .players
            .iter()
            .find(|row| row.id == 2)
            .unwrap()
            .identity_confirmed
    );
    assert!(engine.set_local_player(Some(99), "Arbitrary").is_err());
}

#[test]
fn manual_and_name_selected_actors_cannot_bind_actorless_cooldown_packets() {
    let mut engine = MeterEngine::default();
    hit(&mut engine, 7, 10, 100, 1000);
    engine.set_local_player(Some(7), "Local").unwrap();
    let event = Event::Cooldown {
        skill: 13_130_000,
        remaining_units: Some(6000),
        charges: None,
    };
    engine.ingest_event(event.clone(), 2000);
    assert!(engine.live_state(3000).cooldowns.is_empty());
    identity(&mut engine, 7, "Local", false);
    engine.set_local_player(None, "Local").unwrap();
    engine.ingest_event(event.clone(), 3000);
    assert!(engine.live_state(3000).cooldowns.is_empty());
    identity(&mut engine, 7, "Local", true);
    engine.ingest_event(event, 4000);
    let row = engine.live_state(5000).cooldowns.remove(0);
    assert_eq!(row["actor_id"], 7);
    assert_eq!(row["raw_remaining_units"], 6000);
    assert_eq!(row["estimated_remaining_ms"], serde_json::Value::Null);
    assert_eq!(row["source"], "local-server");
    engine.connection_changed();
    assert!(engine.live_state(5000).cooldowns.is_empty());
}

#[test]
fn received_self_cooldowns_never_move_to_a_manually_selected_actor() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 7, "First", true);
    identity(&mut engine, 8, "Second", false);
    let event = Event::Cooldown {
        skill: 13_130_000,
        remaining_units: Some(6000),
        charges: None,
    };
    engine.ingest_event(event.clone(), 2000);
    assert_eq!(engine.live_state(3000).cooldowns[0]["actor_id"], 7);
    assert!(engine.set_local_player(Some(8), "Second").is_err());
    engine.ingest_event(event.clone(), 3100);
    assert_eq!(engine.live_state(3200).cooldowns[0]["actor_id"], 7);
    identity(&mut engine, 8, "Second", true);
    assert!(engine.live_state(3300).cooldowns.is_empty());
    engine.ingest_event(event, 3400);
    assert_eq!(engine.live_state(3500).cooldowns[0]["actor_id"], 8);
}

#[test]
fn calibrated_self_cooldowns_are_estimates_and_only_received_zero_is_ready() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 7, "Local", true);
    for (at, raw, charges) in [
        (2000, 12000, Some(1)),
        (2500, 10000, None),
        (3000, 8000, None),
        (3500, 6000, None),
    ] {
        engine.ingest_event(
            Event::Cooldown {
                skill: 13_130_000,
                remaining_units: Some(raw),
                charges,
            },
            at,
        );
    }
    let row = engine.live_state(4000).cooldowns.remove(0);
    assert_eq!(row["readiness"], "estimated-cooling");
    assert_eq!(row["estimated_remaining_ms"], 1000);
    assert_eq!(row["raw_remaining_units"], 6000);
    assert_eq!(row["charges"], 1);
    assert_eq!(row["charges_observed_at_ms"], 2000);
    assert_eq!(row["observed_at_ms"], 3500);
    let elapsed = engine.live_state(5100).cooldowns.remove(0);
    assert_eq!(elapsed["readiness"], "estimated-elapsed");
    assert_eq!(elapsed["ready_confirmed"], false);
    engine.ingest_event(
        Event::Cooldown {
            skill: 13_130_000,
            remaining_units: Some(0),
            charges: None,
        },
        5200,
    );
    assert_eq!(
        engine.live_state(5300).cooldowns[0]["readiness"],
        "server-ready"
    );
    engine.ingest_event(
        Event::Cooldown {
            skill: 13_130_000,
            remaining_units: None,
            charges: Some(2),
        },
        5400,
    );
    let row = engine.live_state(5500).cooldowns.remove(0);
    assert_eq!(row["readiness"], "unknown");
    assert_eq!(row["ready_confirmed"], false);
    assert_eq!(row["raw_remaining_units"], 0);
    assert_eq!(row["charges"], 2);
}

#[test]
fn cooldown_storage_is_bounded_and_rejects_invalid_observations() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 7, "Local", true);
    for skill in 1..=700 {
        engine.ingest_event(
            Event::Cooldown {
                skill,
                remaining_units: Some(6000),
                charges: None,
            },
            2000 + u64::from(skill),
        );
    }
    let state = engine.live_state(3000);
    assert_eq!(state.cooldowns.len(), 512);
    assert_eq!(state.cooldowns[0]["skill_id"], 189);
    for invalid in [
        Event::Cooldown {
            skill: 0,
            remaining_units: Some(1),
            charges: None,
        },
        Event::Cooldown {
            skill: 800,
            remaining_units: Some(3_600_001),
            charges: None,
        },
        Event::Cooldown {
            skill: 801,
            remaining_units: Some(1),
            charges: Some(101),
        },
    ] {
        engine.ingest_event(invalid, 4000);
    }
    let state = engine.live_state(5000);
    assert_eq!(state.cooldowns.len(), 512);
    assert_eq!(state.cooldowns[0]["skill_id"], 189);
}

#[test]
fn typed_names_require_one_authoritative_match_and_late_identity_resolves() {
    let mut engine = MeterEngine::default();
    engine.set_character_name("Ranger");
    hit(&mut engine, 1, 10, 100, 1000);
    assert_eq!(engine.live_state(2000).personal_total_damage, None);
    identity(&mut engine, 1, "Ranger", false);
    assert_eq!(engine.live_state(2000).local_identity_source, "name-match");
    assert_eq!(engine.live_state(2000).personal_total_damage, Some(100));
    identity(&mut engine, 2, "Ranger", false);
    assert_eq!(engine.live_state(2000).local_player_id, None);
}

#[test]
fn an_alias_does_not_change_party_membership_or_override_server_local_identity() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Actual", true);
    identity(&mut engine, 2, "Stranger", false);
    engine.set_character_name("Stranger");
    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Actual".into()],
        },
        0,
    );
    hit(&mut engine, 1, 10, 100, 1000);
    hit(&mut engine, 2, 10, 900, 1000);
    let state = engine.live_state(2000);
    assert_eq!(state.local_player_id, Some(1));
    assert_eq!(state.party_member_ids, vec![1]);
    assert_eq!(state.party_total_damage, Some(100));
    assert!(engine.set_local_player(Some(2), "Other").is_err());
}

#[test]
fn stale_saved_name_preferences_never_rename_a_different_server_character() {
    let mut engine = MeterEngine::default();
    engine.set_character_name("Old");
    identity(&mut engine, 1, "Old", true);
    identity(&mut engine, 2, "New", true);
    engine.set_character_name("Old");
    assert_eq!(engine.live_state(0).local_player_name, "New");
    assert_eq!(engine.live_state(0).local_player_id, Some(2));
}

#[test]
fn party_classes_join_only_unique_authoritative_names_and_never_aliases() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Friend".into()],
        },
        0,
    );
    engine.ingest_event(
        Event::PartyProfiles {
            members: vec![("Friend".into(), 14)],
        },
        0,
    );
    engine.ingest_event(
        Event::Identity {
            id: 2,
            name: "Friend".into(),
            class: None,
            own: false,
        },
        0,
    );
    hit(&mut engine, 2, 10, 100, 1000);
    assert_eq!(engine.live_state(2000).players[0].class_name, "Ranger");
    engine.ingest_event(
        Event::Identity {
            id: 3,
            name: "Friend".into(),
            class: None,
            own: false,
        },
        0,
    );
    assert_eq!(engine.live_state(2000).players[0].class_name, "Unknown");
    engine.set_local_player(Some(2), "Other").unwrap();
    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Other".into()],
        },
        0,
    );
    engine.ingest_event(
        Event::PartyProfiles {
            members: vec![("Other".into(), 30)],
        },
        0,
    );
    assert_eq!(engine.live_state(2000).players[0].class_name, "Unknown");
}

#[test]
fn roster_members_resolve_late_and_leaving_replaces_membership() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Local".into(), "Friend".into()],
        },
        0,
    );
    hit(&mut engine, 2, 10, 200, 1000);
    hit(&mut engine, 1, 10, 100, 1000);
    assert_eq!(engine.live_state(2000).party_total_damage, Some(100));
    identity(&mut engine, 2, "Friend", false);
    assert_eq!(engine.live_state(2000).party_total_damage, Some(300));
    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Local".into()],
        },
        3000,
    );
    assert_eq!(engine.live_state(3000).party_total_damage, Some(100));
}

#[test]
fn a_dead_party_member_and_named_local_keep_their_prior_damage() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", false);
    identity(&mut engine, 2, "Friend", false);
    engine.set_character_name("Local");
    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Local".into(), "Friend".into()],
        },
        0,
    );
    hit(&mut engine, 1, 10, 100, 1000);
    hit(&mut engine, 2, 10, 200, 1000);
    engine.ingest_event(Event::Removed { id: 1, death: true }, 2000);
    engine.ingest_event(Event::Removed { id: 2, death: true }, 2000);
    let state = engine.live_state(3000);
    assert_eq!(state.personal_total_damage, Some(100));
    assert_eq!(state.party_total_damage, Some(300));
    assert_eq!(state.party_member_ids, vec![1, 2]);
    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Local".into()],
        },
        4000,
    );
    assert_eq!(engine.live_state(4000).party_total_damage, Some(100));
}

#[test]
fn summon_owner_arriving_before_spawn_credits_only_its_owner() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    identity(&mut engine, 3, "Other", false);
    engine.ingest_event(Event::Owner { id: 2, owner: 1 }, 0);
    engine.ingest_event(
        Event::Npc {
            id: 2,
            name: Some("Local".into()),
            model: 2_920_620,
            kind: 0x5f,
        },
        0,
    );
    hit(&mut engine, 2, 10, 75, 1000);
    hit(&mut engine, 3, 10, 250, 1000);
    let state = engine.live_state(2000);
    assert_eq!(state.personal_total_damage, Some(75));
    assert_eq!(
        state.players.iter().find(|row| row.id == 1).unwrap().damage,
        75
    );
    assert!(engine.set_local_player(Some(2), "Pet").is_err());
}

#[test]
fn explicit_selection_rejects_npc_rows_and_manual_party_never_means_everyone() {
    let mut engine = MeterEngine::default();
    hit(&mut engine, 1, 10, 100, 1000);
    hit(&mut engine, 2, 10, 200, 1000);
    hit(&mut engine, 3, 10, 300, 1000);
    engine.ingest_event(
        Event::Npc {
            id: 3,
            name: None,
            model: 2_900_000,
            kind: 0x0c,
        },
        1000,
    );
    assert!(engine.set_local_player(Some(3), "Mob").is_err());
    assert!(engine.set_party_members(&[3]).is_err());
    engine.set_local_player(Some(1), "Local").unwrap();
    engine.set_party_members(&[1]).unwrap();
    assert_eq!(engine.live_state(2000).party_total_damage, Some(100));
    assert_eq!(engine.live_state(2000).party_membership_source, "manual");
}

#[test]
fn connection_changes_clear_entity_bindings_but_keep_scoped_archive() {
    let mut engine = MeterEngine::default();
    hit(&mut engine, 1, 10, 100, 1000);
    hit(&mut engine, 2, 10, 500, 2000);
    engine.set_local_player(Some(1), "Local").unwrap();
    engine.set_party_members(&[1]).unwrap();
    engine.connection_changed();
    let state = engine.live_state(3000);
    assert_eq!(state.local_player_id, None);
    assert_eq!(state.personal_total_damage, None);
    assert_eq!(state.party_total_damage, None);
    assert!(engine.set_local_player(Some(1), "Stale").is_err());
    let history = engine.history_snapshot().1;
    assert_eq!(history[0].local_player_id, Some(1));
    assert_eq!(history[0].personal_total_damage, Some(100));
    assert_eq!(history[0].party_total_damage, Some(100));
}

#[test]
fn switching_characters_clears_alias_and_the_previous_encounter() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Old", true);
    engine.set_local_player(Some(1), "Alias").unwrap();
    hit(&mut engine, 1, 10, 100, 1000);
    identity(&mut engine, 2, "New", true);
    let state = engine.live_state(2000);
    assert_eq!(state.local_player_id, Some(2));
    assert_eq!(state.local_player_name, "New");
    assert_eq!(state.personal_total_damage, Some(0));
    assert_eq!(state.total_damage, 0);
    assert_eq!(engine.history_snapshot().1[0].local_player_name, "Alias");
}

#[test]
fn reset_keeps_a_current_session_binding_and_completed_personal_time_stays_frozen() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    hit(&mut engine, 1, 10, 100, 1000);
    engine.set_paused_at(true, 2000);
    engine.set_paused_at(false, 5000);
    hit(&mut engine, 1, 10, 100, 6000);
    engine.ingest_event(
        Event::Removed {
            id: 10,
            death: true,
        },
        7000,
    );
    assert_eq!(engine.live_state(12000).personal_elapsed_ms, 3000);
    assert_eq!(engine.history_snapshot().1[0].personal_elapsed_ms, 3000);
    engine.reset();
    assert_eq!(engine.live_state(12000).local_player_id, Some(1));
    assert_eq!(engine.live_state(12000).personal_total_damage, Some(0));
}

#[test]
fn a_completed_unnamed_row_can_still_be_explicitly_bound_in_the_same_session() {
    let mut engine = MeterEngine::default();
    hit(&mut engine, 7, 10, 100, 1000);
    engine.ingest_event(
        Event::Removed {
            id: 10,
            death: true,
        },
        2000,
    );
    engine.set_local_player(Some(7), "Local").unwrap();
    assert_eq!(engine.live_state(3000).personal_total_damage, Some(100));
}

#[test]
fn a_manually_identified_player_death_keeps_personal_damage_until_id_reuse() {
    let mut engine = MeterEngine::default();
    hit(&mut engine, 7, 10, 100, 1000);
    engine.set_local_player(Some(7), "Local").unwrap();
    engine.ingest_event(Event::Removed { id: 7, death: true }, 2000);
    assert_eq!(engine.live_state(3000).personal_total_damage, Some(100));
    engine.ingest_event(
        Event::Npc {
            id: 7,
            name: None,
            model: 2_900_000,
            kind: 0x0c,
        },
        4000,
    );
    assert_eq!(engine.live_state(5000).personal_total_damage, None);
    assert_eq!(
        engine.history_snapshot().1[0].personal_total_damage,
        Some(100)
    );
}

#[test]
fn persisted_history_is_bounded_unique_and_does_not_restore_session_identity() {
    let mut records = Vec::new();
    for id in 1..=230 {
        records.push(Encounter {
            id,
            total_damage: 100,
            ended_ms: 10,
            local_player_id: Some(99),
            ..Default::default()
        });
    }
    records.insert(1, records[0].clone());
    let mut engine = MeterEngine::default();
    engine.restore_history(&records);
    assert_eq!(engine.history_snapshot().1.len(), 200);
    assert_eq!(engine.live_state(0).local_player_id, None);
    hit(&mut engine, 1, 10, 100, 1000);
    engine.reset();
    assert!(engine.history_snapshot().1[0].id > 200);
    let legacy: Encounter = serde_json::from_str(r#"{"id":1,"total_damage":100}"#).unwrap();
    assert_eq!(legacy.personal_total_damage, None);
}

fn character_frame(opcode: u8, name: &str, server: u16) -> Vec<u8> {
    let mut frame = vec![opcode, 0x36, 7, 0, 0, 0, 0, 1, name.len() as u8];
    frame.extend_from_slice(name.as_bytes());
    if opcode == 0x33 {
        frame.extend_from_slice(&server.to_le_bytes());
        frame.extend_from_slice(&14u32.to_le_bytes())
    }
    frame
}

#[test]
fn identity_decoding_uses_mask_name_and_self_profile_only() {
    for opcode in [0x33, 0x44, 0x45] {
        assert!(
            matches!(decode(&character_frame(opcode, "弓手", 1304)), Ok(Some(Event::Identity {id: 7, own, ..})) if own == (opcode == 0x33))
        );
    }
    assert!(decode(&character_frame(0x33, "Local", 5)).is_err());
    assert!(decode(&character_frame(0x45, " Local ", 1304)).is_err());
    let mut payload = vec![0x39, 0x38];
    payload.extend(character_frame(0x33, "Local", 1304));
    assert!(decode(&payload).unwrap().is_none());
}

#[test]
fn npc_decoding_accepts_both_documented_mask_widths_without_name_scanning() {
    for width in [2, 4] {
        let mut frame = vec![0x41, 0x36, 7, 0x0c];
        frame.extend(std::iter::repeat_n(0, width - 1));
        frame.extend_from_slice(&[1, 4]);
        frame.extend_from_slice(b"Boss");
        frame.extend_from_slice(&2_900_001u32.to_le_bytes());
        assert!(
            matches!(decode(&frame), Ok(Some(Event::Npc {id: 7, name: Some(name), ..})) if name == "Boss")
        );
    }
}

fn roster(names: &[Option<&str>]) -> Vec<u8> {
    let mut frame = vec![2, 0x97];
    frame.extend_from_slice(&42u32.to_le_bytes());
    frame.extend_from_slice(&[5, b'P', b'a', b'r', b't', b'y', names.len() as u8]);
    frame.extend(std::iter::repeat_n(0, 17));
    frame.push(names.len() as u8);
    for (index, name) in names.iter().enumerate() {
        frame.extend_from_slice(&[if name.is_some() { 12 } else { 0 }, index as u8 + 1]);
        frame.extend_from_slice(&if name.is_some() {
            (1304u64 << 48 | index as u64 + 1).to_le_bytes()
        } else {
            0u64.to_le_bytes()
        });
        if let Some(name) = name {
            frame.push(name.len() as u8);
            frame.extend_from_slice(name.as_bytes());
            frame.extend_from_slice(&14u32.to_le_bytes());
            frame.extend_from_slice(&50u32.to_le_bytes());
            frame.extend_from_slice(&5000u32.to_le_bytes());
            frame.extend_from_slice(&1304u16.to_le_bytes());
            frame.extend_from_slice(&1304u16.to_le_bytes());
            frame.push(4);
            frame.extend_from_slice(&850_000u64.to_le_bytes());
            frame.extend_from_slice(&[0, 1, 1]);
        } else {
            frame.extend(std::iter::repeat_n(0, 27));
        }
    }
    frame
}

#[test]
fn framed_party_rosters_include_later_filled_slots_and_reject_truncation() {
    let frame = roster(&[Some("Local"), None, Some("Friend")]);
    assert_eq!(
        decode(&frame),
        Ok(Some(Event::PartyMembers {
            members: vec![
                luma_engine::packets::PartyMember {
                    key: 1,
                    server: 1304,
                    slot: 1,
                    name: "Local".into(),
                    class: 14
                },
                luma_engine::packets::PartyMember {
                    key: 3,
                    server: 1304,
                    slot: 3,
                    name: "Friend".into(),
                    class: 14
                }
            ]
        }))
    );
    for length in 0..frame.len() - 2 {
        assert!(!matches!(
            decode(&frame[..length]),
            Ok(Some(Event::PartyMembers { .. }))
        ));
    }
    assert!(decode(&roster(&[Some("Local"), Some("Local")])).is_err());
}
