use luma_engine::{Encounter, MeterEngine, TargetState};

fn fight(damage: u64, boss: bool) -> Encounter {
    Encounter {
        total_damage: damage,
        dps: damage as f64,
        started_ms: 1000,
        ended_ms: 2000,
        targets: vec![TargetState {
            is_boss: boss,
            damage,
            ..Default::default()
        }],
        ..Default::default()
    }
}

fn silent(marker: u64) -> Encounter {
    // Kept as measured through its heal-like events, but it dealt no damage.
    Encounter {
        total_damage: 0,
        unclassified_player_target_events: marker,
        started_ms: 1000,
        ended_ms: 2000,
        ..Default::default()
    }
}

fn merged(engine: &mut MeterEngine, records: Vec<Encounter>) {
    engine.merge_history(&records).unwrap();
}

fn counts(engine: &MeterEngine) -> (usize, usize, usize) {
    let history = engine.history_snapshot().1;
    let bosses = history
        .iter()
        .filter(|record| record.targets.iter().any(|target| target.is_boss))
        .count();
    let silent = history
        .iter()
        .filter(|record| record.total_damage == 0)
        .count();
    (history.len(), bosses, silent)
}

#[test]
fn boss_fights_outlive_a_flood_of_ordinary_fights() {
    let mut engine = MeterEngine::default();
    merged(&mut engine, (1..=60).map(|n| fight(n, true)).collect());
    for _ in 0..3 {
        merged(&mut engine, (1..=150).map(|n| fight(1000 + n, false)).collect());
    }
    let (total, bosses, _) = counts(&engine);
    assert_eq!(total, 200);
    assert_eq!(bosses, 60, "every boss fight is still there");
}

#[test]
fn zero_damage_records_go_before_fights_that_dealt_damage() {
    let mut engine = MeterEngine::default();
    merged(&mut engine, (1..=100).map(|n| fight(n, false)).collect());
    merged(&mut engine, (1..=150).map(silent).collect());
    let (total, _, silent_left) = counts(&engine);
    assert_eq!(total, 200);
    assert_eq!(silent_left, 100, "the older damaging fights were kept");
}

#[test]
fn the_newest_record_is_never_the_one_dropped() {
    let mut engine = MeterEngine::default();
    merged(&mut engine, (1..=199).map(|n| fight(n, true)).collect());
    merged(&mut engine, vec![fight(7001, false), fight(7002, false)]);
    let history = engine.history_snapshot().1;
    assert_eq!(history.len(), 200);
    assert_eq!(history[0].total_damage, 7001, "the latest import stays first");
    assert_eq!(
        history
            .iter()
            .filter(|record| record.targets.iter().any(|target| target.is_boss))
            .count(),
        199
    );
}

#[test]
fn a_history_of_only_boss_fights_still_drops_the_oldest() {
    let mut engine = MeterEngine::default();
    merged(&mut engine, (1..=150).map(|n| fight(n, true)).collect());
    merged(&mut engine, (1..=150).map(|n| fight(500 + n, true)).collect());
    let history = engine.history_snapshot().1;
    assert_eq!(history.len(), 200);
    assert_eq!(history[0].total_damage, 501);
}
