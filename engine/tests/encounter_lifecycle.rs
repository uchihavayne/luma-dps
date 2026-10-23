use luma_engine::{
    packets::{Event, Hit},
    MeterEngine,
};

fn hit(source: u64, target: u64, amount: u64) -> Event {
    Event::Damage(Hit {
        source,
        target,
        skill: 14_090_000,
        amount,
        critical: false,
        tick: false,
        flags: 0,
        angle: 0,
    })
}
fn player(engine: &mut MeterEngine, id: u64) {
    engine.ingest_event(
        Event::Identity {
            id,
            name: format!("Player{id}"),
            class: Some(14),
            own: false,
        },
        0,
    )
}

#[test]
fn removing_a_summon_retains_its_credited_owner_and_skill_totals() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1);
    engine.ingest_event(
        Event::Npc {
            id: 2,
            name: None,
            model: 2_920_620,
            kind: 0x5f,
        },
        0,
    );
    engine.ingest_event(Event::Owner { id: 2, owner: 1 }, 0);
    engine.ingest_event(hit(2, 10, 100), 1000);
    engine.ingest_event(
        Event::Removed {
            id: 2,
            death: false,
        },
        2000,
    );
    let state = engine.live_state(3000);
    assert_eq!(state.players.len(), 1);
    assert_eq!(state.players[0].id, 1);
    assert_eq!(state.players[0].damage, 100);
}

#[test]
fn removing_an_npc_does_not_turn_its_earlier_attacks_into_player_damage() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(
        Event::Npc {
            id: 2,
            name: None,
            model: 2_920_000,
            kind: 0x0c,
        },
        0,
    );
    engine.ingest_event(hit(2, 10, 100), 1000);
    engine.ingest_event(
        Event::Removed {
            id: 2,
            death: false,
        },
        2000,
    );
    assert_eq!(engine.live_state(3000).total_damage, 0);
}

#[test]
fn completed_combat_stays_visible_and_history_is_fetched_separately() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1);
    engine.ingest_event(hit(1, 10, 100), 1000);
    engine.ingest_event(hit(1, 10, 200), 2000);
    engine.ingest_event(
        Event::Removed {
            id: 10,
            death: true,
        },
        2500,
    );
    let state = engine.live_state(5000);
    assert_eq!(state.total_damage, 300);
    // The damage clock stops at the last hit, not at the target's death.
    assert_eq!(state.elapsed_ms, 1000);
    assert!(!state.encounter_active);
    assert!(state.history.is_empty());
    assert_eq!(state.history_count, 1);
    let (revision, history) = engine.history_snapshot();
    assert_eq!(revision, state.history_revision);
    assert_eq!(history[0].total_damage, 300);
    engine.reset();
    assert_eq!(engine.live_state(6000).total_damage, 0);
    assert_eq!(engine.history_snapshot().1.len(), 1);
}

#[test]
fn one_dead_target_does_not_clear_damage_to_other_live_targets() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(hit(1, 10, 100), 1000);
    engine.ingest_event(hit(1, 11, 200), 2000);
    engine.ingest_event(
        Event::Removed {
            id: 10,
            death: true,
        },
        2500,
    );
    assert_eq!(engine.live_state(3000).total_damage, 300);
    assert!(engine.live_state(3000).encounter_active);
}

#[test]
fn entity_reuse_archives_old_attribution_instead_of_reclassifying_it() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 2);
    engine.ingest_event(hit(2, 10, 100), 1000);
    engine.ingest_event(
        Event::Removed {
            id: 2,
            death: false,
        },
        2000,
    );
    engine.ingest_event(
        Event::Npc {
            id: 2,
            name: None,
            model: 2_920_000,
            kind: 0x0c,
        },
        2500,
    );
    let state = engine.live_state(3000);
    assert_eq!(state.total_damage, 100);
    assert_eq!(state.players[0].name, "Player2");
    assert_eq!(engine.history_snapshot().1[0].total_damage, 100);
}

#[test]
fn a_large_number_of_repeated_hits_keeps_one_aggregate_bucket() {
    let mut engine = MeterEngine::default();
    for now in 0..250_000 {
        engine.ingest_event(hit(1, 10, 1), now)
    }
    let state = engine.live_state(250_000);
    assert_eq!(state.total_damage, 250_000);
    assert_eq!(state.players[0].skills.len(), 1);
    assert_eq!(state.players[0].skills[0].hits, 250_000);
    let encoded = serde_json::to_vec(&state).unwrap();
    assert!(encoded.len() < 4096);
}
