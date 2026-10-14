use luma_engine::{
    framing::{expand, FrameStreams},
    net::Connection,
    packets::{decode, Event},
};

fn connection() -> Connection {
    Connection {
        source: [0; 16],
        destination: [1; 16],
        source_port: 7777,
        destination_port: 50000,
    }
}

fn encode(mut value: u32) -> Vec<u8> {
    let mut bytes = Vec::new();
    loop {
        let mut byte = (value & 0x7f) as u8;
        value >>= 7;
        if value != 0 {
            byte |= 0x80;
        }
        bytes.push(byte);
        if value == 0 {
            return bytes;
        }
    }
}

fn record(payload: &[u8]) -> Vec<u8> {
    let mut bytes = encode(payload.len() as u32 + 4);
    bytes.extend_from_slice(payload);
    bytes
}

fn damage_payload() -> Vec<u8> {
    // Existing observed direct-hit fixture: source 1480, target 44905, damage 106.
    "0438e9de020600c80b9147ff003f02020002aff4b76301000000e4506a0100"
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
        .collect()
}

fn amounts(frames: &[Vec<u8>]) -> Vec<u64> {
    let mut amounts = Vec::new();
    for frame in frames {
        let mut expanded = Vec::new();
        expand(frame, &mut expanded, 0).unwrap();
        for payload in expanded {
            if let Ok(Some(Event::Damage(hit))) = decode(&payload) {
                amounts.push(hit.amount);
            }
        }
    }
    amounts
}

fn bundle(inner: &[u8]) -> Vec<u8> {
    let mut payload = vec![0xff, 0xff];
    payload.extend_from_slice(&(inner.len() as u32).to_le_bytes());
    payload.extend(lz4_flex::block::compress(inner));
    record(&payload)
}

#[test]
fn mid_stream_false_long_length_recovers_a_complete_validated_hit() {
    let mut stream = FrameStreams::default();
    let mut bytes = vec![0x80, 0x80, 0x04, 4, 0x38];
    bytes.extend(record(&damage_payload()));
    let frames = stream.push(&connection(), &bytes);
    assert_eq!(frames, vec![damage_payload()]);
    assert_eq!(amounts(&frames), vec![106]);
    assert_eq!(stream.rejected, 1);
}

#[test]
fn recovery_revisits_a_valid_anchor_split_across_later_reads() {
    let damage = record(&damage_payload());
    let mut stream = FrameStreams::default();
    let mut bytes = vec![0x80, 0x80, 0x04, 4, 0x38];
    bytes.extend_from_slice(&damage[..17]);
    assert!(stream.push(&connection(), &bytes).is_empty());
    assert_eq!(
        amounts(&stream.push(&connection(), &damage[17..])),
        vec![106]
    );
}

#[test]
fn two_opcode_bytes_do_not_establish_a_recovery_anchor() {
    let mut stream = FrameStreams::default();
    let mut bytes = vec![0x80, 0x80, 0x04, 4, 0x38];
    bytes.extend(record(&[4, 0x38]));
    bytes.extend(record(&damage_payload()));
    assert_eq!(stream.push(&connection(), &bytes), vec![damage_payload()]);
}

#[test]
fn a_complete_unknown_family_is_opaque_even_on_initial_attachment() {
    let mut opaque = vec![1, 0x39];
    opaque.extend(record(&damage_payload()));
    let mut stream = FrameStreams::default();
    let frames = stream.push(&connection(), &record(&opaque));
    assert_eq!(frames, vec![opaque]);
    assert!(amounts(&frames).is_empty());
    assert_eq!(stream.rejected, 0);
}

#[test]
fn confirmed_alignment_preserves_a_split_unknown_record_with_embedded_damage() {
    let mut opaque = vec![1, 0x39];
    opaque.extend(record(&damage_payload()));
    opaque.extend([0x55; 100]);
    let wire = record(&opaque);
    let split = wire.len() - 30;
    let mut stream = FrameStreams::default();
    stream.mark_start(&connection());
    assert!(stream.push(&connection(), &wire[..split]).is_empty());
    let frames = stream.push(&connection(), &wire[split..]);
    assert_eq!(frames, vec![opaque]);
    assert!(amounts(&frames).is_empty());
    assert_eq!(
        amounts(&stream.push(&connection(), &record(&damage_payload()))),
        vec![106]
    );
}

#[test]
fn a_decoded_hit_preserves_alignment_for_a_later_split_large_frame() {
    let mut stream = FrameStreams::default();
    assert_eq!(
        amounts(&stream.push(&connection(), &record(&damage_payload()))),
        vec![106]
    );
    let mut opaque = vec![1, 0x39];
    opaque.extend(record(&damage_payload()));
    opaque.resize(1_048_576, 0xaa);
    let wire = record(&opaque);
    for chunk in wire[..wire.len() - 7].chunks(16_384) {
        assert!(stream.push(&connection(), chunk).is_empty());
    }
    let frames = stream.push(&connection(), &wire[wire.len() - 7..]);
    assert_eq!(frames, vec![opaque]);
    assert!(amounts(&frames).is_empty());
}

#[test]
fn split_compressed_frames_preserve_the_outer_record_at_every_split() {
    let damage = record(&damage_payload());
    let mut opaque = vec![1, 0x39];
    opaque.extend_from_slice(&damage);
    let mut inner = damage.clone();
    inner.extend(record(&opaque));
    inner.extend_from_slice(&damage);
    let wire = bundle(&inner);
    for trust_start in [false, true] {
        for split in 1..wire.len() {
            let mut stream = FrameStreams::default();
            if trust_start {
                stream.mark_start(&connection());
            }
            assert!(stream.push(&connection(), &wire[..split]).is_empty());
            let frames = stream.push(&connection(), &wire[split..]);
            assert_eq!(frames.len(), 1, "split {split}, trust start {trust_start}");
            assert_eq!(amounts(&frames), vec![106, 106], "split {split}");
        }
    }
}

#[test]
fn recovery_can_use_a_fully_validated_compressed_bundle() {
    let wire = bundle(&record(&damage_payload()));
    let mut stream = FrameStreams::default();
    let mut bytes = vec![0x80, 0x80, 0x04, 4, 0x38];
    bytes.extend(wire);
    assert_eq!(amounts(&stream.push(&connection(), &bytes)), vec![106]);
}

#[test]
fn recovery_waits_for_a_split_bundle_instead_of_using_literal_inner_records() {
    let mut inner = record(&damage_payload());
    // The different opaque record leaves the complete hit in an LZ4 literal run.
    let mut opaque = vec![1, 0x39];
    opaque.extend(0..100);
    inner.extend(record(&opaque));
    let wire = bundle(&inner);
    let mut bytes = vec![0x80, 0x80, 0x04, 4, 0x8d];
    bytes.extend_from_slice(&wire[..wire.len() - 1]);
    let mut stream = FrameStreams::default();
    assert!(stream.push(&connection(), &bytes).is_empty());
    let frames = stream.push(&connection(), &wire[wire.len() - 1..]);
    assert_eq!(frames.len(), 1);
    assert!(frames[0].starts_with(&[0xff, 0xff]));
    assert_eq!(amounts(&frames), vec![106]);
}

#[test]
fn malformed_compression_does_not_anchor_recovery() {
    let mut false_bundle = vec![0xff, 0xff];
    false_bundle.extend_from_slice(&100u32.to_le_bytes());
    false_bundle.extend([0, 0]);
    let mut bytes = vec![0x80, 0x80, 0x04, 4, 0x38];
    bytes.extend(record(&false_bundle));
    bytes.extend(record(&damage_payload()));
    let mut stream = FrameStreams::default();
    assert_eq!(stream.push(&connection(), &bytes), vec![damage_payload()]);
}

#[test]
fn a_bounded_recovery_scan_resumes_without_rescanning_the_prefix() {
    let mut bytes = encode(1_048_580);
    bytes.extend([4, 0x38]);
    bytes.extend(std::iter::repeat_n(0x80, 70_000));
    bytes.extend(record(&damage_payload()));
    let mut stream = FrameStreams::default();
    assert!(stream.push(&connection(), &bytes).is_empty());
    assert_eq!(amounts(&stream.push(&connection(), &[])), vec![106]);
}

#[test]
fn discard_revokes_alignment_and_allows_recovery_after_loss() {
    let mut stream = FrameStreams::default();
    stream.mark_start(&connection());
    let mut false_prefix = vec![0x80, 0x80, 0x04, 4, 0x38];
    false_prefix.extend(record(&damage_payload()));
    assert!(stream.push(&connection(), &false_prefix).is_empty());
    stream.discard(&connection());
    assert_eq!(
        amounts(&stream.push(&connection(), &false_prefix)),
        vec![106]
    );
}

#[test]
fn recovery_accepts_a_complete_character_skill_list() {
    let mut skills = vec![0, 0x51, 1, 1];
    skills.extend(11_010_000u32.to_le_bytes());
    skills.extend([12, 10]);
    skills.extend([0; 9]);
    let mut bytes = vec![0x80, 0x80, 0x04, 4, 0x38];
    bytes.extend(record(&skills));
    bytes.extend(record(&damage_payload()));
    let mut stream = FrameStreams::default();
    assert_eq!(
        stream.push(&connection(), &bytes),
        vec![skills, damage_payload()]
    );
}

#[test]
fn an_empty_character_clear_is_not_a_recovery_anchor() {
    let mut bytes = vec![0x80, 0x80, 0x04, 4, 0x38];
    bytes.extend(record(&[0, 0x51, 0]));
    bytes.extend(record(&damage_payload()));
    let mut stream = FrameStreams::default();
    assert_eq!(stream.push(&connection(), &bytes), vec![damage_payload()]);
}
