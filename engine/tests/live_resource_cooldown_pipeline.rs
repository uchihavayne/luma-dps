use luma_engine::{
    assistance::{AssistEvent, CastObservation},
    packets::{decode, Event},
    resources::{ResourceEvent, TicketReading, ODYLE_TICKET_ID},
    MeterEngine,
};

fn self_record(engine: &mut MeterEngine, actor: u64, name: &str, now: u64) {
    engine.ingest_event(
        Event::Identity {
            id: actor,
            name: name.into(),
            class: Some(14),
            own: true,
        },
        now,
    );
}

fn tickets(base: u32, bonus: u32) -> Event {
    Event::Resource(ResourceEvent::Snapshot {
        entries: vec![TicketReading {
            ticket_id: ODYLE_TICKET_ID,
            count: base,
            bonus,
            time_left_ms: 1234,
        }],
    })
}

fn change(base: u32) -> Event {
    Event::Resource(ResourceEvent::Change {
        reading: TicketReading {
            ticket_id: ODYLE_TICKET_ID,
            count: base,
            bonus: 0,
            time_left_ms: 1000,
        },
        reason: 1,
        gained: None,
    })
}

fn cooldown(skill: u32, value: u32) -> Vec<u8> {
    let mut frame = vec![0x47, 0x38, 1];
    frame.extend(skill.to_le_bytes());
    let mut value = value;
    loop {
        let part = (value & 127) as u8;
        value >>= 7;
        frame.push(if value == 0 { part } else { part | 128 });
        if value == 0 {
            break;
        }
    }
    frame
}

#[test]
fn login_resources_wait_for_authoritative_identity_and_change_is_absolute() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(tickets(401, 18), 1000);
    assert!(engine.live_state(1000).resources.awaiting_identity);
    assert!(engine.live_state(1000).resources.odyle.is_none());
    engine.ingest_event(
        Event::Identity {
            id: 7,
            name: "Local".into(),
            class: Some(14),
            own: false,
        },
        1100,
    );
    engine.set_character_name("Local");
    engine.set_local_player(Some(7), "Local").unwrap();
    assert!(engine.live_state(1200).resources.odyle.is_none());
    self_record(&mut engine, 7, "Local", 1300);
    let state = engine.live_state(1400);
    assert_eq!(state.resources.actor_id, Some(7));
    assert_eq!(state.resources.odyle.unwrap().total, 419);
    assert!(state.resources.snapshot_complete);
    let revision = state.character_revision;
    engine.ingest_event(change(350), 1500);
    let state = engine.live_state(1600);
    assert!(state.character_revision > revision);
    assert_eq!(state.resources.odyle.unwrap().total, 350);
}

#[test]
fn a_new_login_list_cannot_appear_on_the_previous_character() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(tickets(400, 0), 1000);
    self_record(&mut engine, 7, "First", 1100);
    assert_eq!(engine.resources_snapshot(1200).odyle.unwrap().base, 400);
    engine.ingest_event(tickets(200, 10), 2000);
    assert!(engine.resources_snapshot(2001).odyle.is_none());
    self_record(&mut engine, 8, "Second", 2100);
    let second = engine.resources_snapshot(2200);
    assert_eq!(second.actor_id, Some(8));
    assert_eq!(second.odyle.unwrap().total, 210);
    self_record(&mut engine, 9, "Third", 2300);
    assert!(engine.resources_snapshot(2400).odyle.is_none());
}

#[test]
fn loss_and_connection_change_do_not_reuse_cached_resource_identity() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(tickets(400, 0), 1000);
    self_record(&mut engine, 7, "Local", 1100);
    engine.capture_loss();
    assert!(engine.resources_snapshot(1200).odyle.is_none());
    engine.ingest_event(change(300), 1300);
    assert!(engine.resources_snapshot(1400).odyle.is_none());
    self_record(&mut engine, 7, "Local", 1500);
    assert_eq!(engine.resources_snapshot(1600).odyle.unwrap().base, 300);
    engine.connection_changed();
    assert!(engine.resources_snapshot(1700).odyle.is_none());
    assert!(engine.team_sync_payload(1700)["local"].is_null());
}

#[test]
fn delayed_login_resource_identity_does_not_bind_expired_pending_values() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(tickets(400, 0), 1000);
    self_record(&mut engine, 7, "Local", 32_000);
    assert!(engine.resources_snapshot(33_000).odyle.is_none());
}

#[test]
fn strict_cooldown_packet_parser_rejects_trailing_and_duplicate_records() {
    let frame = cooldown(13_130_000, 6000);
    assert!(matches!(decode(&frame), Ok(Some(Event::Updates(_)))));
    let mut trailing = frame.clone();
    trailing.push(0);
    assert!(decode(&trailing).is_err());
    let mut duplicate = frame.clone();
    duplicate[2] = 2;
    duplicate.extend_from_slice(&frame[3..]);
    assert!(decode(&duplicate).is_err());
    for state in [1, 3] {
        let mut unknown_charges = vec![0x22, 0x38, state];
        unknown_charges.extend(13_130_000u32.to_le_bytes());
        unknown_charges.extend([2, 100]);
        assert!(matches!(decode(&unknown_charges), Ok(None)));
    }
}

#[test]
fn received_cooldown_batch_keeps_raw_units_and_requires_self_record() {
    let frame = cooldown(13_130_000, 6000);
    let mut engine = MeterEngine::default();
    engine.ingest_event(decode(&frame).unwrap().unwrap(), 1000);
    assert!(engine.live_state(1100).cooldowns.is_empty());
    self_record(&mut engine, 7, "Local", 1200);
    engine.ingest_event(decode(&frame).unwrap().unwrap(), 1300);
    let row = &engine.live_state(1400).cooldowns[0];
    assert_eq!(row["raw_remaining_units"], 6000);
    assert!(row["estimated_remaining_ms"].is_null());
    assert!(row.get("remaining_ms").is_none());
    assert_eq!(row["source"], "local-server");
}

#[test]
fn only_completed_casts_populate_actor_bound_use_history_without_fake_cooldown() {
    let mut engine = MeterEngine::default();
    self_record(&mut engine, 7, "Local", 1000);
    let cast = CastObservation {
        actor_id: 8,
        skill_id: 14_090_000,
        target_id: 90,
        duration_ms: Some(1000),
        facing: 0.0,
        position: None,
    };
    engine.ingest_event(Event::Assistance(AssistEvent::Windup(cast.clone())), 1100);
    assert!(engine.live_state(1200).observed_casts.is_empty());
    engine.ingest_event(Event::Assistance(AssistEvent::Cast(cast)), 1300);
    let state = engine.live_state(1400);
    assert_eq!(state.observed_casts.len(), 1);
    assert_eq!(state.observed_casts[0].actor_id, 8);
    assert!(!state.observed_casts[0].ready_confirmed);
    assert!(state.cooldowns.is_empty());
    assert_eq!(state.party_membership_source, "unresolved");
    engine.capture_loss();
    assert!(engine.live_state(1500).observed_casts.is_empty());
}

#[test]
fn team_sync_uses_only_server_self_name_and_server_roster_membership() {
    let mut engine = MeterEngine::default();
    engine.ingest_event(
        Event::Identity {
            id: 7,
            name: "Local".into(),
            class: Some(14),
            own: false,
        },
        1000,
    );
    engine.set_local_player(Some(7), "PrivateAlias").unwrap();
    engine.set_party_members(&[7]).unwrap();
    let unconfirmed = engine.team_sync_payload(1100);
    assert!(unconfirmed["local"].is_null());
    assert_eq!(unconfirmed["party"]["source"], "unknown");
    assert_eq!(unconfirmed["party"]["members"].as_array().unwrap().len(), 0);
    self_record(&mut engine, 7, "Local", 1200);
    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Local".into(), "Ally".into()],
        },
        1300,
    );
    engine.ingest_event(
        Event::PartyProfiles {
            members: vec![("Ally".into(), 16)],
        },
        1300,
    );
    engine.ingest_event(
        Event::Cooldown {
            skill: 14_090_000,
            remaining_units: Some(0),
            charges: None,
        },
        1400,
    );
    let payload = engine.team_sync_payload(1500);
    assert_eq!(payload["local"]["name"], "Local");
    assert_eq!(payload["local"]["actor_id"], 7);
    assert_eq!(payload["local"]["identity_source"], "server");
    assert_eq!(payload["party"]["source"], "server");
    assert_eq!(payload["party"]["members"][1]["name"], "Ally");
    assert_eq!(
        engine.live_state(1500).party_identity_roster,
        payload["party"]
    );
    assert!(payload["party"]["members"][1]["actor_id"].is_null());
    assert!(!payload.to_string().contains("PrivateAlias"));
    assert!(payload.get("resources").is_none());
    assert_eq!(payload["cooldowns"][0]["actor_id"], 7);
    engine.capture_loss();
    let after_gap = engine.team_sync_payload(1600);
    assert_eq!(after_gap["party"]["source"], "unknown");
    assert!(after_gap["party"]["members"].as_array().unwrap().is_empty());
    assert_eq!(
        engine.live_state(1600).party_identity_roster["source"],
        "unknown"
    );
    engine.ingest_event(
        Event::PartyRoster {
            names: vec!["Local".into(), "Ally".into()],
        },
        1700,
    );
    assert_eq!(engine.team_sync_payload(1800)["party"]["source"], "server");
}

fn tcp(sequence: u32, flags: u8, payload: &[u8]) -> Vec<u8> {
    let mut packet = vec![0u8; 40];
    packet[0] = 0x45;
    packet[2..4].copy_from_slice(&((40 + payload.len()) as u16).to_be_bytes());
    packet[9] = 6;
    packet[12..16].copy_from_slice(&[10, 0, 0, 1]);
    packet[16..20].copy_from_slice(&[10, 0, 0, 2]);
    packet[20..22].copy_from_slice(&7777u16.to_be_bytes());
    packet[22..24].copy_from_slice(&50000u16.to_be_bytes());
    packet[24..28].copy_from_slice(&sequence.to_be_bytes());
    packet[32] = 0x50;
    packet[33] = flags;
    packet.extend_from_slice(payload);
    packet
}

#[test]
fn resource_login_packet_reaches_store_through_actual_server_framing_only() {
    let mut frame = vec![0x0b, 0x61, 1, 4];
    frame.extend(ODYLE_TICKET_ID.to_le_bytes());
    frame.extend([0x90, 0x03]); // 400 as canonical varint.
    let mut wire = vec![(frame.len() + 4) as u8];
    wire.extend(frame);
    let mut engine = MeterEngine::default();
    engine.ingest_tcp(&tcp(100, 0x18, &wire), false, 1000);
    assert!(!engine.live_state(1000).resources.awaiting_identity);
    engine.ingest_tcp(&tcp(100, 0x18, &wire), true, 1100);
    assert!(engine.live_state(1100).resources.awaiting_identity);
    self_record(&mut engine, 7, "Local", 1200);
    assert_eq!(engine.resources_snapshot(1300).odyle.unwrap().base, 400);
    engine.ingest_tcp(&tcp(200, 0x02, &[]), true, 1400);
    assert!(engine.resources_snapshot(1500).odyle.is_none());
}
