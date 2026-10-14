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
