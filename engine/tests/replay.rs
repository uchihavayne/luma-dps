use luma_engine::{packets::Event, MeterEngine};

fn hex(value: &str) -> Vec<u8> {
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
        .collect()
}
fn encode(value: u32) -> Vec<u8> {
    let mut value = value;
    let mut result = Vec::new();
    loop {
        let mut byte = (value & 127) as u8;
        value >>= 7;
        if value != 0 {
            byte |= 128
        }
        result.push(byte);
        if value == 0 {
            return result;
        }
    }
}
fn frame(payload: &[u8]) -> Vec<u8> {
    let mut bytes = encode(payload.len() as u32 + 4);
    bytes.extend_from_slice(payload);
    bytes
}
fn tcp(sequence: u32, source_port: u16, destination_port: u16, payload: &[u8]) -> Vec<u8> {
    let mut packet = vec![0u8; 40];
    packet[0] = 0x45;
    packet[2..4].copy_from_slice(&((40 + payload.len()) as u16).to_be_bytes());
    packet[9] = 6;
    packet[12..16].copy_from_slice(&[10, 0, 0, 1]);
    packet[16..20].copy_from_slice(&[10, 0, 0, 2]);
    packet[20..22].copy_from_slice(&source_port.to_be_bytes());
    packet[22..24].copy_from_slice(&destination_port.to_be_bytes());
    packet[24..28].copy_from_slice(&sequence.to_be_bytes());
    packet[32] = 0x50;
    packet[33] = 0x18;
    packet.extend_from_slice(payload);
    packet
}
fn damage() -> Vec<u8> {
    frame(&hex(
        "0438e9de020600c80b9147ff003f02020002aff4b76301000000e4506a0100",
    ))
}

#[test]
fn end_to_end_tcp_reordering_counts_an_observed_hit_once() {
    let mut engine = MeterEngine::default();
    let bytes = damage();
    for (seq, payload) in [
        (100, &bytes[..8]),
        (116, &bytes[16..]),
        (108, &bytes[8..16]),
        (100, bytes.as_slice()),
    ] {
        engine.ingest_tcp(&tcp(seq, 13328, 51000, payload), true, 1000)
    }
    let result = engine.state(2000);
    assert_eq!(result.total_damage, 106);
    assert_eq!(result.players.len(), 1);
    assert_eq!(result.players[0].id, 1480);
    assert_eq!(result.diagnostics.damage_events, 1);
}
#[test]
fn sequence_wrap_and_overlapping_tcp_reads_do_not_duplicate_damage() {
    let mut engine = MeterEngine::default();
    let bytes = damage();
    let start = u32::MAX - 7;
    engine.ingest_tcp(&tcp(start, 13328, 51000, &bytes[..16]), true, 1000);
    engine.ingest_tcp(
        &tcp(start.wrapping_add(8), 13328, 51000, &bytes[8..]),
        true,
        1000,
    );
    engine.ingest_tcp(&tcp(start, 13328, 51000, &bytes), true, 1000);
    assert_eq!(engine.state(2000).total_damage, 106);
}
#[test]
fn direction_and_tcp_connection_are_separate_inputs() {
    let mut engine = MeterEngine::default();
    let bytes = damage();
    engine.ingest_tcp(&tcp(100, 13328, 51000, &bytes), false, 1000);
    assert_eq!(engine.state(2000).total_damage, 0);
    engine.ingest_tcp(&tcp(100, 13328, 51000, &bytes[..8]), true, 1000);
    engine.ingest_tcp(&tcp(108, 13328, 51001, &bytes[8..]), true, 1000);
    assert_eq!(engine.state(2000).total_damage, 0);
    engine.ingest_tcp(&tcp(108, 13328, 51000, &bytes[8..]), true, 1000);
    assert_eq!(engine.state(2000).total_damage, 106);
}
#[test]
fn lz4_bundles_and_tick_hits_use_the_same_independent_pipeline() {
    let mut inner = damage();
    inner.extend(frame(&hex("0538812a0abdd1019002bb1227073332931200")));
    let mut payload = vec![255, 255];
    payload.extend((inner.len() as u32).to_le_bytes());
    payload.extend(lz4_flex::block::compress(&inner));
    let mut engine = MeterEngine::default();
    engine.ingest_tcp(&tcp(100, 13328, 51000, &frame(&payload)), true, 1000);
    assert_eq!(engine.state(2000).total_damage, 157);
    assert_eq!(engine.state(2000).diagnostics.damage_events, 2);
}
#[test]
fn incomplete_and_unrelated_tls_never_creates_damage() {
    let mut engine = MeterEngine::default();
    let bytes = damage();
    engine.ingest_tcp(&tcp(100, 13328, 51000, &bytes[..15]), true, 1000);
    assert_eq!(engine.state(2000).total_damage, 0);
    let mut tls = vec![23, 3, 3, 0, bytes.len() as u8];
    tls.extend(bytes);
    engine.ingest_tcp(&tcp(100, 13328, 51001, &tls), true, 1000);
    assert_eq!(engine.state(2000).total_damage, 0);
}
#[test]
fn health_peak_is_not_fabricated_as_maximum_health() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(
        Event::Health {
            id: 10,
            current: 500,
        },
        1000,
    );
    engine.ingest_event(
        Event::Damage(luma_engine::packets::Hit {
            source: 1,
            target: 10,
            skill: 14_090_000,
            amount: 100,
            critical: false,
            tick: false,
            flags: 0,
            angle: 0,
        }),
        1000,
    );
    engine.ingest_event(
        Event::Health {
            id: 10,
            current: 250,
        },
        2000,
    );
    let target = &engine.state(2000).targets[0];
    assert_eq!(target.current_hp, Some(250));
    assert_eq!(target.observed_peak_hp, Some(500));
}
#[test]
fn loot_ownership_does_not_attribute_npc_attacks_to_the_owner() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(
        Event::Npc {
            id: 2,
            name: None,
            model: 2_920_000,
            kind: 0x0c,
        },
        0,
    );
    engine.ingest_event(Event::Owner { id: 2, owner: 1 }, 0);
    engine.ingest_event(
        Event::Damage(luma_engine::packets::Hit {
            source: 2,
            target: 10,
            skill: 14_090_000,
            amount: 100,
            critical: false,
            tick: false,
            flags: 0,
            angle: 0,
        }),
        1000,
    );
    assert_eq!(engine.state(2000).total_damage, 0);
}

#[test]
fn a_tls_like_sequence_inside_game_payload_has_identical_whole_and_split_results() {
    let mut payload = hex("0438e9de020600c80b9147ff003f02020002aff4b76301000000e4506a0100");
    payload[18..23].copy_from_slice(&[23, 3, 3, 0, 2]);
    let bytes = frame(&payload);
    let split = 19;
    let mut whole = MeterEngine::default();
    whole.ingest_tcp(&tcp(100, 13328, 51000, &bytes), true, 1000);
    let mut parts = MeterEngine::default();
    parts.ingest_tcp(&tcp(100, 13328, 51000, &bytes[..split]), true, 1000);
    parts.ingest_tcp(
        &tcp(100 + split as u32, 13328, 51000, &bytes[split..]),
        true,
        1000,
    );
    assert_eq!(whole.live_state(2000).total_damage, 106);
    assert_eq!(parts.live_state(2000).total_damage, 106);
}

fn player_identity(opcode: u8, id: u32, name: &str) -> Vec<u8> {
    let mut payload = vec![opcode, 0x36];
    payload.extend(encode(id));
    payload.extend(0u32.to_le_bytes());
    payload.extend([1, name.len() as u8]);
    payload.extend(name.as_bytes());
    if opcode == 0x33 {
        payload.extend(1304u16.to_le_bytes());
        payload.extend(14u32.to_le_bytes());
    }
    frame(&payload)
}

fn tick_damage(source: u32, amount: u32) -> Vec<u8> {
    let mut payload = vec![5, 0x38];
    payload.extend(encode(10));
    payload.push(2);
    payload.extend(encode(source));
    payload.push(0);
    payload.extend(14_090_000u32.to_le_bytes());
    payload.extend(encode(amount));
    frame(&payload)
}

fn receive(engine: &mut MeterEngine, sequence: &mut u32, payload: &[u8], now: u64) {
    engine.ingest_tcp(&tcp(*sequence, 13328, 51000, payload), true, now);
    *sequence += payload.len() as u32;
}

#[test]
fn nearby_ungrouped_rows_keep_received_names_and_rates_when_self_is_unresolved() {
    let mut engine = MeterEngine::default();
    let mut sequence = 100;
    receive(&mut engine, &mut sequence, &tick_damage(2, 200), 1000);
    receive(&mut engine, &mut sequence, &tick_damage(3, 300), 2000);
    assert_eq!(engine.live_state(3000).players[0].name, "#3");

    for (opcode, id, name) in [(0x44, 2, "Yakın"), (0x45, 3, "弓手")] {
        receive(
            &mut engine,
            &mut sequence,
            &player_identity(opcode, id, name),
            2500,
        );
    }
    let state = engine.live_state(3000);
    assert_eq!(state.local_player_id, None);
    assert_eq!(state.personal_total_damage, None);
    assert_eq!(state.party_total_damage, None);
    assert_eq!(state.total_damage, 500);
    assert_eq!(state.dps, 250.0);
    assert_eq!(state.players.len(), 2);
    assert_eq!(state.players[0].name, "弓手");
    assert_eq!(state.players[0].dps, 150.0);
    assert_eq!(state.players[1].name, "Yakın");
    assert_eq!(state.players[1].dps, 100.0);
    assert!(state.players.iter().all(|row| row.identity_confirmed));
    assert!(state.players.iter().all(|row| !row.in_party));
    assert_eq!(state.diagnostics.rejected_frames, 0);
}

#[test]
fn a_late_party_roster_preserves_nearby_rows_and_only_sums_its_named_members() {
    let mut engine = MeterEngine::default();
    let mut sequence = 100;
    for (opcode, id, name) in [(0x33, 1, "Local"), (0x44, 2, "Friend"), (0x45, 3, "Nearby")] {
        receive(
            &mut engine,
            &mut sequence,
            &player_identity(opcode, id, name),
            0,
        );
    }
    for (id, amount) in [(1, 100), (2, 200), (3, 900)] {
        receive(&mut engine, &mut sequence, &tick_damage(id, amount), 1000);
    }
    let mut roster = vec![2, 0x97];
    roster.extend(42u32.to_le_bytes());
    roster.extend([5, b'P', b'a', b'r', b't', b'y', 2]);
    roster.extend([0; 17]);
    roster.push(2);
    for (slot, name) in [(1, "Local"), (2, "Friend")] {
        roster.extend([12, slot]);
        roster.extend((1304u64 << 48 | u64::from(slot)).to_le_bytes());
        roster.push(name.len() as u8);
        roster.extend(name.as_bytes());
        roster.extend(14u32.to_le_bytes());
        roster.extend(50u32.to_le_bytes());
        roster.extend(5000u32.to_le_bytes());
        roster.extend(1304u16.to_le_bytes());
        roster.extend(1304u16.to_le_bytes());
        roster.push(4);
        roster.extend(850_000u64.to_le_bytes());
        roster.extend([0, 1, 1]);
    }
    let bytes = frame(&roster);
    let split = bytes.len() / 2;
    receive(&mut engine, &mut sequence, &bytes[..split], 1500);
    assert_eq!(engine.live_state(1500).party_total_damage, None);
    receive(&mut engine, &mut sequence, &bytes[split..], 1500);

    let state = engine.live_state(3000);
    assert_eq!(state.local_player_name, "Local");
    assert_eq!(state.total_damage, 1200);
    assert_eq!(state.personal_total_damage, Some(100));
    assert_eq!(state.party_membership_source, "server");
    assert_eq!(state.party_member_ids, vec![1, 2]);
    assert_eq!(state.party_total_damage, Some(300));
    assert_eq!(state.party_dps, Some(150.0));
    assert_eq!(state.players.len(), 3);
    let friend = state.players.iter().find(|row| row.id == 2).unwrap();
    assert_eq!(friend.name, "Friend");
    assert_eq!(friend.class_name, "Ranger");
    assert_eq!(friend.dps, 100.0);
    assert!(friend.in_party);
    let nearby = state.players.iter().find(|row| row.id == 3).unwrap();
    assert_eq!(nearby.name, "Nearby");
    assert_eq!(nearby.dps, 450.0);
    assert!(!nearby.in_party);
    assert_eq!(state.diagnostics.rejected_frames, 0);
}
