//! The revision counter says whether anything the meter shows has changed, so a caller can skip building a
//! state that cannot differ from the last one.
use luma_engine::{
    packets::{Event, Hit},
    MeterEngine,
};

fn hit(source: u64, target: u64, at: u64, engine: &mut MeterEngine) {
    engine.ingest_event(
        Event::Damage(Hit { source, target, skill: 14_090_000, amount: 100, critical: false, tick: false, flags: 0, angle: 0 }),
        at,
    );
}

#[test]
fn the_revision_moves_with_what_the_meter_shows_and_not_with_looking_or_waiting() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(Event::Identity { id: 1, name: "Mira".into(), class: Some(14), own: true }, 0);
    engine.ingest_event(Event::Npc { id: 9, name: Some("Target".into()), model: 2_900_000, kind: 0x0c }, 0);
    let before = engine.revision();
    // Looking at the state, however often, changes nothing.
    for now in [1_000, 1_100, 1_200] {
        let _ = engine.live_state(now);
    }
    assert_eq!(engine.revision(), before);
    // A hit does.
    hit(1, 9, 1_300, &mut engine);
    let after = engine.revision();
    assert_ne!(after, before);
    // Time passing inside a fight is not a change of the counter (the elapsed time is read from the clock), and
    // a tick before the fight has idled out leaves it alone.
    engine.tick(1_400);
    assert_eq!(engine.revision(), after);
    assert!(engine.live_state(1_400).encounter_active);
}
