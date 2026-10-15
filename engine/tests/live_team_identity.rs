use luma_engine::{
    assistance::{AssistEvent, CastCooldown, CastObservation},
    packets::{Event, Hit},
    MeterEngine,
};

fn identity(engine: &mut MeterEngine, id: u64, name: &str, own: bool, now: u64) {
    engine.ingest_event(
        Event::Identity {
            id,
            name: name.into(),
            class: Some(14),
            own,
        },
        now,
    );
}
fn cast(engine: &mut MeterEngine, actor_id: u64, now: u64) {
    engine.ingest_event(
        Event::Assistance(AssistEvent::Cast(CastObservation {
            actor_id,
            skill_id: 14_220_050,
            target_id: actor_id,
            duration_ms: None,
            facing: 0.0,
            position: None,
            cooldown: Some(CastCooldown {
                cooldown_ms: Some(60_000),
                charges: None,
                recharge_ms: None,
            }),
        })),
        now,
    );
}
fn party(engine: &mut MeterEngine, names: &[&str], now: u64) {
    engine.ingest_event(
        Event::PartyRoster {
            names: names.iter().map(|name| (*name).into()).collect(),
        },
        now,
    );
}

#[test]
fn nondamaging_new_party_after_a_fight_uses_live_identity_without_changing_saved_scopes() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true, 0);
    identity(&mut engine, 2, "OldAlly", false, 0);
    party(&mut engine, &["Local", "OldAlly"], 0);
    engine.ingest_event(
        Event::Damage(Hit {
            source: 1,
            target: 9,
            skill: 14_220_050,
            amount: 100,
            critical: false,
            tick: false,
            flags: 0,
            angle: 0,
        }),
        1000,
    );
    engine.ingest_event(Event::Removed { id: 9, death: true }, 2000);
    let archived = serde_json::to_value(engine.history_snapshot().1).unwrap();
    identity(&mut engine, 3, "NewHealer", false, 3000);
    party(&mut engine, &["Local", "NewHealer"], 3000);
    cast(&mut engine, 3, 3100);
    let state = engine.live_state(4000);
    assert_eq!(state.personal_total_damage, Some(100));
    assert!(state.players.iter().all(|player| player.id != 3));
    assert_eq!(
        state.live_team_identity["party_member_ids"],
        serde_json::json!([1, 3])
    );
    assert_eq!(state.live_team_identity["local"]["actor_id"], 1);
    assert_eq!(state.actor_cooldowns.len(), 1);
    assert_eq!(state.actor_cooldowns[0].actor_id, 3);
    assert_eq!(
        serde_json::to_value(engine.history_snapshot().1).unwrap(),
        archived
    );

    engine.connection_changed();
    assert!(engine.live_team_identity()["local"].is_null());
    assert_eq!(
        engine.live_team_identity()["party_member_ids"],
        serde_json::json!([])
    );
    assert_eq!(
        engine.live_team_identity()["party_membership_source"],
        "unresolved"
    );
    identity(&mut engine, 4, "NewCharacter", true, 5000);
    identity(&mut engine, 5, "OtherHealer", false, 5000);
    party(&mut engine, &["NewCharacter", "OtherHealer"], 5000);
    cast(&mut engine, 5, 5100);
    let state = engine.live_state(6000);
    assert!(state.party_member_ids.is_empty()); // The displayed encounter is from a prior session.
    assert_eq!(state.live_team_identity["local"]["actor_id"], 4);
    assert_eq!(state.live_team_identity["local"]["name"], "NewCharacter");
    assert_eq!(
        state.live_team_identity["local"]["identity_source"],
        "server"
    );
    assert_eq!(
        state.live_team_identity["party_member_ids"],
        serde_json::json!([4, 5])
    );
    assert_eq!(state.actor_cooldowns[0].actor_id, 5);
    assert_eq!(
        serde_json::to_value(engine.history_snapshot().1).unwrap(),
        archived
    );
}

#[test]
fn crowded_strangers_are_filtered_before_transport_limits_and_own_is_first() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 70_000, "Local", true, 0);
    identity(&mut engine, 80_000, "Healer", false, 0);
    party(&mut engine, &["Local", "Healer"], 0);
    for actor in 1..=900 {
        cast(&mut engine, actor, 1000);
    }
    cast(&mut engine, 80_000, 1100);
    cast(&mut engine, 70_000, 1200);
    let state = engine.live_state(1500);
    assert_eq!(
        state
            .actor_cooldowns
            .iter()
            .map(|row| row.actor_id)
            .collect::<Vec<_>>(),
        vec![70_000, 80_000]
    );
    assert_eq!(
        state.live_team_identity["party_membership_source"],
        "server"
    );
}

#[test]
fn manual_selection_and_removed_identity_never_claim_automatic_team_identity() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Observed", false, 0);
    engine.set_local_player(Some(1), "Alias").unwrap();
    engine.set_party_members(&[1]).unwrap();
    cast(&mut engine, 1, 1000);
    let state = engine.live_state(1500);
    assert!(state.live_team_identity["local"].is_null());
    assert_eq!(
        state.live_team_identity["party_membership_source"],
        "manual"
    );
    assert!(state.actor_cooldowns.is_empty());
    identity(&mut engine, 1, "Observed", true, 2000);
    assert_eq!(engine.live_team_identity()["local"]["actor_id"], 1);
    engine.ingest_event(
        Event::Removed {
            id: 1,
            death: false,
        },
        3000,
    );
    assert!(engine.live_team_identity()["local"].is_null());
    assert!(engine.live_team_identity()["party_member_ids"]
        .as_array()
        .unwrap()
        .is_empty());
}
