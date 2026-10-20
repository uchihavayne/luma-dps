//! Private local records. Only the engine's live observation queue can update them.
use luma_engine::records::Observation;
use serde::{Deserialize, Serialize};
use std::{fs, io::Read, path::PathBuf};

const MAX_RECORDS: usize = 512;
const MAX_BYTES: usize = 1024 * 1024;

#[derive(Clone, Serialize, Deserialize)]
pub struct Record {
    pub best: Observation,
    pub previous: Option<Observation>,
}
#[derive(Clone, Serialize)]
pub struct Notice {
    pub sequence: u64,
    pub best: Observation,
    pub previous: Observation,
}
#[derive(Serialize, Deserialize)]
struct Document {
    #[serde(rename = "type")]
    kind: String,
    version: u32,
    records: Vec<Record>,
}
pub struct Store {
    path: PathBuf,
    records: Vec<Record>,
    notices: Vec<Notice>,
    revision: u64,
    sequence: u64,
    dirty: bool,
    due: u64,
    error: String,
}

fn parse(bytes: &[u8]) -> Result<Vec<Record>, String> {
    if bytes.len() > MAX_BYTES {
        return Err("Personal best file is too large".into());
    }
    let doc: Document = serde_json::from_slice(bytes).map_err(|_| "Invalid personal best file")?;
    if doc.kind != "luma-personal-bests" || doc.version != 1 || doc.records.len() > MAX_RECORDS {
        return Err("Unsupported personal best file".into());
    }
    for (index, row) in doc.records.iter().enumerate() {
        if !row.best.valid()
            || row.previous.as_ref().is_some_and(|previous| {
                !previous.valid()
                    || !row.best.same_record(previous)
                    || !row.best.better_than(previous)
            })
            || doc.records[..index]
                .iter()
                .any(|prior| prior.best.same_record(&row.best))
        {
            return Err("Invalid personal best record".into());
        }
    }
    Ok(doc.records)
}

impl Store {
    pub fn open(path: PathBuf) -> Self {
        let mut store = Self {
            path,
            records: Vec::new(),
            notices: Vec::new(),
            revision: 0,
            sequence: 0,
            dirty: false,
            due: 0,
            error: String::new(),
        };
        if store.path.as_os_str().is_empty() {
            return store;
        }
        let result = (|| {
            let file = fs::File::open(&store.path)?;
            let mut bytes = Vec::new();
            file.take((MAX_BYTES + 1) as u64).read_to_end(&mut bytes)?;
            Ok::<_, std::io::Error>(bytes)
        })();
        match result {
            Ok(bytes) => match parse(&bytes) {
                Ok(records) => {
                    store.records = records;
                    store.revision = 1;
                }
                Err(error) => store.error = error,
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => (),
            Err(_) => store.error = "Cannot read personal best file".into(),
        }
        store
    }

    pub fn observe(&mut self, observation: Observation) {
        if !observation.valid() {
            return;
        }
        if let Some(row) = self
            .records
            .iter_mut()
            .find(|row| row.best.same_record(&observation))
        {
            if !observation.better_than(&row.best) {
                return;
            }
            let previous = std::mem::replace(&mut row.best, observation.clone());
            row.previous = Some(previous.clone());
            self.sequence += 1;
            // Coalesce a busy frame; preserve the first prior score for the notice.
            if let Some(notice) = self.notices.iter_mut().find(|notice| {
                notice.best.same_record(&observation)
                    && observation.at_ms.saturating_sub(notice.best.at_ms) < 1000
            }) {
                notice.best = observation;
                notice.sequence = self.sequence;
            } else {
                self.notices.push(Notice {
                    sequence: self.sequence,
                    best: observation,
                    previous,
                });
                if self.notices.len() > 8 {
                    self.notices.remove(0);
                }
            }
        } else {
            if self.records.len() == MAX_RECORDS {
                let oldest = self
                    .records
                    .iter()
                    .enumerate()
                    .min_by_key(|(_, row)| row.best.at_ms)
                    .map(|(i, _)| i)
                    .unwrap();
                self.records.remove(oldest);
            }
            self.records.push(Record {
                best: observation,
                previous: None,
            });
        }
        self.revision += 1;
        self.dirty = true;
    }

    pub fn status(&self, now: u64) -> serde_json::Value {
        let notices: Vec<_> = self
            .notices
            .iter()
            .filter(|row| row.best.at_ms <= now && now - row.best.at_ms <= 6000)
            .collect();
        serde_json::json!({ "revision": self.revision, "count": self.records.len(),
            "notices": notices, "storage_error": self.error })
    }

    pub fn snapshot(&self) -> serde_json::Value {
        serde_json::json!({ "revision": self.revision, "records": self.records, "storage_error": self.error })
    }

    pub fn flush(&mut self, now: u64, force: bool) {
        if !self.dirty || self.path.as_os_str().is_empty() || !force && now < self.due {
            return;
        }
        let result = (|| {
            let bytes = serde_json::to_vec(&Document {
                kind: "luma-personal-bests".into(),
                version: 1,
                records: self.records.clone(),
            })
            .map_err(|_| "Cannot encode personal bests")?;
            if bytes.len() > MAX_BYTES {
                return Err("Personal best file is too large");
            }
            let parent = self
                .path
                .parent()
                .filter(|p| !p.as_os_str().is_empty())
                .ok_or("Personal best directory unavailable")?;
            fs::create_dir_all(parent).map_err(|_| "Cannot create personal best directory")?;
            let temporary = self.path.with_extension("json.new");
            fs::write(&temporary, bytes).map_err(|_| "Cannot save personal bests")?;
            fs::rename(temporary, &self.path).map_err(|_| "Cannot replace personal bests")?;
            Ok(())
        })();
        self.due = now.saturating_add(if result.is_ok() { 3000 } else { 5000 });
        match result {
            Ok(()) => {
                self.dirty = false;
                self.error.clear();
            }
            Err(error) => self.error = error.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn hit(amount: u64, at: u64) -> Observation {
        Observation {
            name: "Archer".into(),
            server_id: 1001,
            class_name: "Ranger".into(),
            actor_id: 7,
            is_local: true,
            metric: "hit".into(),
            amount,
            at_ms: at,
            skill_id: Some(14000000),
            critical: false,
            tick: false,
            target_name: "Boss".into(),
            target_npc_id: Some(100),
            map_id: Some(1),
            boss_max_hp: Some(1000000),
            elapsed_ms: None,
        }
    }
    #[test]
    fn strict_records_and_busy_updates_preserve_the_prior_score() {
        let mut store = Store::open(PathBuf::new());
        store.observe(hit(10000, 1000));
        assert_eq!(store.notices.len(), 0);
        for amount in [9000, 10000, 12000, 13000] {
            store.observe(hit(amount, 2000));
        }
        assert_eq!(store.records[0].best.amount, 13000);
        assert_eq!(store.records[0].previous.as_ref().unwrap().amount, 12000);
        assert_eq!(store.notices.len(), 1);
        assert_eq!(store.notices[0].previous.amount, 10000);
        assert_eq!(store.notices[0].best.amount, 13000);
        assert_eq!(store.revision, 3);
        assert_eq!(store.status(8001)["notices"].as_array().unwrap().len(), 0);
    }
    #[test]
    fn character_server_class_and_boss_contexts_are_separate() {
        let mut store = Store::open(PathBuf::new());
        let original = hit(10000, 1000);
        store.observe(original.clone());
        let mut other = original.clone();
        other.server_id += 1;
        store.observe(other);
        let mut other = original.clone();
        other.name = "Friend".into();
        store.observe(other);
        let mut other = original.clone();
        other.class_name = "Cleric".into();
        store.observe(other);
        let mut boss = original.clone();
        boss.metric = "boss-dps".into();
        boss.skill_id = None;
        boss.elapsed_ms = Some(10000);
        store.observe(boss.clone());
        boss.boss_max_hp = Some(2000000);
        store.observe(boss.clone());
        boss.map_id = Some(2);
        store.observe(boss);
        assert_eq!(store.records.len(), 7);
        let mut reconnect = original;
        reconnect.actor_id = 99;
        reconnect.amount = 13000;
        store.observe(reconnect);
        assert_eq!(store.records.len(), 7);
        assert_eq!(store.records[0].best.amount, 13000);
    }
    #[test]
    fn dps_compares_the_rate_instead_of_damage_or_rounded_values() {
        let mut store = Store::open(PathBuf::new());
        let mut observation = hit(100001, 1000);
        observation.metric = "boss-dps".into();
        observation.skill_id = None;
        observation.elapsed_ms = Some(10000);
        store.observe(observation.clone());
        observation.amount = 200001;
        observation.elapsed_ms = Some(20000);
        store.observe(observation.clone());
        assert_eq!(store.revision, 1);
        observation.amount = 200003;
        store.observe(observation);
        assert_eq!(store.revision, 2);
    }
    #[test]
    fn bounded_disk_round_trip_keeps_records_but_never_replays_notices() {
        let dir = std::env::temp_dir().join(format!(
            "luma-bests-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let path = dir.join("bests.json");
        let mut store = Store::open(path.clone());
        store.observe(hit(10000, 1000));
        store.observe(hit(13000, 2000));
        store.flush(2000, true);
        assert!(store.error.is_empty(), "{}", store.error);
        let mut restored = Store::open(path.clone());
        assert_eq!(restored.records[0].best.amount, 13000);
        assert!(restored.notices.is_empty());
        restored.observe(hit(12000, 3000));
        assert!(restored.notices.is_empty());
        restored.observe(hit(14000, 4000));
        assert_eq!(restored.notices[0].previous.amount, 13000);
        fs::remove_file(path).unwrap();
        fs::remove_dir(dir).unwrap();
    }
    #[test]
    fn corrupt_duplicates_oversize_and_invalid_values_are_rejected() {
        assert!(parse(&vec![b' '; MAX_BYTES + 1]).is_err());
        let mut store = Store::open(PathBuf::new());
        let mut invalid = hit(1, 1);
        invalid.server_id = 0;
        store.observe(invalid);
        assert!(store.records.is_empty());
        let row = Record {
            best: hit(10, 100),
            previous: None,
        };
        assert!(parse(
            &serde_json::to_vec(&Document {
                kind: "luma-personal-bests".into(),
                version: 1,
                records: vec![row.clone(), row]
            })
            .unwrap()
        )
        .is_err());
        for i in 0..600 {
            let mut row = hit(1, i + 1);
            row.name = format!("Actor{i}");
            store.observe(row);
        }
        assert_eq!(store.records.len(), MAX_RECORDS);
        assert_eq!(store.records[0].best.name, "Actor88");
    }
}
