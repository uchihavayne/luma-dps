use luma_engine::{
    packets::{decode, Event, MemberProfile},
    MeterEngine,
};

// Public wire facts from the MIT AionDPS self-check at revision 8459321.
// These are published examples, not this user's capture or character records.
const WATER: &str = "4136A5AE011F1000C18E2C0000020028A04500788245008031440E86B1437AFC01DF28DF2819070000190700000000000000000000000000005892010064000000F04902000100000000000000A08601000000000090D00300010111010F329A09FFFFFFFFFFFFFFFF8075D52ABB0300008E5509022B5A9B45CADA7B4590C525440702068E2A000002CD00C4040000D0003D0100001E000000E31D030000";
const FIRE: &str = "4136B7DD011F1000B28E2C00400200E8E44500F06B4500806C443AAF7D4366B40198639863630B0000630B000000000000000000000000000060B2010064000000F04902000100000000000000A08601000000000000E20400010101110144AA9809FFFFFFFFFFFFFFFF8075D52ABB030000CF190E02FB71E7451296784571BE6044070206CF0C000002CD005A000000D000300100002D000000DD1D030000";
const WATER_HIT: &str = "0438EC91010600A5AE01BB86010002020000024FA09800010000009E5A690100";
const FIRE_HIT: &str = "0438EC91012600B7DD01AE8601000503000002D99A980001000000C0528B0501410100";

fn raw(hex: &str) -> Vec<u8> {
    hex.as_bytes()
        .chunks_exact(2)
        .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
        .collect()
}
fn apply(engine: &mut MeterEngine, frame: &[u8], now: u64) {
    if let Some(event) = decode(frame).unwrap() {
        engine.ingest_event(event, now);
    }
}
fn player(engine: &mut MeterEngine, id: u64, name: &str, own: bool) {
    engine.ingest_event(
        Event::Identity {
            id,
            name: name.into(),
            class: Some(14),
            own,
        },
        0,
    );
}
fn ownership(frame: &[u8]) -> Option<(u64, u64)> {
    let Event::Updates(events) = decode(frame).ok()?? else {
        return None;
    };
    events.into_iter().find_map(|event| match event {
        Event::Owner { id, owner } => Some((id, owner)),
        _ => None,
    })
}

#[test]
fn public_spawn_owner_varint_and_tagged_u16_agree_and_credit_separate_summoners() {
    assert_eq!(ownership(&raw(WATER)), Some((22309, 10894)));
    assert_eq!(ownership(&raw(FIRE)), Some((28343, 3279)));
    let mut engine = MeterEngine::default();
    player(&mut engine, 10894, "FirstOwner", false);
    player(&mut engine, 3279, "OwnCharacter", true);
    apply(&mut engine, &raw(WATER), 100);
    apply(&mut engine, &raw(FIRE), 200);
    apply(&mut engine, &raw(WATER_HIT), 1000);
    apply(&mut engine, &raw(FIRE_HIT), 1100);
    let state = engine.live_state(2000);
    assert_eq!(state.total_damage, 756);
    assert_eq!(state.personal_total_damage, Some(651));
    assert_eq!(state.players.len(), 2);
    assert!(state
        .players
        .iter()
        .any(|row| row.id == 10894 && row.name == "FirstOwner" && row.damage == 105));
    assert!(state
        .players
        .iter()
        .all(|row| row.id != 22309 && row.id != 28343));
}

#[test]
fn tagged_owner_fallback_requires_the_same_independently_received_owner() {
    let fallback = WATER.replace("0702068E2A", "0702018E2A");
    assert_eq!(ownership(&raw(&fallback)), Some((22309, 10894)));
    let mismatch = WATER.replace("0702068E2A", "070206CF0C");
    assert_eq!(ownership(&raw(&mismatch)), None);
    let no_marker = WATER.replace("FFFFFFFFFFFFFFFF", "FEFFFFFFFFFFFFFF");
    assert_eq!(ownership(&raw(&no_marker)), None);
    let ambiguous = WATER.to_owned() + "0702068E2A";
    assert_eq!(ownership(&raw(&ambiguous)), None);
}

#[test]
fn actor_reused_as_unowned_monster_cannot_rewrite_the_prior_summoners_damage() {
    let reused = WATER.replace("8075D52ABB0300008E55", "8075D52ABB030000A5AE01");
    assert_eq!(ownership(&raw(&reused)), None);
    let mut engine = MeterEngine::default();
    player(&mut engine, 10894, "Owner", true);
    apply(&mut engine, &raw(WATER), 100);
    apply(&mut engine, &raw(WATER_HIT), 1000);
    apply(&mut engine, &raw(&reused), 1100);
    apply(&mut engine, &raw(WATER_HIT), 1200);
    let state = engine.live_state(2000);
    assert_eq!(state.personal_total_damage, Some(0));
    assert!(state
        .players
        .iter()
        .any(|row| row.id == 22309 && row.damage == 105));
    let history = engine.history_snapshot().1;
    assert_eq!(history[0].personal_total_damage, Some(105));
    assert_eq!(history[0].players[0].name, "Owner");
}

#[test]
fn loot_npc_and_bare_appearance_prefix_never_establish_summon_ownership() {
    let mut loot = raw(WATER);
    loot[5] = 0x0c;
    assert_eq!(ownership(&loot), None);
    let mut engine = MeterEngine::default();
    player(&mut engine, 10894, "Owner", true);
    apply(&mut engine, &loot, 100);
    // Earlier builds treated this unverified short prefix as an Owner record.
    let bare = raw("048DA5AE01000000008E55");
    assert_eq!(decode(&bare).unwrap(), None);
    apply(&mut engine, &bare, 200);
    apply(&mut engine, &raw(WATER_HIT), 1000);
    assert_eq!(engine.live_state(2000).total_damage, 0);
    assert_eq!(engine.live_state(2000).personal_total_damage, Some(0));
}

#[test]
fn a_short_death_notice_does_not_reattribute_pet_damage_or_create_a_new_owner() {
    let mut engine = MeterEngine::default();
    player(&mut engine, 10894, "Owner", true);
    apply(&mut engine, &raw(WATER), 100);
    apply(&mut engine, &raw(WATER_HIT), 1000);
    let death = raw("048DA5AE01");
    assert_eq!(
        decode(&death).unwrap(),
        Some(Event::Removed {
            id: 22309,
            death: true
        })
    );
    apply(&mut engine, &death, 1100);
    let state = engine.live_state(2000);
    assert_eq!(state.players.len(), 1);
    assert_eq!(state.players[0].id, 10894);
    assert_eq!(state.players[0].name, "Owner");
    assert_eq!(state.personal_total_damage, Some(105));
}

#[test]
fn independently_received_owner_profile_names_previously_anonymous_pet_damage_without_a_party() {
    let mut engine = MeterEngine::default();
    apply(&mut engine, &raw(WATER), 100);
    apply(&mut engine, &raw(WATER_HIT), 1000);
    engine.ingest_event(
        Event::MemberProfiles {
            members: vec![MemberProfile {
                id: 10894,
                server: 1304,
                name: "ReceivedOwner".into(),
            }],
        },
        1100,
    );
    let state = engine.live_state(2000);
    assert_eq!(state.players.len(), 1);
    assert_eq!(state.players[0].name, "ReceivedOwner");
    assert_eq!(state.players[0].damage, 105);
    assert_eq!(state.local_player_id, None);
    assert_eq!(state.party_total_damage, None);
}
