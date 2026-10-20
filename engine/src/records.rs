//! Bounded observations from live events. Imported history never enters this path.
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Observation {
    pub name: String,
    pub server_id: u16,
    pub class_name: String,
    pub actor_id: u64,
    pub is_local: bool,
    pub metric: String,
    pub amount: u64,
    pub at_ms: u64,
    pub skill_id: Option<u32>,
    pub critical: bool,
    pub tick: bool,
    pub target_name: String,
    pub target_npc_id: Option<u32>,
    pub map_id: Option<u32>,
    pub boss_max_hp: Option<u64>,
    pub elapsed_ms: Option<u64>,
}

impl Observation {
    pub fn valid(&self) -> bool {
        let text = |s: &str, max: usize| {
            !s.is_empty() && s.chars().count() <= max && !s.chars().any(char::is_control)
        };
        text(&self.name, 80)
            && !self.name.starts_with('#')
            && !self.name.eq_ignore_ascii_case("unknown")
            && (1000..3000).contains(&self.server_id)
            && self.actor_id > 0
            && self.actor_id <= u64::from(u32::MAX)
            && text(&self.class_name, 32)
            && self.amount > 0
            && self.amount <= 9_007_199_254_740_991
            && self.at_ms > 0
            && self.at_ms <= 8_640_000_000_000_000
            && self.target_name.chars().count() <= 100
            && !self.target_name.chars().any(char::is_control)
            && match self.metric.as_str() {
                "hit" => self.skill_id.is_some() && self.elapsed_ms.is_none(),
                "boss-dps" => {
                    self.is_local
                        && self.skill_id.is_none()
                        && self.target_npc_id.is_some_and(|id| id > 0)
                        && self.map_id.is_some_and(|id| id > 0)
                        && self.boss_max_hp.is_some_and(|hp| hp > 0)
                        && self
                            .elapsed_ms
                            .is_some_and(|ms| (10_000..=21_600_000).contains(&ms))
                }
                _ => false,
            }
    }

    pub fn same_record(&self, other: &Self) -> bool {
        self.name == other.name
            && self.server_id == other.server_id
            && self.class_name == other.class_name
            && self.metric == other.metric
            && (self.metric == "hit"
                || (self.target_npc_id, self.map_id, self.boss_max_hp)
                    == (other.target_npc_id, other.map_id, other.boss_max_hp))
    }

    pub fn better_than(&self, other: &Self) -> bool {
        // Cross multiplication preserves sub-DPS precision without rounded scores.
        u128::from(self.amount) * u128::from(other.elapsed_ms.unwrap_or(1))
            > u128::from(other.amount) * u128::from(self.elapsed_ms.unwrap_or(1))
    }
}

pub fn enqueue(queue: &mut Vec<Observation>, observation: Observation) {
    if !observation.valid() {
        return;
    }
    if let Some(prior) = queue.iter_mut().find(|row| row.same_record(&observation)) {
        if observation.better_than(prior) {
            *prior = observation;
        }
    } else {
        if queue.len() == 128 {
            queue.remove(0);
        }
        queue.push(observation);
    }
}
