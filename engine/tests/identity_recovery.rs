use luma_engine::{
    packets::{decode, Event, Hit, MemberProfile, PartyMember},
    MeterEngine,
};

fn varint(mut value: u32) -> Vec<u8> {
    let mut bytes = Vec::new();
    loop {
        let low = (value & 127) as u8;
        value >>= 7;
        bytes.push(if value == 0 { low } else { low | 128 });
        if value == 0 {
            return bytes;
        }
    }
}

fn appearance(target: u32, actor: u32, server: u16, name: &str) -> Vec<u8> {
    let mut bytes = vec![4, 0x8d];
    bytes.extend(varint(target));
    bytes.extend(14_090_000u32.to_le_bytes());
    bytes.extend(varint(actor));
    bytes.extend(server.to_le_bytes());
    bytes.push(name.len() as u8);
    bytes.extend(name.as_bytes());
    bytes
}

fn identity(engine: &mut MeterEngine, actor: u64, name: &str, own: bool, now: u64) {
    engine.ingest_event(
        Event::Identity {
            id: actor,
            name: name.into(),
            class: Some(14),
            own,
        },
        now,
    );
}

fn hit(engine: &mut MeterEngine, actor: u64, now: u64) {
    engine.ingest_event(
        Event::Damage(Hit {
            source: actor,
            target: 99,
            skill: 14_090_000,
            amount: 100,
            critical: false,
            tick: false,
            flags: 0,
            angle: 0,
        }),
        now,
    );
}

fn profile(engine: &mut MeterEngine, actor: u64, server: u16, name: &str, now: u64) {
    engine.ingest_event(
        Event::MemberProfiles {
            members: vec![MemberProfile {
                id: actor,
                server,
                name: name.into(),
            }],
        },
        now,
    );
}

fn roster(engine: &mut MeterEngine, server: u16, name: &str, now: u64) {
    engine.ingest_event(
        Event::PartyMembers {
            members: vec![PartyMember {
                key: 5000,
                server,
                slot: 1,
                name: name.into(),
                class: 14,
            }],
        },
        now,
    );
}

fn tcp(sequence: u32, payload: &[u8]) -> Vec<u8> {
    let mut bytes = vec![0u8; 40];
    bytes[0] = 0x45;
    bytes[2..4].copy_from_slice(&((40 + payload.len()) as u16).to_be_bytes());
    bytes[9] = 6;
    bytes[12..16].copy_from_slice(&[10, 0, 0, 1]);
    bytes[16..20].copy_from_slice(&[10, 0, 0, 2]);
    bytes[20..22].copy_from_slice(&13328u16.to_be_bytes());
    bytes[22..24].copy_from_slice(&51000u16.to_be_bytes());
    bytes[24..28].copy_from_slice(&sequence.to_be_bytes());
    bytes[32] = 0x50;
    bytes[33] = 0x18;
    bytes.extend(payload);
    bytes
}

#[test]
fn player_appearance_names_the_acting_combat_id_without_promoting_self_or_target() {
    // Public wire example in the MIT AionDPS self-check, revision 8459321.
    let hex = "048d8484030e4ea800be081805044161687a08416b617473756b69010000000000000100";
    let bytes: Vec<u8> = hex
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
        .collect();
    assert_eq!(
        decode(&bytes).unwrap(),
        Some(Event::Identity {
            id: 1086,
            name: "Aahz".into(),
            class: None,
            own: false,
        })
    );
    let mut engine = MeterEngine::default();
    hit(&mut engine, 1086, 1000);
    engine.ingest_event(decode(&bytes).unwrap().unwrap(), 1100);
    let state = engine.live_state(2000);
    assert_eq!(state.players[0].name, "Aahz");
    assert!(state.players[0].identity_confirmed);
    assert_eq!(state.local_player_id, None);
    assert_eq!(state.party_total_damage, None);
    assert_eq!(state.total_damage, 100);
}

#[test]
fn appearance_handles_self_target_unicode_and_all_home_servers_without_name_scanning() {
    for (server, name) in [(1301, "12hrs"), (2304, "弓手"), (1401, "Yakın")] {
        let mut bytes = appearance(42, 42, server, name);
        bytes.push(5);
        bytes.extend(b"Guild");
        assert_eq!(
            decode(&bytes).unwrap(),
            Some(Event::Identity {
                id: 42,
                name: name.into(),
                class: None,
                own: false,
            })
        );
    }
}

#[test]
fn incomplete_or_malformed_appearance_does_not_become_a_name_or_owner_guess() {
    let bytes = appearance(99, 2, 1304, "Healer");
    for end in 0..bytes.len() {
        assert!(!matches!(
            decode(&bytes[..end]),
            Ok(Some(Event::Identity { .. }))
        ));
    }
    for bytes in [
        appearance(99, 2, 5, "Healer"),
        appearance(99, 2, 1304, " Guild "),
        appearance(99, 2, 1304, "1234"),
    ] {
        assert!(decode(&bytes).is_err());
    }
    // An invalid first field must not be skipped in favor of a later guild.
    let mut bad = appearance(99, 2, 1304, "");
    bad.push(6);
    bad.extend(b"Healer");
    assert!(decode(&bad).is_err());
    let mut short_owner = vec![4, 0x8d, 3];
    short_owner.extend(14_090_000u32.to_le_bytes());
    short_owner.push(2);
    assert_eq!(
        decode(&short_owner).unwrap(),
        Some(Event::Owner { id: 3, owner: 2 })
    );
}

#[test]
fn midstream_framing_recovers_real_nearby_names_after_damage_has_started() {
    let mut engine = MeterEngine::default();
    hit(&mut engine, 2, 1000);
    let bytes = appearance(99, 2, 1304, "Nearby");
    let mut wire = vec![0xff, 0x80, 0x80];
    wire.extend(varint(bytes.len() as u32 + 4));
    wire.extend(bytes);
    let split = wire.len() - 3;
    engine.ingest_tcp(&tcp(100, &wire[..split]), true, 1100);
    engine.ingest_tcp(&tcp(100 + split as u32, &wire[split..]), true, 1200);
    assert_eq!(engine.live_state(2000).players[0].name, "Nearby");
    assert_eq!(engine.live_state(2000).players[0].dps, 100.0);
}

#[test]
fn early_structural_profile_waits_for_exact_current_server_roster_without_guessing_self() {
    let mut engine = MeterEngine::default();
    profile(&mut engine, 2, 1304, "Healer", 1000);
    hit(&mut engine, 2, 1100);
    assert_eq!(engine.live_state(1200).players[0].name, "#2");
    roster(&mut engine, 1401, "Healer", 1300);
    assert_eq!(engine.live_state(1400).players[0].name, "#2");
    roster(&mut engine, 1304, "Healer", 1500);
    let state = engine.live_state(2000);
    assert_eq!(state.players[0].name, "Healer");
    assert!(state.players[0].in_party);
    assert_eq!(state.party_total_damage, Some(100));
    assert_eq!(state.local_player_id, None);
}

#[test]
fn pending_profiles_expire_and_never_cross_loss_reconnect_despawn_or_clock_reversal() {
    for scenario in 0..6 {
        let mut engine = MeterEngine::default();
        profile(&mut engine, 2, 1304, "Healer", 1000);
        let mut at = 2000;
        match scenario {
            0 => at = 31_001,
            1 => engine.capture_loss(),
            2 => engine.connection_changed(),
            3 => engine.ingest_event(
                Event::Removed {
                    id: 2,
                    death: false,
                },
                1500,
            ),
            4 => at = 900,
            _ => identity(&mut engine, 2, "Other", false, 1500),
        }
        roster(&mut engine, 1304, "Healer", at);
        assert!(
            engine.party_identity_roster()["members"][0]["actor_id"].is_null(),
            "scenario {scenario}"
        );
    }
}

#[test]
fn pending_profile_does_not_survive_a_known_party_change() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(
        Event::PartyContext {
            party_id: 1,
            capacity: 5,
        },
        0,
    );
    profile(&mut engine, 2, 1304, "Healer", 1000);
    engine.ingest_event(
        Event::PartyContext {
            party_id: 2,
            capacity: 5,
        },
        1100,
    );
    roster(&mut engine, 1304, "Healer", 1200);
    assert!(engine.party_identity_roster()["members"][0]["actor_id"].is_null());
}

#[test]
fn nearby_identity_cannot_replace_the_confirmed_current_local_character() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 2, "Local", true, 0);
    hit(&mut engine, 2, 1000);
    engine.ingest_event(
        decode(&appearance(99, 2, 1304, "Other")).unwrap().unwrap(),
        1100,
    );
    let state = engine.live_state(2000);
    assert_eq!(state.local_player_name, "Local");
    assert_eq!(state.personal_total_damage, Some(100));
    assert_eq!(state.players[0].name, "Local");
}

#[test]
fn reused_actor_name_never_relabels_an_earlier_completed_encounter() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 2, "First", false, 0);
    hit(&mut engine, 2, 1000);
    engine.tick(11_000);
    let history = serde_json::to_value(engine.history_snapshot().1).unwrap();
    identity(&mut engine, 2, "Second", false, 12_000);
    assert_eq!(engine.live_state(13_000).players[0].name, "First");
    assert_eq!(
        serde_json::to_value(engine.history_snapshot().1).unwrap(),
        history
    );
    hit(&mut engine, 2, 14_000);
    assert_eq!(engine.live_state(15_000).players[0].name, "Second");
}

#[test]
fn a_new_actor_occupant_never_inherits_the_previous_players_class() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 2, "First", false, 0);
    engine.ingest_event(
        decode(&appearance(99, 2, 1304, "First")).unwrap().unwrap(),
        100,
    );
    hit(&mut engine, 2, 1000);
    assert_eq!(engine.live_state(2000).players[0].class_name, "Ranger");
    engine.ingest_event(
        decode(&appearance(99, 2, 1304, "Second")).unwrap().unwrap(),
        2100,
    );
    hit(&mut engine, 2, 3000);
    let state = engine.live_state(4000);
    assert_eq!(state.players[0].name, "Second");
    assert_eq!(state.players[0].class_name, "Unknown");
    assert_eq!(engine.history_snapshot().1[0].players[0].name, "First");
    assert_eq!(
        engine.history_snapshot().1[0].players[0].class_name,
        "Ranger"
    );
}

#[test]
fn late_name_can_resolve_current_completed_view_but_not_after_a_despawn() {
    for removed in [false, true] {
        let mut engine = MeterEngine::default();
        hit(&mut engine, 2, 1000);
        engine.tick(11_000);
        if removed {
            engine.ingest_event(
                Event::Removed {
                    id: 2,
                    death: false,
                },
                11_100,
            );
        }
        identity(&mut engine, 2, "Nearby", false, 12_000);
        assert_eq!(
            engine.live_state(13_000).players[0].name,
            if removed { "#2" } else { "Nearby" }
        );
        // Saved history is immutable; only the still displayed encounter resolves.
        assert_eq!(engine.history_snapshot().1[0].players[0].name, "#2");
    }
}

#[test]
fn known_names_survive_capture_loss_and_confirmed_unknown_is_a_valid_literal_name() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 2, "Unknown", true, 0);
    identity(&mut engine, 3, "Nearby", false, 0);
    hit(&mut engine, 2, 1000);
    hit(&mut engine, 3, 1100);
    engine.capture_loss();
    let state = engine.live_state(2000);
    assert_eq!(state.local_player_name, "Unknown");
    assert!(state.players.iter().any(|row| row.name == "Nearby"));
    assert!(state.players.iter().all(|row| row.identity_confirmed));
}
