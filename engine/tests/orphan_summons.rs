//! Summons and spell entities that are never announced or named show up only as damage sources.
//! They are tied to a player by class, a shared power scalar and a much larger skill set, and only
//! when exactly one player fits.
use luma_engine::{
    packets::{self, Event, Hit},
    MeterEngine,
};

const SORCERER: u32 = 25;
const SPIRITMASTER: u32 = 21;

fn identity(engine: &mut MeterEngine, id: u64, class: u32) {
    engine.ingest_event(
        Event::Identity {
            id,
            name: format!("Player{id}"),
            class: Some(class),
            own: false,
        },
        0,
    )
}
fn npc(engine: &mut MeterEngine) {
    engine.ingest_event(
        Event::Npc {
            id: 10,
            name: Some("Target".into()),
            model: 2_900_000,
            kind: 0x0c,
        },
        0,
    )
}
fn hit(engine: &mut MeterEngine, source: u64, skill: u32, amount: u64, now: u64) {
    engine.ingest_event(
        Event::Damage(Hit {
            source,
            target: 10,
            skill,
            amount,
            critical: false,
            tick: false,
            flags: 0,
            angle: 0,
        }),
        now,
    )
}
/// A Sorcerer with six different skills and the given power scalars.
fn sorcerer(engine: &mut MeterEngine, id: u64, scalars: &[u32]) {
    identity(engine, id, SORCERER);
    for (index, skill) in [15_050_340, 15_060_340, 15_070_340, 15_080_340, 15_090_340, 15_100_340]
        .into_iter()
        .enumerate()
    {
        hit(engine, id, skill, 100, 1000 + index as u64);
    }
    for scalar in scalars {
        engine.observe_power(id, *scalar);
    }
}
fn rows(engine: &mut MeterEngine, at: u64) -> Vec<(u64, u64)> {
    // The binding is re-evaluated at most once a second, on the engine's tick.
    engine.tick(at);
    let mut rows: Vec<_> = engine
        .live_state(at + 100)
        .players
        .iter()
        .map(|row| (row.id, row.damage))
        .collect();
    rows.sort();
    rows
}

#[test]
fn an_unannounced_spell_entity_joins_the_one_player_it_fits() {
    let mut engine = MeterEngine::default();
    npc(&mut engine);
    sorcerer(&mut engine, 1, &[17_000, 18_000]);
    hit(&mut engine, 77, 15_280_142, 50, 2000);
    hit(&mut engine, 77, 15_280_142, 70, 3000);
    engine.observe_power(77, 17_000);
    assert_eq!(rows(&mut engine, 10_000), vec![(1, 720)]);
    let record = engine.current_record(10_100);
    assert!(record.damage_samples.iter().all(|sample| sample.player_id == 1));
}

#[test]
fn nothing_is_merged_without_every_condition() {
    // No power scalar in common.
    let mut engine = MeterEngine::default();
    npc(&mut engine);
    sorcerer(&mut engine, 1, &[17_000]);
    hit(&mut engine, 77, 15_280_142, 50, 2000);
    engine.observe_power(77, 20_000);
    assert_eq!(rows(&mut engine, 10_000), vec![(1, 600), (77, 50)]);

    // The player has too few skills: two against one is not three times as many.
    let mut engine = MeterEngine::default();
    npc(&mut engine);
    identity(&mut engine, 1, SORCERER);
    hit(&mut engine, 1, 15_050_340, 100, 1000);
    hit(&mut engine, 1, 15_060_340, 100, 1001);
    engine.observe_power(1, 17_000);
    hit(&mut engine, 77, 15_280_142, 50, 2000);
    engine.observe_power(77, 17_000);
    assert_eq!(rows(&mut engine, 10_000), vec![(1, 200), (77, 50)]);

    // The summon's skills belong to another class.
    let mut engine = MeterEngine::default();
    npc(&mut engine);
    sorcerer(&mut engine, 1, &[17_000]);
    hit(&mut engine, 77, 16_280_142, 50, 2000);
    engine.observe_power(77, 17_000);
    assert_eq!(rows(&mut engine, 10_000), vec![(1, 600), (77, 50)]);

    // Its skills span two classes, or none of a class (monster skills).
    let mut engine = MeterEngine::default();
    npc(&mut engine);
    sorcerer(&mut engine, 1, &[17_000]);
    hit(&mut engine, 77, 15_280_142, 50, 2000);
    hit(&mut engine, 77, 16_280_142, 50, 2001);
    engine.observe_power(77, 17_000);
    hit(&mut engine, 78, 2_100_075, 40, 2002);
    engine.observe_power(78, 17_000);
    assert_eq!(rows(&mut engine, 10_000), vec![(1, 600), (77, 100), (78, 40)]);

    // No scalar was ever seen for it.
    let mut engine = MeterEngine::default();
    npc(&mut engine);
    sorcerer(&mut engine, 1, &[17_000]);
    hit(&mut engine, 77, 15_280_142, 50, 2000);
    assert_eq!(rows(&mut engine, 10_000), vec![(1, 600), (77, 50)]);
}

#[test]
fn two_players_that_fit_leave_the_entity_alone_and_a_binding_is_released_when_one_appears() {
    let mut engine = MeterEngine::default();
    npc(&mut engine);
    sorcerer(&mut engine, 1, &[17_000]);
    hit(&mut engine, 77, 15_280_142, 50, 2000);
    engine.observe_power(77, 17_000);
    assert_eq!(rows(&mut engine, 10_000), vec![(1, 650)]);
    // A second Sorcerer with the same scalar and as many skills makes it ambiguous.
    sorcerer(&mut engine, 2, &[17_000]);
    assert_eq!(rows(&mut engine, 20_000), vec![(1, 600), (2, 600), (77, 50)]);
}

#[test]
fn announced_players_and_pets_are_never_treated_as_unannounced() {
    let mut engine = MeterEngine::default();
    npc(&mut engine);
    sorcerer(&mut engine, 1, &[17_000]);
    // A Spiritmaster with a single skill has no owner to find, whatever its scalar.
    identity(&mut engine, 2, SPIRITMASTER);
    hit(&mut engine, 2, 16_050_340, 80, 2000);
    engine.observe_power(2, 17_000);
    assert_eq!(rows(&mut engine, 10_000), vec![(1, 600), (2, 80)]);
}

#[test]
fn the_power_scalar_is_read_from_a_real_damage_frame() {
    let frame: Vec<u8> = "0438e9de020600c80b9147ff003f02020002aff4b76301000000e4506a0100"
        .as_bytes()
        .chunks(2)
        .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
        .collect();
    assert_eq!(packets::power_scalar(&frame), Some((1480, 10_340)));
    // The decoded hit is the same one the scalar came from.
    let Some(Event::Damage(hit)) = packets::decode(&frame).unwrap() else {
        panic!("expected damage");
    };
    assert_eq!((hit.source, hit.amount), (1480, 106));
    assert_eq!(packets::power_scalar(&frame[..frame.len() - 4]), None);
    assert_eq!(packets::power_scalar(&[0x05, 0x38, 1, 2, 3]), None);
}
