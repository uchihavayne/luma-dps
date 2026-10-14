use luma_engine::{
    field_boss::{BossSlot, FieldBossEvent},
    packets::Event,
    MeterEngine,
};

fn received(map_id: u32, alive: bool) -> Event {
    Event::FieldBoss(FieldBossEvent {
        map_id,
        slots: vec![BossSlot {
            slot_id: 2,
            alive,
            server_time_ms: Some(1_791_800_000_000),
            position: None,
            observed_at_ms: 0,
            source: "server-map".into(),
        }],
    })
}

#[test]
fn map_boss_data_is_on_demand_and_has_freshness_without_name_or_respawn_guesses() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(received(3001, false), 1000);
    let live = engine.live_state(2000);
    assert!(live.field_boss_available);
    assert!(live.field_boss_revision > 0);
    let serialized = serde_json::to_value(live).unwrap();
    assert!(serialized.get("field_bosses").is_none());
    let server = engine.field_boss_snapshot();
    assert_eq!(server.maps[0].observed_at_ms, 1000);
    assert_eq!(
        server.maps[0].slots[0].server_time_ms,
        Some(1_791_800_000_000)
    );
    assert!(!server.maps[0].slots[0].alive);
    assert!(!engine.field_boss_snapshot().maps[0].slots[0].alive);
    engine.set_target_mode("boss");
    assert!(engine.live_state(3000).targets.is_empty());
}

#[test]
fn capture_loss_or_connection_change_invalidates_map_boss_reports_and_revisions() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(received(3001, true), 1000);
    let first = engine.live_state(1000).field_boss_revision;
    engine.capture_loss();
    assert!(engine.field_boss_snapshot().maps.is_empty());
    assert!(!engine.live_state(2000).field_boss_available);
    assert!(engine.live_state(2000).field_boss_revision > first);
    engine.ingest_event(received(3001, true), 3000);
    engine.connection_changed();
    assert!(engine.field_boss_snapshot().maps.is_empty());
}
