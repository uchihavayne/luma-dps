//! Received coordinates only. World coordinates are centimetres; skill aim
//! points are deliberately separate from an actor's own position.
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};

pub const MAX_TRACK: usize = 12_000;
const MAX_ACTORS: usize = 256;
pub const FRESH_MS: u64 = 5000;

#[derive(Clone, Debug, PartialEq)]
pub struct Observation {
    pub actor_id: u64,
    pub x: f32,
    pub y: f32,
    pub z: Option<f32>,
    pub source: String,
    pub local_only: bool,
}

pub fn coordinates(x: f32, y: f32, z: Option<f32>) -> bool {
    x.is_finite()
        && y.is_finite()
        && x.abs() < 1_000_000.0
        && y.abs() < 1_000_000.0
        && (x != 0.0 || y != 0.0)
        && z.is_none_or(|z| z.is_finite() && z.abs() < 100_000.0)
}

fn actor(frame: &[u8]) -> Option<(u64, usize)> {
    let mut value = 0u32;
    for i in 0..5 {
        let b = *frame.get(2 + i)?;
        if i == 4 && b > 15 {
            return None;
        }
        value |= u32::from(b & 127) << (i * 7);
        if b & 128 == 0 {
            if value == 0 || i > 0 && b == 0 {
                return None;
            }
            return Some((u64::from(value), 3 + i));
        }
    }
    None
}

pub fn position(frame: &[u8]) -> Option<Observation> {
    if !(12..=512).contains(&frame.len()) {
        return None;
    }
    let (id, at) = actor(frame)?;
    let offset = match frame.get(..2)? {
        [0x3c, 0x37] if frame.get(at) == Some(&3) => 1,
        [0x1a | 0x1b | 0x1c | 0x1e | 0x20 | 0x28 | 0x29 | 0x2a, 0x37] => 2,
        [0x1f | 0x2f, 0x37] => 1,
        _ => return None,
    };
    let x = f32::from_le_bytes(frame.get(at + offset..at + offset + 4)?.try_into().ok()?);
    let y = f32::from_le_bytes(
        frame
            .get(at + offset + 4..at + offset + 8)?
            .try_into()
            .ok()?,
    );
    (coordinates(x, y, None)
        && x.abs() > 1.0
        && y.abs() > 1.0
        && x.abs() < 200_000.0
        && y.abs() < 200_000.0)
        .then_some(Observation {
            actor_id: id,
            x,
            y,
            z: None,
            source: "server-position".into(),
            local_only: false,
        })
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Actor {
    pub actor_id: u64,
    pub generation: u32,
    pub name: String,
    pub class_name: String,
    pub kind: String,
    pub npc_id: Option<u32>,
}
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Point {
    pub actor_id: u64,
    pub generation: u32,
    pub map_id: Option<u32>,
    pub epoch: u32,
    pub x: f32,
    pub y: f32,
    pub z: Option<f32>,
    pub at_ms: u64,
    pub present: bool,
    pub source: String,
}
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Aim {
    pub actor_id: u64,
    pub generation: u32,
    pub target_id: u64,
    pub skill_id: u32,
    pub map_id: Option<u32>,
    pub epoch: u32,
    pub at_ms: u64,
    pub until_ms: u64,
    pub x: f32,
    pub y: f32,
    pub z: Option<f32>,
    pub facing: f32,
}
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Snapshot {
    pub map_id: Option<u32>,
    pub epoch: u32,
    pub sampled_at_ms: u64,
    pub actors: Vec<Actor>,
    pub positions: Vec<Point>,
    pub track: Vec<Point>,
    pub aims: Vec<Aim>,
    pub retention_limited: bool,
}
impl Snapshot {
    pub fn valid(&self, start: u64, end: u64) -> bool {
        let keys: std::collections::BTreeSet<_> = self
            .actors
            .iter()
            .map(|a| (a.actor_id, a.generation))
            .collect();
        self.actors.len() <= 1024
            && self.positions.len() <= MAX_ACTORS
            && self.track.len() <= MAX_TRACK
            && keys.len() == self.actors.len()
            && self.aims.len() <= 512
            && self.actors.iter().all(|a| {
                a.actor_id > 0
                    && a.actor_id <= u64::from(u32::MAX)
                    && a.name.len() <= 512
                    && a.class_name.len() <= 128
                    && ["player", "npc", "pet", "unknown"].contains(&a.kind.as_str())
            })
            && self.positions.iter().chain(&self.track).all(|p| {
                p.actor_id > 0
                    && p.actor_id <= u64::from(u32::MAX)
                    && coordinates(p.x, p.y, p.z)
                    && p.at_ms >= start.saturating_sub(FRESH_MS)
                    && p.at_ms <= end
                    && [
                        "server-position",
                        "server-spawn",
                        "server-zone",
                        "server-effect",
                        "server-remove",
                    ]
                    .contains(&p.source.as_str())
            })
            && self.aims.iter().all(|a| {
                a.actor_id > 0
                    && a.actor_id <= u64::from(u32::MAX)
                    && a.target_id <= u64::from(u32::MAX)
                    && a.at_ms >= start
                    && a.at_ms <= end
                    && a.until_ms >= a.at_ms
                    && a.until_ms - a.at_ms <= 120000
                    && coordinates(a.x, a.y, a.z)
                    && a.facing.is_finite()
            })
    }
}

/// A spawned entity of any kind, kept only for the nearby-object probe. It never reaches saved
/// records: its position is the spawn point until a later position record replaces it.
#[derive(Clone, Debug, PartialEq)]
pub struct Object {
    pub id: u64,
    pub kind: u8,
    pub model: u32,
    pub x: f32,
    pub y: f32,
    pub seen_ms: u64,
}
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Nearby {
    pub id: u64,
    pub kind: u8,
    pub model: u32,
    pub distance_cm: f32,
    pub dx: f32,
    pub dy: f32,
}
const MAX_OBJECTS: usize = 512;

#[derive(Default)]
pub struct Store {
    objects: BTreeMap<u64, Object>,
    map: Option<u32>,
    epoch: u32,
    generations: BTreeMap<u64, u32>,
    actors: BTreeMap<(u64, u32), Actor>,
    latest: BTreeMap<u64, Point>,
    sampled: BTreeMap<u64, Point>,
    track: VecDeque<Point>,
    aims: VecDeque<Aim>,
    floor: Option<u64>,
    last_ms: u64,
}
impl Store {
    pub fn clear(&mut self) {
        *self = Self::default();
    }
    pub fn map(&mut self, map: u32) {
        if self.map != Some(map) {
            self.invalidate();
            self.map = Some(map);
        }
    }
    pub fn invalidate(&mut self) {
        self.epoch = self.epoch.wrapping_add(1);
        self.latest.clear();
        self.sampled.clear();
        self.objects.clear();
    }
    pub fn gap(&mut self, now: u64) {
        let ids: Vec<_> = self.latest.keys().copied().collect();
        for id in ids {
            self.remove(id, now);
        }
        self.invalidate();
    }
    pub fn register(&mut self, id: u64, name: &str, class: &str, kind: &str, npc: Option<u32>) {
        if id == 0 || id > u64::from(u32::MAX) {
            return;
        }
        self.bound_generations(id);
        let generation = *self.generations.entry(id).or_default();
        if self.actors.len() >= 1024 && !self.actors.contains_key(&(id, generation)) {
            let used: std::collections::BTreeSet<_> = self
                .track
                .iter()
                .map(|p| (p.actor_id, p.generation))
                .collect();
            self.actors.retain(|key, _| used.contains(key));
            if self.actors.len() >= 1024 {
                // Old paths remain usable without a label. Keep metadata for
                // the currently visible actors rather than starving new ones.
                let oldest = self
                    .actors
                    .keys()
                    .find(|(actor, _)| !self.latest.contains_key(actor))
                    .copied()
                    .or_else(|| self.actors.keys().next().copied());
                if let Some(key) = oldest {
                    self.actors.remove(&key);
                }
            }
        }
        self.actors.insert(
            (id, generation),
            Actor {
                actor_id: id,
                generation,
                name: name.into(),
                class_name: class.into(),
                kind: kind.into(),
                npc_id: npc,
            },
        );
    }
    fn bound_generations(&mut self, id: u64) {
        if self.generations.len() >= 4096 && !self.generations.contains_key(&id) {
            let map = self.map;
            let last_ms = self.last_ms;
            self.clear();
            self.map = map;
            self.last_ms = last_ms;
            self.floor = Some(last_ms);
        }
    }
    pub fn replace(&mut self, id: u64, now: u64) {
        self.remove(id, now);
        self.bound_generations(id);
        self.generations
            .entry(id)
            .and_modify(|v| *v = v.wrapping_add(1))
            .or_insert(0);
    }
    pub fn remove(&mut self, id: u64, now: u64) {
        self.sampled.remove(&id);
        self.objects.remove(&id);
        if let Some(mut last) = self.latest.remove(&id) {
            last.at_ms = now;
            last.present = false;
            last.source = "server-remove".into();
            self.push(last);
        }
    }
    fn push(&mut self, point: Point) {
        if self.track.len() == MAX_TRACK {
            if let Some(p) = self.track.pop_front() {
                self.floor = Some(self.floor.unwrap_or(0).max(p.at_ms));
            }
        }
        self.track.push_back(point);
    }
    pub fn spawn_object(&mut self, object: Object) {
        if object.id == 0
            || object.id > u64::from(u32::MAX)
            || !coordinates(object.x, object.y, None)
        {
            return;
        }
        if self.objects.len() >= MAX_OBJECTS && !self.objects.contains_key(&object.id) {
            if let Some(oldest) = self
                .objects
                .values()
                .min_by_key(|o| o.seen_ms)
                .map(|o| o.id)
            {
                self.objects.remove(&oldest);
            }
        }
        self.objects.insert(object.id, object);
    }
    /// Spawned entities within `radius_cm` of the local player's last received position, nearest
    /// first. `None` while the local position is unknown or older than the fresh window.
    pub fn nearby(
        &self,
        own: u64,
        now: u64,
        radius_cm: f32,
        limit: usize,
    ) -> Option<Vec<Nearby>> {
        let me = self
            .latest
            .get(&own)
            .filter(|p| p.present && p.at_ms <= now && now - p.at_ms <= FRESH_MS)?;
        let mut rows: Vec<_> = self
            .objects
            .values()
            .filter(|o| o.id != own)
            .filter_map(|o| {
                let (dx, dy) = (o.x - me.x, o.y - me.y);
                let distance_cm = dx.hypot(dy);
                (distance_cm <= radius_cm).then_some(Nearby {
                    id: o.id,
                    kind: o.kind,
                    model: o.model,
                    distance_cm,
                    dx,
                    dy,
                })
            })
            .collect();
        rows.sort_by(|a, b| a.distance_cm.total_cmp(&b.distance_cm));
        rows.truncate(limit);
        Some(rows)
    }
    pub fn observe(&mut self, observation: Observation, now: u64) {
        self.record(observation, now, false);
    }
    pub fn seed(&mut self, observation: Observation, now: u64) {
        if !self.latest.contains_key(&observation.actor_id) {
            self.record(observation, now, true);
        }
    }
    fn record(&mut self, observation: Observation, now: u64, seed: bool) {
        if !coordinates(observation.x, observation.y, observation.z)
            || observation.actor_id == 0
            || observation.actor_id > u64::from(u32::MAX)
        {
            return;
        }
        if now < self.last_ms && !seed {
            let map = self.map;
            self.clear();
            self.map = map;
        }
        self.last_ms = self.last_ms.max(now);
        let id = observation.actor_id;
        if let Some(object) = self.objects.get_mut(&id) {
            object.x = observation.x;
            object.y = observation.y;
            object.seen_ms = now;
        }
        if self.latest.len() >= MAX_ACTORS && !self.latest.contains_key(&id) {
            if let Some(oldest) = self
                .latest
                .values()
                .min_by_key(|p| p.at_ms)
                .map(|p| p.actor_id)
            {
                self.latest.remove(&oldest);
                self.sampled.remove(&oldest);
            }
        }
        self.bound_generations(id);
        let generation = *self.generations.entry(id).or_default();
        let point = Point {
            actor_id: id,
            generation,
            map_id: self.map,
            epoch: self.epoch,
            x: observation.x,
            y: observation.y,
            z: observation.z,
            at_ms: now,
            present: true,
            source: observation.source,
        };
        let retain = self.sampled.get(&id).is_none_or(|prior| {
            prior.epoch != point.epoch
                || now.saturating_sub(prior.at_ms) >= 500
                || (point.x - prior.x).hypot(point.y - prior.y) >= 25.0
        });
        self.latest.insert(id, point.clone());
        if retain {
            self.sampled.insert(id, point.clone());
            self.push(point);
        }
    }
    pub fn aim(&mut self, cast: &crate::assistance::CastObservation, now: u64) {
        let Some([x, y, z]) = cast.position else {
            return;
        };
        if !coordinates(x, y, Some(z))
            || !cast.facing.is_finite()
            || cast.actor_id == 0
            || cast.actor_id > u64::from(u32::MAX)
        {
            return;
        }
        if self.aims.len() == 512 {
            if let Some(aim) = self.aims.pop_front() {
                self.floor = Some(self.floor.unwrap_or(0).max(aim.at_ms));
            }
        }
        self.bound_generations(cast.actor_id);
        let generation = *self.generations.entry(cast.actor_id).or_default();
        self.aims.push_back(Aim {
            actor_id: cast.actor_id,
            generation,
            target_id: cast.target_id,
            skill_id: cast.skill_id,
            map_id: self.map,
            epoch: self.epoch,
            at_ms: now,
            until_ms: now.saturating_add(cast.duration_ms.unwrap_or(500).min(120000)),
            x,
            y,
            z: Some(z),
            facing: cast.facing,
        });
    }
    pub fn snapshot(&self, now: u64, interval: Option<(u64, u64)>) -> Snapshot {
        let (start, end) = interval.unwrap_or((now.saturating_sub(FRESH_MS), now));
        let positions: Vec<_> = if interval.is_none() {
            self.latest
                .values()
                .filter(|p| {
                    p.map_id == self.map
                        && p.epoch == self.epoch
                        && p.at_ms <= now
                        && now - p.at_ms <= 15000
                })
                .cloned()
                .collect()
        } else {
            Vec::new()
        };
        let track: Vec<_> = if interval.is_some() {
            self.track
                .iter()
                .filter(|p| {
                    p.map_id == self.map
                        && p.at_ms >= start.saturating_sub(FRESH_MS)
                        && p.at_ms <= end
                })
                .cloned()
                .collect()
        } else {
            Vec::new()
        };
        let used: std::collections::BTreeSet<_> = positions
            .iter()
            .chain(&track)
            .map(|p| (p.actor_id, p.generation))
            .collect();
        let actors = self
            .actors
            .iter()
            .filter(|(key, _)| used.contains(key))
            .map(|(_, a)| a.clone())
            .collect();
        let aims = self
            .aims
            .iter()
            .filter(|a| {
                a.map_id == self.map
                    && a.at_ms <= end
                    && (if interval.is_some() {
                        a.at_ms >= start
                    } else {
                        a.epoch == self.epoch && a.until_ms > now
                    })
            })
            .cloned()
            .collect();
        Snapshot {
            map_id: self.map,
            epoch: self.epoch,
            sampled_at_ms: self.last_ms,
            actors,
            positions,
            track,
            aims,
            retention_limited: interval.is_some()
                && self
                    .floor
                    .is_some_and(|floor| floor >= start.saturating_sub(FRESH_MS)),
        }
    }
}
