use crate::{audio_capture, audio_decode, cube_signal};
use serde::Serialize;
use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

const MAX_REFERENCE_BYTES: usize = 8 * 1024 * 1024;
const MAX_TEMPLATE_BYTES: u64 = 512 * 1024;

#[derive(Clone, Debug, Serialize)]
pub struct ReferenceInfo {
    name: String,
    seconds: f32,
}

#[derive(Clone, Debug, Serialize)]
pub struct CubeState {
    pub(crate) revision: u64,
    enabled: bool,
    status: String,
    source: String,
    message: String,
    reference: ReferenceInfo,
    score: f32,
    direction: String,
    direction_confidence: f32,
    pan: Option<f32>,
    steer_degrees: Option<f32>,
    bearing_ambiguous: bool,
    snr_db: Option<f32>,
    signal_strength: Option<f32>,
    analysis_window_ms: u32,
    input_level_db: Option<f32>,
    audio_present: bool,
    received_audio_frames: u64,
    timestamp_uncertain_packets: u64,
    stream_discontinuities: u64,
    strength_db: Option<f32>,
    trend: String,
    last_detection_ms: Option<u64>,
    audio_channels: u16,
    sample_rate: u32,
    #[serde(skip)]
    last_audio_at: Option<Instant>,
}

impl CubeState {
    fn new(template: &cube_signal::CubeTemplate) -> Self {
        Self {
            revision: 0,
            enabled: false,
            status: "off".into(),
            source: "game".into(),
            message: String::new(),
            reference: reference_info(template),
            score: 0.0,
            direction: "unknown".into(),
            direction_confidence: 0.0,
            pan: None,
            steer_degrees: None,
            bearing_ambiguous: true,
            snr_db: None,
            signal_strength: None,
            analysis_window_ms: 0,
            input_level_db: None,
            audio_present: false,
            received_audio_frames: 0,
            timestamp_uncertain_packets: 0,
            stream_discontinuities: 0,
            strength_db: None,
            trend: "unknown".into(),
            last_detection_ms: None,
            audio_channels: 0,
            sample_rate: 0,
            last_audio_at: None,
        }
    }

    fn clear_signal(&mut self) {
        self.score = 0.0;
        self.direction = "unknown".into();
        self.direction_confidence = 0.0;
        self.pan = None;
        self.steer_degrees = None;
        self.bearing_ambiguous = true;
        self.snr_db = None;
        self.signal_strength = None;
        self.analysis_window_ms = 0;
        self.strength_db = None;
        self.trend = "unknown".into();
    }
}

fn reference_info(template: &cube_signal::CubeTemplate) -> ReferenceInfo {
    ReferenceInfo {
        name: template.name.clone(),
        seconds: template.duration_seconds,
    }
}

struct Worker {
    stop: Arc<AtomicBool>,
    handle: JoinHandle<()>,
    source: String,
    threshold: f32,
}

struct Control {
    template: cube_signal::CubeTemplate,
    worker: Option<Worker>,
}

pub struct Service {
    control: Mutex<Control>,
    reference_change: Mutex<()>,
    state: Mutex<CubeState>,
    generation: AtomicU64,
    template_path: PathBuf,
}

fn builtin_template() -> Result<cube_signal::CubeTemplate, String> {
    serde_json::from_str(include_str!("cube_reference.json"))
        .map_err(|error| format!("Invalid bundled Cube reference: {error}"))
}

impl Service {
    pub fn new(data_dir: PathBuf) -> Result<Self, String> {
        let builtin = builtin_template()?;
        cube_signal::CubeDetector::new(builtin.clone(), 0.82)?;
        let template_path = data_dir.join("cube-reference.json");
        let restored = fs::metadata(&template_path)
            .ok()
            .filter(|metadata| metadata.is_file() && metadata.len() <= MAX_TEMPLATE_BYTES)
            .and_then(|_| fs::read(&template_path).ok())
            .and_then(|bytes| serde_json::from_slice::<cube_signal::CubeTemplate>(&bytes).ok())
            .filter(|template| cube_signal::CubeDetector::new(template.clone(), 0.82).is_ok());
        let template = restored.unwrap_or(builtin);
        Self::with_template(template, template_path)
    }

    fn with_template(
        template: cube_signal::CubeTemplate,
        template_path: PathBuf,
    ) -> Result<Self, String> {
        cube_signal::CubeDetector::new(template.clone(), 0.82)?;
        Ok(Self {
            reference_change: Mutex::new(()),
            state: Mutex::new(CubeState::new(&template)),
            control: Mutex::new(Control {
                template,
                worker: None,
            }),
            generation: AtomicU64::new(0),
            template_path,
        })
    }

    pub fn snapshot(&self) -> Result<CubeState, String> {
        let mut state = self.state.lock().map_err(|_| "Cube status unavailable")?;
        // A stopped audio endpoint must not leave an old directional arrow on screen.
        if state.enabled
            && state
                .last_audio_at
                .is_none_or(|time| time.elapsed() > Duration::from_millis(900))
            && (state.status == "detected" || state.input_level_db.is_some() || state.audio_present)
        {
            if state.status == "detected" {
                state.clear_signal();
                state.status = "listening".into();
            }
            state.input_level_db = None;
            state.audio_present = false;
            state.revision += 1;
        }
        Ok(state.clone())
    }

    fn update(&self, generation: u64, change: impl FnOnce(&mut CubeState)) {
        if let Ok(mut state) = self.state.lock() {
            if self.generation.load(Ordering::Acquire) != generation {
                return;
            }
            change(&mut state);
            state.revision += 1;
        }
    }

    fn stop_worker(&self, control: &mut Control) -> Result<(), String> {
        self.generation.fetch_add(1, Ordering::AcqRel);
        if let Some(worker) = control.worker.take() {
            worker.stop.store(true, Ordering::Release);
            worker
                .handle
                .join()
                .map_err(|_| "Cube audio worker stopped unexpectedly")?;
        }
        Ok(())
    }

    pub fn stop(&self) -> Result<CubeState, String> {
        let mut control = self
            .control
            .lock()
            .map_err(|_| "Cube controls unavailable")?;
        let result = self.stop_worker(&mut control);
        let generation = self.generation.load(Ordering::Acquire);
        self.update(generation, |state| {
            state.enabled = false;
            state.status = "off".into();
            state.message.clear();
            state.clear_signal();
            state.last_detection_ms = None;
            state.audio_channels = 0;
            state.sample_rate = 0;
            state.input_level_db = None;
            state.audio_present = false;
        });
        result?;
        self.snapshot()
    }

    pub fn start(self: &Arc<Self>, source: &str, threshold: f32) -> Result<CubeState, String> {
        if !matches!(source, "game" | "system")
            || !threshold.is_finite()
            || !(0.6..=0.97).contains(&threshold)
        {
            return Err("Invalid Cube source or sensitivity".into());
        }
        let mut control = self
            .control
            .lock()
            .map_err(|_| "Cube controls unavailable")?;
        if control.worker.as_ref().is_some_and(|worker| {
            !worker.handle.is_finished() && worker.source == source && worker.threshold == threshold
        }) {
            return self.snapshot();
        }
        if let Err(error) = self.stop_worker(&mut control) {
            self.worker_error(self.generation.load(Ordering::Acquire), error.clone());
            return Err(error);
        }
        let mut detector = cube_signal::CubeDetector::new(control.template.clone(), threshold)?;
        let generation = self.generation.load(Ordering::Acquire);
        self.update(generation, |state| {
            state.enabled = true;
            state.source = source.into();
            state.status = if source == "game" {
                "waiting_game"
            } else {
                "listening"
            }
            .into();
            state.message.clear();
            state.clear_signal();
            state.last_detection_ms = None;
            state.last_audio_at = None;
            state.sample_rate = 0;
            state.audio_channels = 0;
            state.input_level_db = None;
            state.audio_present = false;
            state.received_audio_frames = 0;
            state.timestamp_uncertain_packets = 0;
            state.stream_discontinuities = 0;
        });
        let stop = Arc::new(AtomicBool::new(false));
        let worker_stop = stop.clone();
        let service = self.clone();
        let selected = source.to_owned();
        let handle = thread::Builder::new()
            .name("luma-cube-audio".into())
            .spawn(move || {
                let mut last_publish = Instant::now() - Duration::from_millis(100);
                while !worker_stop.load(Ordering::Acquire) {
                    if selected == "game" {
                        match audio_capture::find_game_process() {
                            Ok(None) => {
                                service.capture_waiting(generation, "waiting_game", "");
                                wait_cancelled(&worker_stop, 1000);
                                continue;
                            }
                            Err(error) => {
                                // A temporarily inaccessible or ambiguous game
                                // process does not cancel automatic listening.
                                service.capture_waiting(generation, "error", &error);
                                wait_cancelled(&worker_stop, 3000);
                                continue;
                            }
                            Ok(Some(_)) => {}
                        }
                    }
                    detector.expire();
                    let capture_source = if selected == "game" {
                        audio_capture::CaptureSource::GameProcess
                    } else {
                        audio_capture::CaptureSource::SystemOutput
                    };
                    let mut received_frames = 0_u64;
                    let mut timestamp_errors = 0_u64;
                    let mut discontinuities = 0_u64;
                    let mut window_power = 0.0_f64;
                    let mut window_samples = 0_usize;
                    let mut window_peak = 0.0_f32;
                    let result =
                        audio_capture::capture(capture_source, worker_stop.clone(), |chunk| {
                            received_frames =
                                received_frames.saturating_add(if chunk.native_flags.is_some() {
                                    chunk.samples.len() as u64 / u64::from(chunk.channels.max(1))
                                } else {
                                    0
                                });
                            timestamp_errors +=
                                u64::from(chunk.native_flags.is_some_and(|flags| flags & 4 != 0));
                            discontinuities += u64::from(chunk.discontinuity);
                            window_power += chunk
                                .samples
                                .iter()
                                .map(|value| f64::from(*value).powi(2))
                                .sum::<f64>();
                            window_samples += chunk.samples.len();
                            window_peak = chunk
                                .samples
                                .iter()
                                .fold(window_peak, |peak, value| peak.max(value.abs()));
                            let detection = detector.push(
                                &chunk.samples,
                                chunk.sample_rate,
                                chunk.channels,
                                chunk.discontinuity,
                            );
                            let now = crate::now_ms();
                            if last_publish.elapsed() < Duration::from_millis(100) {
                                return;
                            }
                            last_publish = Instant::now();
                            let input_db = (20.0
                                * (window_power / window_samples.max(1) as f64)
                                    .sqrt()
                                    .max(1e-6)
                                    .log10()) as f32;
                            let audio_present = window_peak > 0.000_05 || detection.detected;
                            window_power = 0.0;
                            window_samples = 0;
                            window_peak = 0.0;
                            service.update(generation, |state| {
                                state.status = if detection.detected {
                                    "detected"
                                } else {
                                    "listening"
                                }
                                .into();
                                state.message.clear();
                                state.audio_channels = chunk.channels;
                                state.sample_rate = chunk.sample_rate;
                                state.last_audio_at = Some(Instant::now());
                                state.score = detection.score;
                                state.direction = detection.direction;
                                state.direction_confidence = detection.direction_confidence;
                                state.pan = detection.detected.then_some(detection.pan);
                                state.steer_degrees = detection.steer_degrees;
                                state.bearing_ambiguous = detection.bearing_ambiguous;
                                state.snr_db = detection.snr_db;
                                state.signal_strength = detection.signal_strength;
                                state.analysis_window_ms = detection.analysis_window_ms;
                                state.input_level_db = Some(input_db.clamp(-120.0, 0.0));
                                state.audio_present = audio_present;
                                state.received_audio_frames = received_frames;
                                state.timestamp_uncertain_packets = timestamp_errors;
                                state.stream_discontinuities = discontinuities;
                                state.strength_db = detection.strength_db;
                                state.trend = detection.trend;
                                if detection.detected {
                                    state.last_detection_ms = Some(now);
                                }
                            });
                        });
                    if worker_stop.load(Ordering::Acquire) {
                        return;
                    }
                    detector.reset();
                    match result {
                        Err(error) => service.capture_waiting(generation, "error", &error),
                        Ok(()) => service.capture_waiting(
                            generation,
                            "error",
                            "Audio capture ended; retrying the selected source",
                        ),
                    }
                    // Re-open after output-device changes; never change the selected source.
                    wait_cancelled(&worker_stop, 3000);
                }
            })
            .map_err(|error| {
                self.update(generation, |state| {
                    state.enabled = false;
                    state.status = "error".into();
                    state.message = error.to_string();
                });
                error.to_string()
            })?;
        control.worker = Some(Worker {
            stop,
            handle,
            source: source.into(),
            threshold,
        });
        self.snapshot()
    }

    fn capture_waiting(&self, generation: u64, status: &str, message: &str) {
        self.update(generation, |state| {
            state.status = status.into();
            state.message = message.chars().take(400).collect();
            state.clear_signal();
            state.input_level_db = None;
            state.audio_present = false;
            state.last_audio_at = None;
            state.last_detection_ms = None;
            state.audio_channels = 0;
            state.sample_rate = 0;
        });
    }

    fn worker_error(&self, generation: u64, error: String) {
        self.update(generation, |state| {
            state.status = "error".into();
            state.enabled = false;
            state.message = error.chars().take(400).collect();
            state.clear_signal();
            state.input_level_db = None;
            state.audio_present = false;
        });
    }

    pub fn import_reference(
        &self,
        data: &str,
        start_seconds: f64,
        end_seconds: Option<f64>,
    ) -> Result<CubeState, String> {
        let _change = self
            .reference_change
            .try_lock()
            .map_err(|_| "A Cube reference change is already in progress")?;
        if self.snapshot()?.enabled {
            return Err("Stop the Cube listener before changing its reference".into());
        }
        let bytes = decode_base64(data)?;
        let decoded = audio_decode::decode(&bytes)?;
        let duration = decoded.samples.len() as f64
            / (f64::from(decoded.sample_rate) * f64::from(decoded.channels));
        let template = cube_signal::create_template(
            &decoded.samples,
            decoded.sample_rate,
            decoded.channels,
            start_seconds,
            end_seconds.unwrap_or(duration),
            "Custom Hidden Cube",
        )?;
        self.replace_reference(template)
    }

    pub fn reset_reference(&self) -> Result<CubeState, String> {
        let _change = self
            .reference_change
            .try_lock()
            .map_err(|_| "A Cube reference change is already in progress")?;
        self.replace_reference(builtin_template()?)
    }

    fn replace_reference(&self, template: cube_signal::CubeTemplate) -> Result<CubeState, String> {
        cube_signal::CubeDetector::new(template.clone(), 0.82)?;
        let mut control = self
            .control
            .lock()
            .map_err(|_| "Cube controls unavailable")?;
        if control
            .worker
            .as_ref()
            .is_some_and(|worker| !worker.handle.is_finished())
        {
            return Err("Stop the Cube listener before changing its reference".into());
        }
        let bytes = serde_json::to_vec(&template).map_err(|error| error.to_string())?;
        if bytes.len() as u64 > MAX_TEMPLATE_BYTES {
            return Err("Cube reference is too large".into());
        }
        if let Some(parent) = self.template_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let temporary = self.template_path.with_extension("json.new");
        fs::write(&temporary, bytes).map_err(|error| error.to_string())?;
        fs::rename(&temporary, &self.template_path).map_err(|error| error.to_string())?;
        control.template = template;
        let generation = self.generation.load(Ordering::Acquire);
        self.update(generation, |state| {
            state.reference = reference_info(&control.template);
            state.clear_signal();
            state.status = "off".into();
            state.enabled = false;
            state.message.clear();
            state.last_detection_ms = None;
        });
        self.snapshot()
    }
}

fn wait_cancelled(stop: &AtomicBool, milliseconds: u64) {
    for _ in 0..milliseconds.div_ceil(50) {
        if stop.load(Ordering::Acquire) {
            return;
        }
        thread::sleep(Duration::from_millis(50));
    }
}

fn decode_base64(data: &str) -> Result<Vec<u8>, String> {
    if data.is_empty() || data.len() > MAX_REFERENCE_BYTES.div_ceil(3) * 4 || data.len() % 4 != 0 {
        return Err("Choose a WAV or M4A reference no larger than 8 MB".into());
    }
    fn digit(byte: u8) -> Option<u8> {
        match byte {
            b'A'..=b'Z' => Some(byte - b'A'),
            b'a'..=b'z' => Some(byte - b'a' + 26),
            b'0'..=b'9' => Some(byte - b'0' + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            _ => None,
        }
    }
    let mut bytes = Vec::with_capacity(data.len() / 4 * 3);
    let chunks = data.as_bytes().chunks_exact(4);
    let count = chunks.len();
    for (index, chunk) in chunks.enumerate() {
        let final_chunk = index + 1 == count;
        let padding = usize::from(chunk[3] == b'=') + usize::from(chunk[2] == b'=');
        if padding > 0 && !final_chunk || chunk[2] == b'=' && chunk[3] != b'=' {
            return Err("Invalid reference encoding".into());
        }
        let a = digit(chunk[0]).ok_or("Invalid reference encoding")?;
        let b = digit(chunk[1]).ok_or("Invalid reference encoding")?;
        let c = if padding == 2 {
            0
        } else {
            digit(chunk[2]).ok_or("Invalid reference encoding")?
        };
        let d = if padding > 0 {
            0
        } else {
            digit(chunk[3]).ok_or("Invalid reference encoding")?
        };
        if padding == 2 && b & 15 != 0 || padding == 1 && c & 3 != 0 {
            return Err("Invalid reference encoding".into());
        }
        bytes.push(a << 2 | b >> 4);
        if padding < 2 {
            bytes.push(b << 4 | c >> 2);
        }
        if padding == 0 {
            bytes.push(c << 6 | d);
        }
    }
    if bytes.len() > MAX_REFERENCE_BYTES {
        return Err("Reference exceeds 8 MB".into());
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reference_encoding_is_strict_and_bounded() {
        assert_eq!(decode_base64("TWFu").unwrap(), b"Man");
        assert_eq!(decode_base64("TWE=").unwrap(), b"Ma");
        assert_eq!(decode_base64("TQ==").unwrap(), b"M");
        for bad in [
            "",
            "TQ=",
            "TQ=A",
            "TR==",
            "TWF=",
            "TQ==TQ==",
            "TQ\n=",
            "====",
            "data:audio/wav;base64,TWFu",
        ] {
            assert!(decode_base64(bad).is_err(), "{bad}");
        }
        assert!(decode_base64(&"A".repeat(MAX_REFERENCE_BYTES.div_ceil(3) * 4 + 4)).is_err());
    }

    #[test]
    fn invalid_source_and_sensitivity_never_start_audio() {
        let service =
            Arc::new(Service::new(std::env::temp_dir().join("luma-cube-validation-only")).unwrap());
        for (source, threshold) in [
            ("microphone", 0.82),
            ("game", f32::NAN),
            ("system", 0.1),
            ("game", 1.0),
        ] {
            assert!(service.start(source, threshold).is_err());
            assert!(!service.snapshot().unwrap().enabled);
        }
    }

    #[test]
    fn listening_is_off_on_start_and_old_worker_cannot_publish_after_stop() {
        let service = Service::new(std::env::temp_dir().join("luma-cube-validation-only")).unwrap();
        assert!(!service.snapshot().unwrap().enabled);
        assert_eq!(service.snapshot().unwrap().direction, "unknown");
        service.stop().unwrap();
        service.update(0, |state| {
            state.enabled = true;
            state.status = "detected".into();
        });
        assert!(!service.snapshot().unwrap().enabled);
    }

    #[test]
    fn stalled_audio_clears_arrow_and_strength() {
        let service = Service::new(std::env::temp_dir().join("luma-cube-validation-only")).unwrap();
        service.update(0, |state| {
            state.enabled = true;
            state.status = "detected".into();
            state.direction = "right".into();
            state.strength_db = Some(-25.0);
            state.pan = Some(0.6);
            state.steer_degrees = Some(36.0);
            state.snr_db = Some(12.0);
            state.signal_strength = Some(0.7);
            state.audio_present = true;
            state.last_audio_at = Some(Instant::now() - Duration::from_millis(1500));
        });
        let state = service.snapshot().unwrap();
        assert_eq!(state.status, "listening");
        assert_eq!(state.direction, "unknown");
        assert!(state.strength_db.is_none());
        assert!(state.pan.is_none());
        assert!(state.steer_degrees.is_none());
        assert!(state.snr_db.is_none());
        assert!(state.signal_strength.is_none());
        assert!(!state.audio_present);

        service.update(0, |state| {
            state.status = "listening".into();
            state.input_level_db = Some(-18.0);
            state.audio_present = true;
        });
        let state = service.snapshot().unwrap();
        assert_eq!(state.status, "listening");
        assert!(state.input_level_db.is_none());
        assert!(!state.audio_present);
        assert_eq!(service.snapshot().unwrap().revision, state.revision);
    }

    #[test]
    fn retrying_capture_keeps_listening_requested_without_a_stale_match() {
        let service = Service::new(std::env::temp_dir().join("luma-cube-validation-only")).unwrap();
        service.update(0, |state| {
            state.enabled = true;
            state.status = "detected".into();
            state.last_detection_ms = Some(1234);
            state.last_audio_at = Some(Instant::now());
            state.pan = Some(0.8);
            state.steer_degrees = Some(45.0);
            state.audio_present = true;
            state.input_level_db = Some(-12.0);
            state.audio_channels = 2;
            state.sample_rate = 44_100;
        });
        for (status, message) in [("error", "Game process unavailable"), ("waiting_game", "")] {
            service.capture_waiting(0, status, message);
            let state = service.snapshot().unwrap();
            assert!(state.enabled);
            assert_eq!(state.status, status);
            assert_eq!(state.message, message);
            assert!(state.last_detection_ms.is_none());
            assert!(state.last_audio_at.is_none());
            assert!(state.pan.is_none());
            assert!(state.steer_degrees.is_none());
            assert!(state.input_level_db.is_none());
            assert!(!state.audio_present);
            assert_eq!(state.audio_channels, 0);
            assert_eq!(state.sample_rate, 0);
        }
        service.stop().unwrap();
        service.capture_waiting(0, "error", "A late capture failure");
        assert!(!service.snapshot().unwrap().enabled);
        assert_eq!(service.snapshot().unwrap().status, "off");
    }

    #[test]
    fn simultaneous_reference_changes_are_rejected_before_decode() {
        let service = Service::new(std::env::temp_dir().join("luma-cube-validation-only")).unwrap();
        let _change = service.reference_change.lock().unwrap();
        assert!(service
            .import_reference("TWFu", 0.0, None)
            .unwrap_err()
            .contains("already in progress"));
        assert!(service
            .reset_reference()
            .unwrap_err()
            .contains("already in progress"));
    }

    #[test]
    fn failed_old_worker_disables_controls_before_start_returns_error() {
        let service =
            Arc::new(Service::new(std::env::temp_dir().join("luma-cube-validation-only")).unwrap());
        let handle = thread::spawn(|| panic!("simulated audio worker failure"));
        service.control.lock().unwrap().worker = Some(Worker {
            handle,
            stop: Arc::new(AtomicBool::new(false)),
            source: "system".into(),
            threshold: 0.82,
        });
        service.update(0, |state| {
            state.enabled = true;
            state.status = "listening".into();
        });
        assert!(service.start("game", 0.83).is_err());
        let state = service.snapshot().unwrap();
        assert!(!state.enabled);
        assert_eq!(state.status, "error");
    }
}
