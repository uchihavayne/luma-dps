#[path = "../src/cooldowns.rs"]
mod cooldowns;

use cooldowns::{Ledger, CAST_FRESH_MS, COUNTER_FRESH_MS};

fn calibrated() -> Ledger {
    let mut ledger = Ledger::default();
    ledger.bind_self(Some(1));
    ledger.observe_local(100, Some(31_250), None, 500);
    ledger.observe_local(100, Some(30_000), None, 1_000);
    ledger.observe_local(100, Some(27_500), None, 2_000);
    ledger.observe_local(100, Some(25_000), None, 3_000);
    ledger
}

#[test]
fn actorless_counters_require_local_binding_and_never_become_party() {
    let mut ledger = Ledger::default();
    ledger.observe_local(100, Some(30_000), Some(1), 1_000);
    assert!(ledger.snapshot(1_000).own.is_empty());
    ledger.bind_self(Some(1));
    ledger.observe_local(100, Some(30_000), Some(1), 2_000);
    let state = ledger.snapshot(2_000);
    assert_eq!(state.own[0].actor_id, 1);
    assert!(state.peers.is_empty());
    assert_eq!(state.own[0].unit, "server-counter");
    assert_eq!(state.own[0].estimated_remaining_ms, None);
    assert!(!state.own[0].ready_confirmed);
}

#[test]
fn stable_samples_calibrate_a_rate_without_assuming_milliseconds() {
    let ledger = calibrated();
    let state = ledger.snapshot(3_000);
    assert_eq!(state.own[0].rate_samples, 3);
    assert_eq!(state.own[0].estimated_rate_units_per_ms, Some(2.5));
    assert_eq!(state.own[0].estimated_remaining_ms, Some(10_000));
    assert_eq!(
        ledger.snapshot(4_000).own[0].estimated_remaining_ms,
        Some(9_000)
    );
    assert_eq!(state.own[0].readiness, "estimated-cooling");
}

#[test]
fn elapsed_estimate_never_confirms_readiness_but_received_zero_can() {
    let mut ledger = Ledger::default();
    ledger.bind_self(Some(1));
    for (at, units) in [(500, 6_250), (1_000, 5_000), (2_000, 2_500), (2_500, 1_250)] {
        ledger.observe_local(100, Some(units), None, at);
    }
    let elapsed = ledger.snapshot(3_001);
    assert_eq!(elapsed.own[0].estimated_remaining_ms, Some(0));
    assert_eq!(elapsed.own[0].readiness, "estimated-elapsed");
    assert!(!elapsed.own[0].ready_confirmed);
    ledger.observe_local(100, Some(0), None, 3_002);
    assert!(ledger.snapshot(3_002).own[0].ready_confirmed);
    assert_eq!(ledger.snapshot(3_002).own[0].readiness, "server-ready");
}

#[test]
fn stale_counters_and_capture_gaps_discard_calibration() {
    let mut ledger = calibrated();
    let stale = ledger.snapshot(3_001 + COUNTER_FRESH_MS);
    assert!(!stale.own[0].fresh);
    assert_eq!(stale.own[0].estimated_remaining_ms, None);
    assert_eq!(stale.own[0].readiness, "stale");
    ledger.observe_local(100, Some(20_000), None, 10_000);
    assert_eq!(ledger.snapshot(10_000).own[0].estimated_remaining_ms, None);
    ledger.clear();
    assert!(ledger.snapshot(10_000).own.is_empty());
}

#[test]
fn a_new_cooldown_or_changed_rate_invalidates_old_estimates() {
    let mut ledger = calibrated();
    ledger.observe_local(100, Some(30_000), None, 4_000);
    assert_eq!(ledger.snapshot(4_000).own[0].estimated_remaining_ms, None);
    let mut ledger = calibrated();
    ledger.observe_local(100, Some(24_000), None, 4_000);
    assert_eq!(ledger.snapshot(4_000).own[0].estimated_remaining_ms, None);
    assert_eq!(ledger.snapshot(4_000).own[0].rate_samples, 1);
}

#[test]
fn duplicate_unchanging_counter_and_inconsistent_slopes_do_not_calibrate() {
    let mut ledger = calibrated();
    ledger.observe_local(100, Some(25_000), None, 3_600);
    assert_eq!(ledger.snapshot(3_600).own[0].estimated_remaining_ms, None);
    let mut ledger = Ledger::default();
    ledger.bind_self(Some(1));
    for (at, units) in [(1_000, 30_000), (2_000, 27_500), (3_000, 27_000)] {
        ledger.observe_local(100, Some(units), None, at);
    }
    assert_eq!(ledger.snapshot(3_000).own[0].estimated_remaining_ms, None);
}

#[test]
fn charge_only_update_does_not_make_an_old_counter_fresh_or_ready() {
    let mut ledger = calibrated();
    ledger.observe_local(100, None, Some(2), 10_000);
    let row = &ledger.snapshot(10_000).own[0];
    assert_eq!(row.charges, Some(2));
    assert_eq!(row.observed_at_ms, Some(3_000));
    assert_eq!(row.charges_observed_at_ms, Some(10_000));
    assert!(!row.fresh);
    assert!(!row.ready_confirmed);
}

#[test]
fn a_binding_change_and_backwards_clock_clear_prior_observations() {
    let mut ledger = calibrated();
    ledger.bind_self(Some(2));
    assert!(ledger.snapshot(3_000).own.is_empty());
    ledger.observe_local(100, Some(0), None, 4_000);
    assert!(ledger.snapshot(3_999).own.is_empty());
    ledger.observe_local(100, Some(5_000), None, 3_500);
    assert_eq!(ledger.snapshot(3_500).own[0].actor_id, 2);
    assert!(!ledger.snapshot(3_500).own[0].ready_confirmed);
}

#[test]
fn party_casts_are_actor_bound_and_never_have_fabricated_readiness() {
    let mut ledger = calibrated();
    ledger.observe_cast(2, 100, 9, 4_000);
    ledger.observe_cast(3, 100, 10, 4_000);
    ledger.observe_cast(2, 100, 9, 4_020);
    ledger.observe_cast(2, 100, 9, 6_000);
    let state = ledger.snapshot(6_000);
    assert_eq!(state.casts.len(), 2);
    assert_eq!(state.casts[0].actor_id, 2);
    assert_eq!(state.casts[0].use_count, 2);
    assert!(!state.casts[0].ready_confirmed);
    assert_eq!(state.casts[0].source, "server-cast");
    assert!(state.peers.is_empty());
    assert!(!ledger.snapshot(6_001 + CAST_FRESH_MS).casts[0].fresh);
}

#[test]
fn peer_observations_keep_source_binding_and_rebase_age_without_remote_clocks() {
    let mut ledger = calibrated();
    ledger.observe_peer(2, 100, Some(32_500), None, 500, 4_000);
    ledger.observe_peer(2, 100, Some(30_000), None, 500, 5_000);
    ledger.observe_peer(2, 100, Some(27_500), None, 500, 6_000);
    ledger.observe_peer(2, 100, Some(25_000), None, 500, 7_000);
    let state = ledger.snapshot(7_000);
    assert_eq!(state.peers.len(), 1);
    assert_eq!(state.peers[0].source, "peer-relay");
    assert_eq!(state.peers[0].observed_at_ms, Some(6_500));
    assert_eq!(state.peers[0].estimated_remaining_ms, Some(9_500));
    assert_eq!(state.own[0].actor_id, 1);
    ledger.observe_peer(1, 100, Some(0), None, 0, 7_001);
    assert!(!ledger.snapshot(7_001).own[0].ready_confirmed);
    ledger.observe_peer(2, 100, Some(0), None, 5_000, 7_002);
    assert!(!ledger.snapshot(7_002).peers[0].ready_confirmed);
    ledger.observe_peer(2, 100, Some(0), None, COUNTER_FRESH_MS + 1, 20_000);
    assert_eq!(
        ledger.snapshot(20_000).peers[0].raw_remaining_units,
        Some(25_000)
    );
}

#[test]
fn invalid_and_large_inputs_are_rejected_and_state_is_bounded() {
    let mut ledger = Ledger::default();
    ledger.bind_self(Some(1));
    ledger.observe_local(0, Some(1), None, 1_000);
    ledger.observe_local(1, Some(3_600_001), None, 1_000);
    ledger.observe_local(1, Some(1), Some(101), 1_000);
    ledger.observe_local(1, None, None, 1_000);
    assert!(ledger.snapshot(1_000).own.is_empty());
    for skill in 1..=700 {
        ledger.observe_local(skill, Some(100), None, 1_000 + u64::from(skill));
        ledger.observe_cast(2, skill, 9, 1_000 + u64::from(skill));
    }
    assert_eq!(ledger.snapshot(2_000).own.len(), 512);
    assert_eq!(ledger.snapshot(2_000).casts.len(), 512);
    ledger.remove_actor(2);
    assert!(ledger.snapshot(2_000).casts.is_empty());
    ledger.remove_actor(1);
    assert!(ledger.snapshot(2_000).own.is_empty());
    assert_eq!(ledger.snapshot(2_000).local_actor_id, None);
}

#[test]
fn serde_dto_exposes_estimation_and_provenance_without_a_millisecond_alias() {
    let value = serde_json::to_value(calibrated().snapshot(3_000)).unwrap();
    let row = &value["own"][0];
    assert_eq!(row["unit"], "server-counter");
    assert!(row.get("remaining_ms").is_none());
    assert_eq!(row["raw_remaining_units"], 25_000);
    assert_eq!(row["estimated_remaining_ms"], 10_000);
    assert_eq!(row["source"], "local-server");
}

#[test]
fn a_charge_count_change_invalidates_the_old_counter_calibration() {
    let mut ledger = calibrated();
    ledger.observe_local(100, Some(22_500), Some(1), 4_000);
    assert_eq!(ledger.snapshot(4_000).own[0].estimated_remaining_ms, None);
    ledger.observe_local(100, Some(20_000), Some(1), 5_000);
    ledger.observe_local(100, Some(17_500), Some(1), 6_000);
    ledger.observe_local(100, Some(16_250), Some(1), 6_500);
    assert!(ledger.snapshot(6_500).own[0]
        .estimated_remaining_ms
        .is_some());
    ledger.observe_local(100, None, Some(2), 6_600);
    assert_eq!(ledger.snapshot(6_600).own[0].estimated_remaining_ms, None);
    assert!(!ledger.snapshot(6_600).own[0].ready_confirmed);
}
