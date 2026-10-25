//! A windup is flagged hostile only when its caster is a monster: players, summons and pets are
//! not threats, so the cast list can show monster casts without clutter.
use luma_engine::{
    assistance::{AssistEvent, CastObservation},
    packets::Event,
    MeterEngine,
};

fn windup(actor: u64, target: u64) -> Event {
    Event::Assistance(AssistEvent::Windup(CastObservation {
        actor_id: actor,
        skill_id: 2_000_123,
        target_id: target,
        duration_ms: Some(3000),
        facing: 0.0,
        position: None,
        cooldown: None,
    }))
}

#[test]
fn only_monster_casts_are_hostile() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(
        Event::Identity { id: 1, name: "Local".into(), class: Some(14), own: true },
        0,
    );
    engine.ingest_event(
        Event::Identity { id: 2, name: "Friend".into(), class: Some(29), own: false },
        0,
    );
    engine.ingest_event(
        Event::Npc { id: 9, name: Some("Boss".into()), model: 2_900_000, kind: 0x0c },
        0,
    );
    engine.ingest_event(
        Event::Npc { id: 8, name: None, model: 2_920_620, kind: 0x5f },
        0,
    );
    engine.ingest_event(Event::Owner { id: 8, owner: 2 }, 0);
    for (actor, target) in [(9, 1), (2, 1), (8, 1), (77, 1)] {
        engine.ingest_event(windup(actor, target), 1000);
    }
    let state = engine.live_state(1500);
    let hostile = |actor: u64| {
        state
            .assist
            .casts
            .iter()
            .find(|cast| cast.actor_id == actor)
            .map(|cast| cast.hostile)
    };
    assert_eq!(hostile(9), Some(true));
    assert_eq!(hostile(2), Some(false));
    assert_eq!(hostile(8), Some(false));
    // A caster nothing was received about is not assumed to be a monster.
    assert_eq!(hostile(77), Some(false));
}
