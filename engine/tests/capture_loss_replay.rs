use luma_engine::MeterEngine;

fn damage() -> Vec<u8> {
    let payload: Vec<u8> = "0438e9de020600c80b9147ff003f02020002aff4b76301000000e4506a0100"
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
        .collect();
    let mut wire = vec![(payload.len() + 4) as u8];
    wire.extend(payload);
    wire
}

fn tcp(sequence: u32, local_port: u16, flags: u8, payload: &[u8]) -> Vec<u8> {
    let mut packet = vec![0u8; 40];
    packet[0] = 0x45;
    packet[2..4].copy_from_slice(&((40 + payload.len()) as u16).to_be_bytes());
    packet[9] = 6;
    packet[12..16].copy_from_slice(&[10, 0, 0, 1]);
    packet[16..20].copy_from_slice(&[10, 0, 0, 2]);
    packet[20..22].copy_from_slice(&7777u16.to_be_bytes());
    packet[22..24].copy_from_slice(&local_port.to_be_bytes());
    packet[24..28].copy_from_slice(&sequence.to_be_bytes());
    packet[32] = 0x50;
    packet[33] = flags;
    packet.extend_from_slice(payload);
    packet
}

fn ingest(engine: &mut MeterEngine, sequence: u32, payload: &[u8], now: u64) {
    engine.ingest_tcp(&tcp(sequence, 50000, 0x18, payload), true, now);
}

#[test]
fn already_counted_tcp_hit_is_not_counted_again_after_capture_loss() {
    let hit = damage();
    let mut engine = MeterEngine::default();
    ingest(&mut engine, 100, &hit, 1);
    engine.capture_loss();
    ingest(&mut engine, 100, &hit, 2);
    assert_eq!(engine.state(3).total_damage, 106);
    assert_eq!(engine.state(3).diagnostics.damage_events, 1);
    ingest(&mut engine, 100 + hit.len() as u32, &hit, 4);
    assert_eq!(engine.state(5).total_damage, 212);
    assert_eq!(engine.state(5).diagnostics.damage_events, 2);
    assert_eq!(engine.state(5).diagnostics.stream_gaps, 1);
}

#[test]
fn overlap_after_loss_emits_only_the_genuinely_new_frame() {
    let hit = damage();
    let mut engine = MeterEngine::default();
    ingest(&mut engine, 100, &hit, 1);
    engine.capture_loss();
    let mut overlap = hit.clone();
    overlap.extend_from_slice(&hit);
    ingest(&mut engine, 100, &overlap, 2);
    assert_eq!(engine.state(3).total_damage, 212);
    assert_eq!(engine.state(3).diagnostics.damage_events, 2);
}

#[test]
fn a_partial_record_is_discarded_instead_of_stitched_across_loss() {
    let hit = damage();
    let mut engine = MeterEngine::default();
    ingest(&mut engine, 100, &hit[..8], 1);
    engine.capture_loss();
    ingest(&mut engine, 100, &hit, 2);
    assert_eq!(engine.state(3).total_damage, 0);
    ingest(&mut engine, 100 + hit.len() as u32, &hit, 4);
    assert_eq!(engine.state(5).total_damage, 106);
    assert_eq!(engine.state(5).diagnostics.damage_events, 1);
}

#[test]
fn buffered_out_of_order_bytes_do_not_survive_capture_loss() {
    let hit = damage();
    let next = 100 + hit.len() as u32;
    let mut engine = MeterEngine::default();
    ingest(&mut engine, 100, &hit, 1);
    ingest(&mut engine, next + 8, &hit[8..], 2);
    engine.capture_loss();
    ingest(&mut engine, next, &hit[..8], 3);
    assert_eq!(engine.state(4).total_damage, 106);
    ingest(&mut engine, next + 8, &hit[8..], 5);
    assert_eq!(engine.state(6).total_damage, 212);
}

#[test]
fn post_loss_ack_and_old_retransmission_do_not_delay_new_payload_recovery() {
    let hit = damage();
    let mut engine = MeterEngine::default();
    ingest(&mut engine, 100, &hit, 1);
    engine.capture_loss();
    engine.ingest_tcp(&tcp(1000, 50000, 0x10, &[]), true, 2);
    ingest(&mut engine, 100, &hit, 3);
    ingest(&mut engine, 1000, &hit, 4);
    let state = engine.state(5);
    assert_eq!(state.total_damage, 212);
    assert_eq!(state.diagnostics.damage_events, 2);
    assert_eq!(state.diagnostics.stream_gaps, 1);
}

#[test]
fn wrapped_sequence_high_water_survives_loss_and_trims_overlap() {
    let hit = damage();
    let start = u32::MAX - 10;
    let mut engine = MeterEngine::default();
    ingest(&mut engine, start, &hit, 1);
    engine.capture_loss();
    ingest(&mut engine, start, &hit, 2);
    let mut overlap = hit[4..].to_vec();
    overlap.extend_from_slice(&hit);
    ingest(&mut engine, start.wrapping_add(4), &overlap, 3);
    assert_eq!(engine.state(4).total_damage, 212);
    assert_eq!(engine.state(4).diagnostics.damage_events, 2);
}

#[test]
fn a_real_syn_resets_high_water_even_when_sequence_numbers_are_reused() {
    let hit = damage();
    let mut engine = MeterEngine::default();
    ingest(&mut engine, 100, &hit, 1);
    engine.capture_loss();
    engine.ingest_tcp(&tcp(99, 50000, 0x1a, &hit), true, 2);
    assert_eq!(engine.state(3).total_damage, 212);
    assert_eq!(engine.state(3).diagnostics.damage_events, 2);
}

#[test]
fn a_changed_connection_resets_the_delivered_generation() {
    let hit = damage();
    let mut engine = MeterEngine::default();
    ingest(&mut engine, 100, &hit, 1);
    engine.capture_loss();
    engine.connection_changed();
    ingest(&mut engine, 100, &hit, 2);
    let state = engine.state(3);
    assert_eq!(state.total_damage, 106);
    assert_eq!(state.diagnostics.damage_events, 1);
    assert_eq!(state.history.len(), 1);
}

#[test]
fn separate_flows_preserve_independent_delivered_high_waters() {
    let hit = damage();
    let mut engine = MeterEngine::default();
    for (port, sequence) in [(50000, 100), (50001, 500)] {
        engine.ingest_tcp(&tcp(sequence, port, 0x18, &hit), true, 1);
    }
    engine.capture_loss();
    for (port, sequence) in [(50000, 100), (50001, 500)] {
        engine.ingest_tcp(&tcp(sequence, port, 0x18, &hit), true, 2);
        engine.ingest_tcp(&tcp(sequence + hit.len() as u32, port, 0x18, &hit), true, 3);
    }
    assert_eq!(engine.state(4).total_damage, 424);
    assert_eq!(engine.state(4).diagnostics.damage_events, 4);
}

#[test]
fn retransmitted_terminal_segments_cannot_reopen_a_closed_flow() {
    let hit = damage();
    let mut engine = MeterEngine::default();
    engine.ingest_tcp(&tcp(100, 50000, 0x19, &hit), true, 1);
    engine.capture_loss();
    engine.ingest_tcp(&tcp(100, 50000, 0x19, &hit), true, 2);
    ingest(&mut engine, 100 + hit.len() as u32, &hit, 3);
    assert_eq!(engine.state(4).total_damage, 106);
    engine.ingest_tcp(&tcp(99, 50000, 0x1a, &hit), true, 5);
    assert_eq!(engine.state(6).total_damage, 212);
}

#[test]
fn a_reset_closes_a_known_flow_until_a_new_syn() {
    let hit = damage();
    let mut engine = MeterEngine::default();
    ingest(&mut engine, 100, &hit, 1);
    engine.ingest_tcp(&tcp(100 + hit.len() as u32, 50000, 0x14, &[]), true, 2);
    engine.capture_loss();
    ingest(&mut engine, 100, &hit, 3);
    assert_eq!(engine.state(4).total_damage, 106);
    engine.ingest_tcp(&tcp(99, 50000, 0x1a, &hit), true, 5);
    assert_eq!(engine.state(6).total_damage, 212);
}

#[test]
fn confirmed_tls_classification_survives_capture_loss() {
    let hit = damage();
    let mut encrypted = vec![23, 3, 3, 0, hit.len() as u8];
    encrypted.extend_from_slice(&hit);
    let mut engine = MeterEngine::default();
    ingest(&mut engine, 100, &encrypted, 1);
    engine.capture_loss();
    ingest(&mut engine, 100 + encrypted.len() as u32, &hit, 2);
    assert_eq!(engine.state(3).total_damage, 0);
    assert_eq!(engine.state(3).diagnostics.damage_events, 0);
}
