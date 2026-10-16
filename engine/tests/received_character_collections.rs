use luma_engine::character::{self, CharacterEvent, CharacterStore};
use luma_engine::packets::{decode, Event};

fn power(current: u32, highest: u32) -> Vec<u8> {
    let mut frame = vec![0x56, 0x36];
    frame.extend(current.to_le_bytes());
    frame.extend([0; 4]);
    frame.extend(highest.to_le_bytes());
    frame.extend([0; 4]);
    frame
}

fn collections() -> Vec<u8> {
    let mut frame = vec![0, 0x90];
    frame.extend(0u32.to_le_bytes()); // no active pet
    frame.extend([0, 0]); // inventory and progress lists
    for id in 2..=6u8 {
        if id > 2 {
            frame.push(0xaa);
        }
        frame.extend([id, id]);
        frame.extend(12u32.to_le_bytes());
        frame.extend(345u64.to_le_bytes());
        frame.extend([1, 0xfb, 1, 2]); // one page, two slots
        frame.extend([0, 3]);
        frame.extend(42u16.to_le_bytes());
        frame.extend(123i64.to_le_bytes());
        frame.extend([0xab, 1, 0]); // empty second slot
        frame.extend(0u16.to_le_bytes());
        frame.extend(0i64.to_le_bytes());
    }
    frame
}

#[test]
fn combat_power_requires_entire_verified_shape_and_accepts_separate_server_updates() {
    for (current, highest) in [(356559, 400000), (400001, 400000)] {
        assert_eq!(
            character::decode(&power(current, highest)).unwrap(),
            Some(CharacterEvent::CombatPower { current, highest })
        );
    }
    let valid = power(356559, 400000);
    for end in 0..valid.len() {
        assert!(!matches!(character::decode(&valid[..end]), Ok(Some(_))));
    }
    let mut invalid = valid.clone();
    invalid[7] = 1;
    assert!(character::decode(&invalid).is_err());
    let mut invalid = valid;
    invalid.push(0);
    assert!(character::decode(&invalid).is_err());
    assert!(character::decode(&power(0, 400000)).is_err());
    assert!(matches!(
        decode(&power(356559, 400000)).unwrap(),
        Some(Event::Character(_))
    ));
}

#[test]
fn own_power_waits_for_identity_and_does_not_cross_character_or_pending_age() {
    let mut store = CharacterStore::default();
    store.ingest(
        CharacterEvent::CombatPower {
            current: 356559,
            highest: 400000,
        },
        1000,
    );
    assert!(store.snapshot().own.is_none());
    assert_eq!(
        store
            .snapshot()
            .unbound_own
            .unwrap()
            .combat_power
            .unwrap()
            .current,
        356559
    );
    store.bind_self(7, "First", Some(1304), 2000);
    assert_eq!(
        store
            .own_snapshot()
            .unwrap()
            .combat_power
            .unwrap()
            .observed_at_ms,
        1000
    );
    store.bind_self(8, "Second", Some(1304), 3000);
    assert!(store.snapshot().own.unwrap().combat_power.is_none());
    store.clear();
    store.ingest(
        CharacterEvent::CombatPower {
            current: 356559,
            highest: 400000,
        },
        1000,
    );
    // A later equipment observation must not rejuvenate old pending power.
    store.ingest(
        CharacterEvent::Equipment {
            items: vec![],
            complete: false,
        },
        32000,
    );
    store.bind_self(9, "Third", Some(1304), 33000);
    assert!(store.snapshot().own.unwrap().combat_power.is_none());
}

#[test]
fn received_species_has_all_five_groups_and_numeric_effects_without_catalog_guesses() {
    let frame = collections();
    let Some(CharacterEvent::Species { species }) = character::decode_species(&frame).unwrap()
    else {
        panic!("missing species");
    };
    assert_eq!(species.len(), 5);
    assert_eq!(species[0].species_id, 2);
    assert_eq!((species[4].level, species[4].progress), (12, 345));
    assert_eq!(species[0].effects.len(), 1);
    assert_eq!(species[0].effects[0].stat_id, 42);
    assert_eq!(species[0].effects[0].value, 123);
    let Some(Event::Updates(events)) = decode(&frame).unwrap() else {
        panic!("expected pet and species");
    };
    assert_eq!(events.len(), 2);
    for end in 8..frame.len() {
        assert!(!matches!(
            character::decode_species(&frame[..end]),
            Ok(Some(_))
        ));
    }
    let mut ambiguous = frame.clone();
    ambiguous.extend(&frame[8..]);
    assert!(character::decode_species(&ambiguous).is_err());
}

#[test]
fn only_unique_own_character_wing_anchor_establishes_wing_observation() {
    let mut frame = vec![0x33, 0x36, 7, 0, 0, 0, 0, 1, 5];
    frame.extend(b"First");
    frame.extend(1304u16.to_le_bytes());
    frame.extend(14u32.to_le_bytes());
    frame.extend([0xa0, 0x86, 1, 0, 0xa0, 0x86, 1, 0]);
    frame.extend([0; 8]);
    frame.extend([1, 0, 0, 0, 1]);
    frame.extend(30_500_200u32.to_le_bytes());
    frame.extend(30_400_400u32.to_le_bytes());
    assert_eq!(
        character::decode_own_wing(&frame),
        Some(CharacterEvent::Wing {
            wing_id: 30_500_200,
            skin_id: Some(30_400_400),
        })
    );
    let Some(Event::Updates(updates)) = decode(&frame).unwrap() else {
        panic!("expected bound wing");
    };
    assert!(matches!(
        &updates[0],
        Event::Identity {
            own: true,
            id: 7,
            ..
        }
    ));
    assert!(matches!(
        &updates[1],
        Event::Character(CharacterEvent::Wing { .. })
    ));
    let mut other = frame.clone();
    other[0] = 0x45;
    assert_eq!(character::decode_own_wing(&other), None);
    let mut ambiguous = frame;
    ambiguous.extend([0xa0, 0x86, 1, 0, 0xa0, 0x86, 1, 0]);
    assert_eq!(character::decode_own_wing(&ambiguous), None);
}

#[test]
fn announced_zone_is_read_from_zone_route_and_validated_at_offset() {
    let mut frame = vec![0x21, 0x36];
    frame.extend(25u32.to_le_bytes());
    frame.extend(600001u32.to_le_bytes());
    assert_eq!(
        decode(&frame).unwrap(),
        Some(Event::ZoneChange { zone_id: 600001 })
    );
    for end in 0..frame.len() {
        assert!(!matches!(
            decode(&frame[..end]),
            Ok(Some(Event::ZoneChange { .. }))
        ));
    }
    frame[6..].copy_from_slice(&0u32.to_le_bytes());
    assert!(decode(&frame).is_err());
}

fn party(party_id: u32, names: &[&str]) -> Vec<u8> {
    let mut frame = vec![2, 0x97];
    frame.extend(party_id.to_le_bytes());
    frame.extend([0, 5]); // an empty recruitment title is valid
    frame.extend([0; 17]);
    frame.push(names.len() as u8);
    for (index, name) in names.iter().enumerate() {
        let slot = (index + 1) as u8;
        frame.extend([12, slot]);
        frame.extend((1304u64 << 48 | u64::from(slot)).to_le_bytes());
        frame.push(name.len() as u8);
        frame.extend(name.as_bytes());
        for value in [14u32, 50, 5000] {
            frame.extend(value.to_le_bytes());
        }
        frame.extend(1304u16.to_le_bytes());
        frame.extend(1304u16.to_le_bytes());
        frame.push(4);
        frame.extend(350_000u64.to_le_bytes());
        frame.extend([1, 2, 1, 0, 0, 0]);
    }
    frame
}

#[test]
fn validated_party_context_precedes_partial_members_and_zero_does_not_claim_disband() {
    let Some(Event::Updates(updates)) = decode(&party(77, &["Local", "Ally"])).unwrap() else {
        panic!("missing party context");
    };
    assert_eq!(
        updates[0],
        Event::PartyContext {
            party_id: 77,
            capacity: 5
        }
    );
    assert!(matches!(&updates[1], Event::PartyMembers { members } if members.len() == 2));
    assert!(matches!(
        decode(&party(0, &["Local"])).unwrap(),
        Some(Event::PartyMembers { .. })
    ));
    let mut invalid = party(88, &["Local"]);
    invalid.truncate(15);
    assert!(decode(&invalid).is_err()); // no context emitted from a broken roster
}

#[test]
fn a_new_smaller_party_cannot_keep_members_from_the_previous_party() {
    let mut engine = luma_engine::MeterEngine::default();
    engine.ingest_event(
        decode(&party(77, &["Local", "OldAlly"])).unwrap().unwrap(),
        1000,
    );
    engine.ingest_event(decode(&party(77, &["Local"])).unwrap().unwrap(), 2000);
    assert_eq!(
        engine.party_identity_roster()["members"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    engine.ingest_event(decode(&party(88, &["Local"])).unwrap().unwrap(), 3000);
    let roster = engine.party_identity_roster();
    assert_eq!(roster["members"].as_array().unwrap().len(), 1);
    assert_eq!(roster["members"][0]["name"], "Local");
}
