//! What one state update costs on the Rust side, for a busy fight: twelve players, twenty-five skills each, a
//! boss and a few other targets. Run in release mode:
//!   cargo run --release --example state_cost [out.json]
//! It prints the time of building the state, turning it into a JSON value, writing it as text (what the
//! fingerprint does), and its size; the optional path receives the JSON so another tool can time reading it.
use luma_engine::{
    packets::{Event, Hit},
    MeterEngine,
};
use std::time::Instant;

const PLAYERS: u64 = 12;
const SKILLS: u32 = 25;
const TARGETS: u64 = 6;

fn busy_engine() -> (MeterEngine, u64) {
    let mut engine = MeterEngine::default();
    for target in 0..TARGETS {
        engine.ingest_event(Event::Npc { id: 1000 + target, name: Some(format!("Target {target}")), model: 2_900_000 + target as u32, kind: 0x0c }, 0);
    }
    let classes = [14u32, 18, 21, 25, 29, 33, 37, 41, 45, 17, 22, 26];
    for player in 0..PLAYERS {
        engine.ingest_event(
            Event::Identity { id: 1 + player, name: format!("Player{player}"), class: Some(classes[player as usize % classes.len()]), own: player == 0 },
            0,
        );
    }
    // A minute of fighting at twenty hits a second per player.
    let mut now = 1_000;
    let mut seed = 7u64;
    while now < 61_000 {
        for player in 0..PLAYERS {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            let skill = 14_000_000 + (player as u32 % 9) * 1_000_000 + ((seed >> 33) as u32 % SKILLS);
            let target = 1000 + (seed >> 40) % TARGETS;
            engine.ingest_event(
                Event::Damage(Hit { source: 1 + player, target, skill, amount: 500 + (seed >> 50) % 4000, critical: seed % 5 == 0, tick: false, flags: 0, angle: 0 }),
                now,
            );
        }
        now += 50;
    }
    (engine, now)
}


/// What each game frame costs the engine: kept for a capture dump and looked at for the party, items, deaths
/// and so on. A raid sends thousands a second, so a microsecond here is milliseconds every second.
fn frame_cost() {
    let mut engine = MeterEngine::default();
    let frames: Vec<Vec<u8>> = (0..64u32)
        .map(|index| {
            // A mix of sizes and opcodes: most are nothing to the meter.
            let mut frame = vec![(index * 7 % 251) as u8, (index * 13 % 241) as u8];
            frame.extend((0..(40 + index as usize * 6)).map(|byte| (byte as u32 * 31 + index) as u8));
            frame
        })
        .collect();
    let rounds = 400_000u32;
    let started = Instant::now();
    for round in 0..rounds {
        let frame = &frames[round as usize % frames.len()];
        engine.remember_frame(u64::from(round), frame);
    }
    let kept = started.elapsed().as_secs_f64() / f64::from(rounds) * 1e6;
    let started = Instant::now();
    for round in 0..rounds {
        let frame = &frames[round as usize % frames.len()];
        engine.observe_game_frame(frame, u64::from(round));
    }
    let looked = started.elapsed().as_secs_f64() / f64::from(rounds) * 1e6;
    println!("per game frame: keeping it {kept:.2} us, looking at it {looked:.2} us (a raid: ~5,000 a second -> {:.1} ms a second)", (kept + looked) * 5.0);
}

fn main() {
    frame_cost();
    let (engine, now) = busy_engine();
    let rounds = 200u32;
    let (mut build, mut value_time, mut text_time, mut direct_time) = (0f64, 0f64, 0f64, 0f64);
    let (mut size, mut players, mut skills) = (0usize, 0usize, 0usize);
    let mut last = serde_json::Value::Null;
    for _ in 0..rounds {
        let started = Instant::now();
        let state = engine.live_state(now);
        build += started.elapsed().as_secs_f64();
        players = state.players.len();
        skills = state.players.iter().map(|player| player.skills.len()).sum();
        let started = Instant::now();
        let direct = serde_json::to_string(&state).unwrap();
        direct_time += started.elapsed().as_secs_f64();
        let started = Instant::now();
        let value = serde_json::to_value(&state).unwrap();
        value_time += started.elapsed().as_secs_f64();
        let started = Instant::now();
        let text = serde_json::to_string(&value).unwrap();
        text_time += started.elapsed().as_secs_f64();
        size = text.len().max(direct.len());
        last = value;
    }
    let ms = |total: f64| total / f64::from(rounds) * 1000.0;
    println!("players {players}, skill rows {skills}, state JSON {} KB", size / 1024);
    println!("build the state        {:6.2} ms", ms(build));
    println!("to a JSON value        {:6.2} ms", ms(value_time));
    println!("value as text          {:6.2} ms   (what the fingerprint writes, again, every pass)", ms(text_time));
    println!("state straight as text {:6.2} ms", ms(direct_time));
    println!("one pass, the old way {:6.2} ms   (build + value + text, every 150 ms, in the game or not)", ms(build) + ms(value_time) + ms(text_time));
    println!("one pass, the new way {:6.2} ms   (build + text; sent only when it changed, once a second when quiet)", ms(build) + ms(direct_time));
    if let Some(path) = std::env::args().nth(1) {
        std::fs::write(&path, serde_json::to_vec(&last).unwrap()).unwrap();
        println!("wrote {path}");
    }
}
