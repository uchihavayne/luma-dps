use luma_engine::{
    packets::{decode, Event, Hit, MemberProfile, PartyMember},
    MeterEngine,
};

fn variable(mut value: u32) -> Vec<u8> {
    let mut bytes = Vec::new();
    loop {
        let low = (value & 127) as u8;
        value >>= 7;
        bytes.push(low | if value == 0 { 0 } else { 128 });
        if value == 0 {
            return bytes;
        }
    }
}

fn snapshot(opcode: u8, first: u32, second: u32, name: &str) -> Vec<u8> {
    let mut frame = vec![opcode, 0x36];
    frame.extend(variable(17500));
    frame.extend(variable(first));
    frame.extend(variable(second));
    frame.push(7);
    frame.push(name.len() as u8);
    frame.extend(name.as_bytes());
    if opcode == 0x33 {
        frame.extend(1304u16.to_le_bytes());
    }
    frame.extend(14u32.to_le_bytes());
    frame
}

fn profile(actor: u32, server: u16, name: &str) -> Vec<u8> {
    let mut frame = vec![0, 0x92, 3, 0];
    frame.extend(actor.to_le_bytes());
    frame.extend(server.to_le_bytes());
    frame.extend([0, 0, 36]);
    frame.extend(b"A1B2C3D4-E5F6-4788-99AA-BBCCDDEEFF00");
    frame.extend([1, 2, 3, 4, 5, 6]);
    frame.extend(server.to_le_bytes());
    frame.push(name.len() as u8);
    frame.extend(name.as_bytes());
    frame.extend([0, 0, 0, 0]);
    frame
}

fn apply(engine: &mut MeterEngine, frame: &[u8], now: u64) {
    engine.ingest_event(decode(frame).unwrap().unwrap(), now);
}

fn hit(engine: &mut MeterEngine, source: u64, target: u64, amount: u64, now: u64) {
    engine.ingest_event(
        Event::Damage(Hit {
            source,
            target,
            skill: 14_090_000,
            amount,
            critical: false,
            tick: false,
            flags: 0,
            angle: 0,
        }),
        now,
    );
}

fn identity(engine: &mut MeterEngine, id: u64, name: &str, own: bool) {
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

fn roster(engine: &mut MeterEngine, server: u16) {
    engine.ingest_event(
        Event::PartyMembers {
            members: vec![PartyMember {
                key: 4000,
                server,
                slot: 1,
                name: "Support".into(),
                class: 14,
            }],
        },
        2000,
    );
}

#[test]
fn character_snapshots_follow_canonical_variable_prefix_widths_and_received_class() {
    for opcode in [0x33, 0x44, 0x45] {
        for first in [0, 127, 128, 16384, 0x12345678] {
            for second in [1, 128, 16384, 0x12345678] {
                let frame = snapshot(opcode, first, second, "Nearby");
                let identity = Event::Identity {
                    id: 17500,
                    name: "Nearby".into(),
                    class: Some(14),
                    own: opcode == 0x33,
                };
                let expected = if opcode == 0x33 {
                    Event::Updates(vec![
                        identity,
                        Event::MemberProfiles {
                            members: vec![MemberProfile {
                                id: 17500,
                                server: 1304,
                                name: "Nearby".into(),
                            }],
                        },
                    ])
                } else {
                    identity
                };
                assert_eq!(
                    decode(&frame).unwrap(),
                    Some(expected),
                    "opcode {opcode}, prefix {first}/{second}"
                );
            }
        }
    }
}

#[test]
fn nearby_typed_profiles_recover_names_across_prefix_widths_and_preserve_home_server() {
    for opcode in [0x44, 0x45] {
        for width in [0, 2, 4, 8, 12] {
            let mut frame = vec![opcode, 0x36];
            frame.extend(variable(17500));
            frame.extend(vec![0xff; width]);
            frame.push(6);
            frame.extend(b"Archer");
            frame.extend(1304u16.to_le_bytes());
            frame.extend(14u32.to_le_bytes());
            frame.push(1);
            frame.extend(45u32.to_le_bytes());
            let mut e = MeterEngine::default();
            hit(&mut e, 17500, 88, 100, 1000);
            apply(&mut e, &frame, 1100);
            let s = e.live_state(1200);
            assert_eq!(s.players[0].name, "Archer");
            assert!(s.players[0].identity_confirmed);
            assert_eq!(s.local_player_id, None);
            // Incomplete suffixes cannot be mistaken for a full server profile.
            for end in 0..frame.len() {
                assert!(
                    !matches!(decode(&frame[..end]),Ok(Some(Event::Updates(events))) if events.iter().any(|e|matches!(e,Event::MemberProfiles{..})))
                );
            }
        }
    }
}

#[test]
fn variable_prefix_requires_a_real_class_suffix_and_never_searches_later_guild_names() {
    let frame = snapshot(0x45, 128, 16384, "Support");
    for end in 0..frame.len() {
        assert!(!matches!(
            decode(&frame[..end]),
            Ok(Some(Event::Identity { .. }))
        ));
    }
    let mut malformed = frame.clone();
    let last = malformed.len();
    malformed[last - 4..].copy_from_slice(&0xffff_ffffu32.to_le_bytes());
    malformed.push(5);
    malformed.extend(b"Guild");
    assert!(!matches!(
        decode(&malformed),
        Ok(Some(Event::Identity { .. }))
    ));
    let mut noncanonical = vec![0x45, 0x36];
    noncanonical.extend(variable(17500));
    noncanonical.extend([0x80, 0]);
    noncanonical.extend(variable(16384));
    noncanonical.extend([7, 7]);
    noncanonical.extend(b"Support");
    noncanonical.extend(14u32.to_le_bytes());
    assert!(!matches!(
        decode(&noncanonical),
        Ok(Some(Event::Identity { .. }))
    ));
}

#[test]
fn profile_names_nearby_player_after_capture_gap_without_roster_or_self_inference() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    hit(&mut engine, 17500, 99, 200, 1000);
    engine.capture_loss();
    apply(&mut engine, &profile(17500, 1304, "Support"), 1100);
    let state = engine.live_state(2000);
    let player = state.players.iter().find(|row| row.id == 17500).unwrap();
    assert_eq!(player.name, "Support");
    assert_eq!(player.damage, 200);
    assert!(player.identity_confirmed);
    assert!(!player.in_party);
    assert_eq!(state.party_total_damage, None);
    assert_eq!(state.local_player_id, Some(1));
    assert_eq!(state.personal_total_damage, Some(0));
    assert_eq!(state.party_identity_roster["source"], "unknown");
}

#[test]
fn received_home_server_does_not_turn_same_named_other_server_into_party_member() {
    let mut engine = MeterEngine::default();
    apply(&mut engine, &profile(17500, 1304, "Support"), 1000);
    hit(&mut engine, 17500, 99, 200, 1100);
    roster(&mut engine, 1401);
    let state = engine.live_state(2500);
    assert_eq!(state.players[0].name, "Support");
    assert!(!state.players[0].in_party);
    assert_eq!(state.party_total_damage, Some(0));
    assert!(state.party_identity_roster["members"][0]["actor_id"].is_null());
    roster(&mut engine, 1304);
    let state = engine.live_state(2600);
    assert!(state.players[0].in_party);
    assert_eq!(state.party_total_damage, Some(200));
}

#[test]
fn anonymous_player_target_source_is_not_a_zero_damage_participant_but_unknown_outgoing_is_retained(
) {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    hit(&mut engine, 54600, 1, 1, 1000);
    hit(&mut engine, 1, 99, 100, 1100);
    hit(&mut engine, 17500, 99, 50, 1200);
    let state = engine.live_state(2000);
    assert_eq!(state.players.len(), 2);
    assert!(state.players.iter().all(|row| row.id != 54600));
    assert!(state
        .players
        .iter()
        .any(|row| row.id == 17500 && row.damage == 50));
    assert_eq!(state.unclassified_player_target_amount, 1);
    assert_eq!(state.unclassified_player_target_events, 1);
    assert!(!state.personal_damage_taken_complete);
    assert_eq!(state.total_damage, 150);
    assert_eq!(state.personal_total_damage, Some(100));
}

#[test]
fn confirmed_zero_damage_support_players_remain_in_roster() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    apply(&mut engine, &profile(17500, 1304, "Support"), 1000);
    roster(&mut engine, 1304);
    hit(&mut engine, 17500, 1, 200, 2100);
    hit(&mut engine, 1, 99, 100, 2200);
    let state = engine.live_state(3000);
    let support = state.players.iter().find(|row| row.id == 17500).unwrap();
    assert_eq!(support.name, "Support");
    assert_eq!(support.damage, 0);
    assert!(support.in_party);
    assert!(support.identity_confirmed);
    assert_eq!(support.unclassified_player_target_amount, 200);
}

#[test]
fn exact_short_death_notice_invalidates_actor_before_name_handle_reuse() {
    let mut frame = vec![4, 0x8d];
    frame.extend(variable(17500));
    assert_eq!(
        decode(&frame).unwrap(),
        Some(Event::Removed {
            id: 17500,
            death: true
        })
    );
    let mut engine = MeterEngine::default();
    apply(&mut engine, &profile(17500, 1304, "Support"), 1000);
    hit(&mut engine, 17500, 99, 100, 1100);
    apply(&mut engine, &frame, 1200);
    apply(&mut engine, &snapshot(0x45, 128, 16384, "Next"), 1300);
    hit(&mut engine, 17500, 99, 50, 1400);
    assert_eq!(engine.live_state(2000).players[0].name, "Next");
    assert_eq!(engine.history_snapshot().1[0].players[0].name, "Support");
}
