//! Local last-received pet counters, isolated by validated character and home
//! server. Cached counters never advance from a later session's deltas.
use luma_engine::character::{
    CharacterSnapshot, ObservedPetProgress, PetContinuity, PetProgressSnapshot,
};
use serde::{Deserialize, Serialize};
use std::{fs, io::Read, path::PathBuf};

const MAX_BYTES: usize = 8 * 1024 * 1024;
const MAX_PROFILES: usize = 16;
const MAX_PETS: usize = 2000;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct SavedPet {
    pet_id: u32,
    level: u32,
    progress: Option<u64>,
    observed_at_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct Profile {
    name: String,
    server_id: u32,
    pets: Vec<SavedPet>,
}

#[derive(Serialize, Deserialize)]
struct Document {
    #[serde(rename = "type")]
    kind: String,
    version: u32,
    profiles: Vec<Profile>,
}

pub struct Store {
    path: PathBuf,
    profiles: Vec<Profile>,
    dirty: bool,
    retry_at_ms: u64,
    pub error: String,
}

fn valid_name(name: &str) -> bool {
    !name.is_empty() && name.chars().count() <= 80 && !name.chars().any(char::is_control)
}

fn key(snapshot: &CharacterSnapshot) -> Option<(&str, u32, u64)> {
    let owner = snapshot.pet_collection_owner.as_ref()?;
    let own = snapshot.own.as_ref()?;
    let server = own.server_id?;
    (owner.source == "server-self"
        && owner.actor_id > 0
        && owner.actor_id <= u64::from(u32::MAX)
        && own.source == "server-self"
        && own.actor_id == Some(owner.actor_id)
        && valid_name(&own.name)
        && (1000..3000).contains(&server))
    .then_some((own.name.as_str(), server, owner.actor_id))
}

fn parse(bytes: &[u8]) -> Result<Vec<Profile>, String> {
    if bytes.len() > MAX_BYTES {
        return Err("Pet cache exceeds its storage limit".into());
    }
    let document: Document = serde_json::from_slice(bytes).map_err(|_| "Invalid pet cache JSON")?;
    if document.kind != "luma-pet-cache"
        || document.version != 1
        || document.profiles.len() > MAX_PROFILES
    {
        return Err("Unsupported pet cache".into());
    }
    let mut keys = std::collections::BTreeSet::new();
    for profile in &document.profiles {
        if !valid_name(&profile.name)
            || !(1000..3000).contains(&profile.server_id)
            || !keys.insert((&profile.name, profile.server_id))
            || profile.pets.len() > MAX_PETS
        {
            return Err("Invalid pet cache profile".into());
        }
        let mut ids = std::collections::BTreeSet::new();
        for pet in &profile.pets {
            if !(1000..=99999).contains(&pet.pet_id)
                || pet.level > 3
                || !ids.insert(pet.pet_id)
                || pet.progress.is_none() && pet.level != 3
                || pet
                    .progress
                    .is_some_and(|value| value > u64::from(u32::MAX))
                || pet.observed_at_ms > 8_640_000_000_000_000
            {
                return Err("Invalid pet cache counter".into());
            }
        }
    }
    Ok(document.profiles)
}

impl Store {
    pub fn open(path: PathBuf) -> Self {
        let loaded = (|| {
            if !path.exists() {
                return Ok(Vec::new());
            }
            let mut bytes = Vec::new();
            fs::File::open(&path)
                .and_then(|file| file.take(MAX_BYTES as u64 + 1).read_to_end(&mut bytes))
                .map_err(|_| "Cannot read pet cache".to_string())?;
            parse(&bytes)
        })();
        let (profiles, error) = match loaded {
            Ok(profiles) => (profiles, String::new()),
            Err(error) => (Vec::new(), error),
        };
        Self {
            path,
            profiles,
            dirty: false,
            retry_at_ms: 0,
            error,
        }
    }

    pub fn observe(&mut self, snapshot: &CharacterSnapshot, now: u64) {
        let Some((name, server_id, actor_id)) = key(snapshot) else {
            return;
        };
        let Some(current) = snapshot
            .pet_progress
            .as_ref()
            .filter(|pets| pets.source == "server-self" && pets.actor_id == Some(actor_id))
        else {
            return;
        };
        if current.pets.len() > MAX_PETS {
            return;
        }
        let received: Vec<_> = current.pets.iter().filter_map(|pet| {
            let level = pet.level?;
            (!pet.progress_stale && pet.observed_at_ms <= now
                && (1000..=99999).contains(&pet.pet_id) && level <= 3
                && (pet.progress.is_some() || level == 3)
                && pet.progress.is_none_or(|value| value <= u64::from(u32::MAX))
                && matches!(pet.progress_source.as_str(), "server-absolute" | "server-delta" | "server-level-reset" | "unknown" if level == 3 || pet.progress_source != "unknown"))
            .then_some(SavedPet { pet_id: pet.pet_id, level, progress: pet.progress, observed_at_ms: pet.observed_at_ms })
        }).collect();
        let complete = current.inventory_complete
            && current.continuity == PetContinuity::Live
            && current
                .pets
                .iter()
                .all(|pet| !pet.progress_stale && pet.observed_at_ms <= now);
        if received.is_empty() && !complete {
            return;
        }
        let index = self
            .profiles
            .iter()
            .position(|profile| profile.name == name && profile.server_id == server_id);
        let mut next = Profile {
            name: name.into(),
            server_id,
            pets: if complete {
                Vec::new()
            } else {
                index
                    .map(|index| self.profiles[index].pets.clone())
                    .unwrap_or_default()
            },
        };
        for pet in received {
            if let Some(previous) = next
                .pets
                .iter_mut()
                .find(|previous| previous.pet_id == pet.pet_id)
            {
                if pet.observed_at_ms >= previous.observed_at_ms {
                    *previous = pet;
                }
            } else {
                next.pets.push(pet);
            }
        }
        next.pets.sort_by_key(|pet| pet.pet_id);
        if next.pets.len() > MAX_PETS || index.is_some_and(|index| self.profiles[index] == next) {
            return;
        }
        if let Some(index) = index {
            self.profiles.remove(index);
        }
        self.profiles.insert(0, next);
        self.profiles.truncate(MAX_PROFILES);
        self.dirty = true;
    }

    pub fn project(&self, mut snapshot: CharacterSnapshot, now: u64) -> CharacterSnapshot {
        let Some((name, server, actor)) = key(&snapshot) else {
            return snapshot;
        };
        if snapshot
            .pet_progress
            .as_ref()
            .is_some_and(|pets| pets.inventory_complete)
        {
            return snapshot;
        }
        let Some(saved) = self
            .profiles
            .iter()
            .find(|profile| profile.name == name && profile.server_id == server)
        else {
            return snapshot;
        };
        let had_progress = snapshot.pet_progress.is_some();
        let mut progress = snapshot
            .pet_progress
            .take()
            .unwrap_or_else(|| PetProgressSnapshot {
                actor_id: Some(actor),
                source: "server-self".into(),
                ..Default::default()
            });
        if progress.actor_id != Some(actor) || progress.source != "server-self" {
            return snapshot;
        }
        let mut restored = false;
        for pet in &saved.pets {
            if pet.observed_at_ms > now {
                continue;
            }
            let current = progress
                .pets
                .iter_mut()
                .find(|row| row.pet_id == pet.pet_id);
            let previous = match current {
                Some(row) if row.progress.is_some() || row.level == Some(3) => continue,
                Some(row) if row.level.is_some_and(|level| level != pet.level) => continue,
                Some(row) => row,
                None => {
                    if progress.pets.len() >= MAX_PETS {
                        break;
                    }
                    progress.pets.push(ObservedPetProgress {
                        pet_id: pet.pet_id,
                        level: None,
                        progress: None,
                        progress_source: "unknown".into(),
                        required_progress: None,
                        session_gained: 0,
                        observed_at_ms: 0,
                        session_started_at_ms: None,
                        session_baseline_gained: 0,
                        session_gain_events: 0,
                        last_gain_at_ms: None,
                        progress_stale: true,
                    });
                    progress.pets.last_mut().unwrap()
                }
            };
            previous.level = Some(pet.level);
            previous.progress = pet.progress;
            previous.progress_source = "server-absolute".into();
            previous.observed_at_ms = pet.observed_at_ms;
            previous.progress_stale = true;
            // New deltas are still visible as session gains; they never get
            // added to a counter that may have changed while Luma was closed.
            previous.session_started_at_ms = None;
            previous.session_baseline_gained = previous.session_gained;
            previous.session_gain_events = 0;
            restored = true;
        }
        if restored {
            progress.pets.sort_by_key(|pet| pet.pet_id);
            progress.observed_at_ms = progress.observed_at_ms.max(
                progress
                    .pets
                    .iter()
                    .map(|pet| pet.observed_at_ms)
                    .max()
                    .unwrap_or(0),
            );
            progress.continuity = PetContinuity::LastKnown;
            progress.stale_reason = Some("previous-session".into());
            progress.stale_at_ms = Some(now);
        }
        if !progress.pets.is_empty() || had_progress {
            snapshot.pet_progress = Some(progress);
        }
        snapshot
    }

    pub fn flush(&mut self, now: u64, force: bool) {
        if !self.dirty || self.path.as_os_str().is_empty() || !force && now < self.retry_at_ms {
            return;
        }
        let result = (|| {
            let bytes = serde_json::to_vec(&Document {
                kind: "luma-pet-cache".into(),
                version: 1,
                profiles: self.profiles.clone(),
            })
            .map_err(|_| "Cannot encode pet cache")?;
            if bytes.len() > MAX_BYTES {
                return Err("Pet cache exceeds its storage limit");
            }
            let parent = self
                .path
                .parent()
                .filter(|path| !path.as_os_str().is_empty())
                .ok_or("Pet cache directory unavailable")?;
            fs::create_dir_all(parent).map_err(|_| "Cannot create pet cache directory")?;
            let temporary = self.path.with_extension("json.new");
            fs::write(&temporary, bytes).map_err(|_| "Cannot write pet cache")?;
            fs::rename(temporary, &self.path).map_err(|_| "Cannot replace pet cache")?;
            Ok(())
        })();
        self.retry_at_ms = now.saturating_add(if result.is_ok() { 1000 } else { 5000 });
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
    use luma_engine::character::{CharacterBuild, PetCollectionOwner};
    fn fixture(actor: u64, name: &str, server: u32) -> CharacterSnapshot {
        CharacterSnapshot {
            pet_collection_owner: Some(PetCollectionOwner {
                actor_id: actor,
                source: "server-self".into(),
                generation: 1,
            }),
            own: Some(CharacterBuild {
                actor_id: Some(actor),
                name: name.into(),
                server_id: Some(server),
                source: "server-self".into(),
                ..Default::default()
            }),
            pet_progress: Some(PetProgressSnapshot {
                actor_id: Some(actor),
                source: "server-self".into(),
                inventory_complete: true,
                observed_at_ms: 100,
                pets: vec![ObservedPetProgress {
                    pet_id: 1042,
                    level: Some(1),
                    progress: Some(12),
                    progress_source: "server-delta".into(),
                    required_progress: None,
                    session_gained: 2,
                    observed_at_ms: 100,
                    session_started_at_ms: Some(0),
                    session_baseline_gained: 0,
                    session_gain_events: 2,
                    last_gain_at_ms: Some(100),
                    progress_stale: false,
                }],
                ..Default::default()
            }),
            ..Default::default()
        }
    }
    fn empty(actor: u64, name: &str, server: u32) -> CharacterSnapshot {
        CharacterSnapshot {
            pet_progress: None,
            ..fixture(actor, name, server)
        }
    }
    #[test]
    fn reopening_restores_only_same_verified_name_and_server_as_last_known() {
        let mut cache = Store::open(PathBuf::new());
        cache.observe(&fixture(7, "Player", 1304), 100);
        let resumed = cache.project(empty(99, "Player", 1304), 200);
        let pets = resumed.pet_progress.unwrap();
        assert_eq!(pets.actor_id, Some(99));
        assert_eq!(pets.continuity, PetContinuity::LastKnown);
        assert_eq!(pets.stale_reason.as_deref(), Some("previous-session"));
        assert_eq!(pets.pets[0].progress, Some(12));
        assert!(pets.pets[0].progress_stale);
        assert_eq!(pets.pets[0].session_started_at_ms, None);
        assert!(cache
            .project(empty(99, "Other", 1304), 200)
            .pet_progress
            .is_none());
        assert!(cache
            .project(empty(99, "Player", 1305), 200)
            .pet_progress
            .is_none());
        let mut manual = empty(99, "Player", 1304);
        manual.own.as_mut().unwrap().source = "manual".into();
        assert!(cache.project(manual, 200).pet_progress.is_none());
        let mut unknown = empty(99, "Player", 1304);
        unknown.own.as_mut().unwrap().server_id = None;
        assert!(cache.project(unknown, 200).pet_progress.is_none());
        assert!(cache
            .project(empty(99, "Player", 1304), 99)
            .pet_progress
            .is_none());
    }
    #[test]
    fn partial_session_gains_do_not_advance_a_counter_across_the_closed_interval() {
        let mut cache = Store::open(PathBuf::new());
        cache.observe(&fixture(7, "Player", 1304), 100);
        let mut current = fixture(99, "Player", 1304);
        let pets = current.pet_progress.as_mut().unwrap();
        pets.inventory_complete = false;
        let pet = &mut pets.pets[0];
        pet.level = None;
        pet.progress = None;
        pet.progress_source = "unknown".into();
        pet.session_gained = 11;
        pet.observed_at_ms = 200;
        cache.observe(&current, 200);
        let merged = cache.project(current.clone(), 200).pet_progress.unwrap();
        assert_eq!(merged.pets[0].progress, Some(12));
        assert_eq!(merged.pets[0].session_gained, 11);
        assert!(merged.pets[0].progress_stale);
        current.pet_progress.as_mut().unwrap().pets[0].level = Some(2);
        let newer_tier = cache.project(current, 200).pet_progress.unwrap();
        assert_eq!(newer_tier.pets[0].level, Some(2));
        assert_eq!(newer_tier.pets[0].progress, None);
    }
    #[test]
    fn fresh_server_baseline_and_new_levels_replace_cached_values() {
        let mut cache = Store::open(PathBuf::new());
        cache.observe(&fixture(7, "Player", 1304), 100);
        let mut current = fixture(99, "Player", 1304);
        let pets = current.pet_progress.as_mut().unwrap();
        pets.pets[0].level = Some(2);
        pets.pets[0].progress = Some(0);
        pets.pets[0].progress_source = "server-level-reset".into();
        pets.pets[0].observed_at_ms = 200;
        cache.observe(&current, 200);
        assert_eq!(
            cache.project(current, 200).pet_progress.unwrap().continuity,
            PetContinuity::Live
        );
        let restored = cache
            .project(empty(100, "Player", 1304), 300)
            .pet_progress
            .unwrap();
        assert_eq!(
            (restored.pets[0].level, restored.pets[0].progress),
            (Some(2), Some(0))
        );
        let mut full = fixture(100, "Player", 1304);
        full.pet_progress.as_mut().unwrap().pets.clear();
        cache.observe(&full, 300);
        assert!(cache
            .project(empty(100, "Player", 1304), 300)
            .pet_progress
            .is_none());
    }
    #[test]
    fn stale_foreign_or_future_observations_cannot_overwrite_a_saved_baseline() {
        let mut cache = Store::open(PathBuf::new());
        cache.observe(&fixture(7, "Player", 1304), 100);
        for kind in 0..4 {
            let mut bad = fixture(7, "Player", 1304);
            let pets = bad.pet_progress.as_mut().unwrap();
            pets.inventory_complete = false;
            pets.pets[0].progress = Some(99);
            match kind {
                0 => pets.pets[0].progress_stale = true,
                1 => pets.actor_id = Some(8),
                2 => pets.pets[0].observed_at_ms = 301,
                _ => bad.pet_collection_owner = None,
            }
            cache.observe(&bad, 300);
        }
        assert_eq!(
            cache
                .project(empty(99, "Player", 1304), 300)
                .pet_progress
                .unwrap()
                .pets[0]
                .progress,
            Some(12)
        );
    }
    #[test]
    fn cache_survives_disk_roundtrip_and_rejects_corruption_and_duplicates() {
        let directory = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join(format!(
                "luma-pet-cache-test-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
        let path = directory.join("pets.json");
        let mut cache = Store::open(path.clone());
        cache.observe(&fixture(7, "Player", 1304), 100);
        cache.flush(100, true);
        assert!(cache.error.is_empty(), "{}", cache.error);
        let restored = Store::open(path.clone());
        assert_eq!(
            restored
                .project(empty(99, "Player", 1304), 200)
                .pet_progress
                .unwrap()
                .pets[0]
                .progress,
            Some(12)
        );
        let mut document: serde_json::Value =
            serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        let duplicate = document["profiles"][0].clone();
        document["profiles"].as_array_mut().unwrap().push(duplicate);
        assert!(parse(&serde_json::to_vec(&document).unwrap()).is_err());
        fs::write(&path, b"broken").unwrap();
        assert!(!Store::open(path.clone()).error.is_empty());
        fs::remove_file(path).unwrap();
        fs::remove_dir(directory).unwrap();
        assert!(parse(&vec![0; MAX_BYTES + 1]).is_err());
    }
}
