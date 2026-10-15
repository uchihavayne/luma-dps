use luma_engine::latency::{Sample, Snapshot, Trace, MAX_SAMPLES};
fn sample(at: u64, rtt: u32) -> Sample {
    Sample {
        observed_at_ms: at,
        rtt_ms: rtt,
        measured_connections: 1,
        ..Sample::default()
    }
}

#[test]
fn held_old_future_and_invalid_os_values_do_not_become_new_samples() {
    let mut trace = Trace::default();
    assert!(trace.observe(sample(1000, 80), 1000));
    assert!(!trace.observe(sample(1000, 90), 2000));
    assert!(!trace.observe(sample(1500, 90), 1500));
    assert!(!trace.observe(sample(2000, 90), 1900));
    assert!(!trace.observe(sample(2000, 90), 7001));
    assert!(!trace.observe(sample(3000, 120001), 3000));
    assert!(!trace.observe(
        Sample {
            measured_connections: 0,
            ..sample(3000, 0)
        },
        3000
    ));
    let result = trace.snapshot(1000, 5000);
    assert_eq!(result.sample_count, 1);
    assert_eq!(result.average_ms, Some(80.0));
}

#[test]
fn encounter_window_excludes_idle_and_other_fights_and_keeps_actual_zero() {
    let mut trace = Trace::default();
    for (at, rtt) in [
        (1000, 999),
        (5000, 0),
        (6000, 50),
        (7000, 100),
        (8000, 200),
        (20000, 999),
    ] {
        trace.observe(sample(at, rtt), at);
    }
    let result = trace.snapshot(5000, 8000);
    assert_eq!(result.sample_count, 4);
    assert_eq!(result.minimum_ms, Some(0));
    assert_eq!(result.maximum_ms, Some(200));
    assert_eq!(result.average_ms, Some(87.5));
    assert_eq!(result.median_ms, Some(75.0));
    assert_eq!(result.p95_ms, Some(200));
    assert!(!result.partial);
    assert!(result.is_valid());
}

#[test]
fn sparse_and_bounded_retention_are_explicit_and_never_create_zero_latency() {
    assert_eq!(Trace::default().snapshot(1000, 5000).average_ms, None);
    let mut trace = Trace::default();
    for n in 1..=800 {
        trace.observe(sample(n * 1000, n as u32), n * 1000);
    }
    let result = trace.snapshot(1000, 800000);
    assert_eq!(result.sample_count, MAX_SAMPLES);
    assert_eq!(result.samples[0].rtt_ms, 201);
    assert!(result.truncated && result.partial);
    let mut sparse = Trace::default();
    sparse.observe(sample(10000, 50), 10000);
    sparse.observe(sample(30000, 90), 30000);
    assert!(sparse.snapshot(1000, 40000).partial);
}

#[test]
fn clock_reversal_and_connection_clear_cannot_mix_two_time_domains() {
    let mut trace = Trace::default();
    trace.observe(sample(10000, 70), 10000);
    assert!(!trace.observe(sample(9000, 10), 9000));
    assert_eq!(trace.snapshot(1, 20000).sample_count, 0);
    assert!(trace.observe(sample(10001, 100), 10001));
    trace.clear();
    assert_eq!(trace.snapshot(1, 20000).minimum_ms, None);
}

#[test]
fn imported_nested_latency_is_bounded_before_history_acceptance() {
    let invalid = Snapshot {
        samples: vec![sample(1000, 1); MAX_SAMPLES + 1],
        ..Snapshot::default()
    };
    assert!(!invalid.is_valid());
    let invalid = Snapshot {
        average_ms: Some(f64::NAN),
        ..Snapshot::default()
    };
    assert!(!invalid.is_valid());
}

#[test]
fn real_encounter_archives_rtt_and_reconnect_cannot_rewrite_the_saved_fight() {
    use luma_engine::{
        packets::{Event, Hit},
        MeterEngine,
    };
    let mut engine = MeterEngine::default();
    engine.ingest_event(
        Event::Identity {
            id: 7,
            name: "Player".into(),
            class: Some(14),
            own: true,
        },
        1000,
    );
    let hit = |at| {
        (
            Event::Damage(Hit {
                source: 7,
                target: 10,
                amount: 100,
                skill: 14090000,
                critical: false,
                tick: false,
                flags: 0,
                angle: 0,
            }),
            at,
        )
    };
    engine.observe_latency(sample(1000, 10), 1000);
    let (event, at) = hit(1000);
    engine.ingest_event(event, at);
    engine.observe_latency(sample(2000, 50), 2000);
    let (event, at) = hit(2000);
    engine.ingest_event(event, at);
    assert_eq!(
        engine.current_record(2000).network_latency.average_ms,
        Some(30.0)
    );
    engine.connection_changed();
    engine.observe_latency(sample(3000, 999), 3000);
    let saved = engine.history_snapshot().1;
    assert_eq!(saved.len(), 1);
    assert_eq!(saved[0].network_latency.average_ms, Some(30.0));
    assert_eq!(
        engine.current_record(4000).network_latency.average_ms,
        Some(30.0)
    );
    let mut restored = MeterEngine::default();
    restored.restore_history(&saved);
    assert_eq!(
        restored.history_snapshot().1[0]
            .network_latency
            .sample_count,
        2
    );
    let mut invalid = saved[0].clone();
    invalid.network_latency.samples[0].observed_at_ms = 1;
    assert!(restored.merge_history(&[invalid]).is_err());
}

#[test]
fn anonymized_relative_zero_observations_are_valid_in_saved_reports_only() {
    let record = Snapshot {
        samples: vec![sample(0, 0)],
        sample_count: 1,
        ..Snapshot::default()
    };
    assert!(record.is_valid());
    assert_eq!(record.within(0, 1000).average_ms, Some(0.0));
    assert!(!Trace::default().observe(sample(0, 0), 1000));
}
