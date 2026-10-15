//! Per-encounter summaries of fresh passive Windows TCP RTT observations.
//! No addresses or connection identifiers are stored.
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

pub const MAX_SAMPLES: usize = 600;
const TRACE_SAMPLES: usize = 7200;
const MAX_RTT: u32 = 120_000;

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct Sample {
    pub observed_at_ms: u64,
    pub rtt_ms: u32,
    pub latest_rtt_ms: Option<u32>,
    pub variation_ms: Option<u32>,
    pub measured_connections: u32,
}

impl Sample {
    fn valid(&self) -> bool {
        self.rtt_ms <= MAX_RTT
            && self.latest_rtt_ms.is_none_or(|v| v <= MAX_RTT)
            && self.variation_ms.is_none_or(|v| v <= MAX_RTT)
            && (1..=128).contains(&self.measured_connections)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct Snapshot {
    pub source: String,
    pub samples: Vec<Sample>,
    pub sample_count: usize,
    pub window_ms: u64,
    pub observed_span_ms: u64,
    pub partial: bool,
    pub truncated: bool,
    pub minimum_ms: Option<u32>,
    pub maximum_ms: Option<u32>,
    pub average_ms: Option<f64>,
    pub median_ms: Option<f64>,
    pub p95_ms: Option<u32>,
}

impl Default for Snapshot {
    fn default() -> Self {
        Self {
            source: "windows-tcp-estats".into(),
            samples: Vec::new(),
            sample_count: 0,
            window_ms: 0,
            observed_span_ms: 0,
            partial: true,
            truncated: false,
            minimum_ms: None,
            maximum_ms: None,
            average_ms: None,
            median_ms: None,
            p95_ms: None,
        }
    }
}

impl Snapshot {
    pub fn within(&self, start_ms: u64, end_ms: u64) -> Self {
        let trace = Trace {
            samples: self.samples.iter().cloned().collect(),
            dropped_through_ms: None,
        };
        let mut result = trace.snapshot(start_ms, end_ms);
        result.truncated |= self.truncated;
        result.partial |= self.partial || result.truncated;
        result
    }

    pub fn is_valid(&self) -> bool {
        self.source == "windows-tcp-estats"
            && self.samples.len() <= MAX_SAMPLES
            && self.sample_count == self.samples.len()
            && self.samples.iter().all(Sample::valid)
            && self
                .samples
                .windows(2)
                .all(|pair| pair[0].observed_at_ms < pair[1].observed_at_ms)
            && self.minimum_ms.is_none_or(|v| v <= MAX_RTT)
            && self.maximum_ms.is_none_or(|v| v <= MAX_RTT)
            && self
                .average_ms
                .is_none_or(|v| v.is_finite() && (0.0..=f64::from(MAX_RTT)).contains(&v))
            && self
                .median_ms
                .is_none_or(|v| v.is_finite() && (0.0..=f64::from(MAX_RTT)).contains(&v))
            && self.p95_ms.is_none_or(|v| v <= MAX_RTT)
    }
}

#[derive(Clone, Debug, Default)]
pub struct Trace {
    samples: VecDeque<Sample>,
    dropped_through_ms: Option<u64>,
}

impl Trace {
    pub fn clear(&mut self) {
        *self = Self::default();
    }

    /// Re-reading a held OS observation never creates another latency sample.
    pub fn observe(&mut self, sample: Sample, now_ms: u64) -> bool {
        if !sample.valid()
            || sample.observed_at_ms == 0
            || now_ms < sample.observed_at_ms
            || now_ms - sample.observed_at_ms > 5000
        {
            return false;
        }
        if let Some(last) = self.samples.back() {
            if sample.observed_at_ms < last.observed_at_ms {
                self.clear();
                return false;
            }
            if sample.observed_at_ms - last.observed_at_ms < 1000 {
                return false;
            }
        }
        self.samples.push_back(sample);
        while self.samples.len() > TRACE_SAMPLES {
            self.dropped_through_ms = self.samples.pop_front().map(|row| row.observed_at_ms);
        }
        true
    }

    pub fn snapshot(&self, start_ms: u64, end_ms: u64) -> Snapshot {
        if end_ms < start_ms {
            return Snapshot::default();
        }
        let mut result = Snapshot {
            window_ms: end_ms - start_ms,
            ..Snapshot::default()
        };
        let selected: Vec<_> = self
            .samples
            .iter()
            .filter(|row| (start_ms..=end_ms).contains(&row.observed_at_ms))
            .collect();
        let dropped = selected.len().saturating_sub(MAX_SAMPLES);
        result.samples = selected.into_iter().skip(dropped).cloned().collect();
        result.sample_count = result.samples.len();
        result.truncated = dropped > 0 || self.dropped_through_ms.is_some_and(|at| at >= start_ms);
        let (Some(first), Some(last)) = (result.samples.first(), result.samples.last()) else {
            return result;
        };
        result.observed_span_ms = last.observed_at_ms - first.observed_at_ms;
        result.partial = result.truncated
            || first.observed_at_ms - start_ms > 5000
            || end_ms - last.observed_at_ms > 5000
            || result
                .samples
                .windows(2)
                .any(|pair| pair[1].observed_at_ms - pair[0].observed_at_ms > 10_000);
        let mut values: Vec<_> = result.samples.iter().map(|row| row.rtt_ms).collect();
        values.sort_unstable();
        let len = values.len();
        let mid = len / 2;
        result.minimum_ms = values.first().copied();
        result.maximum_ms = values.last().copied();
        result.average_ms =
            Some(values.iter().map(|v| u64::from(*v)).sum::<u64>() as f64 / len as f64);
        result.median_ms = Some(if len % 2 == 1 {
            f64::from(values[mid])
        } else {
            f64::from(values[mid - 1] + values[mid]) / 2.0
        });
        result.p95_ms = Some(values[(len * 95).div_ceil(100).saturating_sub(1)]);
        result
    }
}
