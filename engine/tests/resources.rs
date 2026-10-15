use luma_engine::resources::{
    decode, ResourceEvent, ResourceStore, TicketReading, ODYLE_TICKET_ID,
};

fn variable(mut value: u32) -> Vec<u8> {
    let mut output = Vec::new();
    loop {
        let next = (value & 0x7f) as u8;
        value >>= 7;
        output.push(if value == 0 { next } else { next | 0x80 });
        if value == 0 {
            return output;
        }
    }
}

fn entry(id: u32, mask: u8, count: u32, bonus: u32, time: u64) -> Vec<u8> {
    let mut output = vec![mask];
    output.extend(id.to_le_bytes());
    if mask & 1 != 0 {
        output.extend(time.to_le_bytes());
    }
    if mask & 4 != 0 {
        output.extend(variable(count));
    }
    if mask & 8 != 0 {
        output.extend(variable(bonus));
    }
    output
}

fn list(entries: &[Vec<u8>]) -> Vec<u8> {
    let mut output = vec![0x0b, 0x61, entries.len() as u8];
    for value in entries {
        output.extend(value);
    }
    output
}

fn change(value: Vec<u8>, reason: u8, gained: Option<u32>) -> Vec<u8> {
    let mut output = vec![0x0c, 0x61, u8::from(gained.is_some())];
    output.extend(value);
    output.push(reason);
    if let Some(gain) = gained {
        output.extend(gain.to_le_bytes());
    }
    output
}

fn event(bytes: &[u8]) -> ResourceEvent {
    decode(bytes).unwrap().unwrap()
}

fn membership(start: u64, end: u64) -> Vec<u8> {
    let mut output = vec![0x3b, 0xe3, 9];
    for id in 34u32..=42 {
        output.extend(id.to_le_bytes());
        output.push(0);
        output.extend(start.to_le_bytes());
        output.extend(end.to_le_bytes());
    }
    output
}

#[test]
fn exact_login_list_handles_zeroes_and_all_documented_field_masks() {
    let entries = vec![
        entry(ODYLE_TICKET_ID, 12, 75, 520, 0),
        entry(7, 4, 28, 0, 0),
        entry(3, 1, 0, 0, 25_200_000),
        entry(80000001, 0, 0, 0, 0),
    ];
    let ResourceEvent::Snapshot { entries: decoded } = event(&list(&entries)) else {
        panic!()
    };
    assert_eq!(decoded.len(), 4);
    assert_eq!(
        decoded[0],
        TicketReading {
            ticket_id: ODYLE_TICKET_ID,
            count: 75,
            bonus: 520,
            time_left_ms: 0
        }
    );
    assert_eq!(decoded[2].time_left_ms, 25_200_000);
    assert_eq!(decoded[3].count, 0);
    assert_eq!(
        event(&list(&[])),
        ResourceEvent::Snapshot { entries: vec![] }
    );
}

#[test]
fn ticket_id_is_fixed_little_endian_not_a_variable_actor_id() {
    let bytes = change(entry(ODYLE_TICKET_ID, 8, 0, 640, 0), 1, Some(10));
    let ResourceEvent::Change {
        reading,
        reason,
        gained,
    } = event(&bytes)
    else {
        panic!()
    };
    assert_eq!(reading.ticket_id, ODYLE_TICKET_ID);
    assert_eq!(
        (reading.count, reading.bonus, reason, gained),
        (0, 640, 1, Some(10))
    );
    let mut store = ResourceStore::default();
    store.bind_self(8, "Archer", 1);
    store.ingest(event(&change(entry(74292, 12, 1, 20, 0), 1, Some(1))), 2);
    assert!(store.snapshot(2).odyle.is_none());
    assert_eq!(store.snapshot(2).tickets[0].ticket_id, 74292);
}

#[test]
fn malformed_lengths_masks_duplicate_ids_and_varints_fail_closed() {
    let sample = list(&[entry(ODYLE_TICKET_ID, 12, 540, 1200, 0)]);
    for end in 0..sample.len() {
        assert!(decode(&sample[..end]).is_err());
    }
    let mut trailing = sample.clone();
    trailing.push(0);
    assert!(decode(&trailing).is_err());
    assert!(decode(&list(&[entry(2, 2, 0, 0, 0)])).is_err());
    assert!(decode(&list(&[entry(2, 0, 0, 0, 0), entry(2, 4, 1, 0, 0)])).is_err());
    assert!(decode(&list(&[entry(0, 0, 0, 0, 0)])).is_err());
    for malformed in [
        vec![0x80, 0],
        vec![0xff, 0xff, 0xff, 0xff, 0xff],
        vec![0x80; 6],
    ] {
        let mut bytes = vec![0x0c, 0x61, 0, 4];
        bytes.extend(ODYLE_TICKET_ID.to_le_bytes());
        bytes.extend(malformed);
        bytes.push(3);
        assert!(decode(&bytes).is_err());
    }
    let mut unknown_flag = change(entry(ODYLE_TICKET_ID, 0, 0, 0, 0), 3, None);
    unknown_flag[2] = 2;
    assert!(decode(&unknown_flag).is_err());
    assert!(decode(&change(
        entry(ODYLE_TICKET_ID, 4, 10_000_001, 0, 0),
        1,
        None
    ))
    .is_err());
    assert!(decode(&[0x12, 0x34]).unwrap().is_none());
}

#[test]
fn login_data_waits_for_new_self_and_never_appears_under_previous_character() {
    let mut store = ResourceStore::default();
    store.bind_self(1, "Old", 1000);
    store.ingest(
        event(&change(entry(ODYLE_TICKET_ID, 12, 200, 45, 0), 2, None)),
        1100,
    );
    assert_eq!(store.snapshot(1100).odyle.unwrap().total, 245);
    store.ingest(
        event(&list(&[entry(ODYLE_TICKET_ID, 12, 540, 120, 0)])),
        2000,
    );
    let pending = store.snapshot(2000);
    assert_eq!(pending.actor_id, None);
    assert!(pending.awaiting_identity);
    assert!(pending.odyle.is_none());
    store.bind_self(2, "New", 6500);
    let current = store.snapshot(6500);
    assert_eq!(current.actor_id, Some(2));
    assert!(current.snapshot_complete);
    assert_eq!(current.odyle.unwrap().total, 660);
}

#[test]
fn snapshot_missing_odyle_is_unknown_while_present_zero_is_zero() {
    let mut store = ResourceStore::default();
    store.ingest(event(&list(&[entry(7, 4, 10, 0, 0)])), 1000);
    store.bind_self(1, "First", 1100);
    assert!(store.snapshot(1100).odyle.is_none());
    store.ingest(event(&list(&[entry(ODYLE_TICKET_ID, 0, 0, 0, 0)])), 2000);
    store.bind_self(1, "First", 2200);
    assert_eq!(store.snapshot(2200).odyle.unwrap().total, 0);
}

#[test]
fn update_fields_are_absolute_and_omission_does_not_keep_stale_base_or_bonus() {
    let mut store = ResourceStore::default();
    store.bind_self(1, "First", 1000);
    store.ingest(
        event(&change(entry(ODYLE_TICKET_ID, 12, 75, 520, 0), 1, Some(10))),
        1100,
    );
    store.ingest(
        event(&change(entry(ODYLE_TICKET_ID, 8, 0, 530, 0), 1, Some(10))),
        1200,
    );
    let value = store.snapshot(1200).odyle.unwrap();
    assert_eq!((value.base, value.bonus, value.total), (0, 530, 530));
    assert!(!store.snapshot(1200).snapshot_complete);
    store.ingest(
        event(&change(entry(ODYLE_TICKET_ID, 0, 0, 0, 0), 3, None)),
        1300,
    );
    assert_eq!(store.snapshot(1300).odyle.unwrap().total, 0);
}

#[test]
fn gap_clear_switch_and_expired_pending_do_not_restore_previous_values() {
    let mut store = ResourceStore::default();
    store.ingest(event(&list(&[entry(ODYLE_TICKET_ID, 4, 100, 0, 0)])), 1000);
    assert!(!store.snapshot(31001).awaiting_identity);
    store.bind_self(1, "First", 31001);
    assert!(store.snapshot(31001).odyle.is_none());
    store.ingest(
        event(&change(entry(ODYLE_TICKET_ID, 4, 50, 0, 0), 3, None)),
        32000,
    );
    store.bind_self(2, "Second", 33000);
    assert!(store.snapshot(33000).odyle.is_none());
    store.ingest(
        event(&change(entry(ODYLE_TICKET_ID, 4, 40, 0, 0), 3, None)),
        34000,
    );
    store.clear();
    assert!(store.snapshot(35000).odyle.is_none());
    assert!(store.snapshot(35000).actor_id.is_none());
}

#[test]
fn out_of_order_updates_do_not_replace_a_newer_absolute_value() {
    let mut store = ResourceStore::default();
    store.bind_self(1, "First", 1000);
    store.ingest(
        event(&change(entry(ODYLE_TICKET_ID, 4, 500, 0, 0), 2, None)),
        3000,
    );
    store.ingest(
        event(&change(entry(ODYLE_TICKET_ID, 4, 450, 0, 0), 3, None)),
        2000,
    );
    assert_eq!(store.snapshot(3000).odyle.unwrap().base, 500);
    assert_eq!(store.snapshot(3000).observed_at_ms, Some(3000));
}

#[test]
fn full_membership_evidence_yields_separate_rule_capacity_and_expiry() {
    let start = 1_790_000_000_000;
    let end = start + 86_400_000;
    let mut store = ResourceStore::default();
    store.bind_self(1, "First", start);
    store.ingest(
        event(&change(entry(ODYLE_TICKET_ID, 12, 800, 900, 0), 2, None)),
        start + 1,
    );
    assert_eq!(store.snapshot(start + 1).odyle.unwrap().base_capacity, None);
    store.ingest(event(&membership(start, end)), start + 2);
    let value = store.snapshot(start + 2).odyle.unwrap();
    assert_eq!(value.base_capacity, Some(840));
    assert_eq!(value.total, 1700);
    assert_eq!(value.capacity_source.as_deref(), Some("membership-rule"));
    assert!(!value.capacity_mismatch);
    // The observed value stays 800 after expiry; a conflicting rule never
    // clamps it or pretends the base has fallen to 560.
    let expired = store.snapshot(end).odyle.unwrap();
    assert_eq!(expired.base, 800);
    assert_eq!(expired.membership_active, Some(false));
    assert!(expired.capacity_mismatch);
    assert_eq!(expired.base_capacity, None);
}

#[test]
fn membership_decoder_rejects_partial_conflicting_trailing_and_wrong_endian_data() {
    let start = 1_790_000_000_000;
    let end = start + 86_400_000;
    let bytes = membership(start, end);
    assert!(
        matches!(event(&bytes), ResourceEvent::Membership { expires_at_ms: Some(value) } if value == end)
    );
    for length in 2..bytes.len() {
        assert!(decode(&bytes[..length]).is_err());
    }
    let mut partial = bytes[..24].to_vec();
    partial[2] = 1;
    assert!(decode(&partial).is_err());
    let mut conflicting = bytes.clone();
    conflicting[37] ^= 1;
    assert!(decode(&conflicting).is_err());
    let mut trailing = bytes.clone();
    trailing.push(0);
    assert!(decode(&trailing).is_err());
    assert!(decode(&[0xe3, 0x3b, 0]).unwrap().is_none());
    assert_eq!(
        event(&[0x3b, 0xe3, 0]),
        ResourceEvent::Membership {
            expires_at_ms: None
        }
    );
}

#[test]
fn no_membership_snapshot_means_capacity_unknown_and_new_login_clears_it() {
    let mut store = ResourceStore::default();
    store.bind_self(1, "First", 1000);
    store.ingest(event(&[0x3b, 0xe3, 0]), 1100);
    store.ingest(
        event(&change(entry(ODYLE_TICKET_ID, 4, 500, 0, 0), 2, None)),
        1200,
    );
    assert_eq!(store.snapshot(1200).odyle.unwrap().base_capacity, Some(560));
    store.ingest(event(&list(&[entry(ODYLE_TICKET_ID, 4, 200, 0, 0)])), 2000);
    store.bind_self(2, "Second", 2100);
    assert_eq!(store.snapshot(2100).odyle.unwrap().base_capacity, None);
}

#[test]
fn arbitrary_packet_inputs_are_bounded_and_never_panic() {
    let mut seed = 0x4c554d41u64;
    for size in 0..2048 {
        let mut bytes = Vec::with_capacity(size);
        for _ in 0..size {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
            bytes.push((seed >> 32) as u8);
        }
        if size >= 2 {
            bytes[..2].copy_from_slice(if size % 2 == 0 {
                &[0x0b, 0x61]
            } else {
                &[0x0c, 0x61]
            });
        }
        let _ = decode(&bytes);
    }
    assert!(decode(&vec![0x0b; 20_000]).unwrap().is_none());
    let mut too_large = vec![0; 20_000];
    too_large[..2].copy_from_slice(&[0x0b, 0x61]);
    assert!(decode(&too_large).is_err());
}
