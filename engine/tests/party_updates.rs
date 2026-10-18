use luma_engine::{
    packets::{decode, Event, Hit, PartyMember},
    MeterEngine,
};

fn member(name: &str, key: u32, slot: u8) -> PartyMember {
    PartyMember {
        key,
        server: 1304,
        slot,
        name: name.into(),
        class: 14,
    }
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

fn apply(engine: &mut MeterEngine, bytes: &[u8], now: u64) {
    engine.ingest_event(decode(bytes).unwrap().unwrap(), now);
}

fn update(value: &PartyMember) -> Vec<u8> {
    let mut frame = vec![0x1f, 0x97, 0x7e, value.slot];
    frame.extend(value.key.to_le_bytes());
    frame.extend([0, 0]);
    frame.extend(value.server.to_le_bytes());
    frame.push(value.name.len() as u8);
    frame.extend(value.name.as_bytes());
    for number in [value.class, 50, 5000] {
        frame.extend(number.to_le_bytes());
    }
    frame.push(3);
    frame.extend(value.server.to_le_bytes());
    frame.extend(4024u16.to_le_bytes());
    frame.push(4);
    frame.extend(850_000u64.to_le_bytes());
    frame.extend([1, 2, 1, 0, 0, 0, 200, 0, 0, 0, 0, 0, 0, 0, 1]);
    frame
}

fn removal(value: &PartyMember) -> Vec<u8> {
    let mut frame = vec![0x22, 0x96];
    frame.extend(value.key.to_le_bytes());
    frame.extend([0, 0]);
    frame.extend(value.server.to_le_bytes());
    frame.extend([1, 2, 3, 4]);
    frame
}

fn profile(id: u32, server: u16, name: &str) -> Vec<u8> {
    let mut frame = vec![0, 0x92, 3, 0];
    frame.extend(id.to_le_bytes());
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

fn cast(actor: u8, duration: u32) -> Vec<u8> {
    let mut bytes = vec![2, 0x38, actor, 0];
    bytes.extend(14_220_050u32.to_le_bytes());
    bytes.extend([1, 0, actor]);
    bytes.extend(0f32.to_le_bytes());
    bytes.extend([0, 0]);
    let mut remaining = duration;
    loop {
        let low = (remaining & 127) as u8;
        remaining >>= 7;
        bytes.push(if remaining == 0 { low } else { low | 128 });
        if remaining == 0 {
            break;
        }
    }
    bytes
}

#[test]
fn incremental_members_keep_same_class_healers_and_bind_uid_before_any_damage() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    let ally = member("Healer", 1002, 3);
    engine.ingest_event(
        Event::PartyMembers {
            members: vec![member("Local", 1001, 1)],
        },
        10,
    );
    apply(&mut engine, &update(&ally), 20);
    let state = engine.live_state(20);
    assert_eq!(state.party_identity_roster["source"], "server");
    assert_eq!(state.party_identity_roster["complete"], false);
    assert_eq!(
        state.party_identity_roster["members"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    apply(&mut engine, &profile(2, 1304, "Healer"), 30);
    apply(&mut engine, &cast(2, 81_100), 40);
    let state = engine.live_state(500);
    assert!(state.players.is_empty());
    let row = state.party_identity_roster["members"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["name"] == "Healer")
        .unwrap();
    assert_eq!(row["actor_id"], 2);
    assert_eq!(row["identity_confirmed"], true);
    assert_eq!(row["class_name"], "Ranger");
    assert_eq!(state.actor_cooldowns[0].actor_id, 2);
    assert_eq!(state.actor_cooldowns[0].remaining_ms, Some(80_640));
    assert_eq!(state.local_player_id, Some(1));
}

#[test]
fn profile_records_cannot_create_membership_or_promote_an_own_character() {
    let mut engine = MeterEngine::default();
    apply(&mut engine, &profile(2, 1304, "Healer"), 10);
    assert_eq!(engine.party_identity_roster()["source"], "unknown");
    assert_eq!(engine.live_state(10).local_player_id, None);
    engine.ingest_event(
        Event::PartyMembers {
            members: vec![member("Healer", 50, 3)],
        },
        20,
    );
    // The profile identifies the actor immediately. Membership still requires
    // its exact home-server/name pair in the current received roster.
    assert_eq!(engine.party_identity_roster()["members"][0]["actor_id"], 2);
    apply(&mut engine, &profile(2, 1401, "Healer"), 30);
    assert!(engine.party_identity_roster()["members"][0]["actor_id"].is_null());
    apply(&mut engine, &profile(2, 1304, "Healer"), 40);
    assert_eq!(engine.party_identity_roster()["members"][0]["actor_id"], 2);
    assert_eq!(engine.live_state(40).local_player_id, None);
    let mut malformed = profile(2, 1304, "Healer");
    malformed[4 + 9] = b'Z';
    assert!(decode(&malformed).is_err());
    let mut mismatched = profile(2, 1304, "Healer");
    mismatched[4 + 51] ^= 1;
    assert!(decode(&mismatched).is_err());
}

#[test]
fn removals_are_key_and_server_bound_and_self_leave_clears_live_roster() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    let local = member("Local", 1001, 1);
    let ally = member("Healer", 1002, 3);
    engine.ingest_event(
        Event::PartyMembers {
            members: vec![local.clone(), ally.clone()],
        },
        10,
    );
    let mut wrong = ally.clone();
    wrong.server = 1401;
    apply(&mut engine, &removal(&wrong), 20);
    assert_eq!(
        engine.party_identity_roster()["members"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    apply(&mut engine, &removal(&ally), 30);
    assert_eq!(
        engine.party_identity_roster()["members"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    apply(&mut engine, &removal(&local), 40);
    assert_eq!(engine.party_identity_roster()["source"], "unknown");
    assert!(engine.party_identity_roster()["members"]
        .as_array()
        .unwrap()
        .is_empty());
    assert_eq!(engine.live_state(40).local_player_id, Some(1));
}

#[test]
fn slot_replacement_and_duplicate_cross_server_names_never_guess_actor_bindings() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 2, "Healer", false);
    engine.ingest_event(
        Event::PartyMembers {
            members: vec![member("Healer", 1002, 3)],
        },
        10,
    );
    let replacement = member("Other", 1003, 3);
    apply(&mut engine, &update(&replacement), 20);
    assert_eq!(
        engine.party_identity_roster()["members"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        engine.party_identity_roster()["members"][0]["name"],
        "Other"
    );
    let mut duplicate = member("Healer", 1004, 4);
    duplicate.server = 1401;
    engine.ingest_event(
        Event::PartyMembers {
            members: vec![member("Healer", 1002, 2), duplicate],
        },
        30,
    );
    assert!(engine.party_identity_roster()["members"]
        .as_array()
        .unwrap()
        .iter()
        .all(|row| row["name"] != "Healer"));
}

#[test]
fn gap_and_identity_reuse_clear_live_evidence_without_rewriting_captured_history() {
    let mut engine = MeterEngine::default();
    identity(&mut engine, 1, "Local", true);
    identity(&mut engine, 2, "Healer", false);
    engine.ingest_event(
        Event::PartyMembers {
            members: vec![member("Local", 1, 1), member("Healer", 2, 2)],
        },
        10,
    );
    apply(&mut engine, &cast(2, 50_000), 20);
    engine.ingest_event(
        Event::Damage(Hit {
            source: 2,
            target: 9,
            skill: 14_220_050,
            amount: 100,
            critical: false,
            tick: false,
            flags: 0,
            angle: 0,
        }),
        30,
    );
    engine.reset();
    let history = engine.history_snapshot().1;
    engine.capture_loss();
    assert_eq!(engine.party_identity_roster()["source"], "unknown");
    assert!(engine.live_state(40).actor_cooldowns.is_empty());
    assert_eq!(
        serde_json::to_value(engine.history_snapshot().1).unwrap(),
        serde_json::to_value(history).unwrap()
    );
    apply(&mut engine, &update(&member("Healer", 2, 2)), 50);
    apply(&mut engine, &cast(2, 50_000), 60);
    identity(&mut engine, 2, "Different", false);
    assert!(engine.live_state(70).actor_cooldowns.is_empty());
    assert!(engine.party_identity_roster()["members"][0]["actor_id"].is_null());
}

#[test]
fn incomplete_member_prefixes_and_out_of_range_handles_are_not_roster_updates() {
    let valid = update(&member("Healer", 1002, 3));
    assert!(matches!(
        decode(&valid),
        Ok(Some(Event::PartyMembers { .. }))
    ));
    assert!(decode(&valid[..valid.len() - 8]).is_err());
    let mut bad = valid.clone();
    bad[3] = 0;
    assert!(decode(&bad).is_err());
    let mut bad = valid.clone();
    bad[4..8].fill(0);
    assert!(decode(&bad).is_err());
    let mut bad = valid.clone();
    bad[10..12].copy_from_slice(&9u16.to_le_bytes());
    assert!(decode(&bad).is_err());
}
