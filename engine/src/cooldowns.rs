//! Received cooldown counters and actor-bound skill-use observations.
//!
//! The local 47 38 counter has no actor field and its unit is not established.
//! Only a stable sequence of counter changes can produce an approximate local
//! duration. A received zero is readiness evidence; a timer elapsing is not.
//! Party casts are observations of use, never evidence of a ready cooldown.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};

pub const COUNTER_FRESH_MS: u64 = 6_000;
pub const CAST_FRESH_MS: u64 = 120_000;
const MAX_COUNTERS: usize = 512;
const MAX_CASTS: usize = 512;
const MAX_UNITS: u32 = 3_600_000;
const MAX_CHARGES: u32 = 100;
const MAX_RATE_SAMPLES: usize = 5;
const MIN_SAMPLE_MS: u64 = 100;
const MAX_SAMPLE_MS: u64 = 5_000;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Observation {
    pub actor_id: u64,
    pub skill_id: u32,
    pub raw_remaining_units: Option<u32>,
    pub unit: String,
    pub estimated_remaining_ms: Option<u64>,
    pub estimated_rate_units_per_ms: Option<f64>,
    pub rate_samples: usize,
    pub charges: Option<u32>,
    pub observed_at_ms: Option<u64>,
    pub charges_observed_at_ms: Option<u64>,
    pub fresh_for_ms: u64,
    pub fresh: bool,
    pub readiness: String,
    pub ready_confirmed: bool,
    pub source: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct CastUse {
    pub actor_id: u64,
    pub skill_id: u32,
    pub target_id: u64,
    pub last_observed_at_ms: u64,
    pub use_count: u32,
    pub fresh_for_ms: u64,
    pub fresh: bool,
    pub ready_confirmed: bool,
    pub source: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct Snapshot {
    pub local_actor_id: Option<u64>,
    pub own: Vec<Observation>,
    pub peers: Vec<Observation>,
    pub casts: Vec<CastUse>,
}

#[derive(Clone, Debug, Default)]
struct Counter {
    actor_id: u64,
    skill_id: u32,
    remaining_units: Option<u32>,
    counter_valid: bool,
    observed_at_ms: Option<u64>,
    charges: Option<u32>,
    charges_observed_at_ms: Option<u64>,
    rates: VecDeque<f64>,
    peer: bool,
}

impl Counter {
    fn observe(&mut self, units: Option<u32>, charges: Option<u32>, now: u64) {
        let charge_transition = charges.is_some_and(|count| self.charges != Some(count));
        if charge_transition {
            self.rates.clear();
            if units.is_none() {
                // A charge transition can supersede a prior zero without
                // providing the new counter. Retain the historical raw value,
                // but do not continue calling that earlier state ready.
                self.counter_valid = false;
            }
        }
        if let Some(units) = units {
            if let (Some(previous), Some(at)) = (self.remaining_units, self.observed_at_ms) {
                let elapsed = now.saturating_sub(at);
                if charge_transition || now < at || elapsed > MAX_SAMPLE_MS || units > previous {
                    self.rates.clear();
                } else if units > 0 && units < previous {
                    if (MIN_SAMPLE_MS..=MAX_SAMPLE_MS).contains(&elapsed) {
                        let rate = f64::from(previous - units) / elapsed as f64;
                        if (0.01..=100.0).contains(&rate) {
                            // A changed reduction/buff or discontinuous counter
                            // invalidates the old calibration immediately.
                            if self
                                .rate()
                                .is_some_and(|old| (rate / old - 1.0).abs() > 0.2)
                            {
                                self.rates.clear();
                            }
                            self.rates.push_back(rate);
                            while self.rates.len() > MAX_RATE_SAMPLES {
                                self.rates.pop_front();
                            }
                        } else {
                            self.rates.clear();
                        }
                    } else {
                        self.rates.clear();
                    }
                } else if units == previous && units != 0 {
                    // A stationary value does not continue an earlier slope.
                    self.rates.clear();
                }
            }
            if units == 0 {
                self.rates.clear();
            }
            self.remaining_units = Some(units);
            self.observed_at_ms = Some(now);
            self.counter_valid = true;
        }
        if let Some(charges) = charges {
            self.charges = Some(charges);
            self.charges_observed_at_ms = Some(now);
        }
    }

    fn rate(&self) -> Option<f64> {
        // Three independent falling intervals require four received samples.
        if self.rates.len() < 3 {
            return None;
        }
        let mut values: Vec<_> = self.rates.iter().copied().collect();
        values.sort_by(f64::total_cmp);
        let median = values[values.len() / 2];
        ((values[values.len() - 1] - values[0]) / median <= 0.2).then_some(median)
    }

    fn snapshot(&self, now: u64) -> Observation {
        let is_fresh =
            |at: Option<u64>| at.is_some_and(|at| now >= at && now - at <= COUNTER_FRESH_MS);
        let fresh = self.counter_valid && is_fresh(self.observed_at_ms);
        let rate = fresh.then(|| self.rate()).flatten();
        let estimated_remaining_ms = rate.and_then(|rate| {
            let units = self.remaining_units?;
            let at = self.observed_at_ms?;
            let duration = (f64::from(units) / rate).ceil();
            if duration.is_finite() && duration <= 3_600_000.0 {
                Some((duration as u64).saturating_sub(now.saturating_sub(at)))
            } else {
                None
            }
        });
        let ready_confirmed = fresh && self.remaining_units == Some(0);
        let readiness = if !self.counter_valid {
            "unknown"
        } else if !fresh {
            if self.observed_at_ms.is_some() {
                "stale"
            } else {
                "unknown"
            }
        } else if ready_confirmed {
            "server-ready"
        } else if estimated_remaining_ms == Some(0) {
            "estimated-elapsed"
        } else if estimated_remaining_ms.is_some() {
            "estimated-cooling"
        } else {
            "unknown"
        };
        Observation {
            actor_id: self.actor_id,
            skill_id: self.skill_id,
            raw_remaining_units: self.remaining_units,
            unit: "server-counter".into(),
            estimated_remaining_ms,
            estimated_rate_units_per_ms: rate,
            rate_samples: self.rates.len(),
            charges: self.charges,
            observed_at_ms: self.observed_at_ms,
            charges_observed_at_ms: self.charges_observed_at_ms,
            fresh_for_ms: COUNTER_FRESH_MS,
            fresh,
            readiness: readiness.into(),
            ready_confirmed,
            source: if self.peer {
                "peer-relay"
            } else {
                "local-server"
            }
            .into(),
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct Ledger {
    local_actor_id: Option<u64>,
    counters: BTreeMap<(u64, u32), Counter>,
    casts: BTreeMap<(u64, u32), CastUse>,
    last_ms: Option<u64>,
}

impl Ledger {
    pub fn clear(&mut self) {
        *self = Self::default();
    }

    /// A connection or identity change invalidates all prior observations.
    pub fn bind_self(&mut self, actor_id: Option<u64>) {
        let actor_id = actor_id.filter(|id| *id != 0);
        if self.local_actor_id != actor_id {
            self.clear();
            self.local_actor_id = actor_id;
        }
    }

    fn tick(&mut self, now: u64) {
        if self.last_ms.is_some_and(|previous| now < previous) {
            let local = self.local_actor_id;
            self.clear();
            self.local_actor_id = local;
        }
        self.last_ms = Some(now);
    }

    pub fn observe_local(
        &mut self,
        skill_id: u32,
        units: Option<u32>,
        charges: Option<u32>,
        now: u64,
    ) {
        self.tick(now);
        if let Some(actor_id) = self.local_actor_id {
            self.observe_counter(actor_id, skill_id, units, charges, now, false);
        }
    }

    /// Accepts an explicitly received room peer observation, not an actorless
    /// game packet. The room layer must authenticate the sender's actor binding.
    /// A sender age is rebased to the receiving clock; remote clock values are
    /// never treated as local timestamps. Outdated relays cannot refresh a row.
    pub fn observe_peer(
        &mut self,
        actor_id: u64,
        skill_id: u32,
        units: Option<u32>,
        charges: Option<u32>,
        sender_age_ms: u64,
        received_at_ms: u64,
    ) {
        self.tick(received_at_ms);
        if actor_id == 0
            || self.local_actor_id == Some(actor_id)
            || sender_age_ms > COUNTER_FRESH_MS
            || sender_age_ms > received_at_ms
        {
            return;
        }
        let observed_at = received_at_ms - sender_age_ms;
        if self
            .counters
            .get(&(actor_id, skill_id))
            .and_then(|row| row.observed_at_ms)
            .is_some_and(|previous| observed_at <= previous)
        {
            return;
        }
        self.observe_counter(actor_id, skill_id, units, charges, observed_at, true);
    }

    fn observe_counter(
        &mut self,
        actor_id: u64,
        skill_id: u32,
        units: Option<u32>,
        charges: Option<u32>,
        now: u64,
        peer: bool,
    ) {
        if skill_id == 0
            || units.is_some_and(|value| value > MAX_UNITS)
            || charges.is_some_and(|value| value > MAX_CHARGES)
            || units.is_none() && charges.is_none()
        {
            return;
        }
        let key = (actor_id, skill_id);
        if self.counters.len() >= MAX_COUNTERS && !self.counters.contains_key(&key) {
            if let Some(oldest) = self
                .counters
                .iter()
                .min_by_key(|(_, row)| {
                    row.observed_at_ms
                        .or(row.charges_observed_at_ms)
                        .unwrap_or(0)
                })
                .map(|(key, _)| *key)
            {
                self.counters.remove(&oldest);
            }
        }
        let row = self.counters.entry(key).or_insert_with(|| Counter {
            actor_id,
            skill_id,
            peer,
            ..Counter::default()
        });
        row.observe(units, charges, now);
    }

    /// Records a received completed cast. Windups may be cancelled and should
    /// not call this method or start a guessed skill cooldown.
    pub fn observe_cast(&mut self, actor_id: u64, skill_id: u32, target_id: u64, now: u64) {
        self.tick(now);
        if actor_id == 0 || skill_id == 0 {
            return;
        }
        let key = (actor_id, skill_id);
        if self.casts.len() >= MAX_CASTS && !self.casts.contains_key(&key) {
            if let Some(oldest) = self
                .casts
                .iter()
                .min_by_key(|(_, row)| row.last_observed_at_ms)
                .map(|(key, _)| *key)
            {
                self.casts.remove(&oldest);
            }
        }
        let row = self.casts.entry(key).or_insert_with(|| CastUse {
            actor_id,
            skill_id,
            target_id,
            last_observed_at_ms: now,
            use_count: 0,
            fresh_for_ms: CAST_FRESH_MS,
            fresh: true,
            ready_confirmed: false,
            source: "server-cast".into(),
        });
        // Mirrored/batched duplicate records are not additional uses.
        if row.use_count > 0 && now.saturating_sub(row.last_observed_at_ms) < 100 {
            return;
        }
        row.target_id = target_id;
        row.last_observed_at_ms = now;
        row.use_count = row.use_count.saturating_add(1);
    }

    pub fn remove_actor(&mut self, actor_id: u64) {
        self.counters.retain(|(id, _), _| *id != actor_id);
        self.casts.retain(|(id, _), _| *id != actor_id);
        if self.local_actor_id == Some(actor_id) {
            self.local_actor_id = None;
        }
    }

    pub fn snapshot(&self, now: u64) -> Snapshot {
        if self.last_ms.is_some_and(|previous| now < previous) {
            return Snapshot {
                local_actor_id: self.local_actor_id,
                ..Snapshot::default()
            };
        }
        let mut output = Snapshot {
            local_actor_id: self.local_actor_id,
            ..Snapshot::default()
        };
        for row in self.counters.values() {
            let observation = row.snapshot(now);
            if row.peer {
                output.peers.push(observation);
            } else if self.local_actor_id == Some(row.actor_id) {
                output.own.push(observation);
            }
        }
        output.casts = self
            .casts
            .values()
            .cloned()
            .map(|mut row| {
                row.fresh = now >= row.last_observed_at_ms
                    && now - row.last_observed_at_ms <= CAST_FRESH_MS;
                row
            })
            .collect();
        output
    }
}
