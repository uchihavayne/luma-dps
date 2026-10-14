use luma_engine::Encounter;
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

const MAX_BYTES: usize = 32 * 1024 * 1024;
const MAX_RECORDS: usize = 200;

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

fn encode(records: &[Encounter]) -> Result<(Vec<u8>, usize), String> {
    let mut bytes = br#"{"type":"luma-history","version":1,"encounters":["#.to_vec();
    let mut retained = 0;
    for record in records.iter().take(MAX_RECORDS) {
        let record =
            serde_json::to_vec(record).map_err(|e| format!("Cannot encode history: {e}"))?;
        if bytes.len().saturating_add(record.len()).saturating_add(3) > MAX_BYTES {
            if retained == 0 {
                return Err("The newest encounter exceeds the history storage limit".into());
            }
            break;
        }
        if retained != 0 {
            bytes.push(b',');
        }
        bytes.extend(record);
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
}
