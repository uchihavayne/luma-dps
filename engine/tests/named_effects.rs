//! Effect entities such as a Cleric's auras are announced under their caster's name with no class.
//! Their damage belongs to that caster's row, but only when the match is unambiguous.
use luma_engine::{
    packets::{Event, Hit, MemberProfile},
    MeterEngine,
};

const CLERIC: u32 = 29;
const SORCERER: u32 = 25;
const AURA_SKILL: u32 = 17_150_342;

fn identity(engine: &mut MeterEngine, id: u64, name: &str, class: u32, own: bool) {
    engine.ingest_event(
        Event::Identity {
            id,
            name: name.into(),
            class: Some(class),
            own,
        },
        0,
    )
}
fn profile(engine: &mut MeterEngine, id: u64, name: &str, server: u16) {
    engine.ingest_event(
        Event::MemberProfiles {
            members: vec![MemberProfile {
                id,
                server,
                name: name.into(),
            }],
        },
        0,
    )
}
fn npc(engine: &mut MeterEngine, id: u64) {
    engine.ingest_event(
        Event::Npc {
            id,
            name: Some("Target".into()),
            model: 2_900_000,
            kind: 0x0c,
        },
        0,
    )
}
fn hit(engine: &mut MeterEngine, source: u64, amount: u64, now: u64) {
    engine.ingest_event(
        Event::Damage(Hit {
            source,
            target: 10,
            amount,
            skill: AURA_SKILL,
            critical: false,
            tick: true,
            flags: 0,
            angle: 0,
        }),
        now,
    )
}
fn rows(engine: &MeterEngine) -> Vec<(u64, u64)> {
    let mut rows: Vec<_> = engine
        .live_state(5000)
        .players
        .iter()
        .map(|row| (row.id, row.damage))
        .collect();
    rows.sort();
    rows
}

#[test]
fn an_aura_named_after_its_caster_adds_to_the_caster_whichever_arrives_first() {
    for aura_first in [false, true] {
        let mut engine = MeterEngine::default();
        npc(&mut engine, 10);
        if aura_first {
            profile(&mut engine, 5, "Lelie", 1304);
            identity(&mut engine, 1, "Lelie", CLERIC, false);
        } else {
            identity(&mut engine, 1, "Lelie", CLERIC, false);
            profile(&mut engine, 5, "Lelie", 1304);
        }
        hit(&mut engine, 1, 100, 1000);
        hit(&mut engine, 5, 40, 2000);
        assert_eq!(rows(&engine), vec![(1, 140)], "aura first: {aura_first}");
        let record = engine.current_record(5000);
        assert!(record.damage_samples.iter().all(|sample| sample.player_id == 1));
    }
}

#[test]
fn the_local_players_own_aura_joins_the_local_row() {
    let mut engine = MeterEngine::default();
    npc(&mut engine, 10);
    identity(&mut engine, 1, "Mine", CLERIC, true);
    profile(&mut engine, 5, "Mine", 1304);
    hit(&mut engine, 1, 100, 1000);
    hit(&mut engine, 5, 60, 2000);
    let state = engine.live_state(5000);
    assert_eq!(state.personal_total_damage, Some(160));
    assert_eq!(rows(&engine), vec![(1, 160)]);
}

#[test]
fn a_player_who_is_later_identified_with_a_class_is_released() {
    let mut engine = MeterEngine::default();
    npc(&mut engine, 10);
    identity(&mut engine, 1, "Twin", CLERIC, false);
    profile(&mut engine, 5, "Twin", 1304);
    hit(&mut engine, 5, 40, 1000);
    assert_eq!(rows(&engine), vec![(1, 40)]);
    // A class arrives for entity 5: it is its own character after all.
    identity(&mut engine, 5, "Twin", SORCERER, false);
    hit(&mut engine, 5, 60, 2000);
    hit(&mut engine, 1, 10, 3000);
    // Its earlier damage is its own too: the row follows whoever the entity turned out to be.
    assert_eq!(rows(&engine), vec![(1, 10), (5, 100)]);
}

#[test]
fn two_identified_players_with_one_name_are_never_merged_and_an_ambiguous_alias_stays_apart() {
    let mut engine = MeterEngine::default();
    npc(&mut engine, 10);
    identity(&mut engine, 1, "Same", CLERIC, false);
    identity(&mut engine, 2, "Same", SORCERER, false);
    hit(&mut engine, 1, 100, 1000);
    hit(&mut engine, 2, 200, 1000);
    assert_eq!(rows(&engine), vec![(1, 100), (2, 200)]);
    // Neither home server is known, so the alias could belong to either: it stays its own row.
    profile(&mut engine, 5, "Same", 1304);
    hit(&mut engine, 5, 30, 2000);
    assert_eq!(rows(&engine), vec![(1, 100), (2, 200), (5, 30)]);
}

#[test]
fn the_home_server_picks_the_right_one_of_two_same_named_players() {
    let mut engine = MeterEngine::default();
    npc(&mut engine, 10);
    identity(&mut engine, 1, "Same", CLERIC, false);
    profile(&mut engine, 1, "Same", 1304);
    identity(&mut engine, 2, "Same", CLERIC, false);
    profile(&mut engine, 2, "Same", 1305);
    // Re-announcing the two real players with a class and server must not bind them to each other.
    hit(&mut engine, 1, 100, 1000);
    hit(&mut engine, 2, 200, 1000);
    profile(&mut engine, 5, "Same", 1305);
    hit(&mut engine, 5, 30, 2000);
    assert_eq!(rows(&engine), vec![(1, 100), (2, 230)]);
    // An alias from a server neither player belongs to has no owner.
    profile(&mut engine, 6, "Same", 1999);
    hit(&mut engine, 6, 7, 3000);
    assert_eq!(rows(&engine).len(), 3);
}

#[test]
fn a_target_named_like_a_player_is_not_an_effect() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Target", CLERIC, false);
    npc(&mut engine, 10);
    hit(&mut engine, 1, 100, 1000);
    assert_eq!(rows(&engine), vec![(1, 100)]);
}
