use luma_engine::{
    character::{self, CharacterEvent, CharacterStore, ObservedPetProgress, PetContinuity},
    packets::{self, Event},
    MeterEngine,
};

fn inventory(active: u32, rows: &[(u32, u32)], progress: &[(u32, u32)]) -> Vec<u8> {
    let mut frame = vec![0, 0x90];
    frame.extend(active.to_le_bytes());
    assert!(rows.len() < 128 && progress.len() < 128);
    frame.push(rows.len() as u8);
    for (id, level) in rows {
        frame.extend(id.to_le_bytes());
        frame.extend(id.to_le_bytes());
        frame.extend(level.to_le_bytes());
    }
    frame.push(progress.len() as u8);
    for (id, value) in progress {
        frame.extend(id.to_le_bytes());
        frame.extend(value.to_le_bytes());
    }
    frame
}

fn gains(rows: &[(u32, u32)]) -> Vec<u8> {
    let mut frame = vec![0x0d, 0x90, rows.len() as u8];
    for (id, value) in rows {
        frame.extend(id.to_le_bytes());
        frame.extend(value.to_le_bytes());
    }
    frame
}

fn level(pet_id: u32, level: u32) -> Vec<u8> {
    let mut frame = vec![0x14, 0x90, 0, 0];
    frame.extend(pet_id.to_le_bytes());
    frame.extend(level.to_le_bytes());
    frame
}

fn registration(pet_id: u32, level: u32) -> Vec<u8> {
    // 09 90 carries two opaque bytes before the independently documented ID
    // and level fields; those bytes are not 14 90's reserved-zero field.
    let mut frame = vec![9, 0x90, 0xa5, 0x5a];
    frame.extend(pet_id.to_le_bytes());
    frame.extend(level.to_le_bytes());
    frame
}

fn receive(engine: &mut MeterEngine, frame: &[u8], at: u64) {
    engine.ingest_event(packets::decode(frame).unwrap().unwrap(), at);
}

#[test]
fn own_login_keeps_its_validated_home_server_for_automatic_pet_cache_isolation() {
    let mut engine = MeterEngine::default();
    let mut frame = vec![0x33, 0x36, 7, 0, 0, 0, 0, 1, 6];
    frame.extend(b"Player");
    frame.extend(1304u16.to_le_bytes());
    frame.extend(14u32.to_le_bytes());
    receive(&mut engine, &frame, 100);
    let snapshot = engine.character_snapshot();
    assert_eq!(snapshot.own.unwrap().server_id, Some(1304));
    assert_eq!(snapshot.pet_collection_owner.unwrap().actor_id, 7);
    receive(&mut engine, &inventory(0, &[(1042, 1)], &[(1042, 12)]), 200);
    receive(&mut engine, &frame, 300);
    let snapshot = engine.character_snapshot();
    assert_eq!(snapshot.own.unwrap().server_id, Some(1304));
    assert_eq!(snapshot.pet_progress.unwrap().pets[0].progress, Some(12));
    assert!(engine.party_identity_roster()["members"]
        .as_array()
        .unwrap()
        .is_empty());
}

fn own(engine: &mut MeterEngine, id: u64, at: u64) {
    engine.ingest_event(
        Event::Identity {
            id,
            name: format!("Player{id}"),
            class: None,
            own: true,
        },
        at,
    );
}

#[test]
fn confirmed_collection_owner_survives_death_without_reviving_combat_identity() {
    for death in [false, true] {
        let mut engine = MeterEngine::default();
        own(&mut engine, 7, 100);
        receive(&mut engine, &inventory(0, &[(1042, 2)], &[(1042, 32)]), 200);
        let initial = engine.character_snapshot();
        let owner = initial.pet_collection_owner.unwrap();
        assert_eq!(owner.actor_id, 7);
        assert_eq!(owner.source, "server-self");
        engine.ingest_event(Event::Removed { id: 7, death }, 300);
        assert!(engine.live_team_identity()["local"].is_null());
        assert_eq!(
            engine.live_state(400).pet_collection_owner,
            Some(owner.clone())
        );
        let snapshot = engine.character_snapshot();
        assert_eq!(snapshot.pet_collection_owner, Some(owner.clone()));
        assert_eq!(snapshot.pet_progress.unwrap().pets[0].progress, Some(32));
        // A duplicate same-character self announcement after respawn is not a
        // collection switch, even though combat presence was removed.
        own(&mut engine, 7, 500);
        assert_eq!(
            engine.character_snapshot().pet_collection_owner,
            Some(owner)
        );
        assert_eq!(
            engine.character_snapshot().pet_progress.unwrap().pets[0].progress,
            Some(32)
        );
    }
}

#[test]
fn collection_owner_changes_on_character_replacement_and_same_actor_reconnect() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(&mut engine, &inventory(0, &[(1042, 2)], &[(1042, 32)]), 200);
    let old = engine.character_snapshot().pet_collection_owner.unwrap();
    engine.ingest_event(
        Event::Identity {
            id: 7,
            name: "Replacement".into(),
            class: None,
            own: true,
        },
        300,
    );
    let changed = engine.character_snapshot();
    let owner = changed.pet_collection_owner.unwrap();
    assert_ne!(owner.generation, old.generation);
    assert!(changed.pet_progress.is_none());
    receive(&mut engine, &inventory(0, &[(1042, 1)], &[(1042, 2)]), 400);
    let before_reconnect = engine.character_snapshot().pet_collection_owner.unwrap();
    engine.connection_changed();
    assert!(engine.live_state(500).pet_collection_owner.is_none());
    assert!(engine.character_snapshot().pet_collection_owner.is_none());
    assert!(engine.character_snapshot().pet_progress.is_none());
    engine.ingest_event(
        Event::Identity {
            id: 7,
            name: "Replacement".into(),
            class: None,
            own: true,
        },
        600,
    );
    let after = engine.character_snapshot();
    assert_ne!(
        after.pet_collection_owner.unwrap().generation,
        before_reconnect.generation
    );
    assert!(after.pet_progress.is_none());
    own(&mut engine, 8, 700);
    assert_eq!(
        engine
            .character_snapshot()
            .pet_collection_owner
            .unwrap()
            .actor_id,
        8
    );
    assert!(engine.character_snapshot().pet_progress.is_none());
}

#[test]
fn reused_self_scene_handles_and_manual_aliases_cannot_claim_collection_ownership() {
    for npc in [false, true] {
        let mut engine = MeterEngine::default();
        own(&mut engine, 7, 100);
        receive(&mut engine, &inventory(0, &[(1042, 2)], &[(1042, 32)]), 200);
        engine.ingest_event(Event::Removed { id: 7, death: true }, 300);
        if npc {
            engine.ingest_event(
                Event::Npc {
                    id: 7,
                    name: None,
                    model: 2400617,
                    kind: 0x1c,
                },
                400,
            );
        } else {
            engine.ingest_event(
                Event::Identity {
                    id: 7,
                    name: "Other".into(),
                    class: None,
                    own: false,
                },
                400,
            );
        }
        assert!(engine.live_state(500).pet_collection_owner.is_none());
        assert!(engine.character_snapshot().pet_collection_owner.is_none());
        assert!(engine.character_snapshot().pet_progress.is_none());
    }
    let mut engine = MeterEngine::default();
    engine.set_local_player(None, "Alias").unwrap();
    assert!(engine.character_snapshot().pet_collection_owner.is_none());
    assert!(engine.live_state(100).pet_collection_owner.is_none());
}

#[test]
fn a_transient_capture_gap_keeps_the_same_collection_owner_with_stale_counters() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(&mut engine, &inventory(0, &[(1042, 2)], &[(1042, 32)]), 200);
    let owner = engine.character_snapshot().pet_collection_owner.unwrap();
    engine.capture_loss();
    let snapshot = engine.character_snapshot();
    assert_eq!(snapshot.pet_collection_owner, Some(owner));
    let pets = snapshot.pet_progress.unwrap();
    assert_eq!(pets.continuity, PetContinuity::LastKnown);
    assert_eq!(pets.pets[0].progress, Some(32));
    assert!(pets.pets[0].progress_stale);
}

#[test]
fn a_known_self_home_server_conflict_invalidates_collection_but_initial_metadata_does_not() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(&mut engine, &inventory(0, &[(1042, 2)], &[(1042, 32)]), 200);
    let owner = engine.character_snapshot().pet_collection_owner;
    for (server, at) in [(1001, 300), (1001, 400)] {
        engine.ingest_event(
            Event::MemberProfiles {
                members: vec![packets::MemberProfile {
                    id: 7,
                    server,
                    name: "Player7".into(),
                }],
            },
            at,
        );
        assert_eq!(engine.character_snapshot().pet_collection_owner, owner);
        assert_eq!(
            engine.character_snapshot().pet_progress.unwrap().pets[0].progress,
            Some(32)
        );
    }
    engine.ingest_event(
        Event::MemberProfiles {
            members: vec![packets::MemberProfile {
                id: 7,
                server: 1002,
                name: "Player7".into(),
            }],
        },
        500,
    );
    assert!(engine.character_snapshot().pet_collection_owner.is_none());
    assert!(engine.character_snapshot().pet_progress.is_none());
    assert!(engine.live_state(600).pet_collection_owner.is_none());
    assert_eq!(engine.live_team_identity()["local"]["actor_id"], 7);
}

#[test]
fn pet_login_prefix_preserves_actual_levels_progress_and_unknown_targets() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    let mut frame = inventory(1124, &[(1124, 3), (1042, 2)], &[(1042, 32)]);
    // Species knowledge is an independent tail of the same login message.
    frame.extend([2, 0x7a, 0, 1, 0, 0]);
    receive(&mut engine, &frame, 200);
    let snapshot = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(snapshot.actor_id, Some(7));
    assert_eq!(snapshot.source, "server-self");
    assert_eq!(snapshot.active_pet_id, Some(1124));
    assert!(snapshot.active_pet_known && snapshot.inventory_complete);
    assert_eq!(snapshot.pets[0].pet_id, 1042);
    assert_eq!(snapshot.pets[0].progress, Some(32));
    assert_eq!(snapshot.pets[0].progress_source, "server-absolute");
    assert_eq!(snapshot.pets[0].required_progress, None);
    assert_eq!(snapshot.pets[1].level, Some(3));
    assert_eq!(snapshot.pets[1].progress, None);
    assert!(!engine.live_state(200).character_available);
}

#[test]
fn independently_counted_login_rows_keep_zero_level_and_points_only_pets() {
    // Synthetic wire fixture, written directly from the published full-state
    // layout rather than the inventory helper: opaque u32 header; two level
    // triples; three independent point pairs. The last pet has no level row.
    let frame = [
        0x00, 0x90, 0xff, 0xff, 0xff, 0xff, 0x02, // header and level count
        0x12, 0x04, 0x00, 0x00, 0x12, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 1042 Lv.0
        0x64, 0x04, 0x00, 0x00, 0x64, 0x04, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, // 1124 Lv.2
        0x03, // point count may exceed level count
        0x12, 0x04, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, // 1042: 3
        0x64, 0x04, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, // 1124: 32
        0xb4, 0x04, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, // 1204: 1, no level
    ];
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(&mut engine, &frame, 200);
    let snapshot = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(snapshot.actor_id, Some(7));
    assert!(!snapshot.active_pet_known);
    assert_eq!(snapshot.active_pet_id, None);
    assert!(snapshot.inventory_complete);
    assert_eq!(snapshot.pets.len(), 3);
    assert_eq!(snapshot.pets[0].level, Some(0));
    assert_eq!(snapshot.pets[0].progress, Some(3));
    assert_eq!(snapshot.pets[1].level, Some(2));
    assert_eq!(snapshot.pets[1].progress, Some(32));
    assert_eq!(snapshot.pets[2].level, None);
    assert_eq!(snapshot.pets[2].progress, Some(1));
    receive(&mut engine, &gains(&[(1042, 1), (1204, 2)]), 300);
    let updated = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(updated.pets[0].level, Some(0));
    assert_eq!(updated.pets[0].progress, Some(4));
    assert_eq!(updated.pets[2].level, None);
    assert_eq!(updated.pets[2].progress, Some(3));
}

#[test]
fn points_only_collection_is_received_without_inventing_levels_or_active_pet() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(
        &mut engine,
        &inventory(1124, &[], &[(1042, 3), (1204, 2)]),
        200,
    );
    let snapshot = engine.character_snapshot().pet_progress.unwrap();
    assert!(snapshot.inventory_complete);
    assert!(!snapshot.active_pet_known);
    assert_eq!(snapshot.active_pet_id, None);
    assert_eq!(snapshot.pets.len(), 2);
    assert!(snapshot.pets.iter().all(|pet| pet.level.is_none()));
    assert_eq!(snapshot.pets[0].progress, Some(3));
    assert_eq!(snapshot.pets[1].progress, Some(2));
}

#[test]
fn malformed_independent_point_lists_still_fail_atomically() {
    for frame in [
        inventory(0, &[], &[(1042, 1), (1042, 2)]),
        inventory(0, &[(1042, 0)], &[(0, 1)]),
        inventory(0, &[(1042, 0)], &[(100_000, 1)]),
    ] {
        assert!(character::decode(&frame).is_err());
    }
    let mut excessive_count = inventory(0, &[], &[]);
    excessive_count.pop();
    excessive_count.extend([0xd1, 0x0f]); // 2,001 independently counted point rows
    assert!(character::decode(&excessive_count).is_err());
}

#[test]
fn pet_deltas_are_automatic_and_absolute_refresh_does_not_double_count_session_gain() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(&mut engine, &inventory(0, &[(1042, 2)], &[(1042, 32)]), 200);
    receive(&mut engine, &gains(&[(1042, 2), (1204, 1)]), 300);
    let observed = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(observed.pets[0].progress, Some(34));
    assert_eq!(observed.pets[0].session_gained, 2);
    assert_eq!(observed.pets[0].progress_source, "server-delta");
    assert_eq!(observed.pets[1].session_gained, 1);
    assert_eq!(observed.pets[1].level, None);
    assert_eq!(observed.pets[1].progress, None);
    assert!(!observed.inventory_complete);
    receive(
        &mut engine,
        &inventory(0, &[(1042, 2), (1204, 1)], &[(1042, 34), (1204, 1)]),
        400,
    );
    let refreshed = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(refreshed.pets[0].session_gained, 2);
    assert_eq!(refreshed.pets[0].progress, Some(34));
    assert_eq!(refreshed.pets[0].progress_source, "server-absolute");
    assert_eq!(refreshed.pets[1].session_gained, 1);
    assert!(refreshed.inventory_complete);
    assert!(!refreshed.active_pet_known || refreshed.active_pet_id.is_none());
    // A previously exported snapshot remains immutable.
    assert_eq!(observed.pets[0].progress_source, "server-delta");
}

#[test]
fn received_level_change_starts_the_new_tier_at_zero_without_inventing_old_overflow() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(&mut engine, &inventory(0, &[(1042, 1)], &[(1042, 24)]), 200);
    receive(&mut engine, &gains(&[(1042, 2)]), 300);
    let mut level = vec![0x14, 0x90, 0, 0];
    level.extend(1042u32.to_le_bytes());
    level.extend(2u32.to_le_bytes());
    receive(&mut engine, &level, 400);
    let state = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(state.pets[0].level, Some(2));
    assert_eq!(state.pets[0].progress, Some(0));
    assert_eq!(state.pets[0].required_progress, None);
    assert_eq!(state.pets[0].session_gained, 2);
    assert_eq!(state.pets[0].progress_source, "server-level-reset");
    receive(&mut engine, &inventory(0, &[(1042, 2)], &[(1042, 1)]), 500);
    assert_eq!(
        engine.character_snapshot().pet_progress.unwrap().pets[0].progress,
        Some(1)
    );
}

#[test]
fn pending_pet_login_needs_fresh_authoritative_self_and_never_manual_or_nearby_identity() {
    let frame = inventory(0, &[(1042, 2)], &[(1042, 32)]);
    let mut engine = MeterEngine::default();
    receive(&mut engine, &frame, 1_000);
    engine.ingest_event(
        Event::Identity {
            id: 2,
            name: "Nearby".into(),
            class: None,
            own: false,
        },
        1_100,
    );
    engine.set_local_player(Some(2), "Manual").unwrap();
    assert!(engine.character_snapshot().pet_progress.is_none());
    own(&mut engine, 7, 2_000);
    assert_eq!(
        engine.character_snapshot().pet_progress.unwrap().actor_id,
        Some(7)
    );
    own(&mut engine, 8, 3_000);
    assert!(engine.character_snapshot().pet_progress.is_none());
    engine.connection_changed();
    receive(&mut engine, &frame, 4_000);
    own(&mut engine, 9, 35_000);
    assert!(engine.character_snapshot().pet_progress.is_none());
}

#[test]
fn capture_loss_and_clock_reversal_keep_last_known_but_connection_change_clears_pets() {
    let frame = inventory(0, &[(1042, 2)], &[(1042, 32)]);
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(&mut engine, &frame, 200);
    engine.capture_loss();
    let stale = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(stale.continuity, PetContinuity::LastKnown);
    assert_eq!(stale.stale_reason.as_deref(), Some("capture-loss"));
    assert_eq!(stale.pets[0].level, Some(2));
    assert_eq!(stale.pets[0].progress, Some(32));
    assert!(stale.pets[0].progress_stale);
    receive(&mut engine, &gains(&[(1042, 1)]), 300);
    assert_eq!(
        engine.character_snapshot().pet_progress.unwrap().pets[0].progress,
        Some(32)
    );
    engine.connection_changed();
    assert!(engine.character_snapshot().pet_progress.is_none());
    own(&mut engine, 8, 500);
    receive(&mut engine, &frame, 600);
    receive(&mut engine, &gains(&[(1042, 1)]), 550);
    let stale = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(stale.actor_id, Some(8));
    assert_eq!(stale.continuity, PetContinuity::LastKnown);
    assert_eq!(stale.stale_reason.as_deref(), Some("clock-reversal"));
    assert_eq!(stale.pets[0].progress, Some(32));
    assert!(stale.pets[0].progress_stale);
}

#[test]
fn malformed_pet_lists_and_deltas_are_atomic_errors() {
    let frame = inventory(1124, &[(1124, 3), (1042, 2)], &[(1042, 32)]);
    for length in 2..frame.len() {
        assert!(
            character::decode(&frame[..length]).is_err(),
            "prefix {length}"
        );
    }
    for invalid in [
        inventory(0, &[(1042, 2), (1042, 2)], &[]),
        inventory(0, &[(1042, 4)], &[]),
        inventory(0, &[(1042, 2)], &[(0, 1)]),
        inventory(0, &[(1042, 2), (1204, 2)], &[(1042, 1), (1042, 2)]),
        gains(&[(1042, 1), (1042, 1)]),
        gains(&[(1042, 0)]),
        gains(&[(1042, 1_000)]),
        gains(&[(0, 1)]),
    ] {
        assert!(character::decode(&invalid).is_err());
    }
    let delta = gains(&[(1042, 2)]);
    for length in 2..delta.len() {
        assert!(character::decode(&delta[..length]).is_err());
    }
    let mut unknown_tail = delta;
    unknown_tail.push(0);
    assert!(character::decode(&unknown_tail).is_err());
    let mut oversized = vec![0, 0x90];
    oversized.extend(0u32.to_le_bytes());
    oversized.extend([0xd1, 0x0f]); // 2,001 entries
    assert!(character::decode(&oversized).is_err());
}

fn tcp(sequence: u32, flags: u8, payload: &[u8]) -> Vec<u8> {
    let mut packet = vec![0u8; 40];
    packet[0] = 0x45;
    packet[2..4].copy_from_slice(&((40 + payload.len()) as u16).to_be_bytes());
    packet[9] = 6;
    packet[12..16].copy_from_slice(&[198, 51, 100, 9]);
    packet[16..20].copy_from_slice(&[192, 0, 2, 3]);
    packet[20..22].copy_from_slice(&7777u16.to_be_bytes());
    packet[22..24].copy_from_slice(&50000u16.to_be_bytes());
    packet[24..28].copy_from_slice(&sequence.to_be_bytes());
    packet[32] = 0x50;
    packet[33] = flags;
    packet.extend(payload);
    packet
}

fn wire(frame: &[u8]) -> Vec<u8> {
    assert!(frame.len() + 4 < 128);
    let mut bytes = vec![(frame.len() + 4) as u8];
    bytes.extend(frame);
    bytes
}

#[test]
fn compressed_login_recovers_zero_level_and_independent_points_before_self_binding() {
    let raw = wire(&inventory(0, &[(1042, 0)], &[(1042, 3), (1204, 1)]));
    let mut bundle = vec![0xff, 0xff];
    bundle.extend((raw.len() as u32).to_le_bytes());
    bundle.extend(lz4_flex::block::compress(&raw));
    let data = wire(&bundle);
    let mut engine = MeterEngine::default();
    engine.ingest_tcp(&tcp(100, 0x18, &data), true, 1_000);
    assert!(engine.character_snapshot().pet_progress.is_none());
    own(&mut engine, 7, 21_000);
    let snapshot = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(snapshot.actor_id, Some(7));
    assert_eq!(snapshot.pets.len(), 2);
    assert_eq!(snapshot.pets[0].level, Some(0));
    assert_eq!(snapshot.pets[0].progress, Some(3));
    assert_eq!(snapshot.pets[1].level, None);
    assert_eq!(snapshot.pets[1].progress, Some(1));
    assert_eq!(engine.live_state(21_000).total_damage, 0);
}

#[test]
fn truncated_points_only_inventory_never_overwrites_an_existing_collection() {
    let complete = inventory(0, &[(1042, 0)], &[(1042, 3), (1204, 2)]);
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(&mut engine, &complete, 200);
    let previous = engine.character_snapshot();
    for length in 2..complete.len() {
        assert!(packets::decode(&complete[..length]).is_err());
        assert_eq!(engine.character_snapshot(), previous);
    }
}

#[test]
fn retransmitted_reordered_and_split_pet_gain_packets_count_each_server_record_once() {
    let mut engine = MeterEngine::default();
    let list = wire(&inventory(0, &[(1042, 2)], &[(1042, 32)]));
    let delta = wire(&gains(&[(1042, 2)]));
    engine.ingest_tcp(&tcp(99, 0x12, &[]), true, 100);
    own(&mut engine, 7, 101);
    engine.ingest_tcp(&tcp(100, 0x18, &list), true, 200);
    let next = 100 + list.len() as u32;
    engine.ingest_tcp(&tcp(next + 4, 0x18, &delta[4..]), true, 300);
    engine.ingest_tcp(&tcp(next, 0x18, &delta[..4]), true, 400);
    engine.ingest_tcp(&tcp(next, 0x18, &delta), true, 500);
    engine.ingest_tcp(&tcp(next + 4, 0x18, &delta[4..]), true, 600);
    let state = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(state.pets[0].progress, Some(34));
    assert_eq!(state.pets[0].session_gained, 2);
    engine.ingest_tcp(&tcp(next + delta.len() as u32, 0x18, &delta), true, 700);
    let state = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(state.pets[0].progress, Some(36));
    assert_eq!(state.pets[0].session_gained, 4);
}

#[test]
fn a_new_tcp_stream_or_capture_gap_never_keeps_absolute_pet_progress_current() {
    let mut engine = MeterEngine::default();
    let list = wire(&inventory(0, &[(1042, 2)], &[(1042, 32)]));
    let delta = wire(&gains(&[(1042, 2)]));
    engine.ingest_tcp(&tcp(99, 0x12, &[]), true, 100);
    own(&mut engine, 7, 101);
    engine.ingest_tcp(&tcp(100, 0x18, &list), true, 200);
    assert!(engine.character_snapshot().pet_progress.is_some());
    // The missing range cannot be filled before the bounded gap deadline.
    let next = 100 + list.len() as u32 + 10;
    engine.ingest_tcp(&tcp(next, 0x18, &delta), true, 300);
    engine.ingest_tcp(&tcp(next, 0x18, &delta), true, 10_000);
    assert_eq!(engine.live_state(10_001).diagnostics.stream_gaps, 1);
    let after_gap = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(after_gap.pets[0].progress, Some(32));
    assert_eq!(after_gap.continuity, PetContinuity::LastKnown);
    assert!(after_gap.pets[0].progress_stale);
    assert_eq!(after_gap.pets[0].session_gained, 2);
    engine.ingest_tcp(&tcp(next + delta.len() as u32, 0x18, &list), true, 10_100);
    let state = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(state.pets[0].progress, Some(32));
    assert_eq!(state.continuity, PetContinuity::Live);
    assert!(!state.pets[0].progress_stale);
    engine.ingest_tcp(&tcp(50_000, 0x12, &[]), true, 11_000);
    assert!(engine.character_snapshot().pet_progress.is_none());
}

#[test]
fn pet_only_frames_never_create_combat_damage_or_actor_identity() {
    let mut engine = MeterEngine::default();
    receive(&mut engine, &inventory(0, &[(1042, 2)], &[(1042, 32)]), 200);
    receive(&mut engine, &gains(&[(1042, 1)]), 300);
    let state = engine.live_state(400);
    assert_eq!(state.total_damage, 0);
    assert!(state.players.is_empty());
    assert!(state.local_player_id.is_none());
    assert!(engine.character_snapshot().pet_progress.is_none());
    assert!(matches!(
        character::decode(&gains(&[(1042, 1)])).unwrap(),
        Some(CharacterEvent::PetGains { .. })
    ));
}

#[test]
fn absolute_refresh_keeps_observed_rate_origin_without_inventing_gains() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(&mut engine, &inventory(0, &[(1042, 2)], &[(1042, 32)]), 200);
    receive(&mut engine, &gains(&[(1042, 2)]), 1_200);
    receive(&mut engine, &gains(&[(1042, 1)]), 2_200);
    let previous = engine.character_snapshot().pet_progress.unwrap();
    let pet = &previous.pets[0];
    assert_eq!(pet.session_started_at_ms, Some(200));
    assert_eq!(pet.session_baseline_gained, 0);
    assert_eq!(pet.session_gained, 3);
    assert_eq!(pet.session_gain_events, 2);
    assert_eq!(pet.last_gain_at_ms, Some(2_200));

    // An absolute correction is authoritative for progress, not a gain event.
    receive(
        &mut engine,
        &inventory(0, &[(1042, 2), (1204, 1)], &[(1042, 33)]),
        3_200,
    );
    let snapshot = engine.character_snapshot().pet_progress.unwrap();
    let pet = &snapshot.pets[0];
    assert_eq!(pet.progress, Some(33));
    assert_eq!(pet.session_started_at_ms, Some(200));
    assert_eq!(pet.session_baseline_gained, 0);
    assert_eq!(pet.session_gained, 3);
    assert_eq!(pet.session_gain_events, 2);
    assert_eq!(pet.last_gain_at_ms, Some(2_200));
    assert_eq!(snapshot.pets[1].session_started_at_ms, Some(3_200));
    assert_eq!(snapshot.pets[1].session_gained, 0);
    assert_eq!(snapshot.pets[1].last_gain_at_ms, None);
    assert_eq!(previous.pets[0].progress, Some(35));
}

#[test]
fn first_received_gain_has_no_pre_arrival_rate_and_refresh_cannot_create_one() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(&mut engine, &gains(&[(1042, 3)]), 5_000);
    let snapshot = engine.character_snapshot().pet_progress.unwrap();
    let pet = &snapshot.pets[0];
    assert_eq!(pet.session_started_at_ms, Some(5_000));
    assert_eq!(pet.session_baseline_gained, 3);
    assert_eq!(pet.session_gained - pet.session_baseline_gained, 0);
    assert_eq!(pet.session_gain_events, 1);
    assert_eq!(pet.last_gain_at_ms, Some(5_000));
    assert_eq!(pet.progress, None);

    receive(
        &mut engine,
        &inventory(0, &[(1042, 1)], &[(1042, 4)]),
        6_000,
    );
    receive(&mut engine, &gains(&[(1042, 2)]), 7_000);
    let snapshot = engine.character_snapshot().pet_progress.unwrap();
    let pet = &snapshot.pets[0];
    assert_eq!(pet.session_started_at_ms, Some(5_000));
    assert_eq!(pet.session_baseline_gained, 3);
    assert_eq!(pet.session_gained - pet.session_baseline_gained, 2);
    assert_eq!(pet.progress, Some(6));
    assert_eq!(pet.session_gain_events, 2);
    assert_eq!(pet.last_gain_at_ms, Some(7_000));
}

#[test]
fn server_level_reset_allows_next_tier_gains_and_duplicate_level_never_erases_them() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(&mut engine, &inventory(0, &[(1042, 1)], &[(1042, 24)]), 200);
    receive(&mut engine, &gains(&[(1042, 2)]), 1_200);
    receive(&mut engine, &level(1042, 2), 1_300);
    receive(&mut engine, &gains(&[(1042, 1)]), 2_200);
    receive(&mut engine, &level(1042, 2), 2_300);
    let snapshot = engine.character_snapshot().pet_progress.unwrap();
    let pet = &snapshot.pets[0];
    assert_eq!(pet.level, Some(2));
    assert_eq!(pet.progress, Some(1));
    assert_eq!(pet.required_progress, None);
    assert_eq!(pet.session_started_at_ms, Some(200));
    assert_eq!(pet.session_baseline_gained, 0);
    assert_eq!(pet.session_gained, 3);
    assert_eq!(pet.session_gain_events, 2);
    assert_eq!(pet.last_gain_at_ms, Some(2_200));

    receive(
        &mut engine,
        &inventory(0, &[(1042, 2)], &[(1042, 1)]),
        2_400,
    );
    receive(&mut engine, &level(1042, 2), 2_500);
    assert_eq!(
        engine.character_snapshot().pet_progress.unwrap().pets[0].progress,
        Some(1)
    );
}

#[test]
fn real_registration_and_level_events_reopen_each_tier_but_thresholds_alone_never_do() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(&mut engine, &inventory(0, &[(1042, 0)], &[(1042, 4)]), 200);
    receive(&mut engine, &gains(&[(1042, 1)]), 300);
    let pending = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(pending.pets[0].level, Some(0));
    assert_eq!(pending.pets[0].progress, Some(5));
    receive(&mut engine, &registration(1042, 1), 400);
    let registered = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(registered.pets[0].level, Some(1));
    assert_eq!(registered.pets[0].progress, Some(0));
    assert_eq!(registered.pets[0].progress_source, "server-level-reset");
    receive(&mut engine, &gains(&[(1042, 25)]), 500);
    let pending = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(pending.pets[0].level, Some(1));
    assert_eq!(pending.pets[0].progress, Some(25));
    receive(&mut engine, &level(1042, 2), 600);
    let second = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(second.pets[0].level, Some(2));
    assert_eq!(second.pets[0].progress, Some(0));
    receive(&mut engine, &gains(&[(1042, 75)]), 700);
    let pending = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(pending.pets[0].level, Some(2));
    assert_eq!(pending.pets[0].progress, Some(75));
    receive(&mut engine, &level(1042, 3), 800);
    let completed = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(completed.pets[0].level, Some(3));
    assert_eq!(completed.pets[0].progress, Some(0));
    assert_eq!(completed.pets[0].session_gained, 101);
}

#[test]
fn duplicate_registration_never_resets_a_registered_pet_and_points_only_rows_can_register() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(
        &mut engine,
        &inventory(0, &[(1042, 2)], &[(1042, 32), (1204, 3)]),
        200,
    );
    receive(&mut engine, &gains(&[(1042, 2)]), 300);
    let before = engine.character_snapshot();
    receive(&mut engine, &registration(1042, 1), 400);
    assert_eq!(engine.character_snapshot(), before);
    receive(&mut engine, &registration(1042, 3), 50);
    assert_eq!(engine.character_snapshot(), before);
    receive(&mut engine, &registration(1204, 1), 500);
    let state = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(state.pets[0].level, Some(2));
    assert_eq!(state.pets[0].progress, Some(34));
    assert_eq!(state.pets[1].level, Some(1));
    assert_eq!(state.pets[1].progress, Some(0));
    receive(&mut engine, &registration(1300, 1), 600);
    let state = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(state.pets[2].pet_id, 1300);
    assert_eq!(state.pets[2].progress, Some(0));
    assert!(!state.inventory_complete);
}

#[test]
fn real_level_reset_restores_its_baseline_after_loss_without_rejuvenating_other_pet_rows() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(
        &mut engine,
        &inventory(0, &[(1042, 1), (1204, 1)], &[(1042, 24), (1204, 3)]),
        200,
    );
    engine.capture_loss();
    receive(&mut engine, &level(1042, 2), 400);
    let reset = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(reset.continuity, PetContinuity::LastKnown);
    assert_eq!(reset.pets[0].level, Some(2));
    assert_eq!(reset.pets[0].progress, Some(0));
    assert_eq!(reset.pets[0].progress_source, "server-level-reset");
    assert!(!reset.pets[0].progress_stale);
    assert_eq!(reset.pets[0].observed_at_ms, 400);
    assert_eq!(reset.pets[0].session_started_at_ms, Some(400));
    assert!(reset.pets[1].progress_stale);
    assert_eq!(reset.pets[1].observed_at_ms, 200);
    receive(&mut engine, &gains(&[(1042, 3), (1204, 1)]), 500);
    let advanced = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(advanced.pets[0].progress, Some(3));
    assert_eq!(advanced.pets[0].progress_source, "server-delta");
    assert_eq!(advanced.pets[1].progress, Some(3));
    assert!(advanced.pets[1].progress_stale);
    assert_eq!(advanced.pets[1].observed_at_ms, 200);
}

#[test]
fn documented_change_prefixes_accept_opaque_suffixes_with_strict_fields_and_family_bounds() {
    // Literal synthetic frame from the documented 14 90 fixed-field prefix;
    // suffix meaning is intentionally neither decoded nor used for progress.
    let level_with_suffix = [
        0x14, 0x90, 0, 0, 0x12, 4, 0, 0, 2, 0, 0, 0, 0xde, 0xad, 0xbe, 0xef,
    ];
    assert_eq!(
        character::decode(&level_with_suffix).unwrap(),
        Some(CharacterEvent::PetLevel {
            pet_id: 1042,
            level: 2
        })
    );
    let registration_with_suffix = [9, 0x90, 0x87, 0x65, 0x12, 4, 0, 0, 1, 0, 0, 0, 0x99, 0x44];
    assert_eq!(
        character::decode(&registration_with_suffix).unwrap(),
        Some(CharacterEvent::PetAdded {
            pet_id: 1042,
            level: 1
        })
    );
    for frame in [&level_with_suffix[..], &registration_with_suffix[..]] {
        for length in 2..12 {
            assert!(character::decode(&frame[..length]).is_err());
        }
        let mut too_large = frame.to_vec();
        too_large.resize(4_097, 0);
        assert!(character::decode(&too_large).is_err());
        too_large.truncate(4_096);
        assert!(character::decode(&too_large).unwrap().is_some());
        for (offset, value) in [(4, 0u32), (4, 100_000), (8, 0), (8, 4)] {
            let mut invalid = frame.to_vec();
            invalid[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
            assert!(character::decode(&invalid).is_err());
        }
    }
}

#[test]
fn level_suffix_is_not_replayed_as_a_gain_or_combined_with_the_next_frame() {
    let mut engine = MeterEngine::default();
    engine.ingest_tcp(&tcp(99, 0x12, &[]), true, 100);
    own(&mut engine, 7, 101);
    let login = wire(&inventory(0, &[(1042, 1)], &[(1042, 24)]));
    engine.ingest_tcp(&tcp(100, 0x18, &login), true, 200);
    let mut change = level(1042, 2);
    change.extend(wire(&gains(&[(1042, 999)]))); // opaque bytes inside level frame
    let mut packets = wire(&gains(&[(1042, 1)]));
    packets.extend(wire(&change));
    packets.extend(wire(&gains(&[(1042, 3)])));
    engine.ingest_tcp(&tcp(100 + login.len() as u32, 0x18, &packets), true, 300);
    let state = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(state.pets[0].level, Some(2));
    assert_eq!(state.pets[0].progress, Some(3));
    assert_eq!(state.pets[0].session_gained, 4);
}

#[test]
fn capture_loss_starts_a_new_gain_baseline_instead_of_reusing_an_old_rate() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(&mut engine, &inventory(0, &[(1042, 2)], &[(1042, 32)]), 200);
    receive(&mut engine, &gains(&[(1042, 2)]), 1_200);
    engine.capture_loss();
    receive(&mut engine, &gains(&[(1042, 3)]), 10_000);
    let snapshot = engine.character_snapshot().pet_progress.unwrap();
    let pet = &snapshot.pets[0];
    assert_eq!(pet.progress, Some(34));
    assert!(pet.progress_stale);
    assert_eq!(pet.session_started_at_ms, Some(10_000));
    assert_eq!(pet.session_gained, 3);
    assert_eq!(pet.session_baseline_gained, 3);
    assert_eq!(pet.session_gain_events, 1);
    assert_eq!(pet.last_gain_at_ms, Some(10_000));

    engine.connection_changed();
    assert!(engine.character_snapshot().pet_progress.is_none());
    own(&mut engine, 8, 20_000);
    receive(
        &mut engine,
        &inventory(0, &[(1042, 1)], &[(1042, 1)]),
        20_100,
    );
    let snapshot = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(snapshot.actor_id, Some(8));
    assert_eq!(snapshot.pets[0].session_started_at_ms, Some(20_100));
    assert_eq!(snapshot.pets[0].session_gained, 0);
    assert_eq!(snapshot.pets[0].last_gain_at_ms, None);
}

#[test]
fn capture_gap_keeps_all_last_values_and_never_adds_to_a_broken_absolute_baseline() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(
        &mut engine,
        &inventory(
            1124,
            &[(1042, 2), (1124, 3), (1204, 0)],
            &[(1042, 32), (1124, 0), (1204, 3)],
        ),
        200,
    );
    receive(&mut engine, &gains(&[(1042, 2)]), 1_000);
    engine.capture_loss();
    let stale = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(stale.continuity, PetContinuity::LastKnown);
    assert_eq!(stale.stale_at_ms, Some(1_000));
    assert_eq!(
        stale
            .pets
            .iter()
            .map(|pet| pet.progress)
            .collect::<Vec<_>>(),
        vec![Some(34), Some(0), Some(3)]
    );
    assert!(stale
        .pets
        .iter()
        .all(|pet| pet.progress_stale && pet.session_started_at_ms.is_none()));
    receive(
        &mut engine,
        &gains(&[(1042, 2), (1124, 1), (1204, 1)]),
        10_000,
    );
    let after_delta = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(after_delta.continuity, PetContinuity::LastKnown);
    assert_eq!(
        after_delta
            .pets
            .iter()
            .map(|pet| pet.progress)
            .collect::<Vec<_>>(),
        vec![Some(34), Some(0), Some(3)]
    );
    assert_eq!(after_delta.pets[0].session_gained, 2);
    assert_eq!(after_delta.pets[0].session_baseline_gained, 2);
    assert_eq!(after_delta.pets[0].session_started_at_ms, Some(10_000));
    assert_eq!(after_delta.pets[0].observed_at_ms, 1_000);
    assert_eq!(after_delta.pets[1].observed_at_ms, 200);
    assert_eq!(after_delta.pets[2].observed_at_ms, 200);
    receive(&mut engine, &level(1042, 2), 10_001);
    assert_eq!(
        engine.character_snapshot().pet_progress.unwrap().pets[0].observed_at_ms,
        1_000
    );
    receive(
        &mut engine,
        &inventory(0, &[(1042, 2)], &[(1042, 40)]),
        11_000,
    );
    receive(&mut engine, &gains(&[(1042, 1)]), 12_000);
    let refreshed = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(refreshed.continuity, PetContinuity::Live);
    assert_eq!(refreshed.stale_reason, None);
    assert_eq!(refreshed.stale_at_ms, None);
    assert_eq!(refreshed.pets[0].progress, Some(41));
    assert!(!refreshed.pets[0].progress_stale);
    assert_eq!(refreshed.pets[0].session_gained, 3);
}

#[test]
fn auxiliary_flow_syn_keeps_history_but_a_known_pet_flow_reset_and_new_generation_clear_it() {
    let mut engine = MeterEngine::default();
    let list = wire(&inventory(0, &[(1042, 2)], &[(1042, 32)]));
    engine.ingest_tcp(&tcp(99, 0x12, &[]), true, 100);
    own(&mut engine, 7, 101);
    engine.ingest_tcp(&tcp(100, 0x18, &list), true, 200);
    let mut auxiliary = tcp(999, 0x12, &[]);
    auxiliary[20..22].copy_from_slice(&8888u16.to_be_bytes());
    auxiliary[22..24].copy_from_slice(&50001u16.to_be_bytes());
    engine.ingest_tcp(&auxiliary, true, 300);
    let retained = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(retained.actor_id, Some(7));
    assert_eq!(retained.continuity, PetContinuity::LastKnown);
    assert_eq!(
        retained.stale_reason.as_deref(),
        Some("auxiliary-flow-change")
    );
    assert_eq!(retained.pets[0].progress, Some(32));
    engine.ingest_tcp(&tcp(100 + list.len() as u32, 0x04, &[]), true, 400);
    assert!(engine.character_snapshot().pet_progress.is_none());
    receive(&mut engine, &inventory(0, &[(1042, 2)], &[(1042, 40)]), 500);
    engine.capture_loss();
    engine.connection_changed();
    own(&mut engine, 8, 600);
    assert!(engine.character_snapshot().pet_progress.is_none());
}

#[test]
fn proven_pet_flow_new_lifetime_requires_fresh_server_self_before_attaching_login_rows() {
    let mut engine = MeterEngine::default();
    let old_list = wire(&inventory(0, &[(1042, 2)], &[(1042, 32)]));
    engine.ingest_tcp(&tcp(99, 0x12, &[]), true, 100);
    own(&mut engine, 7, 101);
    engine.ingest_tcp(&tcp(100, 0x18, &old_list), true, 200);
    engine.ingest_tcp(&tcp(4_999, 0x12, &[]), true, 300);
    let new_list = wire(&inventory(0, &[(1204, 1)], &[(1204, 3)]));
    engine.ingest_tcp(&tcp(5_000, 0x18, &new_list), true, 400);
    assert!(engine.character_snapshot().pet_progress.is_none());
    assert_eq!(engine.live_state(400).local_player_id, None);
    own(&mut engine, 8, 500);
    let refreshed = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(refreshed.actor_id, Some(8));
    assert_eq!(refreshed.continuity, PetContinuity::Live);
    assert_eq!(refreshed.pets.len(), 1);
    assert_eq!(refreshed.pets[0].pet_id, 1204);
    assert_eq!(refreshed.pets[0].progress, Some(3));
}

#[test]
fn stale_collection_never_crosses_character_server_or_actor_identity_changes() {
    for (actor, name, server) in [
        (8, "Player7", Some(1)),
        (7, "Other", Some(1)),
        (7, "Player7", Some(2)),
    ] {
        let mut store = CharacterStore::default();
        store.bind_self(7, "Player7", Some(1), 100);
        store.ingest(
            character::decode(&inventory(0, &[(1042, 2)], &[(1042, 32)]))
                .unwrap()
                .unwrap(),
            200,
        );
        store.invalidate_capture(300, "capture-loss");
        store.bind_self(7, "Player7", None, 350);
        assert_eq!(store.snapshot().own.unwrap().server_id, Some(1));
        store.bind_self(actor, name, server, 400);
        assert!(store.snapshot().pet_progress.is_none());
    }
    let mut engine = MeterEngine::default();
    receive(&mut engine, &inventory(0, &[(1042, 2)], &[(1042, 32)]), 100);
    engine.capture_loss();
    own(&mut engine, 7, 200);
    assert!(engine.character_snapshot().pet_progress.is_none());
}

#[test]
fn stale_snapshot_serialization_is_explicit_and_absolute_refresh_ignores_forged_flags() {
    let mut store = CharacterStore::default();
    store.bind_self(7, "Player", None, 100);
    let mut rows = received_pets(&inventory(0, &[(1042, 2)], &[(1042, 32)]));
    store.ingest(
        CharacterEvent::PetInventory {
            active_pet_id: None,
            active_pet_known: true,
            pets: rows.clone(),
        },
        200,
    );
    store.invalidate_capture(300, "capture-loss");
    let value = serde_json::to_value(store.snapshot()).unwrap();
    assert_eq!(value["pet_progress"]["continuity"], "last-known");
    assert_eq!(value["pet_progress"]["stale_reason"], "capture-loss");
    assert_eq!(value["pet_progress"]["pets"][0]["progress_stale"], true);
    rows[0].progress_stale = true;
    store.ingest(
        CharacterEvent::PetInventory {
            active_pet_id: None,
            active_pet_known: true,
            pets: rows,
        },
        400,
    );
    let refreshed = store.snapshot().pet_progress.unwrap();
    assert_eq!(refreshed.continuity, PetContinuity::Live);
    assert!(!refreshed.pets[0].progress_stale);
}

fn received_pets(frame: &[u8]) -> Vec<ObservedPetProgress> {
    let Some(CharacterEvent::PetInventory { pets, .. }) = character::decode(frame).unwrap() else {
        panic!("expected pet inventory");
    };
    pets
}

#[test]
fn invalid_typed_pet_events_are_atomic_even_with_an_earlier_clock() {
    let mut store = CharacterStore::default();
    store.bind_self(7, "Player", None, 100);
    let valid = received_pets(&inventory(0, &[(1042, 2)], &[(1042, 32)]));
    store.ingest(
        CharacterEvent::PetInventory {
            active_pet_id: None,
            active_pet_known: true,
            pets: valid.clone(),
        },
        200,
    );
    let previous = store.snapshot();
    let mut invalid_level = valid.clone();
    invalid_level[0].level = Some(4);
    let mut invalid_progress = valid.clone();
    invalid_progress[0].progress = Some(u64::from(u32::MAX) + 1);
    for event in [
        CharacterEvent::PetGains {
            gains: vec![(1042, 1), (0, 2)],
        },
        CharacterEvent::PetGains {
            gains: vec![(1042, 1), (1042, 2)],
        },
        CharacterEvent::PetGains {
            gains: vec![(1042, 0)],
        },
        CharacterEvent::PetLevel {
            pet_id: 1042,
            level: 4,
        },
        CharacterEvent::PetLevel {
            pet_id: 0,
            level: 2,
        },
        CharacterEvent::PetAdded {
            pet_id: 1042,
            level: 4,
        },
        CharacterEvent::PetAdded {
            pet_id: 0,
            level: 1,
        },
        CharacterEvent::PetInventory {
            active_pet_id: Some(9999),
            active_pet_known: true,
            pets: valid.clone(),
        },
        CharacterEvent::PetInventory {
            active_pet_id: None,
            active_pet_known: true,
            pets: vec![valid[0].clone(), valid[0].clone()],
        },
        CharacterEvent::PetInventory {
            active_pet_id: None,
            active_pet_known: true,
            pets: invalid_level,
        },
        CharacterEvent::PetInventory {
            active_pet_id: None,
            active_pet_known: true,
            pets: invalid_progress,
        },
    ] {
        store.ingest(event.clone(), 300);
        assert_eq!(store.snapshot(), previous);
        store.ingest(event, 50);
        assert_eq!(store.snapshot(), previous);
    }
}

#[test]
fn typed_inventory_normalizes_provenance_metadata_and_order_before_future_deltas() {
    let mut store = CharacterStore::default();
    store.bind_self(7, "Player", None, 100);
    let mut pets = received_pets(&inventory(0, &[(1042, 2), (1204, 1)], &[(1042, 32)]));
    pets.reverse();
    for pet in &mut pets {
        pet.required_progress = Some(9_999);
        pet.progress_source = "guessed".into();
        pet.session_gained = 777;
        pet.session_started_at_ms = Some(1);
        pet.session_baseline_gained = 88;
        pet.session_gain_events = 99;
        pet.last_gain_at_ms = Some(90);
    }
    store.ingest(
        CharacterEvent::PetInventory {
            active_pet_id: Some(1042),
            active_pet_known: true,
            pets,
        },
        200,
    );
    store.ingest(
        CharacterEvent::PetGains {
            gains: vec![(1042, 2)],
        },
        300,
    );
    let snapshot = store.snapshot().pet_progress.unwrap();
    assert_eq!(
        snapshot
            .pets
            .iter()
            .map(|pet| pet.pet_id)
            .collect::<Vec<_>>(),
        [1042, 1204]
    );
    let pet = &snapshot.pets[0];
    assert_eq!(pet.progress, Some(34));
    assert_eq!(pet.progress_source, "server-delta");
    assert_eq!(pet.required_progress, None);
    assert_eq!(pet.session_gained, 2);
    assert_eq!(pet.session_started_at_ms, Some(200));
    assert_eq!(pet.session_baseline_gained, 0);
    assert_eq!(pet.session_gain_events, 1);
    assert_eq!(pet.last_gain_at_ms, Some(300));
    assert_eq!(snapshot.pets[1].progress_source, "unknown");
    assert_eq!(snapshot.pets[1].session_gained, 0);
}

#[test]
fn raw_counter_overflow_becomes_unknown_without_losing_actual_session_gains() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(
        &mut engine,
        &inventory(0, &[(1042, 2)], &[(1042, u32::MAX)]),
        200,
    );
    receive(&mut engine, &gains(&[(1042, 2)]), 300);
    let snapshot = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(snapshot.pets[0].progress, None);
    assert_eq!(snapshot.pets[0].progress_source, "unknown");
    assert_eq!(snapshot.pets[0].session_gained, 2);
    assert_eq!(snapshot.pets[0].session_gain_events, 1);
    assert_eq!(snapshot.pets[0].session_started_at_ms, Some(200));
}

#[test]
fn legacy_pet_snapshots_do_not_invent_a_session_clock_or_rate_baseline() {
    let pet: ObservedPetProgress = serde_json::from_value(serde_json::json!({
        "pet_id":1042, "level":2, "progress":32, "progress_source":"server-absolute",
        "required_progress":null, "session_gained":3, "observed_at_ms":200
    }))
    .unwrap();
    assert_eq!(pet.progress, Some(32));
    assert_eq!(pet.session_started_at_ms, None);
    assert_eq!(pet.session_baseline_gained, 0);
    assert_eq!(pet.session_gain_events, 0);
    assert_eq!(pet.last_gain_at_ms, None);
}

#[test]
fn pet_level_reserved_prefix_is_required_and_malformed_level_never_changes_progress() {
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(&mut engine, &inventory(0, &[(1042, 1)], &[(1042, 3)]), 200);
    let previous = engine.character_snapshot();
    for index in [2, 3] {
        let mut malformed = level(1042, 2);
        malformed[index] = 1;
        assert!(character::decode(&malformed).is_err());
        assert!(packets::decode(&malformed).is_err());
        assert_eq!(engine.character_snapshot(), previous);
    }
}
