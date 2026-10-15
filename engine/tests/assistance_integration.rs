use luma_engine::{
    assistance::{AssistEvent, CastObservation, EffectObservation},
    packets::{decode, Event, Hit},
    MeterEngine,
};

fn hit(engine: &mut MeterEngine) {
    engine.ingest_event(
        Event::Damage(Hit {
            source: 1,
            target: 10,
            skill: 14_090_000,
            amount: 100,
            critical: false,
            tick: false,
            flags: 0,
            angle: 0,
        }),
        1000,
    );
}
fn player(engine: &mut MeterEngine) {
    engine.ingest_event(
        Event::Identity {
            id: 1,
            name: "Local".into(),
            class: Some(14),
            own: true,
        },
        0,
    );
}
fn windup(actor_id: u64) -> Event {
    Event::Assistance(AssistEvent::Windup(CastObservation {
        actor_id,
        skill_id: 12345,
        target_id: 1,
        duration_ms: Some(1500),
        facing: 0.0,
        position: None,
        cooldown: None,
    }))
}

#[test]
fn framed_health_has_reported_maximum_separate_from_observed_peak() {
    let mut engine = MeterEngine::default();
    hit(&mut engine);
    let mut frame = vec![0, 0x8d, 10, 2, 2, 0];
    frame.extend_from_slice(&700i64.to_le_bytes());
    frame.push(7);
    frame.extend_from_slice(&1000i64.to_le_bytes());
    engine.ingest_event(decode(&frame).unwrap().unwrap(), 2000);
    let state = engine.live_state(2000);
    assert_eq!(state.targets[0].current_hp, Some(700));
    assert_eq!(state.targets[0].observed_peak_hp, Some(700));
    assert_eq!(state.targets[0].reported_max_hp, Some(1000));
    assert_eq!(state.targets[0].health_observed_at_ms, Some(2000));
    engine.ingest_event(
        Event::Assistance(AssistEvent::Health {
            actor_id: 10,
            current_hp: Some(2000),
            reported_max_hp: None,
        }),
        3000,
    );
    assert_eq!(engine.live_state(3000).targets[0].reported_max_hp, None);
    assert_eq!(
        engine.live_state(3000).targets[0].observed_peak_hp,
        Some(2000)
    );
}

#[test]
fn live_assistance_is_bounded_and_prioritizes_selected_boss_and_local_effects() {
    let mut engine = MeterEngine::default();
    player(&mut engine);
    engine.set_boss_targets(&[50]);
    for actor in 10..=50 {
        engine.ingest_event(windup(actor), 1000)
    }
    for instance in 1..=100 {
        engine.ingest_event(
            Event::Assistance(AssistEvent::Effect(EffectObservation {
                recipient_id: if instance == 100 { 1 } else { instance + 1 },
                caster_id: 10,
                instance_id: instance,
                effect_id: 123450,
                duration_ms: 5000,
                persistent: false,
                refreshed: false,
            })),
            1000,
        );
    }
    let live = engine.live_state(1200).assist;
    assert_eq!(live.casts.len(), 8);
    assert_eq!(live.effects.len(), 64);
    assert!(live.timeline.is_empty());
    assert!(live.health.is_empty());
    assert!(live.retention_limited);
    assert_eq!(live.casts[0].actor_id, 50);
    assert_eq!(live.effects[0].recipient_id, 1);
    let details = engine.assistance_snapshot(1200);
    assert_eq!(details.casts.len(), 41);
    assert_eq!(details.effects.len(), 100);
    assert_eq!(details.timeline.len(), 141);
}

#[test]
fn encounter_reports_archive_real_assistance_but_damage_reset_keeps_active_effects() {
    let mut engine = MeterEngine::default();
    player(&mut engine);
    hit(&mut engine);
    engine.ingest_event(windup(10), 1000);
    assert_eq!(engine.current_record(1200).assist.timeline.len(), 1);
    engine.reset();
    assert_eq!(engine.history_snapshot().1[0].assist.timeline.len(), 1);
    assert_eq!(engine.live_state(1200).assist.casts.len(), 1);
    engine.capture_loss();
    assert!(engine.live_state(1200).assist.casts.is_empty());
    engine.ingest_event(windup(10), 1300);
    engine.connection_changed();
    assert!(engine.assistance_snapshot(1400).timeline.is_empty());
}

#[test]
fn a_cast_without_server_windup_never_becomes_a_predicted_boss_countdown() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(
        Event::Assistance(AssistEvent::Cast(CastObservation {
            actor_id: 10,
            skill_id: 12345,
            target_id: 1,
            duration_ms: None,
            facing: 0.0,
            position: None,
            cooldown: None,
        })),
        1000,
    );
    assert!(engine.live_state(1000).assist.casts.is_empty());
    assert_eq!(engine.assistance_snapshot(1000).timeline[0].kind, "cast");
}
