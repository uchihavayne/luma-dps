//! Hidden Cubes from the game's own object notices. The server announces a Cube once it is within
//! about 100 m, with its world position (centimetres, x y z), says when someone starts opening it
//! and when it is gone. The player's own position is not streamed back: it arrives only with
//! self-buff records, teleports and map loads, so every distance carries the age of the last fix.
//!
//! Frame layouts, bodies after the two opcode bytes (documented from live captures by
//! aion2-cube-radar, docs/FINDINGS.md; this is an independent implementation of those facts):
//!
//! ```text
//! 34 36  object in range:  id varint, kind u16, template u32, x y z f32
//! 35 36  object gone:      id varint, reason u8 (4 opened, 1 out of range)
//! 38 36  opening started:  object varint, actor varint, 01
//! 3a 36  opening done:     object varint, actor varint, count u32, item u32
//! 23 36  teleport:         6 bytes, then the player's x y z f32
//! ```
use std::collections::{BTreeMap, BTreeSet};

/// Cube templates seen in captures: Verteron's two and Altgard's (unconfirmed). Another one is
/// learned the first time an object of that template is opened with a Hidden Cube Key.
pub const TEMPLATES: [u32; 3] = [1_200_039, 1_200_041, 1_301_199];
const KEY_ITEM: u32 = 630_900_003;
const MAX_OBJECTS: usize = 256;
const MAX_LEARNED: usize = 32;
/// A position older than this is not used for a distance: a running player covers 200 m.
pub const FIX_MAX_AGE_MS: u64 = 30_000;
/// The server's send radius is about 100 m; a notice that is still held far beyond it is stale.
const STALE_CM: f32 = 25_000.0;
/// Heading comes from the last stretch walked between two fixes, and fades once it is old.
const MOVED_CM: f32 = 300.0;
const HEADING_MAX_AGE_MS: u64 = 30_000;

#[derive(Clone, Debug, PartialEq)]
pub enum Event {
    Spawn {
        id: u64,
        template: u32,
        pos: [f32; 3],
    },
    Gone {
        id: u64,
        reason: u8,
    },
    Opening {
        id: u64,
        actor: u64,
        done: bool,
        key: bool,
    },
    /// The player's own position, from any frame that carries it.
    Fix {
        pos: [f32; 3],
    },
    /// A map load: everything in range is sent again.
    Reset,
}

fn varint(frame: &[u8], at: &mut usize) -> Option<u64> {
    let mut value = 0u64;
    for index in 0..5 {
        let byte = *frame.get(*at)?;
        *at += 1;
        value |= u64::from(byte & 127) << (index * 7);
        if byte & 128 == 0 {
            return Some(value);
        }
    }
    None
}

fn word(frame: &[u8], at: usize) -> Option<u32> {
    Some(u32::from_le_bytes(frame.get(at..at + 4)?.try_into().ok()?))
}

/// Three f32 world coordinates at `at`, when they can be a position.
pub fn position(frame: &[u8], at: usize) -> Option<[f32; 3]> {
    let read = |offset| Some(f32::from_le_bytes(frame.get(offset..offset + 4)?.try_into().ok()?));
    let pos = [read(at)?, read(at + 4)?, read(at + 8)?];
    (pos.iter().all(|value| value.is_finite() && value.abs() < 1.0e7)
        && (pos[0] != 0.0 || pos[1] != 0.0))
        .then_some(pos)
}

/// A whole frame: two opcode bytes, then the body.
pub fn decode(frame: &[u8]) -> Option<Event> {
    let mut at = 2;
    match frame.get(..2)? {
        [0x34, 0x36] => {
            let id = varint(frame, &mut at).filter(|id| *id > 0)?;
            let template = word(frame, at + 2).filter(|t| (100_000..=9_999_999).contains(t))?;
            Some(Event::Spawn {
                id,
                template,
                pos: position(frame, at + 6)?,
            })
        }
        [0x35, 0x36] => {
            let id = varint(frame, &mut at).filter(|id| *id > 0)?;
            Some(Event::Gone {
                id,
                reason: *frame.get(at)?,
            })
        }
        [opcode @ (0x38 | 0x3a), 0x36] => {
            let id = varint(frame, &mut at).filter(|id| *id > 0)?;
            let actor = varint(frame, &mut at).filter(|id| *id > 0)?;
            let done = *opcode == 0x3a;
            Some(Event::Opening {
                id,
                actor,
                done,
                key: done && word(frame, at + 4) == Some(KEY_ITEM),
            })
        }
        [0x23, 0x36] => Some(Event::Fix {
            pos: position(frame, 8)?,
        }),
        _ => None,
    }
}

struct Object {
    template: u32,
    pos: [f32; 3],
    opening: bool,
}

#[derive(Clone, Copy)]
struct Fix {
    pos: [f32; 3],
    at_ms: u64,
}

#[derive(Default)]
pub struct Tracker {
    learned: BTreeSet<u32>,
    objects: BTreeMap<u64, Object>,
    me: Option<Fix>,
    heading: Option<([f32; 2], u64)>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct CubeView {
    pub id: u64,
    pub template: u32,
    /// Planar distance, as the server measures its send radius.
    pub distance_m: Option<u32>,
    /// Positive when the Cube is above the player.
    pub vertical_m: Option<i32>,
    /// Against the direction of the last walk, positive to the right; unknown while standing.
    pub direction_deg: Option<i32>,
    pub opening: bool,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Radar {
    pub cubes: Vec<CubeView>,
    pub fix_age_ms: Option<u64>,
}

impl Tracker {
    pub fn clear(&mut self) {
        self.objects.clear();
        self.me = None;
        self.heading = None;
    }

    pub fn learned(&self) -> Vec<u32> {
        self.learned.iter().copied().collect()
    }

    pub fn learn(&mut self, templates: impl IntoIterator<Item = u32>) {
        for template in templates {
            if (100_000..=9_999_999).contains(&template) && self.learned.len() < MAX_LEARNED {
                self.learned.insert(template);
            }
        }
    }

    fn is_cube(&self, template: u32) -> bool {
        TEMPLATES.contains(&template) || self.learned.contains(&template)
    }

    pub fn apply(&mut self, event: Event, now: u64) {
        match event {
            Event::Spawn { id, template, pos } => {
                if self.objects.len() >= MAX_OBJECTS && !self.objects.contains_key(&id) {
                    // Crowded areas announce many ordinary objects: drop those before any Cube.
                    let learned = &self.learned;
                    self.objects.retain(|_, object| {
                        TEMPLATES.contains(&object.template) || learned.contains(&object.template)
                    });
                    if self.objects.len() >= MAX_OBJECTS {
                        self.objects.clear();
                    }
                }
                self.objects.insert(
                    id,
                    Object {
                        template,
                        pos,
                        opening: false,
                    },
                );
            }
            Event::Gone { id, .. } => {
                self.objects.remove(&id);
            }
            Event::Opening {
                id,
                done,
                key,
                actor: _,
            } => {
                let Some(object) = self.objects.get_mut(&id) else {
                    return;
                };
                if key && !TEMPLATES.contains(&object.template) {
                    let template = object.template;
                    self.learn([template]);
                }
                if let Some(object) = self.objects.get_mut(&id) {
                    object.opening = !done;
                }
            }
            Event::Fix { pos } => self.fix(pos, now),
            Event::Reset => self.objects.clear(),
        }
    }

    fn fix(&mut self, pos: [f32; 3], now: u64) {
        if let Some(last) = self.me.filter(|last| last.at_ms <= now) {
            let (dx, dy) = (pos[0] - last.pos[0], pos[1] - last.pos[1]);
            let moved = dx.hypot(dy);
            if moved >= MOVED_CM && now - last.at_ms <= HEADING_MAX_AGE_MS {
                self.heading = Some(([dx / moved, dy / moved], now));
            }
        }
        self.me = Some(Fix { pos, at_ms: now });
    }

    pub fn radar(&self, now: u64) -> Radar {
        let me = self
            .me
            .filter(|fix| fix.at_ms <= now && now - fix.at_ms <= FIX_MAX_AGE_MS);
        let heading = self
            .heading
            .filter(|(_, at)| *at <= now && now - at <= HEADING_MAX_AGE_MS)
            .map(|(unit, _)| unit);
        let mut cubes: Vec<_> = self
            .objects
            .iter()
            .filter(|(_, object)| self.is_cube(object.template))
            .filter_map(|(id, object)| {
                let relative = me.map(|fix| {
                    [
                        object.pos[0] - fix.pos[0],
                        object.pos[1] - fix.pos[1],
                        object.pos[2] - fix.pos[2],
                    ]
                });
                let planar = relative.map(|r| r[0].hypot(r[1]));
                if planar.is_some_and(|distance| distance > STALE_CM) {
                    return None;
                }
                // With the right-handed side of the walking direction as (-hy, hx): the game's
                // axes follow Unreal's, where +Y lies to the right of +X.
                let direction_deg = relative.zip(heading).map(|(r, h)| {
                    let cross = h[0] * r[1] - h[1] * r[0];
                    let dot = h[0] * r[0] + h[1] * r[1];
                    cross.atan2(dot).to_degrees().round() as i32
                });
                Some(CubeView {
                    id: *id,
                    template: object.template,
                    distance_m: planar.map(|distance| (distance / 100.0).round() as u32),
                    vertical_m: relative.map(|r| (r[2] / 100.0).round() as i32),
                    direction_deg,
                    opening: object.opening,
                })
            })
            .collect();
        cubes.sort_by_key(|cube| (cube.distance_m.unwrap_or(u32::MAX), cube.id));
        Radar {
            cubes,
            fix_age_ms: me.map(|fix| now - fix.at_ms),
        }
    }
}
