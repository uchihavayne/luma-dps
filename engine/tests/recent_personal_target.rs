use luma_engine::{
    packets::{Event, Hit},
    MeterEngine,
};

fn identity(id: u64, name: &str, own: bool) -> Event {
    Event::Identity {
        id,
        name: name.into(),
        class: Some(14),
        own,
    }
}

fn npc(id: u64, name: Option<&str>, kind: u8) -> Event {
    Event::Npc {
        id,
        name: name.map(str::to_owned),
        model: 123,
        kind,
    }
}

fn damage(source: u64, target: u64) -> Event {
    Event::Damage(Hit {
        source,
        target,
        amount: 100,
        skill: 14_090_000,
        critical: false,
        tick: false,
        flags: 0,
        angle: 0,
    })
}

fn engine_with_target() -> MeterEngine {
    let mut engine = MeterEngine::default();
    engine.ingest_event(identity(1, "Local", true), 100);
    engine.ingest_event(npc(900, Some("Krall Laborer"), 0x0c), 200);
    engine
}

#[test]
fn unnamed_spawn_template_is_preserved_through_wire_decode_hit_death_and_json() {
    // IDs are public NPC table identities: Black Claw Manduri Combatant's
    // 2400617 map source and Krall Armed Soldier's 2100075 source. They are
    // independent from each connection's short-lived scene handle.
    for (scene, template, expected_name) in [
        (77u32, 2_400_617u32, Some("Black Claw Manduri Combatant")),
        (78, 2_100_075, Some("Krall Armed Soldier")),
        (79, 9_999_998, None),
    ] {
        let mut frame = vec![0x41, 0x36, scene as u8, 0x0c, 0, 0];
        frame.extend(template.to_le_bytes());
        let event = luma_engine::packets::decode(&frame).unwrap().unwrap();
        assert!(
            matches!(&event, Event::Npc { id, name: None, model, .. } if *id == u64::from(scene) && *model == template)
        );
        let mut engine = MeterEngine::default();
        engine.ingest_event(identity(1, "Local", true), 100);
        engine.ingest_event(event, 200);
        engine.ingest_event(
            Event::Updates(vec![
                damage(1, u64::from(scene)),
                Event::Removed {
                    id: u64::from(scene),
                    death: true,
                },
            ]),
            1_000,
        );
        let state = engine.live_state(1_100);
        assert!(state.live_target.is_none());
        let recent = state.recent_personal_target.unwrap();
        assert_eq!(recent.target_name.as_deref(), expected_name);
        assert_eq!(recent.target_npc_id, Some(template));
        assert_eq!(recent.target_id, u64::from(scene));
        assert_eq!(recent.hit_at_ms, 1_000);
        assert_eq!(
            serde_json::to_value(&recent).unwrap()["target_npc_id"],
            template
        );
        assert_eq!(
            engine.live_state(2_000).recent_personal_target.unwrap(),
            recent
        );
    }
}

#[test]
fn one_shot_and_death_in_one_batch_survive_first_ui_poll_without_refreshing_hit_time() {
    let mut engine = engine_with_target();
    engine.ingest_event(
        Event::Updates(vec![
            damage(1, 900),
            Event::Removed {
                id: 900,
                death: true,
            },
        ]),
        1_000,
    );
    let state = engine.live_state(1_100);
    assert!(!state.encounter_active);
    assert_eq!(state.focused_target_id, None);
    assert!(state.live_target.is_none());
    let recent = state.recent_personal_target.unwrap();
    assert_eq!(recent.actor_id, 1);
    assert_eq!(recent.target_id, 900);
    assert_eq!(recent.target_name.as_deref(), Some("Krall Laborer"));
    assert_eq!(recent.hit_at_ms, 1_000);
    assert_eq!(recent.source, "server-self-hit");
    assert_eq!(
        engine.live_state(9_000).recent_personal_target,
        Some(recent.clone())
    );
    assert_eq!(engine.state(11_000).recent_personal_target, Some(recent));
    assert!(engine.live_state(11_001).recent_personal_target.is_none());
}

#[test]
fn strangers_manual_rows_and_typed_aliases_cannot_create_a_recent_self_target() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(identity(2, "Nearby", false), 100);
    engine.ingest_event(npc(900, Some("Krall Laborer"), 0x0c), 200);
    engine.set_local_player(Some(2), "Nearby").unwrap();
    engine.ingest_event(damage(2, 900), 1_000);
    assert!(engine.live_state(1_100).recent_personal_target.is_none());
    engine.ingest_event(identity(1, "Local", true), 1_200);
    engine.ingest_event(damage(2, 900), 1_300);
    assert!(engine.live_state(1_400).recent_personal_target.is_none());
    engine.ingest_event(damage(1, 900), 1_500);
    assert_eq!(
        engine
            .live_state(1_600)
            .recent_personal_target
            .unwrap()
            .actor_id,
        1
    );
    engine.ingest_event(damage(2, 900), 2_000);
    assert_eq!(
        engine
            .live_state(2_100)
            .recent_personal_target
            .unwrap()
            .hit_at_ms,
        1_500
    );
}

#[test]
fn newer_personal_targets_replace_the_old_name_even_when_the_new_one_is_unknown() {
    let mut engine = engine_with_target();
    engine.ingest_event(damage(1, 900), 1_000);
    engine.ingest_event(npc(901, Some("Uncatalogued received NPC"), 0x0c), 1_100);
    engine.ingest_event(damage(1, 901), 1_200);
    let recent = engine.live_state(1_300).recent_personal_target.unwrap();
    assert_eq!(recent.target_id, 901);
    assert_eq!(
        recent.target_name.as_deref(),
        Some("Uncatalogued received NPC")
    );
    engine.ingest_event(npc(902, None, 0x0c), 1_400);
    engine.ingest_event(damage(1, 902), 1_500);
    let recent = engine.live_state(1_600).recent_personal_target.unwrap();
    assert_eq!(recent.target_id, 902);
    assert_eq!(recent.target_name, None);
    engine.ingest_event(damage(1, 903), 1_700); // no received NPC identity
    assert!(engine.live_state(1_800).recent_personal_target.is_none());
}

#[test]
fn loss_generation_reset_identity_zone_and_clock_changes_clear_the_recent_hit() {
    let clearers: Vec<fn(&mut MeterEngine)> = vec![
        |engine| engine.capture_loss(),
        |engine| engine.connection_changed(),
        |engine| engine.reset(),
        |engine| engine.ingest_event(identity(2, "Other local", true), 1_100),
        |engine| engine.ingest_event(identity(1, "Renamed local", true), 1_100),
        |engine| engine.ingest_event(Event::Removed { id: 1, death: true }, 1_100),
        |engine| engine.ingest_event(Event::ZoneChange { zone_id: 77 }, 1_100),
        |engine| {
            engine.ingest_event(
                Event::Health {
                    id: 900,
                    current: 10,
                },
                900,
            )
        },
    ];
    for clear in clearers {
        let mut engine = engine_with_target();
        engine.ingest_event(damage(1, 900), 1_000);
        assert!(engine.live_state(1_050).recent_personal_target.is_some());
        clear(&mut engine);
        assert!(engine.live_state(1_200).recent_personal_target.is_none());
    }
}

#[test]
fn a_reused_scene_handle_cannot_rename_a_previous_hit_or_resurrect_an_expired_one() {
    let mut engine = engine_with_target();
    engine.ingest_event(damage(1, 900), 1_000);
    engine.ingest_event(
        Event::Removed {
            id: 900,
            death: true,
        },
        1_100,
    );
    engine.ingest_event(npc(900, Some("Different NPC"), 0x0c), 1_200);
    assert!(engine.live_state(1_300).recent_personal_target.is_none());
    engine.ingest_event(damage(1, 900), 1_400);
    assert_eq!(
        engine
            .live_state(1_500)
            .recent_personal_target
            .unwrap()
            .target_name
            .as_deref(),
        Some("Different NPC")
    );
    engine.ingest_event(identity(900, "Reused as player", false), 1_600);
    assert!(engine.live_state(1_700).recent_personal_target.is_none());
    engine.ingest_event(damage(1, 900), 1_800);
    assert!(engine.live_state(1_900).recent_personal_target.is_none());
}

#[test]
fn current_role_resolver_never_guesses_an_unreceived_name_and_needs_a_new_hit_after_spawn() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(identity(1, "Local", true), 100);
    engine.ingest_event(npc(900, None, 0x0c), 200);
    engine.ingest_event(damage(1, 900), 1_000);
    assert_eq!(
        engine
            .live_state(1_100)
            .recent_personal_target
            .unwrap()
            .target_name,
        None
    );
    // The wire exposes another spawn, not a proven name-only update. It must
    // not retroactively attribute an old hit to a new occupant of this ID.
    engine.ingest_event(npc(900, Some("Received NPC name"), 0x0c), 1_200);
    assert!(engine.live_state(1_300).recent_personal_target.is_none());
    engine.ingest_event(damage(1, 900), 1_400);
    assert_eq!(
        engine
            .live_state(1_500)
            .recent_personal_target
            .unwrap()
            .target_name
            .as_deref(),
        Some("Received NPC name")
    );
}

#[test]
fn confirmed_server_owned_pet_hits_are_personal_but_unowned_pets_and_npc_hits_are_not() {
    let mut engine = engine_with_target();
    engine.ingest_event(npc(90, Some("Pet"), 0x5f), 300);
    engine.ingest_event(damage(90, 900), 1_000);
    assert!(engine.live_state(1_100).recent_personal_target.is_none());
    engine.ingest_event(Event::Owner { id: 90, owner: 1 }, 1_200);
    engine.ingest_event(damage(90, 900), 1_300);
    let recent = engine.live_state(1_400).recent_personal_target.unwrap();
    assert_eq!(recent.actor_id, 1);
    assert_eq!(recent.hit_at_ms, 1_300);
    engine.ingest_event(damage(900, 1), 1_500);
    assert_eq!(
        engine.live_state(1_600).recent_personal_target,
        Some(recent)
    );
}

#[test]
fn history_and_report_serialization_never_invent_a_live_recent_target() {
    let mut captured = engine_with_target();
    captured.ingest_event(damage(1, 900), 1_000);
    let record = captured.current_record(2_000);
    let json = serde_json::to_value(&record).unwrap();
    assert!(json.get("recent_personal_target").is_none());
    let mut restored = MeterEngine::default();
    restored.merge_history(&[record]).unwrap();
    restored.ingest_event(identity(1, "Local", true), 2_100);
    assert!(restored.live_state(2_200).recent_personal_target.is_none());
    let state = serde_json::to_value(captured.live_state(2_200)).unwrap();
    assert_eq!(state["recent_personal_target"]["source"], "server-self-hit");
    assert_eq!(state["recent_personal_target"]["hit_at_ms"], 1_000);
}
