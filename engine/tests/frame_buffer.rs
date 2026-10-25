use luma_engine::MeterEngine;

fn hex(value: &str) -> Vec<u8> {
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
        .collect()
}
fn frame(payload: &[u8]) -> Vec<u8> {
    let mut bytes = vec![payload.len() as u8 + 4];
    bytes.extend_from_slice(payload);
    bytes
}
fn tcp(sequence: u32, payload: &[u8]) -> Vec<u8> {
    let mut packet = vec![0u8; 40];
    packet[0] = 0x45;
    packet[2..4].copy_from_slice(&((40 + payload.len()) as u16).to_be_bytes());
    packet[9] = 6;
    packet[12..16].copy_from_slice(&[10, 0, 0, 1]);
    packet[16..20].copy_from_slice(&[10, 0, 0, 2]);
    packet[20..22].copy_from_slice(&13328u16.to_be_bytes());
    packet[22..24].copy_from_slice(&51000u16.to_be_bytes());
    packet[24..28].copy_from_slice(&sequence.to_be_bytes());
    packet[32] = 0x50;
    packet[33] = 0x18;
    packet.extend_from_slice(payload);
    packet
}

#[test]
fn received_frames_are_kept_in_a_bounded_window_and_filtered_by_time() {
    let mut engine = MeterEngine::default();
    let payload = hex("0438e9de020600c80b9147ff003f02020002aff4b76301000000e4506a0100");
    let bytes = frame(&payload);
    engine.ingest_tcp(&tcp(100, &bytes), true, 1_000);
    engine.ingest_tcp(&tcp(100 + bytes.len() as u32, &bytes), true, 5_000);
    let all = engine.recent_frames(0);
    assert_eq!(all.len(), 2);
    assert_eq!((all[0].0, all[1].0), (1_000, 5_000));
    assert_eq!(all[0].1, payload);
    assert_eq!(engine.recent_frames(2_000).len(), 1);
    assert!(engine.recent_frames(9_000).is_empty());
}

#[test]
fn the_window_never_exceeds_its_frame_or_byte_limits_and_drops_the_oldest() {
    let mut engine = MeterEngine::default();
    for index in 0..40_500u64 {
        engine.remember_frame(index, &[1, 2, 3, 4]);
    }
    let kept = engine.recent_frames(0);
    assert_eq!(kept.len(), 40_000);
    assert_eq!(kept[0].0, 500);
    // Large frames are cut to 4 KiB and the byte budget (12 MiB) bounds the window too.
    let mut engine = MeterEngine::default();
    for index in 0..4_000u64 {
        engine.remember_frame(index, &vec![7u8; 10_000]);
    }
    let kept = engine.recent_frames(0);
    assert!(kept.iter().all(|(_, frame)| frame.len() == 4096));
    assert!(kept.len() * 4096 <= 12 * 1024 * 1024);
    assert_eq!(kept.last().unwrap().0, 3_999);
}
