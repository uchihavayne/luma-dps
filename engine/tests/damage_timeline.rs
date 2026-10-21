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

fn finished(hits: &[(u64, u64, u64)]) -> luma_engine::Encounter {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1);
    player(&mut engine, 2);
    for &(at, source, amount) in hits {
        engine.ingest_event(hit(source, 10, amount), at);
    }
    engine.reset();
    engine.history_snapshot().1.remove(0)
}

#[test]
fn every_saved_encounter_keeps_a_damage_series_that_matches_its_totals() {
    let record = finished(&[(1000, 1, 100), (1500, 2, 50), (2500, 1, 200)]);
    let timeline = &record.timeline;
    assert_eq!(timeline.total.iter().sum::<u64>(), 350);
    assert_eq!(timeline.total.iter().sum::<u64>(), record.total_damage);
    assert_eq!(timeline.interval_ms % 1000, 0);
    assert!(timeline.started_ms <= 1000);
    assert!(timeline.complete);
    // Players are ordered by damage, and each series adds up to that player's total.
    assert_eq!(timeline.players.len(), 2);
    assert_eq!(timeline.players[0].id, 1);
    assert_eq!(timeline.players[0].damage.iter().sum::<u64>(), 300);
    assert_eq!(timeline.players[1].damage.iter().sum::<u64>(), 50);
    assert!(timeline
        .players
        .iter()
        .all(|series| series.damage.len() == timeline.total.len()));
}

#[test]
fn a_long_encounter_is_resampled_into_a_bounded_number_of_buckets() {
    // A hit every 5 s keeps this one encounter (the idle limit is 10 s) for about 1000 s.
    let hits: Vec<_> = (0..=200).map(|n| (1000 + n * 5000, 1, 3)).collect();
    let record = finished(&hits);
    let timeline = &record.timeline;
    assert!(timeline.total.len() <= 241, "{}", timeline.total.len());
    assert_eq!(timeline.interval_ms % 1000, 0);
    assert!(timeline.interval_ms > 1000);
    assert_eq!(timeline.total.iter().sum::<u64>(), 603);
    assert_eq!(record.total_damage, 603);
}

#[test]
fn an_encounter_without_damage_samples_has_no_series() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1);
    engine.reset();
    assert!(engine.history_snapshot().1.is_empty());
}
