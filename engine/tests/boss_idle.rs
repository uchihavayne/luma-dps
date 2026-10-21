use luma_engine::{
    packets::{Event, Hit},
    MeterEngine,
};

const BOSS_MODEL: u32 = 2_300_908; // in the reviewed boss catalog
const ORDINARY_MODEL: u32 = 1_000_001;

fn engine_with(model: u32) -> MeterEngine {
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
    engine.ingest_event(
        Event::Npc {
            id: 900,
            model,
            name: None,
            kind: 0x1c,
        },
        100,
    );
    engine
}

fn hit(engine: &mut MeterEngine, at: u64, amount: u64) {
    engine.ingest_event(
        Event::Damage(Hit {
            source: 1,
            target: 900,
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

/// Total damage of every finished record, oldest first, after closing the open encounter.
fn fights(engine: &mut MeterEngine) -> Vec<u64> {
    engine.reset();
    engine
        .history_snapshot()
        .1
        .iter()
        .rev()
        .map(|record| record.total_damage)
        .collect()
}

#[test]
fn a_live_boss_keeps_one_fight_open_through_a_pause_longer_than_the_ordinary_limit() {
    let mut engine = engine_with(BOSS_MODEL);
    hit(&mut engine, 1_000, 100);
    hit(&mut engine, 20_000, 200); // 19 s of silence: a phase change
    assert_eq!(fights(&mut engine), vec![300]);
}

#[test]
fn an_ordinary_target_still_ends_the_fight_after_the_ordinary_limit() {
    let mut engine = engine_with(ORDINARY_MODEL);
    hit(&mut engine, 1_000, 100);
    hit(&mut engine, 20_000, 200);
    assert_eq!(fights(&mut engine), vec![100, 200]);
}

#[test]
fn a_boss_pause_beyond_the_boss_limit_still_ends_the_fight() {
    let mut engine = engine_with(BOSS_MODEL);
    hit(&mut engine, 1_000, 100);
    hit(&mut engine, 40_000, 200); // 39 s of silence
    assert_eq!(fights(&mut engine), vec![100, 200]);
}

#[test]
fn a_dead_boss_still_ends_the_fight_at_once() {
    let mut engine = engine_with(BOSS_MODEL);
    hit(&mut engine, 1_000, 100);
    engine.ingest_event(
        Event::Removed {
            id: 900,
            death: true,
        },
        2_000,
    );
    hit(&mut engine, 12_000, 50);
    assert_eq!(fights(&mut engine), vec![100, 50]);
}

#[test]
fn an_idle_boss_fight_ends_after_the_boss_limit_and_is_recorded_without_the_pause() {
    let mut engine = engine_with(BOSS_MODEL);
    hit(&mut engine, 1_000, 100);
    hit(&mut engine, 2_000, 100);
    engine.tick(20_000); // quiet for 18 s: still open
    assert!(engine.history_snapshot().1.is_empty());
    engine.tick(40_000); // quiet for 38 s: over the boss limit
    let history = engine.history_snapshot().1;
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].total_damage, 200);
    // The end is one ordinary idle limit after the last hit, not 30 s, so DPS is not diluted.
    assert_eq!(history[0].ended_ms, 12_000);
}
