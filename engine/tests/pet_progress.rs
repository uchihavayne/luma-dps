use luma_engine::{
    character::{self, CharacterEvent},
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

fn receive(engine: &mut MeterEngine, frame: &[u8], at: u64) {
    engine.ingest_event(packets::decode(frame).unwrap().unwrap(), at);
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
fn level_change_invalidates_unknown_rollover_without_guessing_required_souls() {
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
    assert_eq!(state.pets[0].progress, None);
    assert_eq!(state.pets[0].required_progress, None);
    assert_eq!(state.pets[0].session_gained, 2);
    assert_eq!(state.pets[0].progress_source, "unknown");
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
fn pet_progress_is_cleared_on_capture_loss_connection_and_clock_reversal() {
    let frame = inventory(0, &[(1042, 2)], &[(1042, 32)]);
    let mut engine = MeterEngine::default();
    own(&mut engine, 7, 100);
    receive(&mut engine, &frame, 200);
    engine.capture_loss();
    assert!(engine.character_snapshot().pet_progress.is_none());
    receive(&mut engine, &gains(&[(1042, 1)]), 300);
    assert_eq!(
        engine.character_snapshot().pet_progress.unwrap().pets[0].progress,
        None
    );
    engine.connection_changed();
    assert!(engine.character_snapshot().pet_progress.is_none());
    own(&mut engine, 8, 500);
    receive(&mut engine, &frame, 600);
    receive(&mut engine, &gains(&[(1042, 1)]), 550);
    assert!(engine.character_snapshot().pet_progress.is_none());
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
        inventory(9999, &[(1042, 2)], &[]),
        inventory(0, &[(1042, 4)], &[]),
        inventory(0, &[(1042, 2)], &[(1204, 1)]),
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
    assert_eq!(after_gap.pets[0].progress, None);
    assert_eq!(after_gap.pets[0].session_gained, 2);
    engine.ingest_tcp(&tcp(next + delta.len() as u32, 0x18, &list), true, 10_100);
    let state = engine.character_snapshot().pet_progress.unwrap();
    assert_eq!(state.pets[0].progress, Some(32));
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
