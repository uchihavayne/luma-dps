use luma_engine::{
    packets::{Event, Hit},
    MeterEngine,
};

fn npc(engine: &mut MeterEngine, id: u64, model: u32, name: Option<&str>, kind: u8, at: u64) {
    engine.ingest_event(
        Event::Npc {
            id,
            model,
            name: name.map(str::to_owned),
            kind,
        },
        at,
    );
}
fn hit(engine: &mut MeterEngine, target: u64, amount: u64, at: u64) {
    engine.ingest_event(
        Event::Damage(Hit {
            source: 1,
            target,
            skill: 14_090_000,
            amount,
            critical: false,
            tick: false,
            flags: 0,
            angle: 0,
        }),
        at,
    );
}
fn start() -> MeterEngine {
    let mut engine = MeterEngine::default();
    engine.ingest_event(
        Event::Identity {
            id: 1,
            name: "Local".into(),
            class: Some(14),
            own: true,
        },
        0,
    );
    engine
}

#[test]
fn an_unnamed_single_player_miniboss_resolves_by_model_and_keeps_received_hp() {
    let mut engine = start();
    npc(&mut engine, 900, 2300908, None, 0x1c, 100);
    engine.ingest_event(
        Event::Health {
            id: 900,
            current: 460_000,
        },
        1000,
    );
    hit(&mut engine, 900, 12_000, 1100);
    let state = engine.live_state(1200);
    let target = state.live_target.unwrap();
    assert_eq!(target.name, "Watchdog Kwapo");
    assert_eq!(target.npc_id, Some(2300908));
    assert_eq!(target.current_hp, Some(460_000));
    assert_eq!(target.current_hp_observed_at_ms, Some(1000));
    assert_eq!(
        target.reported_max_hp, None,
        "a name catalog must not invent maximum HP"
    );
    assert_eq!(state.focused_target_id, Some(900));
    assert_eq!(state.personal_total_damage, Some(12_000));
    assert!(
        target.is_boss,
        "the exact NPC model is in the reviewed boss catalog"
    );
    engine.set_target_mode("boss");
    assert_eq!(engine.live_state(1200).personal_total_damage, Some(12_000));
}

#[test]
fn spawned_target_text_does_not_rename_a_known_monster_to_a_nearby_player() {
    let mut engine = start();
    npc(&mut engine, 900, 2300908, Some("NearbyPlayer"), 0x0c, 100);
    hit(&mut engine, 900, 10_000, 1000);
    assert_eq!(
        engine.live_state(1100).live_target.unwrap().name,
        "Watchdog Kwapo"
    );
    npc(
        &mut engine,
        901,
        9_999_998,
        Some("New received NPC"),
        0x0c,
        1200,
    );
    hit(&mut engine, 901, 500, 1300);
    let state = engine.live_state(1400);
    assert_eq!(state.live_target.unwrap().name, "New received NPC");
    assert_eq!(
        state.focused_target_id,
        Some(901),
        "a new smaller hit must change the displayed target"
    );
}

#[test]
fn a_reused_scene_handle_does_not_keep_the_previous_monster_name_boss_flag_or_hp() {
    let mut engine = start();
    npc(&mut engine, 900, 2300908, None, 0x1c, 100);
    hit(&mut engine, 900, 1000, 1000);
    engine.ingest_event(
        Event::Health {
            id: 900,
            current: 400_000,
        },
        1100,
    );
    engine.ingest_event(
        Event::Removed {
            id: 900,
            death: true,
        },
        1200,
    );
    assert_eq!(engine.live_state(1201).targets[0].current_hp, Some(0));
    npc(&mut engine, 900, 9_999_998, None, 0x0c, 1500);
    hit(&mut engine, 900, 500, 1600);
    let target = engine.live_state(1700).live_target.unwrap();
    assert_eq!(target.npc_id, Some(9_999_998));
    assert!(target.name.starts_with("Target #"));
    assert!(!target.is_boss);
    assert_eq!(target.current_hp, None);
    engine.set_target_mode("boss");
    assert_eq!(engine.live_state(1700).total_damage, 0);
}

#[test]
fn ordinary_mob_hp_and_summons_do_not_create_bosses_or_replace_player_names() {
    let mut engine = start();
    npc(&mut engine, 900, 2500009, None, 0x0c, 100);
    engine.ingest_event(
        Event::Health {
            id: 900,
            current: 10_000_000,
        },
        1000,
    );
    hit(&mut engine, 900, 1000, 1100);
    let target = engine.live_state(1200).live_target.unwrap();
    assert_eq!(target.name, "Distorted Mutant");
    assert!(!target.is_boss, "large HP alone cannot classify a boss");
    npc(&mut engine, 901, 2300908, Some("Summon"), 0x5f, 1300);
    engine.ingest_event(
        Event::Identity {
            id: 2,
            name: "AnotherPlayer".into(),
            class: Some(18),
            own: false,
        },
        1400,
    );
    hit(&mut engine, 900, 1000, 1500);
    assert!(engine
        .live_state(1600)
        .players
        .iter()
        .any(|player| player.id == 1 && player.name == "Local"));
}
