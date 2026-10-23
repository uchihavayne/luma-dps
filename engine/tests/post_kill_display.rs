//! A finished encounter, a boss kill above all, stays on screen until a new one actually deals
//! damage. Damage taken or a heal tick right after the kill must not wipe the result.
use luma_engine::{
    packets::{Event, Hit},
    MeterEngine,
};

fn player(engine: &mut MeterEngine, id: u64, own: bool) {
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
fn npc(engine: &mut MeterEngine, id: u64) {
    engine.ingest_event(
        Event::Npc {
            id,
            name: Some(format!("NPC{id}")),
            model: 2_900_000,
            kind: 0x0c,
        },
        0,
    )
}
fn hit(engine: &mut MeterEngine, source: u64, target: u64, amount: u64, now: u64) {
    engine.ingest_event(
        Event::Damage(Hit {
            source,
            target,
            amount,
            skill: 14_090_000,
            critical: false,
            tick: false,
            flags: 0,
            angle: 0,
        }),
        now,
    )
}
fn heal(engine: &mut MeterEngine, source: u64, target: u64, now: u64) {
    engine.ingest_event(
        Event::Healing(Hit {
            source,
            target,
            amount: 400,
            skill: 14_090_000,
            critical: false,
            tick: true,
            flags: 0,
            angle: 0,
        }),
        now,
    )
}
/// A killed boss: 600 damage over two seconds by the local player, then its death.
fn killed_boss() -> MeterEngine {
    let mut engine = MeterEngine::default();
    player(&mut engine, 1, true);
    player(&mut engine, 2, false);
    npc(&mut engine, 9);
    npc(&mut engine, 10);
    hit(&mut engine, 1, 9, 200, 1000);
    hit(&mut engine, 1, 9, 400, 3000);
    engine.ingest_event(Event::Removed { id: 9, death: true }, 3100);
    engine
}

fn assert_boss_result_shown(engine: &MeterEngine, now: u64) {
    let state = engine.live_state(now);
    assert_eq!(state.total_damage, 600, "at {now}");
    assert_eq!(state.personal_total_damage, Some(600), "at {now}");
    assert_eq!(state.elapsed_ms, 2000, "at {now}");
    assert_eq!(state.players[0].damage, 600, "at {now}");
    assert!(!state.encounter_active, "a finished result is not an active encounter");
}

#[test]
fn damage_taken_right_after_a_kill_does_not_wipe_the_result() {
    let mut engine = killed_boss();
    assert_boss_result_shown(&engine, 3200);
    // An add hits the player: nothing the player dealt.
    hit(&mut engine, 10, 1, 90, 3300);
    hit(&mut engine, 10, 1, 90, 4300);
    assert_boss_result_shown(&engine, 4400);
    // Even once that stray encounter has idled out and been saved.
    engine.tick(20_000);
    assert_boss_result_shown(&engine, 20_000);
    assert_boss_result_shown(&engine, 60_000);
}

#[test]
fn a_heal_tick_after_a_kill_does_not_wipe_the_result() {
    let mut engine = killed_boss();
    for second in [4, 5, 6, 7] {
        heal(&mut engine, 2, 1, second * 1000);
    }
    assert_boss_result_shown(&engine, 7100);
    engine.tick(30_000);
    assert_boss_result_shown(&engine, 30_000);
}

#[test]
fn the_next_hit_on_a_target_replaces_the_result() {
    let mut engine = killed_boss();
    hit(&mut engine, 10, 1, 90, 3300);
    assert_boss_result_shown(&engine, 3400);
    hit(&mut engine, 1, 10, 50, 3500);
    let state = engine.live_state(3600);
    assert_eq!(state.total_damage, 50);
    assert_eq!(state.personal_total_damage, Some(50));
    assert!(state.encounter_active);
    // The damage taken before the first hit belongs to the new encounter.
    assert_eq!(state.personal_damage_taken, Some(90));
}

#[test]
fn an_encounter_that_deals_damage_still_replaces_the_result_when_it_ends() {
    let mut engine = killed_boss();
    hit(&mut engine, 1, 10, 50, 5000);
    engine.tick(30_000);
    let state = engine.live_state(30_000);
    assert_eq!(state.total_damage, 50);
    assert_eq!(engine.history_snapshot().1.len(), 2);
}

#[test]
fn history_still_records_what_the_stray_encounter_measured() {
    let mut engine = killed_boss();
    hit(&mut engine, 10, 1, 90, 3300);
    engine.tick(30_000);
    let history = engine.history_snapshot().1;
    // The boss and the stray encounter that only took damage; the screen keeps showing the boss.
    assert_eq!(history.len(), 2);
    assert_eq!(history[0].personal_damage_taken, Some(90));
    assert_eq!(history[1].total_damage, 600);
    assert_boss_result_shown(&engine, 30_000);
}
