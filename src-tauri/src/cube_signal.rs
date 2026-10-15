use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

pub const ANALYSIS_RATE: u32 = 16_000;
const FFT_SIZE: usize = 1024;
const HOP_SIZE: usize = 256;
const BAND_COUNT: usize = 48;
const BIN_COUNT: usize = FFT_SIZE / 2 + 1;
const FIRST_BIN: usize = 7;
const END_BIN: usize = 487;
const PROFILE_FRAMES: usize = 4;
const MAX_PROFILES: usize = 128;
const MIN_SAMPLE_RATE: u32 = 8_000;
const MAX_SAMPLE_RATE: u32 = 192_000;
const SILENCE_RMS: f32 = 0.000_025;
const EXPIRY_FRAMES: usize = 35;
const EVIDENCE_FRAMES: usize = 24;
const REQUIRED_EVIDENCE: usize = 14;

/// A small spectral reference, without the original recording or personal audio.
/// Scores are similarities to this reference, not calibrated probabilities.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CubeTemplate {
    pub version: u32,
    pub name: String,
    pub analysis_rate: u32,
    pub fft_size: usize,
    pub hop_size: usize,
    pub profiles: Vec<Vec<f32>>,
    pub signature: Vec<f32>,
    pub reference_rms: f32,
    pub duration_seconds: f32,
    pub minimum_tonal_fraction: f32,
}

impl CubeTemplate {
    pub fn validate(&self) -> Result<(), String> {
        if self.version != 1
            || self.analysis_rate != ANALYSIS_RATE
            || self.fft_size != FFT_SIZE
            || self.hop_size != HOP_SIZE
        {
            return Err("Unsupported Cube sound reference format".into());
        }
        if self.name.is_empty()
            || self.name.len() > 160
            || self.name.chars().any(char::is_control)
            || self.profiles.is_empty()
            || self.profiles.len() > MAX_PROFILES
            || self.signature.len() != BIN_COUNT
            || !self.reference_rms.is_finite()
            || self.reference_rms < SILENCE_RMS
            || self.reference_rms > 1.0
            || !self.duration_seconds.is_finite()
            || !(0.15..=120.0).contains(&self.duration_seconds)
            || !self.minimum_tonal_fraction.is_finite()
            || !(0.002..=0.25).contains(&self.minimum_tonal_fraction)
        {
            return Err("Invalid Cube sound reference".into());
        }
        for profile in &self.profiles {
            if profile.len() != BAND_COUNT || !normalized_vector(profile) {
                return Err("Invalid Cube temporal spectral profile".into());
            }
        }
        if !normalized_vector(&self.signature)
            || self.signature[..FIRST_BIN].iter().any(|x| *x != 0.0)
            || self.signature[END_BIN..].iter().any(|x| *x != 0.0)
        {
            return Err("Invalid Cube spectral signature".into());
        }
        if self
            .signature
            .iter()
            .filter(|weight| **weight > 0.0)
            .count()
            > 64
        {
            return Err(
                "Recording has no stable distinctive Cube sound; choose a clearer interval".into(),
            );
        }
        Ok(())
    }
}

fn normalized_vector(values: &[f32]) -> bool {
    values
        .iter()
        .all(|x| x.is_finite() && *x >= 0.0 && *x <= 1.001)
        && (0.98..=1.02).contains(&values.iter().map(|x| x * x).sum::<f32>())
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct CubeDetection {
    pub score: f32,
    pub detected: bool,
    pub direction: String,
    pub direction_confidence: f32,
    pub strength_db: Option<f32>,
    pub trend: String,
    pub pan: f32,
    pub steer_degrees: Option<f32>,
    pub bearing_ambiguous: bool,
    pub snr_db: Option<f32>,
    pub signal_strength: Option<f32>,
}

impl Default for CubeDetection {
    fn default() -> Self {
        Self {
            score: 0.0,
            detected: false,
            direction: "unknown".into(),
            direction_confidence: 0.0,
            strength_db: None,
            trend: "unknown".into(),
            pan: 0.0,
            steer_degrees: None,
            bearing_ambiguous: true,
            snr_db: None,
            signal_strength: None,
        }
    }
}

#[derive(Clone)]
struct Spectrum {
    features: Vec<f32>,
    excess: Vec<f32>,
    left_power: Vec<f32>,
    right_power: Vec<f32>,
    tonal_fraction: f32,
    rms: f32,
}

struct ToneCluster {
    start: usize,
    end: usize,
    weight: f32,
}

struct LocalMatch {
    valid: bool,
    signature: Vec<f32>,
    features: Vec<f32>,
    snr_db: f32,
    left: f32,
    right: f32,
    pan_consistency: f32,
}

struct Resampler {
    rate: u32,
    channels: u16,
    input_index: u64,
    next_output: f64,
    previous: Option<[f32; 2]>,
    filter: Vec<f32>,
    filter_input: VecDeque<[f32; 2]>,
}

impl Resampler {
    fn new(rate: u32, channels: u16) -> Self {
        let filter = if rate > ANALYSIS_RATE {
            let length = 63;
            let cutoff = ANALYSIS_RATE as f32 * 0.47 / rate as f32;
            let mut coefficients: Vec<_> = (0..length)
                .map(|i| {
                    let offset = i as f32 - (length - 1) as f32 / 2.0;
                    let ideal = if offset == 0.0 {
                        2.0 * cutoff
                    } else {
                        (std::f32::consts::TAU * cutoff * offset).sin()
                            / (std::f32::consts::PI * offset)
                    };
                    ideal
                        * (0.54
                            - 0.46 * (std::f32::consts::TAU * i as f32 / (length - 1) as f32).cos())
                })
                .collect();
            let sum = coefficients.iter().sum::<f32>();
            for coefficient in &mut coefficients {
                *coefficient /= sum;
            }
            coefficients
        } else {
            Vec::new()
        };
        Self {
            rate,
            channels,
            input_index: 0,
            next_output: 0.0,
            previous: None,
            filter,
            filter_input: VecDeque::new(),
        }
    }

    fn append(&mut self, samples: &[f32], output: &mut VecDeque<[f32; 2]>) {
        for input in samples.chunks_exact(self.channels as usize) {
            let clean = |x: f32| {
                if x.is_finite() {
                    x.clamp(-1.0, 1.0)
                } else {
                    0.0
                }
            };
            let mut current = if self.channels == 2 {
                [clean(input[0]), clean(input[1])]
            } else {
                let mono = input.iter().map(|x| clean(*x)).sum::<f32>() / self.channels as f32;
                [mono, mono]
            };
            if !self.filter.is_empty() {
                self.filter_input.push_front(current);
                if self.filter_input.len() > self.filter.len() {
                    self.filter_input.pop_back();
                }
                current = [0.0, 0.0];
                for (sample, coefficient) in self.filter_input.iter().zip(&self.filter) {
                    current[0] += sample[0] * coefficient;
                    current[1] += sample[1] * coefficient;
                }
            }
            if let Some(previous) = self.previous {
                while self.next_output <= self.input_index as f64 {
                    let mix = (self.next_output - (self.input_index - 1) as f64) as f32;
                    output.push_back([
                        previous[0] + (current[0] - previous[0]) * mix,
                        previous[1] + (current[1] - previous[1]) * mix,
                    ]);
                    self.next_output += self.rate as f64 / ANALYSIS_RATE as f64;
                }
            } else {
                output.push_back(current);
                self.next_output += self.rate as f64 / ANALYSIS_RATE as f64;
            }
            self.previous = Some(current);
            self.input_index += 1;
        }
    }
}

/// Builds a reference from an explicitly selected recording interval.
/// Leading/trailing silence does not enter the spectral reference. Long
/// recordings retain at most 128 temporal profiles, so import size stays bounded.
pub fn create_template(
    samples: &[f32],
    sample_rate: u32,
    channels: u16,
    start_secs: f64,
    end_secs: f64,
    name: &str,
) -> Result<CubeTemplate, String> {
    if !valid_format(sample_rate, channels)
        || samples.len() % channels as usize != 0
        || !start_secs.is_finite()
        || !end_secs.is_finite()
        || start_secs < 0.0
        || end_secs - start_secs < 0.15
        || end_secs - start_secs > 120.0
        || name.is_empty()
        || name.len() > 160
        || name.chars().any(char::is_control)
    {
        return Err("Select between 0.15 and 120 seconds of valid PCM audio".into());
    }
    let available = samples.len() / channels as usize;
    let start = (start_secs * sample_rate as f64).round() as usize;
    let end = (end_secs * sample_rate as f64).round() as usize;
    if start >= end || end > available.saturating_add(1) {
        return Err("Cube sound interval is outside the recording".into());
    }
    let end = end.min(available);
    let selected = &samples[start * channels as usize..end * channels as usize];
    if selected.iter().any(|x| !x.is_finite()) {
        return Err("Cube sound reference contains invalid samples".into());
    }
    let mut resampler = Resampler::new(sample_rate, channels);
    let mut pending = VecDeque::new();
    let mut profiles = Vec::new();
    let mut signature = vec![0.0; BIN_COUNT];
    let mut group = vec![0.0; BAND_COUNT];
    let mut group_count = 0;
    let mut rms_sum = 0.0;
    let mut tonal_sum = 0.0;
    let mut frame_count = 0;
    // Import in short chunks: a two-minute recording never creates a
    // two-minute intermediate resampled buffer.
    for part in selected.chunks(sample_rate as usize / 4 * channels as usize) {
        resampler.append(part, &mut pending);
        while pending.len() >= FFT_SIZE {
            let window: Vec<_> = pending.iter().take(FFT_SIZE).copied().collect();
            let spectrum = spectrum(&window);
            for _ in 0..HOP_SIZE {
                pending.pop_front();
            }
            if spectrum.rms < SILENCE_RMS || spectrum.tonal_fraction < 0.005 {
                continue;
            }
            let total_excess = spectrum.excess.iter().sum::<f32>().max(1e-20);
            for (sum, value) in signature.iter_mut().zip(&spectrum.excess) {
                *sum += *value / total_excess;
            }
            for (sum, value) in group.iter_mut().zip(&spectrum.features) {
                *sum += *value;
            }
            rms_sum += spectrum.rms;
            tonal_sum += spectrum.tonal_fraction;
            frame_count += 1;
            group_count += 1;
            if group_count == PROFILE_FRAMES {
                normalize(&mut group);
                profiles.push(group.clone());
                group.fill(0.0);
                group_count = 0;
            }
        }
    }
    if frame_count < 6 || profiles.is_empty() {
        return Err(
            "Recording has too little distinctive Cube sound; choose a clearer interval".into(),
        );
    }
    for value in &mut signature {
        *value = (*value / frame_count as f32).sqrt();
    }
    let peak = signature.iter().copied().fold(0.0_f32, f32::max);
    for value in &mut signature {
        // Keep the persistent core of the chime. Importing every small
        // incidental peak makes a noisy reference impossible to match and
        // can make background noise appear to be part of the Cube sound.
        if *value < peak * 0.65 {
            *value = 0.0;
        }
    }
    normalize(&mut signature);
    if profiles.len() > MAX_PROFILES {
        let last = profiles.len() - 1;
        profiles = (0..MAX_PROFILES)
            .map(|i| profiles[i * last / (MAX_PROFILES - 1)].clone())
            .collect();
    }
    let template = CubeTemplate {
        version: 1,
        name: name.to_owned(),
        analysis_rate: ANALYSIS_RATE,
        fft_size: FFT_SIZE,
        hop_size: HOP_SIZE,
        profiles,
        signature,
        reference_rms: rms_sum / frame_count as f32,
        duration_seconds: (end_secs - start_secs) as f32,
        minimum_tonal_fraction: (tonal_sum / frame_count as f32 * 0.025).clamp(0.002, 0.05),
    };
    template.validate()?;
    Ok(template)
}

fn valid_format(rate: u32, channels: u16) -> bool {
    (MIN_SAMPLE_RATE..=MAX_SAMPLE_RATE).contains(&rate) && (1..=8).contains(&channels)
}

pub struct CubeDetector {
    template: CubeTemplate,
    threshold: f32,
    masked_profiles: Vec<Vec<f32>>,
    clusters: Vec<ToneCluster>,
    resampler: Option<Resampler>,
    pending: VecDeque<[f32; 2]>,
    group: Vec<f32>,
    group_count: usize,
    history: VecDeque<Vec<f32>>,
    evidence: VecDeque<bool>,
    missed_frames: usize,
    frame_number: u64,
    strengths: VecDeque<(u64, f32)>,
    steering_energies: Option<[f32; 2]>,
    output: CubeDetection,
}

impl CubeDetector {
    pub fn new(template: CubeTemplate, threshold: f32) -> Result<Self, String> {
        template.validate()?;
        if !threshold.is_finite() || !(0.6..=0.98).contains(&threshold) {
            return Err("Cube sensitivity must be between 0.60 and 0.98".into());
        }
        let mut band_mask = vec![0.0; BAND_COUNT];
        for (bin, weight) in template.signature.iter().enumerate() {
            if *weight > 0.0 {
                band_mask[band_for_bin(bin)] = 1.0;
            }
        }
        let masked_profiles = template
            .profiles
            .iter()
            .map(|profile| masked(profile, &band_mask))
            .collect();
        let mut clusters: Vec<ToneCluster> = Vec::new();
        for (bin, value) in template.signature.iter().enumerate() {
            if *value == 0.0 {
                continue;
            }
            if let Some(cluster) = clusters.last_mut().filter(|cluster| bin <= cluster.end + 2) {
                cluster.end = bin;
                cluster.weight += value * value;
            } else {
                clusters.push(ToneCluster {
                    start: bin,
                    end: bin,
                    weight: value * value,
                });
            }
        }
        Ok(Self {
            template,
            threshold,
            masked_profiles,
            clusters,
            resampler: None,
            pending: VecDeque::new(),
            group: vec![0.0; BAND_COUNT],
            group_count: 0,
            history: VecDeque::new(),
            evidence: VecDeque::new(),
            missed_frames: EXPIRY_FRAMES,
            frame_number: 0,
            strengths: VecDeque::new(),
            steering_energies: None,
            output: CubeDetection::default(),
        })
    }

    /// Clears a stream gap/device change immediately, including stale arrows.
    pub fn reset(&mut self) -> CubeDetection {
        self.resampler = None;
        self.pending.clear();
        self.group.fill(0.0);
        self.group_count = 0;
        self.history.clear();
        self.evidence.clear();
        self.missed_frames = EXPIRY_FRAMES;
        self.frame_number = 0;
        self.strengths.clear();
        self.steering_energies = None;
        self.output = CubeDetection::default();
        self.output.clone()
    }

    /// The capture service calls this after a wall-clock stream timeout.
    pub fn expire(&mut self) -> CubeDetection {
        self.reset()
    }

    #[cfg(test)]
    pub fn status(&self) -> CubeDetection {
        self.output.clone()
    }

    pub fn push(
        &mut self,
        samples: &[f32],
        sample_rate: u32,
        channels: u16,
        discontinuity: bool,
    ) -> CubeDetection {
        if discontinuity
            || self
                .resampler
                .as_ref()
                .is_some_and(|r| r.rate != sample_rate || r.channels != channels)
        {
            self.reset();
        }
        if !valid_format(sample_rate, channels)
            || samples.len() % channels as usize != 0
            || samples.len() > sample_rate as usize * channels as usize * 2
        {
            return self.reset();
        }
        if samples.is_empty() {
            return self.output.clone();
        }
        if samples.iter().filter(|x| !x.is_finite()).count() > samples.len() / 16 {
            return self.reset();
        }
        // Resample bounded 250 ms blocks even if the caller supplies two seconds.
        let part_size = sample_rate as usize / 4 * channels as usize;
        for part in samples.chunks(part_size) {
            self.resampler
                .get_or_insert_with(|| Resampler::new(sample_rate, channels))
                .append(part, &mut self.pending);
            while self.pending.len() >= FFT_SIZE {
                let window: Vec<_> = self.pending.iter().take(FFT_SIZE).copied().collect();
                let analysis = spectrum(&window);
                for _ in 0..HOP_SIZE {
                    self.pending.pop_front();
                }
                self.analyze(analysis, channels == 2);
            }
        }
        self.output.clone()
    }

    fn analyze(&mut self, spectrum: Spectrum, stereo: bool) {
        self.frame_number += 1;
        let local = self.local_match(&spectrum);
        let signature_score = dot(&local.signature, &self.template.signature);
        // The sound can be quiet inside a loud game mix. Its contribution to
        // the whole mix is deliberately not an acceptance gate; each separate
        // reference tone must instead rise above its own neighboring noise.
        let valid = local.valid && signature_score >= self.threshold - 0.08;
        let features = &local.features;
        let instant = self
            .masked_profiles
            .iter()
            .map(|profile| dot(features, profile))
            .fold(0.0_f32, f32::max);
        let similarity = (instant * 0.45 + signature_score * 0.55).clamp(0.0, 1.0);
        self.output.score = if valid {
            similarity
        } else {
            similarity.min(0.59)
        };
        let matched = valid && similarity >= self.threshold;
        self.evidence.push_back(matched);
        if self.evidence.len() > EVIDENCE_FRAMES {
            self.evidence.pop_front();
        }
        if matched {
            for (sum, value) in self.group.iter_mut().zip(features) {
                *sum += *value;
            }
            self.group_count += 1;
            if self.group_count == PROFILE_FRAMES {
                normalize(&mut self.group);
                self.history.push_back(self.group.clone());
                if self.history.len() > 6 {
                    self.history.pop_front();
                }
                self.group.fill(0.0);
                self.group_count = 0;
            }
            // Short masking sounds may hide a frame. Require sustained
            // multi-tone evidence across a bounded window, rather than
            // restarting acquisition on each footstep or wind transient.
            if self.evidence.iter().filter(|matched| **matched).count() >= REQUIRED_EVIDENCE
                && self
                    .evidence
                    .iter()
                    .rev()
                    .take(6)
                    .filter(|matched| **matched)
                    .count()
                    >= 3
                && self.history.len() >= 3
                && self.temporal_score() >= self.threshold - 0.08
            {
                self.missed_frames = 0;
                self.output.detected = true;
                self.update_location(&local, stereo, similarity);
            } else {
                self.missed_frames += 1;
            }
        } else {
            self.missed_frames += 1;
            if !self.evidence.iter().any(|matched| *matched) {
                self.group.fill(0.0);
                self.group_count = 0;
                self.history.clear();
            }
        }
        if self.missed_frames >= EXPIRY_FRAMES {
            self.output.detected = false;
            self.output.direction = "unknown".into();
            self.output.direction_confidence = 0.0;
            self.output.strength_db = None;
            self.output.trend = "unknown".into();
            self.output.pan = 0.0;
            self.output.steer_degrees = None;
            self.output.snr_db = None;
            self.output.signal_strength = None;
            self.strengths.clear();
            self.steering_energies = None;
        }
    }

    fn local_match(&self, spectrum: &Spectrum) -> LocalMatch {
        let mut covered = [0.0; 2];
        let mut strong_clusters = [0; 2];
        let mut channel_bins = [vec![0.0; BIN_COUNT], vec![0.0; BIN_COUNT]];
        let mut weakest_snr = [60.0_f32; 2];
        let mut cluster_energies = Vec::new();
        let required_snr = 1.0 + (self.threshold - 0.6) * 8.0;
        for cluster in &self.clusters {
            let mut energies = [0.0; 2];
            for (channel, power) in [&spectrum.left_power, &spectrum.right_power]
                .iter()
                .enumerate()
            {
                let mut neighbors = Vec::new();
                for bin in cluster.start.saturating_sub(12)..=(cluster.end + 12).min(END_BIN - 1) {
                    if bin + 2 < cluster.start || bin > cluster.end + 2 {
                        neighbors.push(power[bin]);
                    }
                }
                // A nearby voice/music harmonic must not inflate the entire
                // local noise estimate. The upper median is conservative for
                // broadband noise while resisting isolated neighboring tones.
                neighbors.sort_by(f32::total_cmp);
                let floor_per_bin = neighbors[neighbors.len() * 3 / 5] * 1.4;
                let floor = floor_per_bin * (cluster.end - cluster.start + 1) as f32;
                let signal =
                    (power[cluster.start..=cluster.end].iter().sum::<f32>() - floor).max(0.0);
                let snr =
                    (10.0 * (signal / floor.max(1e-20)).max(1e-12).log10()).clamp(-120.0, 60.0);
                weakest_snr[channel] = weakest_snr[channel].min(snr);
                let peak = power[cluster.start..=cluster.end]
                    .iter()
                    .copied()
                    .fold(0.0_f32, f32::max);
                let nearby_peak = power
                    [cluster.start.saturating_sub(2)..=(cluster.end + 2).min(END_BIN - 1)]
                    .iter()
                    .copied()
                    .fold(0.0_f32, f32::max);
                if snr >= required_snr && peak >= nearby_peak * 0.85 {
                    covered[channel] += cluster.weight;
                    strong_clusters[channel] += 1;
                    for bin in cluster.start..=cluster.end {
                        channel_bins[channel][bin] = (power[bin] - floor_per_bin).max(0.0);
                        energies[channel] += channel_bins[channel][bin];
                    }
                }
            }
            cluster_energies.push(energies);
        }
        // Both independent tones must be present in the same ear. A low tone
        // in one speaker and an unrelated high tone in the other is no match.
        let channel_valid = [0, 1].map(|channel| {
            let mut query: Vec<_> = channel_bins[channel]
                .iter()
                .map(|power| power.sqrt())
                .collect();
            normalize(&mut query);
            covered[channel] >= 0.80
                && strong_clusters[channel] >= self.clusters.len().min(2)
                && dot(&query, &self.template.signature) >= self.threshold - 0.08
        });
        let mut signature = vec![0.0; BIN_COUNT];
        let mut features = vec![0.0; BAND_COUNT];
        let mut left = 0.0;
        let mut right = 0.0;
        for bin in FIRST_BIN..END_BIN {
            let l = if channel_valid[0] {
                channel_bins[0][bin]
            } else {
                0.0
            };
            let r = if channel_valid[1] {
                channel_bins[1][bin]
            } else {
                0.0
            };
            left += l;
            right += r;
            signature[bin] = ((l + r) * 0.5).sqrt();
            features[band_for_bin(bin)] += (l + r) * 0.5;
        }
        normalize(&mut signature);
        let total = features.iter().sum::<f32>().max(1e-20);
        for feature in &mut features {
            *feature = (*feature / total * 100.0).ln_1p();
        }
        normalize(&mut features);
        let matched_rms =
            (((left + right) * 0.5) * 2.0 / (FFT_SIZE * FFT_SIZE) as f32 / 0.375).sqrt();
        let pan = (right - left) / (right + left).max(1e-20);
        let variance = cluster_energies
            .iter()
            .zip(&self.clusters)
            .map(|(energies, cluster)| {
                // Keep a partially matching opposite channel in the uncertainty
                // check. Dropping it here would turn a missing tone into false
                // certainty that the entire sound is hard-panned.
                let l = energies[0];
                let r = energies[1];
                let cluster_pan = (r - l) / (r + l).max(1e-20);
                cluster.weight * (cluster_pan - pan).powi(2)
            })
            .sum::<f32>();
        LocalMatch {
            valid: channel_valid.iter().any(|valid| *valid) && matched_rms >= SILENCE_RMS,
            signature,
            features,
            snr_db: [0, 1]
                .into_iter()
                .filter(|channel| channel_valid[*channel])
                .map(|channel| weakest_snr[channel])
                .fold(-120.0_f32, f32::max),
            left,
            right,
            pan_consistency: (1.0 - variance * 4.0).clamp(0.0, 1.0),
        }
    }

    fn temporal_score(&self) -> f32 {
        let length = self.history.len().min(self.masked_profiles.len()).min(6);
        if length == 0 {
            return 0.0;
        }
        let query_start = self.history.len() - length;
        let mut best = 0.0_f32;
        for start in 0..=self.masked_profiles.len() - length {
            let mut sum = 0.0;
            let mut weakest = 1.0_f32;
            for offset in 0..length {
                let similarity = dot(
                    &self.history[query_start + offset],
                    &self.masked_profiles[start + offset],
                );
                sum += similarity;
                weakest = weakest.min(similarity);
            }
            best = best.max(sum / length as f32 * 0.75 + weakest * 0.25);
        }
        best
    }

    fn update_location(&mut self, local: &LocalMatch, stereo: bool, similarity: f32) {
        let energies = self
            .steering_energies
            .map_or([local.left, local.right], |last| {
                [
                    last[0] * 0.82 + local.left * 0.18,
                    last[1] * 0.82 + local.right * 0.18,
                ]
            });
        let pan =
            ((energies[1] - energies[0]) / (energies[1] + energies[0]).max(1e-20)).clamp(-1.0, 1.0);
        if stereo && local.pan_consistency >= 0.65 {
            self.steering_energies = Some(energies);
            self.output.direction =
                if pan > 0.22 || (self.output.direction == "right" && pan > 0.12) {
                    "right"
                } else if pan < -0.22 || (self.output.direction == "left" && pan < -0.12) {
                    "left"
                } else {
                    "center"
                }
                .into();
            self.output.direction_confidence = similarity
                * local.pan_consistency
                * if pan.abs() > 0.22 {
                    pan.abs()
                } else {
                    1.0 - pan.abs()
                };
            self.output.pan = pan;
            // This is an audio-balance steering control, not a world heading.
            // Stereo cannot distinguish equally panned front/back positions.
            self.output.steer_degrees = Some(pan.asin().to_degrees());
        } else {
            self.output.direction = "unknown".into();
            self.output.direction_confidence = 0.0;
            self.output.pan = 0.0;
            self.output.steer_degrees = None;
        }
        // Hann-window power conversion yields a relative dBFS estimate. It
        // cannot identify metres or front/back position from a stereo mix.
        let mean_power = (local.left + local.right) * 0.5;
        let rms = (mean_power * 2.0 / (FFT_SIZE * FFT_SIZE) as f32 / 0.375).sqrt();
        let db = (20.0 * rms.max(1e-10).log10()).clamp(-120.0, 0.0);
        let smoothed = self
            .output
            .strength_db
            .map_or(db, |last| last * 0.75 + db * 0.25);
        self.output.strength_db = Some(smoothed);
        self.output.signal_strength = Some(
            (0.5 + (smoothed - 20.0 * self.template.reference_rms.log10()) / 32.0).clamp(0.0, 1.0),
        );
        self.output.snr_db = Some(
            self.output
                .snr_db
                .map_or(local.snr_db, |last| last * 0.75 + local.snr_db * 0.25),
        );
        self.strengths.push_back((self.frame_number, smoothed));
        while self.strengths.len() > 125 {
            self.strengths.pop_front();
        }
        self.output.trend = if let Some((frame, previous)) = self.strengths.front() {
            if self.frame_number - frame < 45 {
                "unknown"
            } else if smoothed - previous > 2.5 {
                "approaching"
            } else if previous - smoothed > 2.5 {
                "receding"
            } else {
                "steady"
            }
        } else {
            "unknown"
        }
        .into();
    }
}

fn masked(values: &[f32], mask: &[f32]) -> Vec<f32> {
    let mut output: Vec<_> = values.iter().zip(mask).map(|(x, m)| x * m).collect();
    normalize(&mut output);
    output
}

fn normalize(values: &mut [f32]) {
    let norm = values.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 1e-20 {
        for value in values {
            *value /= norm;
        }
    }
}

fn dot(left: &[f32], right: &[f32]) -> f32 {
    left.iter()
        .zip(right)
        .map(|(a, b)| a * b)
        .sum::<f32>()
        .clamp(0.0, 1.0)
}

fn band_for_bin(bin: usize) -> usize {
    let hz = (bin as f32 * ANALYSIS_RATE as f32 / FFT_SIZE as f32).max(100.0);
    ((hz / 100.0).ln() / (7600.0_f32 / 100.0).ln() * BAND_COUNT as f32)
        .floor()
        .clamp(0.0, (BAND_COUNT - 1) as f32) as usize
}

fn spectrum(samples: &[[f32; 2]]) -> Spectrum {
    let mut left_re = vec![0.0; FFT_SIZE];
    let mut right_re = vec![0.0; FFT_SIZE];
    let mut left_im = vec![0.0; FFT_SIZE];
    let mut right_im = vec![0.0; FFT_SIZE];
    let mut square_sum = 0.0;
    for (index, sample) in samples.iter().enumerate() {
        let window = 0.5 - 0.5 * (std::f32::consts::TAU * index as f32 / FFT_SIZE as f32).cos();
        left_re[index] = sample[0] * window;
        right_re[index] = sample[1] * window;
        square_sum += (sample[0] * sample[0] + sample[1] * sample[1]) * 0.5;
    }
    fft(&mut left_re, &mut left_im);
    fft(&mut right_re, &mut right_im);
    let left: Vec<_> = (0..BIN_COUNT)
        .map(|i| left_re[i] * left_re[i] + left_im[i] * left_im[i])
        .collect();
    let right: Vec<_> = (0..BIN_COUNT)
        .map(|i| right_re[i] * right_re[i] + right_im[i] * right_im[i])
        .collect();
    let left_excess = tonal_excess(&left);
    let right_excess = tonal_excess(&right);
    let excess: Vec<_> = left_excess
        .iter()
        .zip(&right_excess)
        .map(|(l, r)| (l + r) * 0.5)
        .collect();
    let power: f32 = left[FIRST_BIN..END_BIN]
        .iter()
        .zip(&right[FIRST_BIN..END_BIN])
        .map(|(l, r)| (l + r) * 0.5)
        .sum();
    let total_excess = excess.iter().sum::<f32>();
    let mut features = vec![0.0; BAND_COUNT];
    for (bin, amount) in excess.iter().enumerate().take(END_BIN).skip(FIRST_BIN) {
        features[band_for_bin(bin)] += amount;
    }
    for feature in &mut features {
        *feature = (*feature / total_excess.max(1e-20) * 100.0).ln_1p();
    }
    normalize(&mut features);
    Spectrum {
        features,
        excess,
        left_power: left,
        right_power: right,
        tonal_fraction: total_excess / power.max(1e-20),
        rms: (square_sum / FFT_SIZE as f32).sqrt(),
    }
}

fn tonal_excess(power: &[f32]) -> Vec<f32> {
    let mut excess = vec![0.0; BIN_COUNT];
    for bin in FIRST_BIN..END_BIN {
        let mut surrounding = 0.0;
        let mut count = 0;
        for neighbor in bin.saturating_sub(7)..=(bin + 7).min(BIN_COUNT - 1) {
            if neighbor.abs_diff(bin) > 2 {
                surrounding += power[neighbor];
                count += 1;
            }
        }
        let floor = surrounding / count as f32;
        excess[bin] = (power[bin] - floor * 2.5).max(0.0);
    }
    excess
}

// Iterative radix-two FFT. No native DSP library/driver is required.
fn fft(real: &mut [f32], imaginary: &mut [f32]) {
    let size = real.len();
    let mut reverse = 0;
    for i in 1..size {
        let mut bit = size >> 1;
        while reverse & bit != 0 {
            reverse ^= bit;
            bit >>= 1;
        }
        reverse ^= bit;
        if i < reverse {
            real.swap(i, reverse);
            imaginary.swap(i, reverse);
        }
    }
    let mut length = 2;
    while length <= size {
        let angle = -std::f32::consts::TAU / length as f32;
        let step_re = angle.cos();
        let step_im = angle.sin();
        for start in (0..size).step_by(length) {
            let mut rotation_re = 1.0;
            let mut rotation_im = 0.0;
            for offset in 0..length / 2 {
                let even = start + offset;
                let odd = even + length / 2;
                let odd_re = real[odd] * rotation_re - imaginary[odd] * rotation_im;
                let odd_im = real[odd] * rotation_im + imaginary[odd] * rotation_re;
                real[odd] = real[even] - odd_re;
                imaginary[odd] = imaginary[even] - odd_im;
                real[even] += odd_re;
                imaginary[even] += odd_im;
                let next_re = rotation_re * step_re - rotation_im * step_im;
                rotation_im = rotation_re * step_im + rotation_im * step_re;
                rotation_re = next_re;
            }
        }
        length <<= 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn signal(rate: u32, seconds: f32, left: f32, right: f32, background: f32) -> Vec<f32> {
        (0..(rate as f32 * seconds) as usize)
            .flat_map(|index| {
                let t = index as f32 / rate as f32;
                let cube = (std::f32::consts::TAU * 625.0 * t).sin() * 0.18
                    + (std::f32::consts::TAU * 1875.0 * t).sin() * 0.15;
                let ambient = (std::f32::consts::TAU * 3500.0 * t).sin() * background;
                [cube * left, cube * right + ambient]
            })
            .collect()
    }

    fn template() -> CubeTemplate {
        create_template(
            &signal(16_000, 1.5, 1.0, 1.0, 0.0),
            16_000,
            2,
            0.0,
            1.5,
            "Test Cube",
        )
        .unwrap()
    }

    fn detector() -> CubeDetector {
        CubeDetector::new(template(), 0.82).unwrap()
    }

    fn builtin_detector() -> CubeDetector {
        CubeDetector::new(
            serde_json::from_str(include_str!("cube_reference.json")).unwrap(),
            0.82,
        )
        .unwrap()
    }

    // Independent fixtures model a quiet two-tone chime inside much louder
    // rumble, colored wind, and voice harmonics on the opposite side.
    fn game_mix(seconds: f32, cube_gain: f32, music: bool) -> Vec<f32> {
        let mut seed = 0x159a_7c31_u32;
        let mut wind = 0.0;
        (0..(16_000.0 * seconds) as usize)
            .flat_map(|i| {
                let t = i as f32 / 16_000.0;
                seed ^= seed << 13;
                seed ^= seed >> 17;
                seed ^= seed << 5;
                let white = (seed as f64 / u32::MAX as f64 * 2.0 - 1.0) as f32;
                wind = wind * 0.94 + white * 0.06;
                let cube = ((std::f32::consts::TAU * 1677.0 * t).sin() * 0.003
                    + (std::f32::consts::TAU * 3540.0 * t).sin() * 0.0025)
                    * cube_gain;
                let background = if music {
                    let root = [261.6256, 329.6276, 391.9954, 440.0][(t as usize) % 4];
                    (1..=18)
                        .map(|h| {
                            (std::f32::consts::TAU * root * h as f32 * t).sin() * 0.04
                                / (h as f32).powf(0.8)
                        })
                        .sum::<f32>()
                } else {
                    let voice = [240.0, 480.0, 960.0, 1440.0, 2240.0, 3220.0]
                        .iter()
                        .enumerate()
                        .map(|(k, f)| {
                            (std::f32::consts::TAU * f * t + (k as f32 + 0.2) * t.sin()).sin()
                                * 0.012
                                / (1.0 + k as f32 * 0.3)
                        })
                        .sum::<f32>()
                        * (0.55 + 0.45 * (std::f32::consts::TAU * 3.4 * t).sin());
                    wind * 0.12
                        + white * 0.004
                        + voice
                        + (std::f32::consts::TAU * 73.0 * t).sin() * 0.04
                };
                [cube + background * 0.3, cube * 0.15 + background]
            })
            .collect()
    }

    fn streaming_detections(mut stream: CubeDetector, samples: &[f32]) -> Vec<CubeDetection> {
        samples
            .chunks(1600)
            .map(|chunk| stream.push(chunk, 16_000, 2, false))
            .collect()
    }

    #[test]
    fn fft_finds_known_frequency() {
        let mut real: Vec<_> = (0..FFT_SIZE)
            .map(|i| (std::f32::consts::TAU * 40.0 * i as f32 / FFT_SIZE as f32).cos())
            .collect();
        let mut imaginary = vec![0.0; FFT_SIZE];
        fft(&mut real, &mut imaginary);
        assert!((real[40] - 512.0).abs() < 0.01);
        assert!(real[39].abs() < 0.01);
    }

    #[test]
    fn template_round_trip_and_bounds() {
        let original = template();
        let decoded: CubeTemplate =
            serde_json::from_str(&serde_json::to_string(&original).unwrap()).unwrap();
        decoded.validate().unwrap();
        let mut invalid = decoded.clone();
        invalid.signature[0] = f32::NAN;
        assert!(invalid.validate().is_err());
        invalid = decoded.clone();
        invalid.profiles = vec![decoded.profiles[0].clone(); MAX_PROFILES + 1];
        assert!(invalid.validate().is_err());
        invalid = decoded;
        invalid.analysis_rate = 48_000;
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn rejects_silent_reference_and_invalid_selection() {
        assert!(create_template(&vec![0.0; 48_000], 16_000, 2, 0.0, 1.5, "Silent").is_err());
        assert!(create_template(&[f32::NAN; 32_000], 16_000, 2, 0.0, 1.0, "Invalid").is_err());
        assert!(create_template(&[0.0; 32_000], 16_000, 0, 0.0, 1.0, "Invalid").is_err());
        assert!(create_template(&[0.0; 32_000], 16_000, 2, 0.8, 0.1, "Invalid").is_err());
        assert!(CubeDetector::new(template(), f32::NAN).is_err());
    }

    #[test]
    fn rejects_noise_only_reference() {
        let mut state = 0x9858_7bbb_u32;
        let samples: Vec<_> = (0..48_000)
            .map(|_| {
                state ^= state << 13;
                state ^= state >> 17;
                state ^= state << 5;
                (state as f32 / u32::MAX as f32 - 0.5) * 0.2
            })
            .collect();
        assert!(create_template(&samples, 16_000, 2, 0.0, 1.5, "Noise").is_err());
        let mut broad = template();
        broad.signature.fill(0.0);
        for weight in &mut broad.signature[20..120] {
            *weight = 0.1;
        }
        assert!(broad.validate().is_err());
    }

    #[test]
    fn recognizes_matching_reference_and_center() {
        let detection = detector().push(&signal(16_000, 1.5, 1.0, 1.0, 0.0), 16_000, 2, false);
        assert!(detection.detected, "{detection:?}");
        assert!(detection.score > 0.95);
        assert_eq!(detection.direction, "center");
        assert!(detection.strength_db.unwrap() < 0.0);
    }

    #[test]
    fn gain_invariance_and_silence_gate() {
        let reference = signal(16_000, 1.5, 1.0, 1.0, 0.0);
        let low: Vec<_> = reference.iter().map(|x| x * 0.005).collect();
        let quiet = detector().push(&low, 16_000, 2, false);
        assert!(quiet.detected, "{quiet:?}");
        let ordinary = detector().push(&reference, 16_000, 2, false);
        assert!((ordinary.score - quiet.score).abs() < 0.02);
        let inaudible: Vec<_> = reference.iter().map(|x| x * 0.000_001).collect();
        assert!(!detector().push(&inaudible, 16_000, 2, false).detected);
    }

    #[test]
    fn direction_uses_cube_energy_instead_of_loud_opposite_background() {
        let left = detector().push(&signal(16_000, 1.5, 1.0, 0.15, 0.55), 16_000, 2, false);
        assert!(left.detected, "{left:?}");
        assert_eq!(left.direction, "left");
        let right = detector().push(&signal(16_000, 1.5, 0.15, 1.0, 0.0), 16_000, 2, false);
        assert!(right.detected);
        assert_eq!(right.direction, "right");
    }

    #[test]
    fn mono_has_no_invented_direction() {
        let stereo = signal(16_000, 1.5, 1.0, 1.0, 0.0);
        let mono: Vec<_> = stereo.chunks_exact(2).map(|frame| frame[0]).collect();
        let detection = detector().push(&mono, 16_000, 1, false);
        assert!(detection.detected);
        assert_eq!(detection.direction, "unknown");
        assert_eq!(detection.direction_confidence, 0.0);
    }

    #[test]
    fn handles_48k_resampling() {
        let detection = detector().push(&signal(48_000, 1.5, 0.2, 1.0, 0.0), 48_000, 2, false);
        assert!(detection.detected, "{detection:?}");
        assert_eq!(detection.direction, "right");
    }

    #[test]
    fn chunking_has_identical_sample_clock() {
        let samples = signal(44_100, 1.5, 1.0, 0.1, 0.0);
        let expected = detector().push(&samples, 44_100, 2, false);
        let mut streaming = detector();
        let mut actual = CubeDetection::default();
        for chunk in samples.chunks(738) {
            actual = streaming.push(chunk, 44_100, 2, false);
        }
        assert_eq!(expected, actual);
    }

    #[test]
    fn silence_expires_previous_arrow() {
        let mut stream = detector();
        assert!(
            stream
                .push(&signal(16_000, 1.0, 1.0, 0.1, 0.0), 16_000, 2, false)
                .detected
        );
        let expired = stream.push(&vec![0.0; 32_000], 16_000, 2, false);
        assert!(!expired.detected);
        assert_eq!(expired.direction, "unknown");
        assert!(expired.strength_db.is_none());
        assert_eq!(expired.pan, 0.0);
        assert!(expired.steer_degrees.is_none());
        assert!(expired.snr_db.is_none());
        assert!(expired.signal_strength.is_none());
    }

    #[test]
    fn stream_gaps_device_changes_and_timeout_clear_state() {
        let mut stream = detector();
        let samples = signal(16_000, 1.0, 1.0, 0.1, 0.0);
        assert!(stream.push(&samples, 16_000, 2, false).detected);
        assert_eq!(stream.push(&[], 16_000, 2, true), CubeDetection::default());
        assert!(stream.push(&samples, 16_000, 2, false).detected);
        assert_eq!(stream.push(&[], 48_000, 2, false), CubeDetection::default());
        assert!(stream.push(&samples, 16_000, 2, false).detected);
        assert_eq!(stream.expire(), CubeDetection::default());
    }

    #[test]
    fn malformed_stream_cannot_panic_or_keep_detection() {
        let mut stream = detector();
        assert_eq!(
            stream.push(&[1.0], 16_000, 2, false),
            CubeDetection::default()
        );
        assert_eq!(
            stream.push(&[1.0], 16_000, 0, false),
            CubeDetection::default()
        );
        assert_eq!(
            stream.push(&[f32::NAN; 2_000], 16_000, 2, false),
            CubeDetection::default()
        );
        assert_eq!(
            stream.push(&vec![0.1; 96_002], 16_000, 2, false),
            CubeDetection::default()
        );
    }

    #[test]
    fn rejects_unrelated_tone_and_partial_signature() {
        for frequency in [700.0, 1400.0, 3500.0, 625.0] {
            let samples: Vec<_> = (0..24_000)
                .flat_map(|i| {
                    let sample =
                        (std::f32::consts::TAU * frequency * i as f32 / 16_000.0).sin() * 0.25;
                    [sample, sample]
                })
                .collect();
            assert!(
                !detector().push(&samples, 16_000, 2, false).detected,
                "frequency {frequency}"
            );
        }
    }

    #[test]
    fn rejects_deterministic_noise_over_multiple_seconds() {
        let mut stream = detector();
        let mut state = 0x1234_5678_u32;
        for _ in 0..16 {
            let noise: Vec<_> = (0..16_000)
                .flat_map(|_| {
                    state ^= state << 13;
                    state ^= state >> 17;
                    state ^= state << 5;
                    let left = (state as f32 / u32::MAX as f32 - 0.5) * 0.4;
                    state = state
                        .rotate_left(7)
                        .wrapping_mul(1_664_525)
                        .wrapping_add(1_013_904_223);
                    let right = (state as f32 / u32::MAX as f32 - 0.5) * 0.4;
                    [left, right]
                })
                .collect();
            assert!(!stream.push(&noise, 16_000, 2, false).detected);
        }
    }

    #[test]
    fn brief_matching_click_does_not_trigger() {
        let mut samples = signal(16_000, 0.10, 1.0, 0.1, 0.0);
        samples.resize(32_000, 0.0);
        assert!(!detector().push(&samples, 16_000, 2, false).detected);
    }

    #[test]
    fn increasing_strength_is_relative_trend_only() {
        let mut stream = detector();
        for i in 0..7 {
            let gain = 0.08 * 1.5_f32.powi(i);
            stream.push(&signal(16_000, 0.3, gain, gain, 0.0), 16_000, 2, false);
        }
        let detection = stream.status();
        assert!(detection.detected);
        assert_eq!(detection.trend, "approaching");
    }

    #[test]
    fn decreasing_strength_is_relative_trend_only() {
        let mut stream = detector();
        for i in 0..7 {
            let gain = 0.9 * 0.67_f32.powi(i);
            stream.push(&signal(16_000, 0.3, gain, gain, 0.0), 16_000, 2, false);
        }
        let detection = stream.status();
        assert!(detection.detected);
        assert_eq!(detection.trend, "receding");
    }

    #[test]
    fn long_silence_padding_does_not_change_reference_core() {
        let original = template();
        let mut padded = vec![0.0; 32_000];
        padded.extend(signal(16_000, 1.5, 1.0, 1.0, 0.0));
        padded.resize(144_000, 0.0);
        let imported = create_template(&padded, 16_000, 2, 0.0, 4.5, "Padded").unwrap();
        assert!(dot(&imported.signature, &original.signature) > 0.995);
        let detection = CubeDetector::new(imported, 0.82).unwrap().push(
            &signal(16_000, 1.5, 1.0, 0.1, 0.0),
            16_000,
            2,
            false,
        );
        assert!(detection.detected);
        assert_eq!(detection.direction, "left");
    }

    #[test]
    fn pending_pcm_and_history_remain_bounded() {
        let mut stream = detector();
        for _ in 0..40 {
            stream.push(&signal(48_000, 0.15, 1.0, 0.1, 0.0), 48_000, 2, false);
            assert!(stream.pending.len() < FFT_SIZE);
            assert!(stream.history.len() <= 6);
            assert!(stream.strengths.len() <= 125);
            assert!(stream.resampler.as_ref().unwrap().filter_input.len() <= 63);
        }
    }

    #[test]
    fn sparse_reference_rejects_each_single_core_frequency() {
        let reference = template();
        assert!(reference.signature.iter().filter(|x| **x > 0.0).count() < 12);
        for frequency in [625.0, 1875.0] {
            let mut stream = CubeDetector::new(reference.clone(), 0.82).unwrap();
            for chunk_index in 0..30 {
                let samples: Vec<_> = (0..800)
                    .flat_map(|i| {
                        let t = (chunk_index * 800 + i) as f32 / 16_000.0;
                        let value = (std::f32::consts::TAU * frequency * t).sin() * 0.25;
                        [value, value]
                    })
                    .collect();
                assert!(!stream.push(&samples, 16_000, 2, false).detected);
            }
        }
    }

    #[test]
    fn an_isolated_invalid_sample_is_sanitized_without_nan_output() {
        let mut input = signal(16_000, 1.5, 1.0, 0.2, 0.0);
        input[45] = f32::NAN;
        let detection = detector().push(&input, 16_000, 2, false);
        assert!(detection.detected);
        assert!(detection.score.is_finite());
        assert!(detection.direction_confidence.is_finite());
        assert!(detection.strength_db.unwrap().is_finite());
    }

    #[test]
    fn quiet_builtin_chime_survives_louder_wind_voice_and_rumble() {
        for gain in [1.0, 0.25] {
            let results = streaming_detections(builtin_detector(), &game_mix(2.0, gain, false));
            assert!(results.iter().any(|result| result.detected), "gain {gain}");
            assert!(results.iter().all(|result| result.direction != "right"));
            assert!(results.iter().any(|result| result.direction == "left"));
            for result in results.iter().filter(|result| result.detected) {
                assert!(result.bearing_ambiguous);
                assert!((-1.0..=1.0).contains(&result.pan));
                assert!(result
                    .steer_degrees
                    .is_none_or(|degrees| (-90.0..=90.0).contains(&degrees)));
                assert!(result.snr_db.unwrap().is_finite());
                assert!((0.0..=1.0).contains(&result.signal_strength.unwrap()));
            }
        }
    }

    #[test]
    fn builtin_rejects_colored_noise_voice_rumble_and_harmonic_music() {
        for music in [false, true] {
            let results = streaming_detections(builtin_detector(), &game_mix(8.0, 0.0, music));
            assert!(
                results.iter().all(|result| !result.detected),
                "music {music}"
            );
        }
    }

    #[test]
    fn one_builtin_tone_with_louder_noise_cannot_supply_the_missing_tone() {
        for frequency in [1677.0, 3540.0] {
            for gain in [0.001, 0.01] {
                let mut samples = game_mix(4.0, 0.0, false);
                for (i, frame) in samples.chunks_exact_mut(2).enumerate() {
                    let tone =
                        (std::f32::consts::TAU * frequency * i as f32 / 16_000.0).sin() * gain;
                    frame[0] += tone;
                    frame[1] += tone;
                }
                let results = streaming_detections(builtin_detector(), &samples);
                assert!(
                    results.iter().all(|result| !result.detected),
                    "frequency {frequency}, gain {gain}"
                );
            }
        }
    }

    #[test]
    fn builtin_chime_in_music_does_not_follow_louder_opposite_music() {
        for gain in [1.0, 0.25] {
            let results = streaming_detections(builtin_detector(), &game_mix(4.0, gain, true));
            assert!(results.iter().any(|result| result.detected), "gain {gain}");
            assert!(
                results.iter().all(|result| result.direction != "right"),
                "gain {gain}"
            );
        }
    }

    #[test]
    fn rejects_neighboring_tones_even_if_their_fft_leakage_covers_reference_bins() {
        let samples: Vec<_> = (0..32_000)
            .flat_map(|i| {
                let t = i as f32 / 16_000.0;
                let value = (std::f32::consts::TAU * 1660.0 * t).sin() * 0.01
                    + (std::f32::consts::TAU * 3520.0 * t).sin() * 0.01;
                [value, value]
            })
            .collect();
        assert!(streaming_detections(builtin_detector(), &samples)
            .iter()
            .all(|result| !result.detected));
    }

    #[test]
    fn unrelated_tones_in_separate_speakers_do_not_form_a_reference() {
        let samples: Vec<_> = (0..32_000)
            .flat_map(|i| {
                let t = i as f32 / 16_000.0;
                [
                    (std::f32::consts::TAU * 625.0 * t).sin() * 0.15,
                    (std::f32::consts::TAU * 1875.0 * t).sin() * 0.15,
                ]
            })
            .collect();
        assert!(streaming_detections(detector(), &samples)
            .iter()
            .all(|result| !result.detected));
    }

    #[test]
    fn conflicting_tone_pans_do_not_invent_a_steering_bearing() {
        let samples: Vec<_> = (0..24_000)
            .flat_map(|i| {
                let t = i as f32 / 16_000.0;
                let low = (std::f32::consts::TAU * 625.0 * t).sin() * 0.18;
                let high = (std::f32::consts::TAU * 1875.0 * t).sin() * 0.15;
                [low + high * 0.15, low * 0.15 + high]
            })
            .collect();
        let result = detector().push(&samples, 16_000, 2, false);
        assert!(result.detected, "{result:?}");
        assert_eq!(result.direction, "unknown");
        assert!(result.steer_degrees.is_none());
        assert_eq!(result.direction_confidence, 0.0);
    }

    #[test]
    fn brief_repeated_masking_does_not_restart_acquisition() {
        let mut samples = signal(16_000, 1.6, 1.0, 0.15, 0.0);
        for (i, frame) in samples.chunks_exact_mut(2).enumerate() {
            if i % 3072 < 96 {
                frame[0] = if i % 2 == 0 { 0.8 } else { -0.8 };
                frame[1] = -frame[0];
            }
        }
        let results = streaming_detections(detector(), &samples);
        assert!(results.iter().any(|result| result.detected));
        assert!(results.iter().all(|result| result.direction != "right"));
    }

    #[test]
    fn pan_tracks_a_real_side_change_and_stays_finite_near_center() {
        let mut stream = detector();
        let left = stream.push(&signal(16_000, 0.7, 1.0, 0.15, 0.0), 16_000, 2, false);
        assert!(left.pan < -0.8 && left.steer_degrees.unwrap() < -45.0);
        let right = stream.push(&signal(16_000, 0.7, 0.15, 1.0, 0.0), 16_000, 2, false);
        assert!(right.pan > 0.8 && right.steer_degrees.unwrap() > 45.0);
        for step in 0..8 {
            let gain = if step % 2 == 0 { 0.98 } else { 1.02 };
            let center = stream.push(&signal(16_000, 0.1, gain, 1.0, 0.0), 16_000, 2, false);
            if step >= 5 {
                assert_eq!(center.direction, "center");
                assert!(center.pan.abs() < 0.12);
            }
        }
    }
}
