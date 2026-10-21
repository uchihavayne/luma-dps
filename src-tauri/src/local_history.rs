use luma_engine::{spatial, Encounter};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fs, path::Path};

const MAX_BYTES: usize = 32 * 1024 * 1024;
const MAX_RECORDS: usize = 200;
const HEADER: &[u8] = br#"{"type":"luma-history","version":1,"encounters":["#;
// Past this size the oldest records lose detail instead of the document losing records,
// which also leaves room for new encounters before the hard limit.
const TARGET_BYTES: usize = MAX_BYTES / 4 * 3;
// Within each stage the newest records are thinned only after every older record has been.
const KEEP_DETAILED: usize = 8;
const PASSES: usize = 5;

#[derive(Serialize, Deserialize)]
struct Document {
    #[serde(rename = "type")]
    kind: String,
    version: u32,
    encounters: Vec<Encounter>,
}

pub fn parse(bytes: &[u8]) -> Result<Vec<Encounter>, String> {
    if bytes.len() > MAX_BYTES {
        return Err("History exceeds the 32 MB limit".into());
    }
    let document: Document =
        serde_json::from_slice(bytes).map_err(|_| "History is not valid Luma JSON")?;
    if document.kind != "luma-history"
        || document.version != 1
        || document.encounters.len() > MAX_RECORDS
    {
        return Err("Unsupported history format or encounter count".into());
    }
    Ok(document.encounters)
}

pub fn load(path: &Path) -> Result<Vec<Encounter>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let metadata = fs::metadata(path).map_err(|e| format!("Cannot read history: {e}"))?;
    if metadata.len() > MAX_BYTES as u64 {
        return Err("History exceeds the 32 MB limit".into());
    }
    parse(&fs::read(path).map_err(|e| format!("Cannot read history: {e}"))?)
}

/// Keeps every `step`-th point of each actor's track, plus its last point.
fn decimate(track: &mut Vec<spatial::Point>, step: usize) {
    let mut totals: BTreeMap<u64, usize> = BTreeMap::new();
    for point in track.iter() {
        *totals.entry(point.actor_id).or_default() += 1;
    }
    let mut seen: BTreeMap<u64, usize> = BTreeMap::new();
    track.retain(|point| {
        let index = seen.entry(point.actor_id).or_default();
        let keep = *index % step == 0 || *index + 1 == totals[&point.actor_id];
        *index += 1;
        keep
    });
}

/// One thinning step, ordered by what the user loses: replay detail first, comparison and
/// sharing eligibility last. Totals, players, targets and skills are never changed; the
/// existing completeness flags tell every consumer that the detail is partial.
fn thin(record: &mut Encounter, pass: usize) -> bool {
    match pass {
        0 => {
            let before = record.spatial.track.len();
            let aims = std::mem::take(&mut record.spatial.aims);
            decimate(&mut record.spatial.track, 4);
            let changed = !aims.is_empty() || record.spatial.track.len() != before;
            record.spatial.retention_limited |= changed;
            changed
        }
        1 => {
            let changed = !record.spatial.track.is_empty();
            record.spatial.track.clear();
            record.spatial.retention_limited |= changed;
            changed
        }
        2 => {
            let changed =
                !record.assist.timeline.is_empty() || !record.assist.health_history.is_empty();
            record.assist.timeline.clear();
            record.assist.health_history.clear();
            record.assist.retention_limited |= changed;
            changed
        }
        3 => {
            // Already incomplete records cannot be compared or shared, so only partial detail goes.
            let samples = !record.sample_complete
                && !(record.damage_samples.is_empty() && record.received_samples.is_empty());
            let healing = !record.healing_sample_complete && !record.healing_samples.is_empty();
            if samples {
                record.damage_samples.clear();
                record.received_samples.clear();
            }
            if healing {
                record.healing_samples.clear();
            }
            samples || healing
        }
        _ => {
            let samples = !(record.damage_samples.is_empty() && record.received_samples.is_empty());
            let healing = !record.healing_samples.is_empty();
            record.damage_samples.clear();
            record.received_samples.clear();
            record.healing_samples.clear();
            if samples {
                record.sample_complete = false;
            }
            if healing {
                record.healing_sample_complete = false;
            }
            samples || healing
        }
    }
}

fn document_len(rows: usize, count: usize) -> usize {
    HEADER.len() + rows + count.saturating_sub(1) + 2
}

fn encode(records: &[Encounter]) -> Result<(Vec<u8>, usize), String> {
    encode_with(records, TARGET_BYTES, MAX_BYTES)
}

/// `records` are newest first. Over `target` the oldest records are thinned step by step;
/// a record is dropped only if the document still exceeds `max` after everything is thinned.
fn encode_with(
    records: &[Encounter],
    target: usize,
    max: usize,
) -> Result<(Vec<u8>, usize), String> {
    let records = &records[..records.len().min(MAX_RECORDS)];
    let encode_row = |record: &Encounter| {
        serde_json::to_vec(record).map_err(|e| format!("Cannot encode history: {e}"))
    };
    let mut rows = records.iter().map(encode_row).collect::<Result<Vec<_>, _>>()?;
    let mut total: usize = rows.iter().map(Vec::len).sum();
    let mut work: Vec<Option<Encounter>> = vec![None; records.len()];
    let mut applied = vec![0usize; records.len()];
    // Each stage runs its steps over the older records first, then the newest ones. Samples
    // come last for everyone: they decide whether a record can be compared or shared.
    let newest = KEEP_DETAILED.min(records.len());
    let stages = [(0..3, newest), (0..3, 0), (3..4, newest), (3..4, 0), (4..5, newest), (4..5, 0)];
    'fit: for (passes, protected) in stages {
        for pass in passes {
            for index in (protected..records.len()).rev() {
                if document_len(total, rows.len()) <= target {
                    break 'fit;
                }
                if applied[index] > pass {
                    continue;
                }
                applied[index] = pass + 1;
                let record = work[index].get_or_insert_with(|| records[index].clone());
                if !thin(record, pass) {
                    continue;
                }
                let row = encode_row(record)?;
                total = total - rows[index].len() + row.len();
                rows[index] = row;
            }
        }
    }
    let mut bytes = HEADER.to_vec();
    let mut retained = 0;
    for row in &rows {
        if bytes.len().saturating_add(row.len()).saturating_add(3) > max {
            if retained == 0 {
                return Err("The newest encounter exceeds the history storage limit".into());
            }
            break;
        }
        if retained != 0 {
            bytes.push(b',');
        }
        bytes.extend(row);
        retained += 1;
    }
    bytes.extend(b"]}");
    Ok((bytes, retained))
}

pub fn save(path: &Path, records: &[Encounter]) -> Result<usize, String> {
    let (bytes, retained) = encode(records)?;
    let directory = path.parent().ok_or("History directory is unavailable")?;
    fs::create_dir_all(directory).map_err(|e| format!("Cannot create history directory: {e}"))?;
    let temporary = path.with_extension("json.new");
    fs::write(&temporary, bytes).map_err(|e| format!("Cannot save history: {e}"))?;
    fs::rename(&temporary, path).map_err(|e| format!("Cannot replace history: {e}"))?;
    Ok(retained)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn captured_scope_and_names_survive_a_disk_document_roundtrip() {
        let row = Encounter {
            id: 3,
            local_player_id: Some(10),
            local_player_name: "TestPlayer".into(),
            personal_total_damage: Some(100),
            total_damage: 900,
            local_identity_source: "server".into(),
            started_ms: 1000,
            ended_ms: 2000,
            ..Default::default()
        };
        let (bytes, retained) = encode(&[row]).unwrap();
        let records = parse(&bytes).unwrap();
        assert_eq!(retained, 1);
        assert_eq!(records[0].personal_total_damage, Some(100));
        assert_eq!(records[0].total_damage, 900);
        assert_eq!(records[0].local_player_name, "TestPlayer");
    }

    #[test]
    fn corrupt_or_foreign_history_is_rejected_and_legacy_records_are_readable() {
        assert!(parse(b"{broken}").is_err());
        assert!(parse(br#"{"type":"foreign","version":1,"encounters":[]}"#).is_err());
        assert!(parse(br#"{"type":"luma-history","version":99,"encounters":[]}"#).is_err());
        let legacy = parse(
            br#"{"type":"luma-history","version":1,"encounters":[{"id":1,"total_damage":100}]}"#,
        )
        .unwrap();
        assert_eq!(legacy[0].total_damage, 100);
        assert!(legacy[0].personal_total_damage.is_none());
        assert!(legacy[0].local_player_id.is_none());
    }

    #[test]
    fn storage_keeps_newest_records_in_order_and_caps_record_count() {
        let records: Vec<_> = (1..=205)
            .rev()
            .map(|id| Encounter {
                id,
                total_damage: id,
                ..Default::default()
            })
            .collect();
        let (bytes, retained) = encode(&records).unwrap();
        let read = parse(&bytes).unwrap();
        assert_eq!(retained, 200);
        assert_eq!(read[0].id, 205);
        assert_eq!(read[199].id, 6);
    }

    fn heavy(id: u64, complete: bool) -> Encounter {
        let point = |i: u64| spatial::Point {
            actor_id: i % 3 + 1,
            at_ms: i,
            present: true,
            source: "server-position".into(),
            ..Default::default()
        };
        Encounter {
            id,
            total_damage: id * 10,
            personal_total_damage: Some(id),
            started_ms: 1,
            ended_ms: 2,
            sample_complete: complete,
            damage_samples: (0..120)
                .map(|i| luma_engine::DamageSample {
                    timestamp_ms: i,
                    amount: 5,
                    metric: "damage".into(),
                    ..Default::default()
                })
                .collect(),
            spatial: spatial::Snapshot {
                track: (0..300).map(point).collect(),
                aims: (0..60)
                    .map(|i| spatial::Aim {
                        actor_id: 1,
                        skill_id: i,
                        ..Default::default()
                    })
                    .collect(),
                ..Default::default()
            },
            assist: luma_engine::assistance::AssistSnapshot {
                timeline: (0..80)
                    .map(|i| luma_engine::assistance::AssistTimelineEvent {
                        kind: "cast".into(),
                        at_ms: i,
                        actor_id: 1,
                        skill_id: Some(7),
                        target_id: 2,
                        instance_id: None,
                    })
                    .collect(),
                ..Default::default()
            },
            ..Default::default()
        }
    }

    fn history(count: u64, complete: bool) -> Vec<Encounter> {
        (1..=count).rev().map(|id| heavy(id, complete)).collect()
    }

    fn size(records: &[Encounter]) -> usize {
        records
            .iter()
            .map(|record| serde_json::to_vec(record).unwrap().len())
            .sum()
    }

    fn thinned_size(record: &Encounter, passes: usize) -> usize {
        let mut trimmed = record.clone();
        for pass in 0..passes {
            thin(&mut trimmed, pass);
        }
        serde_json::to_vec(&trimmed).unwrap().len()
    }

    #[test]
    fn a_history_under_the_target_is_stored_unchanged() {
        let records = history(5, true);
        let (bytes, retained) = encode_with(&records, usize::MAX / 2, usize::MAX / 2).unwrap();
        let read = parse(&bytes).unwrap();
        assert_eq!(retained, 5);
        for (stored, original) in read.iter().zip(&records) {
            assert_eq!(stored.damage_samples.len(), original.damage_samples.len());
            assert_eq!(stored.spatial.track.len(), original.spatial.track.len());
            assert_eq!(stored.spatial.aims.len(), original.spatial.aims.len());
            assert!(stored.sample_complete);
            assert!(!stored.spatial.retention_limited);
        }
    }

    #[test]
    fn the_oldest_records_lose_detail_before_any_record_is_dropped() {
        let records = history(40, true);
        let full = size(&records);
        let target = full * 7 / 10;
        let (bytes, retained) = encode_with(&records, target, full).unwrap();
        let read = parse(&bytes).unwrap();
        assert_eq!(retained, 40);
        assert!(bytes.len() <= target, "{} > {target}", bytes.len());
        for (stored, original) in read.iter().zip(&records) {
            assert_eq!(stored.id, original.id);
            assert_eq!(stored.total_damage, original.total_damage);
            assert_eq!(stored.personal_total_damage, original.personal_total_damage);
        }
        // The newest records keep everything; the oldest are the ones that were thinned.
        assert!(read[..KEEP_DETAILED]
            .iter()
            .all(|record| record.spatial.aims.len() == 60 && record.spatial.track.len() == 300));
        let oldest = read.last().unwrap();
        assert!(oldest.spatial.aims.is_empty() && oldest.spatial.retention_limited);
        assert!(oldest.spatial.track.len() < 300);
    }

    #[test]
    fn samples_of_complete_records_are_the_last_detail_to_go() {
        let records = history(40, true);
        let without_replay_and_assist: usize =
            records.iter().map(|record| thinned_size(record, 3)).sum();
        // Replay and assist detail alone reach this target, so no sample may be touched.
        let target = document_len(without_replay_and_assist, records.len());
        let (bytes, retained) = encode_with(&records, target, size(&records)).unwrap();
        let read = parse(&bytes).unwrap();
        assert_eq!(retained, 40);
        assert!(read
            .iter()
            .all(|record| record.sample_complete && record.damage_samples.len() == 120));
        assert!(read.last().unwrap().assist.timeline.is_empty());
        assert!(read.last().unwrap().assist.retention_limited);
    }

    #[test]
    fn incomplete_samples_go_first_and_a_thinned_complete_record_is_never_complete() {
        let mut records = history(30, true);
        for record in records.iter_mut().skip(15) {
            record.sample_complete = false;
        }
        let without_replay_and_assist: usize =
            records.iter().map(|record| thinned_size(record, 3)).sum();
        // Needs sample removal, but far from all of it.
        let target = without_replay_and_assist * 9 / 10;
        let (bytes, retained) = encode_with(&records, target, size(&records)).unwrap();
        let read = parse(&bytes).unwrap();
        assert_eq!(retained, 30);
        assert!(
            read.iter()
                .any(|record| !record.sample_complete && record.damage_samples.is_empty()),
            "incomplete records lose their samples first"
        );
        assert!(
            read.iter()
                .any(|record| record.sample_complete && record.damage_samples.len() == 120),
            "complete records keep theirs while that is enough"
        );
        for record in &read {
            assert!(!record.sample_complete || record.damage_samples.len() == 120);
        }
    }

    #[test]
    fn a_record_is_dropped_only_as_a_last_resort_and_never_the_newest() {
        let records = history(20, true);
        // Fully thinned, only about half of the records fit.
        let max = HEADER.len() + thinned_size(&records[0], PASSES) * 10 + 12;
        let (bytes, retained) = encode_with(&records, max / 2, max).unwrap();
        let read = parse(&bytes).unwrap();
        assert!((8..20).contains(&retained), "{retained}");
        assert_eq!(read.len(), retained);
        assert!(bytes.len() <= max);
        assert_eq!(read[0].id, 20);
        assert!(read
            .iter()
            .all(|record| record.total_damage == record.id * 10));
    }

    #[test]
    fn decimation_keeps_first_and_last_point_of_every_actor() {
        let mut track: Vec<_> = (0..100u64)
            .map(|i| spatial::Point {
                actor_id: i % 2 + 1,
                at_ms: i,
                ..Default::default()
            })
            .collect();
        decimate(&mut track, 4);
        for actor in [1u64, 2] {
            let times: Vec<u64> = track
                .iter()
                .filter(|point| point.actor_id == actor)
                .map(|point| point.at_ms)
                .collect();
            assert_eq!(times.first().copied(), Some(actor - 1));
            assert_eq!(times.last().copied(), Some(98 + actor - 1));
            assert!(times.len() < 20, "{}", times.len());
            assert!(times.windows(2).all(|pair| pair[0] < pair[1]));
        }
    }
}
