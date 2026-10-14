use luma_engine::{
    character::{CharacterEvent, InspectedCharacter, ObservedItem},
    packets::{Event, Hit},
    MeterEngine,
};

#[test]
fn imported_build_lists_are_bounded_before_history_clone_or_merge() {
    use luma_engine::{
        character::{CharacterBuild, ObservedBoard},
        Encounter,
    };
    let record = Encounter {
        id: 1,
        total_damage: 100,
        ended_ms: 10,
        character_build: Some(CharacterBuild {
            boards: vec![
                ObservedBoard {
                    board_id: 1,
                    node_ids: Vec::new()
                };
                33
            ],
            ..Default::default()
        }),
        ..Default::default()
    };
    let mut engine = MeterEngine::default();
    assert!(engine.merge_history(&[record.clone()]).is_err());
    assert!(engine.history_snapshot().1.is_empty());
    engine.restore_history(&[record]);
    assert!(engine.history_snapshot().1.is_empty());
}

fn identity(engine: &mut MeterEngine, id: u64, name: &str, own: bool, now: u64) {
    engine.ingest_event(
        Event::Identity {
            id,
            name: name.into(),
            class: Some(14),
            own,
        },
        now,
    )
}
fn hit(engine: &mut MeterEngine, source: u64, now: u64) {
    engine.ingest_event(
        Event::Damage(Hit {
            source,
            target: 10,
            skill: 14_090_000,
            amount: 100,
            critical: false,
            tick: false,
            flags: 0,
            angle: 0,
        }),
        now,
    )
}
fn equipment(id: u32) -> Event {
    Event::Character(CharacterEvent::Equipment {
        items: vec![ObservedItem {
            entry_index: 0,
            slot: Some(1),
            item_id: id,
            enchant: None,
            stones: None,
            stats: None,
            godstone_id: None,
            skill_bonuses: None,
        }],
        complete: false,
    })
}

#[test]
fn own_build_freezes_on_own_first_hit_and_live_updates_do_not_rewrite_it() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true, 0);
    engine.ingest_event(equipment(100_001), 100);
    hit(&mut engine, 2, 1000);
    assert!(engine.current_record(1500).character_build.is_none());
    engine.ingest_event(equipment(100_002), 1800);
    hit(&mut engine, 1, 2000);
    engine.ingest_event(equipment(100_003), 2500);
    assert_eq!(
        engine.character_snapshot().own.unwrap().equipment[0].item_id,
        100_003
    );
    let current = engine.current_record(3000);
    assert_eq!(
        current.character_build.unwrap().equipment[0].item_id,
        100_002
    );
    assert_eq!(current.personal_started_ms, Some(2000));
    assert_eq!(engine.live_state(3000).personal_started_ms, Some(2000));
    let live = serde_json::to_value(engine.live_state(3000)).unwrap();
    assert!(live.get("character_build").is_none());
    assert!(engine.live_state(3000).character_available);
    engine.reset();
    assert_eq!(
        engine.history_snapshot().1[0]
            .character_build
            .as_ref()
            .unwrap()
            .equipment[0]
            .item_id,
        100_002
    );
}

#[test]
fn manual_combat_identity_never_claims_unbound_login_gear_or_other_inspections() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(equipment(100_001), 1000);
    hit(&mut engine, 1, 2000);
    engine.set_local_player(Some(1), "Local").unwrap();
    engine.ingest_event(
        Event::Character(CharacterEvent::Inspection(InspectedCharacter {
            name: "Local".into(),
            class_code: 14,
            level: 50,
            gear_score: Some(9000),
            equipment: Vec::new(),
            equipment_complete: false,
            observed_at_ms: 0,
            source: "server-inspection".into(),
        })),
        2500,
    );
    let character = engine.character_snapshot();
    assert!(character.own.is_none());
    assert_eq!(character.unbound_own.unwrap().equipment[0].item_id, 100_001);
    assert_eq!(character.inspected[0].name, "Local");
    assert!(engine.current_record(3000).character_build.is_none());
    assert!(!engine.live_state(3000).character_available);
    identity(&mut engine, 1, "Local", true, 3500);
    assert_eq!(engine.character_snapshot().own.unwrap().actor_id, Some(1));
    // Receiving identity later does not invent equipment at the earlier hit.
    assert!(engine.current_record(4000).character_build.is_none());
    hit(&mut engine, 1, 4500);
    assert!(engine.current_record(5000).character_build.is_none());
}

#[test]
fn character_changes_or_capture_loss_clear_current_gear_but_preserve_archive() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Old", true, 0);
    engine.ingest_event(equipment(100_001), 100);
    hit(&mut engine, 1, 1000);
    engine.capture_loss();
    assert!(!engine.live_state(1200).character_available);
    assert_eq!(engine.character_snapshot().own.unwrap().name, "Old");
    identity(&mut engine, 2, "New", true, 2000);
    assert_eq!(engine.character_snapshot().own.unwrap().name, "New");
    assert!(!engine.live_state(2000).character_available);
    let history = engine.history_snapshot().1;
    assert_eq!(history[0].character_build.as_ref().unwrap().name, "Old");
    assert_eq!(
        history[0].character_build.as_ref().unwrap().equipment[0].item_id,
        100_001
    );
    engine.connection_changed();
    assert!(engine.character_snapshot().own.is_none());
}
