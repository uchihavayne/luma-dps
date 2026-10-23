//! The damage clock runs from the first hit to the last. The quiet time that ends an encounter,
//! and any healing that keeps it open, is not combat time and must not dilute DPS.
use luma_engine::{
    packets::{Event, Hit},
    MeterEngine,
};

fn damage(source: u64, target: u64, amount: u64) -> Event {
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
fn identity(engine: &mut MeterEngine, id: u64, own: bool) {
    engine.ingest_event(
        Event::Identity {
            id,
            name: format!("Player{id}"),
            class: Some(14),
            own,
        },
        0,
    )
}
fn local_engine() -> MeterEngine {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, true);
    engine
}
/// 60 hits of 1000 damage, one a second from 1 s to 60 s: 59 s between the first and the last.
fn sixty_second_fight(engine: &mut MeterEngine) {
    for second in 1..=60 {
        engine.ingest_event(damage(1, 10, 1000), second * 1000);
    }
}

#[test]
fn a_fight_that_ends_by_idle_is_measured_to_its_last_hit_not_ten_seconds_later() {
    let mut engine = local_engine();
    sixty_second_fight(&mut engine);
    engine.tick(80_000);
    let record = engine.history_snapshot().1.remove(0);
    assert_eq!(record.total_damage, 60_000);
    assert_eq!(record.elapsed_ms, 59_000);
    assert_eq!(record.personal_elapsed_ms, 59_000);
    assert!((record.dps - 60_000.0 / 59.0).abs() < 1e-9, "{}", record.dps);
    assert!((record.personal_dps.unwrap() - 60_000.0 / 59.0).abs() < 1e-9);
    assert!((record.players[0].dps - 60_000.0 / 59.0).abs() < 1e-9);
    assert!((record.targets[0].participants[0].dps - 60_000.0 / 59.0).abs() < 1e-9);
    // The record still says when the encounter was closed.
    assert!(record.ended_ms >= 60_000);
}

#[test]
fn the_live_rate_does_not_fall_after_the_last_hit_and_equals_the_saved_one() {
    let mut engine = local_engine();
    sixty_second_fight(&mut engine);
    let at_last_hit = engine.live_state(60_000);
    for later in [61_000, 65_000, 69_000] {
        let state = engine.live_state(later);
        assert_eq!(state.elapsed_ms, 59_000);
        assert_eq!(state.dps, at_last_hit.dps);
        assert_eq!(state.personal_dps, at_last_hit.personal_dps);
    }
    engine.tick(80_000);
    let saved = engine.history_snapshot().1.remove(0);
    assert_eq!(saved.dps, at_last_hit.dps);
    assert_eq!(saved.personal_dps, at_last_hit.personal_dps);
    // After the encounter closes the finished numbers stay on screen unchanged.
    let shown = engine.live_state(90_000);
    assert_eq!((shown.elapsed_ms, shown.dps), (59_000, at_last_hit.dps));
}

#[test]
fn healing_that_keeps_an_encounter_open_does_not_stretch_its_damage_time() {
    let mut engine = local_engine();
    identity(&mut engine, 2, false);
    for second in 1..=5 {
        engine.ingest_event(damage(1, 10, 1000), second * 1000);
    }
    // Healing between players continues for twenty seconds after the last damage.
    for second in [8, 15, 22, 29] {
        engine.ingest_event(
            Event::Healing(Hit {
                source: 1,
                target: 2,
                skill: 14_090_000,
                amount: 500,
                critical: false,
                tick: false,
                flags: 0,
                angle: 0,
            }),
            second * 1000,
        );
    }
    engine.tick(60_000);
    let record = engine.history_snapshot().1.remove(0);
    assert_eq!(record.total_damage, 5000);
    assert_eq!(record.elapsed_ms, 4000);
    assert_eq!(record.personal_elapsed_ms, 4000);
    assert_eq!(record.dps, 1250.0);
    assert_eq!(record.personal_dps, Some(1250.0));
}

#[test]
fn a_single_hit_has_no_span_and_uses_the_one_second_minimum() {
    let mut engine = local_engine();
    engine.ingest_event(damage(1, 10, 5000), 1000);
    let state = engine.live_state(9000);
    assert_eq!((state.elapsed_ms, state.dps), (0, 5000.0));
}

#[test]
fn the_damage_timeline_ends_at_the_last_hit() {
    let mut engine = local_engine();
    sixty_second_fight(&mut engine);
    engine.tick(80_000);
    let record = engine.history_snapshot().1.remove(0);
    let timeline = &record.timeline;
    let last_bucket = timeline.total.iter().rposition(|amount| *amount > 0).unwrap();
    assert_eq!(timeline.total.len(), last_bucket + 1, "no empty buckets after the last hit");
    assert_eq!(timeline.total.iter().sum::<u64>(), 60_000);
}
