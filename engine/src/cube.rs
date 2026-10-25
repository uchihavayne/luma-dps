//! Hidden Cubes from the game's own object notices. The server announces a Cube once it is within
//! about 100 m, with its world position (centimetres, x y z), says when someone starts opening it
//! and when it is gone. The player's own position is not streamed back: it arrives only with
//! self-buff records, teleports and map loads, so every distance carries the age of the last fix.
//!
//! Frame layouts, bodies after the two opcode bytes (documented from live captures by
//! aion2-cube-radar and checked against the way a second meter reads the same messages; this is an
//! independent implementation of those facts):
//!
//! ```text
//! 00 36  map frame:        server time i64 (ms), sent every 50 ms
//! 34 36  object in range:  id varint, flags u8, desc flags u8 [nickname str if 1] template u32
//!                          [race u8 if 2] [gender u8 if 4] [u8+i32 if 8] [u8 if 16],
//!                          x y z f32, origin key i32, direction f32, state u8, can-interact u8,
//!                          reason u8 (1 seen on approach, 6 spawned in view), created i64 (ms)
//! 35 36  object gone:      id varint, reason u8 (4 opened, 1 out of range)
//! 38 36  opening started:  object varint, actor varint, 01
//! 3a 36  opening done:     object varint, actor varint, count u32, item u32
//! 23 36  teleport:         6 bytes, then the player's x y z f32
//! ```
use std::collections::{BTreeMap, BTreeSet};

/// The two looks of a Cube. A template of either look is a Cube; another one is learned the first
/// time an object of that template is opened with a Hidden Cube Key.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Look {
    Red,
    Gold,
}

impl Look {
    pub fn name(self) -> &'static str {
        match self {
            Look::Red => "red",
            Look::Gold => "gold",
        }
    }
}

/// Object templates that are Cubes, with their look.
pub fn known_look(template: u32) -> Option<Look> {
    match template {
        1_200_039 | 1_200_040 | 1_200_041 | 1_201_503 | 1_201_504 | 1_301_199 | 1_301_200
        | 1_301_244 | 1_301_245 => Some(Look::Red),
        1_200_036 | 1_200_037 | 1_200_667 | 1_201_502 | 1_201_505 | 1_300_081 | 1_300_082
        | 1_300_754 | 1_301_242 | 1_301_243 => Some(Look::Gold),
        _ => None,
    }
}

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
/// An opened Cube stays listed this long, marked as taken.
const TAKEN_SHOWN_MS: u64 = 8_000;
const LIVE_SPAWN: u8 = 6;

#[derive(Clone, Debug, PartialEq)]
pub enum Event {
    Spawn {
        id: u64,
        template: u32,
        pos: [f32; 3],
        reason: u8,
        created_ms: Option<u64>,
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
    /// The server's clock, which dates a Cube's creation.
    Clock {
        server_ms: u64,
    },
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

fn long(frame: &[u8], at: usize) -> Option<u64> {
    Some(u64::from_le_bytes(frame.get(at..at + 8)?.try_into().ok()?))
}

/// Three f32 world coordinates at `at`, when they can be a position.
pub fn position(frame: &[u8], at: usize) -> Option<[f32; 3]> {
    let read = |offset| Some(f32::from_le_bytes(frame.get(offset..offset + 4)?.try_into().ok()?));
    let pos = [read(at)?, read(at + 4)?, read(at + 8)?];
    (pos.iter().all(|value| value.is_finite() && value.abs() < 1.0e7)
        && (pos[0] != 0.0 || pos[1] != 0.0))
        .then_some(pos)
}

fn spawn(frame: &[u8]) -> Option<Event> {
    let mut at = 2;
    let id = varint(frame, &mut at).filter(|id| *id > 0)?;
    at += 1; // flags, which only mark optional trailing fields of other objects
    let desc = *frame.get(at)?;
    at += 1;
    if desc & 1 != 0 {
        let length = usize::try_from(varint(frame, &mut at)?).ok()?;
        frame.get(at..at.checked_add(length)?)?;
        at += length;
    }
    let template = word(frame, at).filter(|t| (100_000..=9_999_999).contains(t))?;
    at += 4;
    at += usize::from(desc & 2 != 0) + usize::from(desc & 4 != 0) + 5 * usize::from(desc & 8 != 0)
        + usize::from(desc & 16 != 0);
    let pos = position(frame, at)?;
    at += 12;
    // Origin key (4), direction (4), state (1), can-interact (1), then the reason and the time.
    let reason = *frame.get(at + 10)?;
    let created_ms = long(frame, at + 11).filter(|ms| (1.0e12 as u64..4.0e12 as u64).contains(ms));
    Some(Event::Spawn {
        id,
        template,
        pos,
        reason,
        created_ms,
    })
}

/// A whole frame: two opcode bytes, then the body.
pub fn decode(frame: &[u8]) -> Option<Event> {
    let mut at = 2;
    match frame.get(..2)? {
        [0x00, 0x36] => long(frame, 2)
            .filter(|ms| (1.0e12 as u64..4.0e12 as u64).contains(ms))
            .map(|server_ms| Event::Clock { server_ms }),
        [0x34, 0x36] => spawn(frame),
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
    look: Look,
    pos: [f32; 3],
    opening: bool,
    live: bool,
    created_ms: Option<u64>,
    taken_at: Option<u64>,
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
    /// Local clock minus the server clock, from the latest map frame.
    clock_offset: Option<i64>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct CubeView {
    pub id: u64,
    pub template: u32,
    pub look: Look,
    /// Planar distance, as the server measures its send radius.
    pub distance_m: Option<u32>,
    /// Positive when the Cube is above the player.
    pub vertical_m: Option<i32>,
    /// Against the direction of the last walk, positive to the right; unknown while standing.
    pub direction_deg: Option<i32>,
    /// On the map: 0 is east, 90 north, 180 west, -90 south (north is world -y).
    pub bearing_deg: Option<i32>,
    pub opening: bool,
    /// It appeared while in view, rather than being there already when it came into range.
    pub live: bool,
    /// Seconds since the server created it.
    pub age_s: Option<u32>,
    /// Someone opened it, a moment ago.
    pub taken: bool,
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
        self.clock_offset = None;
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

    fn look_of(&self, template: u32) -> Option<Look> {
        known_look(template).or_else(|| self.learned.contains(&template).then_some(Look::Red))
    }

    pub fn apply(&mut self, event: Event, now: u64) {
        match event {
            Event::Spawn {
                id,
                template,
                pos,
                reason,
                created_ms,
            } => {
                if self.objects.len() >= MAX_OBJECTS && !self.objects.contains_key(&id) {
                    // Crowded areas announce many ordinary objects: drop those before any Cube.
                    let learned = &self.learned;
                    self.objects.retain(|_, object| {
                        known_look(object.template).is_some() || learned.contains(&object.template)
                    });
                    if self.objects.len() >= MAX_OBJECTS {
                        self.objects.clear();
                    }
                }
                self.objects.insert(
                    id,
                    Object {
                        template,
                        look: known_look(template).unwrap_or(Look::Red),
                        pos,
                        opening: false,
                        live: reason == LIVE_SPAWN,
                        created_ms,
                        taken_at: None,
                    },
                );
            }
            Event::Gone { id, reason } => {
                // Opened: keep it listed for a moment as taken. Out of range: forget it.
                let cube = self
                    .objects
                    .get(&id)
                    .is_some_and(|object| self.look_of(object.template).is_some());
                if cube && reason == 4 {
                    if let Some(object) = self.objects.get_mut(&id) {
                        object.taken_at = Some(now);
                        object.opening = false;
                    }
                } else {
                    self.objects.remove(&id);
                }
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
                if key && known_look(object.template).is_none() {
                    let template = object.template;
                    self.learn([template]);
                }
                if let Some(object) = self.objects.get_mut(&id) {
                    object.opening = !done;
                }
            }
            Event::Fix { pos } => self.fix(pos, now),
            Event::Reset => self.objects.clear(),
            Event::Clock { server_ms } => {
                self.clock_offset = Some(now as i64 - server_ms as i64);
            }
        }
        // Opened Cubes are not kept long once nobody looks at them.
        self.objects
            .retain(|_, object| object.taken_at.is_none_or(|at| now.saturating_sub(at) < 60_000));
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
            .filter(|(_, object)| object.taken_at.is_none_or(|at| now.saturating_sub(at) < TAKEN_SHOWN_MS))
            .filter_map(|(id, object)| {
                self.look_of(object.template)?;
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
                // North is world -y and east is world +x, as the map shows it.
                let bearing_deg = relative.map(|r| {
                    // Due west is 180, never -180.
                    match (-r[1]).atan2(r[0]).to_degrees().round() as i32 {
                        -180 => 180,
                        degrees => degrees,
                    }
                });
                let age_s = object.created_ms.zip(self.clock_offset).and_then(|(created, offset)| {
                    let server_now = now as i64 - offset;
                    u32::try_from(((server_now - created as i64) / 1000).max(0)).ok()
                });
                Some(CubeView {
                    id: *id,
                    template: object.template,
                    look: object.look,
                    distance_m: planar.map(|distance| (distance / 100.0).round() as u32),
                    vertical_m: relative.map(|r| (r[2] / 100.0).round() as i32),
                    direction_deg,
                    bearing_deg,
                    opening: object.opening,
                    live: object.live,
                    age_s,
                    taken: object.taken_at.is_some(),
                })
            })
            .collect();
        cubes.sort_by_key(|cube| (cube.taken, cube.distance_m.unwrap_or(u32::MAX), cube.id));
        Radar {
            cubes,
            fix_age_ms: me.map(|fix| now - fix.at_ms),
        }
    }
}
