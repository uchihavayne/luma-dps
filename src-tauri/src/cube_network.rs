//! Hidden Cube notice from received game data. Which spawned entity is a Cube is not documented,
//! so the entity model is learned on this machine from the audio match: the models spawned near
//! the player at each match are counted, quiet moments count the same models as background, and a
//! model that is near on almost every match and seldom otherwise is the Cube. Once learned, the
//! distance to the nearest one is shown whether or not the sound is playing.
use luma_engine::spatial::Nearby;
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fs, path::PathBuf};

pub const RADIUS_M: f32 = 80.0;
pub const NEARBY_LIMIT: usize = 64;
pub const NEEDED_MATCHES: u32 = 3;
const NEEDED_BACKGROUND: u32 = 10;
const BACKGROUND_EVERY_MS: u64 = 15_000;
const MATCH_GAP_MS: u64 = 8_000;
const QUIET_AFTER_MATCH_MS: u64 = 10_000;
const MAX_MODELS: usize = 2_000;
const HALVE_AT: u32 = 4_000;
const MAX_FILE_BYTES: u64 = 1024 * 1024;
const MOVE_CM: f32 = 300.0;
const CLOSER_CM: f32 = 150.0;
const RESULT_LIFETIME_MS: u64 = 4_000;
const SAVE_EVERY_MS: u64 = 10_000;

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct NetworkCube {
    /// "learning" until a model is known, "ready" once it is, "near" while one is within range.
    pub phase: &'static str,
    pub matches: u32,
    pub needed: u32,
    pub models: Vec<u32>,
    pub distance_m: Option<u32>,
    pub trend: &'static str,
    /// Where the Cube lies against the direction of the last few metres of walking.
    pub facing: &'static str,
}

impl Default for NetworkCube {
    fn default() -> Self {
        Self {
            phase: "learning",
            matches: 0,
            needed: NEEDED_MATCHES,
            models: Vec::new(),
            distance_m: None,
            trend: "unknown",
            facing: "unknown",
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Learned {
    matches: u32,
    background: u32,
    with_match: BTreeMap<String, u32>,
    with_background: BTreeMap<String, u32>,
}

fn key(row: &Nearby) -> String {
    format!("{}:{}", row.kind, row.model)
}

fn distinct(rows: &[Nearby]) -> Vec<String> {
    let mut keys: Vec<_> = rows.iter().map(key).collect();
    keys.sort();
    keys.dedup();
    keys
}

impl Learned {
    fn halve(counts: &mut BTreeMap<String, u32>) {
        counts.values_mut().for_each(|value| *value /= 2);
        counts.retain(|_, value| *value > 0);
    }
    fn bound(&mut self) {
        if self.background >= HALVE_AT {
            self.background /= 2;
            Self::halve(&mut self.with_background);
        }
        if self.matches >= HALVE_AT / 10 {
            self.matches /= 2;
            Self::halve(&mut self.with_match);
        }
        for counts in [&mut self.with_match, &mut self.with_background] {
            if counts.len() > MAX_MODELS {
                counts.retain(|_, value| *value > 1);
                if counts.len() > MAX_MODELS {
                    counts.clear();
                }
            }
        }
    }
    /// Models near on at least four of five matches and in at most a third of the quiet samples.
    /// More than three of them means nothing sets the Cube apart yet, so none is trusted.
    fn models(&self) -> Vec<(u8, u32)> {
        if self.matches < NEEDED_MATCHES || self.background < NEEDED_BACKGROUND {
            return Vec::new();
        }
        let need = (self.matches * 4).div_ceil(5).max(NEEDED_MATCHES);
        let found: Vec<_> = self
            .with_match
            .iter()
            .filter(|(_, count)| **count >= need)
            .filter(|(key, _)| {
                let quiet = self.with_background.get(*key).copied().unwrap_or(0);
                quiet * 3 <= self.background
            })
            .filter_map(|(key, _)| {
                let (kind, model) = key.split_once(':')?;
                Some((kind.parse().ok()?, model.parse().ok()?))
            })
            .collect();
        if found.len() > 3 {
            Vec::new()
        } else {
            found
        }
    }
}

struct Track {
    id: u64,
    dx: f32,
    dy: f32,
    distance: f32,
    at: u64,
    trend: &'static str,
    facing: &'static str,
    result_at: u64,
}

pub struct Learner {
    learned: Learned,
    path: Option<PathBuf>,
    seen_detection: Option<u64>,
    last_match_ms: u64,
    last_background_ms: u64,
    saved_at: u64,
    dirty: bool,
    track: Option<Track>,
}

pub struct Step<'a> {
    pub now: u64,
    /// Time of the audio match's latest detection, as the Cube service reports it.
    pub detected_at: Option<u64>,
    /// `None` while the local player's position is unknown.
    pub nearby: Option<&'a [Nearby]>,
}

impl Learner {
    pub fn new(path: Option<PathBuf>) -> Self {
        let learned = path
            .as_ref()
            .filter(|path| fs::metadata(path).is_ok_and(|meta| meta.is_file() && meta.len() <= MAX_FILE_BYTES))
            .and_then(|path| fs::read(path).ok())
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        Self {
            learned,
            path,
            seen_detection: None,
            last_match_ms: 0,
            last_background_ms: 0,
            saved_at: 0,
            dirty: false,
            track: None,
        }
    }

    pub fn step(&mut self, step: Step) -> NetworkCube {
        let fresh = step.detected_at.is_some() && step.detected_at != self.seen_detection;
        if fresh {
            self.seen_detection = step.detected_at;
        }
        if let Some(rows) = step.nearby {
            if fresh && step.now.saturating_sub(self.last_match_ms) >= MATCH_GAP_MS {
                self.last_match_ms = step.now;
                self.learned.matches += 1;
                for key in distinct(rows) {
                    *self.learned.with_match.entry(key).or_default() += 1;
                }
                self.dirty = true;
            } else if !fresh
                && step.now.saturating_sub(self.last_match_ms) >= QUIET_AFTER_MATCH_MS
                && step.now.saturating_sub(self.last_background_ms) >= BACKGROUND_EVERY_MS
            {
                self.last_background_ms = step.now;
                self.learned.background += 1;
                for key in distinct(rows) {
                    *self.learned.with_background.entry(key).or_default() += 1;
                }
                self.dirty = true;
            }
        }
        self.learned.bound();
        self.save(step.now);
        let models = self.learned.models();
        let mut state = NetworkCube {
            matches: self.learned.matches.min(NEEDED_MATCHES),
            ..NetworkCube::default()
        };
        if models.is_empty() {
            self.track = None;
            return state;
        }
        state.phase = "ready";
        state.models = models.iter().map(|(_, model)| *model).collect();
        let nearest = step.nearby.and_then(|rows| {
            rows.iter()
                .find(|row| models.contains(&(row.kind, row.model)))
        });
        let Some(near) = nearest else {
            self.track = None;
            return state;
        };
        state.phase = "near";
        state.distance_m = Some((near.distance_cm / 100.0).round() as u32);
        self.follow(step.now, near);
        if let Some(track) = &self.track {
            if step.now.saturating_sub(track.result_at) <= RESULT_LIFETIME_MS {
                state.trend = track.trend;
                state.facing = track.facing;
            }
        }
        state
    }

    /// Our own displacement is the opposite of the Cube's change in relative position, so the
    /// heading and the closing speed need no world axes and no map.
    fn follow(&mut self, now: u64, near: &Nearby) {
        let Some(track) = self.track.as_mut().filter(|track| track.id == near.id) else {
            self.track = Some(Track {
                id: near.id,
                dx: near.dx,
                dy: near.dy,
                distance: near.distance_cm,
                at: now,
                trend: "unknown",
                facing: "unknown",
                result_at: 0,
            });
            return;
        };
        let (hx, hy) = (track.dx - near.dx, track.dy - near.dy);
        let moved = hx.hypot(hy);
        if moved >= MOVE_CM {
            let change = near.distance_cm - track.distance;
            track.trend = if change <= -CLOSER_CM {
                "approaching"
            } else if change >= CLOSER_CM {
                "receding"
            } else {
                "steady"
            };
            let cosine = (hx * near.dx + hy * near.dy) / (moved * near.distance_cm.max(1.0));
            track.facing = if cosine > 0.5 {
                "ahead"
            } else if cosine < -0.5 {
                "behind"
            } else {
                "side"
            };
            track.result_at = now;
        }
        if moved >= MOVE_CM || now.saturating_sub(track.at) > 10_000 {
            track.dx = near.dx;
            track.dy = near.dy;
            track.distance = near.distance_cm;
            track.at = now;
        }
    }

    fn save(&mut self, now: u64) {
        let Some(path) = self.path.as_ref().filter(|_| self.dirty) else {
            return;
        };
        if now.saturating_sub(self.saved_at) < SAVE_EVERY_MS {
            return;
        }
        self.saved_at = now;
        let temporary = path.with_extension("tmp");
        let written = serde_json::to_vec(&self.learned)
            .ok()
            .is_some_and(|bytes| fs::write(&temporary, bytes).is_ok())
            && fs::rename(&temporary, path).is_ok();
        // A failed write is retried at the next interval; the counts stay in memory.
        self.dirty = !written;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(id: u64, kind: u8, model: u32, dx: f32, dy: f32) -> Nearby {
        Nearby {
            id,
            kind,
            model,
            distance_cm: dx.hypot(dy),
            dx,
            dy,
        }
    }
    fn step(learner: &mut Learner, now: u64, detected_at: Option<u64>, rows: &[Nearby]) -> NetworkCube {
        learner.step(Step {
            now,
            detected_at,
            nearby: Some(rows),
        })
    }
    const CUBE: (u8, u32) = (0x21, 2_000_123);
    const WOLF: (u8, u32) = (0x0c, 2_100_075);

    fn taught() -> Learner {
        let mut learner = Learner::new(None);
        let mut now = 100_000;
        for round in 0..12 {
            step(&mut learner, now, None, &[row(1, WOLF.0, WOLF.1, 3_000.0, 0.0)]);
            now += 16_000;
            if round % 3 == 0 {
                let at = Some(now);
                step(
                    &mut learner,
                    now,
                    at,
                    &[row(2, CUBE.0, CUBE.1, 1_500.0, 500.0), row(1, WOLF.0, WOLF.1, 3_000.0, 0.0)],
                );
                now += 16_000;
            }
        }
        learner
    }

    #[test]
    fn a_model_near_on_every_match_and_rarely_otherwise_is_learned() {
        let mut learner = taught();
        let state = step(&mut learner, 400_000, None, &[row(2, CUBE.0, CUBE.1, 1_500.0, 500.0)]);
        assert_eq!((state.phase, state.models.clone()), ("near", vec![CUBE.1]));
        assert_eq!(state.distance_m, Some(16));
        // The wolf is near on every match, but it is also near in every quiet sample.
        let state = step(&mut learner, 401_000, None, &[row(1, WOLF.0, WOLF.1, 500.0, 0.0)]);
        assert_eq!((state.phase, state.distance_m), ("ready", None));
    }

    #[test]
    fn nothing_is_trusted_before_enough_matches_and_quiet_samples() {
        let mut learner = Learner::new(None);
        for (index, at) in [100_000u64, 120_000, 140_000].into_iter().enumerate() {
            let state = step(&mut learner, at, Some(at), &[row(2, CUBE.0, CUBE.1, 900.0, 0.0)]);
            assert_eq!((state.phase, state.matches), ("learning", index as u32 + 1));
        }
        // Three matches, no quiet samples yet: it could still be an ordinary nearby monster.
        assert_eq!(step(&mut learner, 150_000, None, &[]).phase, "learning");
    }

    #[test]
    fn a_repeated_detection_is_one_match_and_a_missing_position_counts_nothing() {
        let mut learner = Learner::new(None);
        step(&mut learner, 100_000, Some(100_000), &[row(2, 1, 5, 1.0, 1.0)]);
        step(&mut learner, 100_150, Some(100_150), &[row(2, 1, 5, 1.0, 1.0)]);
        learner.step(Step { now: 200_000, detected_at: Some(200_000), nearby: None });
        assert_eq!(learner.learned.matches, 1);
        assert_eq!(learner.learned.background, 0);
    }

    #[test]
    fn too_many_equally_good_models_are_not_trusted() {
        let mut learner = Learner::new(None);
        let crowd: Vec<_> = (0..5).map(|n| row(n + 1, 0x21, 3_000_000 + n as u32, 900.0, 0.0)).collect();
        for at in [100_000u64, 120_000, 140_000] {
            step(&mut learner, at, Some(at), &crowd);
        }
        for n in 0..12 {
            step(&mut learner, 200_000 + n * 16_000, None, &[]);
        }
        assert!(learner.learned.models().is_empty());
    }

    #[test]
    fn walking_towards_the_cube_reports_approaching_and_ahead() {
        let mut learner = taught();
        let mut state = step(&mut learner, 500_000, None, &[row(2, CUBE.0, CUBE.1, 0.0, 3_000.0)]);
        assert_eq!(state.trend, "unknown");
        // We walked 5 m along +y: the Cube's relative y shrinks from 30 m to 25 m.
        state = step(&mut learner, 502_000, None, &[row(2, CUBE.0, CUBE.1, 0.0, 2_500.0)]);
        assert_eq!((state.trend, state.facing, state.distance_m), ("approaching", "ahead", Some(25)));
        // Walking back the other way.
        state = step(&mut learner, 504_000, None, &[row(2, CUBE.0, CUBE.1, 0.0, 3_000.0)]);
        assert_eq!((state.trend, state.facing), ("receding", "behind"));
        // Walking past it sideways keeps the distance about the same.
        state = step(&mut learner, 506_000, None, &[row(2, CUBE.0, CUBE.1, -500.0, 3_000.0)]);
        assert_eq!((state.trend, state.facing), ("steady", "side"));
        // A reading is not kept once the player stands still.
        state = step(&mut learner, 512_000, None, &[row(2, CUBE.0, CUBE.1, -500.0, 3_000.0)]);
        assert_eq!((state.trend, state.facing), ("unknown", "unknown"));
    }

    #[test]
    fn learning_survives_a_restart_and_ignores_a_damaged_file() {
        let directory = std::env::temp_dir().join(format!("luma-cube-network-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let path = directory.join("cube-network.json");
        let mut learner = Learner::new(Some(path.clone()));
        learner.learned = taught().learned;
        learner.dirty = true;
        learner.save(1_000_000);
        assert_eq!(Learner::new(Some(path.clone())).learned, learner.learned);
        std::fs::write(&path, b"{ broken").unwrap();
        assert_eq!(Learner::new(Some(path)).learned, Learned::default());
        std::fs::remove_dir_all(directory).ok();
    }
}
