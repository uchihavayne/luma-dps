//! Received Contents Ticket observations, independently implemented from the
//! packet facts documented in AionDPS at revision
//! 92806d72b1bb9cec4d092dc601d23447c7d67e29, docs/protocol/ticket-frames.md.
//! No game catalog, external implementation or private capture is included.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

pub const ODYLE_TICKET_ID: u32 = 60_000_001;
const MAX_FRAME_BYTES: usize = 16_384;
const MAX_COUNTER: u32 = 10_000_000;
const PENDING_IDENTITY_MS: u64 = 30_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ResourceError {
    Truncated,
    Invalid,
    Limit,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TicketReading {
    pub ticket_id: u32,
    pub count: u32,
    pub bonus: u32,
    pub time_left_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ResourceEvent {
    Snapshot {
        entries: Vec<TicketReading>,
    },
    Membership {
        expires_at_ms: Option<u64>,
    },
    Change {
        reading: TicketReading,
        reason: u8,
        gained: Option<u32>,
    },
}

struct Cursor<'a> {
    bytes: &'a [u8],
    position: usize,
}

impl<'a> Cursor<'a> {
    fn take<const N: usize>(&mut self) -> Result<[u8; N], ResourceError> {
        let end = self.position.checked_add(N).ok_or(ResourceError::Limit)?;
        let result = self
            .bytes
            .get(self.position..end)
            .ok_or(ResourceError::Truncated)?;
        self.position = end;
        result.try_into().map_err(|_| ResourceError::Truncated)
    }

    fn byte(&mut self) -> Result<u8, ResourceError> {
        Ok(self.take::<1>()?[0])
    }

    fn counter(&mut self) -> Result<u32, ResourceError> {
        let mut value = 0u32;
        for index in 0..5 {
            let byte = self.byte()?;
            if index == 4 && byte & 0xf0 != 0 {
                return Err(ResourceError::Invalid);
            }
            value |= u32::from(byte & 0x7f) << (index * 7);
            if byte & 0x80 == 0 {
                if index > 0 && byte == 0 {
                    return Err(ResourceError::Invalid);
                }
                return if value <= MAX_COUNTER {
                    Ok(value)
                } else {
                    Err(ResourceError::Limit)
                };
            }
        }
        Err(ResourceError::Invalid)
    }

    fn ticket(&mut self) -> Result<TicketReading, ResourceError> {
        let mask = self.byte()?;
        if mask & !0x0d != 0 {
            return Err(ResourceError::Invalid);
        }
        let ticket_id = u32::from_le_bytes(self.take()?);
        if ticket_id == 0 {
            return Err(ResourceError::Invalid);
        }
        let time_left_ms = if mask & 1 != 0 {
            u64::from_le_bytes(self.take()?)
        } else {
            0
        };
        if time_left_ms > 9_007_199_254_740_991 {
            return Err(ResourceError::Limit);
        }
        // These are complete absolute entries. Omitted mask fields mean zero;
        // they are not deltas or a patch retaining an older component.
        let count = if mask & 4 != 0 { self.counter()? } else { 0 };
        let bonus = if mask & 8 != 0 { self.counter()? } else { 0 };
        Ok(TicketReading {
            ticket_id,
            count,
            bonus,
            time_left_ms,
        })
    }
}

/// Decode one already-framed, server-origin packet, including its two opcode
/// bytes. Framing and direction are the caller's responsibility.
pub fn decode(frame: &[u8]) -> Result<Option<ResourceEvent>, ResourceError> {
    let opcode = frame.get(..2).ok_or(ResourceError::Truncated)?;
    if opcode != [0x0b, 0x61] && opcode != [0x0c, 0x61] && opcode != [0x3b, 0xe3] {
        return Ok(None);
    }
    if frame.len() > MAX_FRAME_BYTES {
        return Err(ResourceError::Limit);
    }
    let mut cursor = Cursor {
        bytes: frame,
        position: 2,
    };
    let event = if opcode == [0x3b, 0xe3] {
        let count = usize::from(cursor.byte()?);
        if frame.len() != 3 + count * 21 {
            return Err(ResourceError::Invalid);
        }
        let mut benefit_ids = BTreeSet::new();
        let mut expiry = None;
        for _ in 0..count {
            let effect = u32::from_le_bytes(cursor.take()?);
            let _flags = cursor.byte()?;
            let starts_at = u64::from_le_bytes(cursor.take()?);
            let ends_at = u64::from_le_bytes(cursor.take()?);
            if (34..=42).contains(&effect) {
                if !(1_500_000_000_000..4_000_000_000_000).contains(&starts_at)
                    || !(1_500_000_000_000..4_000_000_000_000).contains(&ends_at)
                    || starts_at > ends_at
                    || !benefit_ids.insert(effect)
                    || expiry.is_some_and(|previous| previous != ends_at)
                {
                    return Err(ResourceError::Invalid);
                }
                expiry = Some(ends_at);
            }
        }
        // Observed membership benefits arrive as one set. A partial new shape
        // must not silently grant or deny a resource capacity.
        if !benefit_ids.is_empty() && benefit_ids.len() != 9 {
            return Err(ResourceError::Invalid);
        }
        ResourceEvent::Membership {
            expires_at_ms: expiry,
        }
    } else if opcode == [0x0b, 0x61] {
        let count = usize::from(cursor.byte()?);
        let mut entries = Vec::with_capacity(count);
        let mut identifiers = BTreeSet::new();
        for _ in 0..count {
            let reading = cursor.ticket()?;
            if !identifiers.insert(reading.ticket_id) {
                return Err(ResourceError::Invalid);
            }
            entries.push(reading);
        }
        ResourceEvent::Snapshot { entries }
    } else {
        let flag = cursor.byte()?;
        if flag > 1 {
            return Err(ResourceError::Invalid);
        }
        let reading = cursor.ticket()?;
        let reason = cursor.byte()?;
        let gained = if flag == 1 {
            Some(u32::from_le_bytes(cursor.take()?))
        } else {
            None
        };
        if gained.is_some_and(|value| value > MAX_COUNTER) {
            return Err(ResourceError::Limit);
        }
        ResourceEvent::Change {
            reading,
            reason,
            gained,
        }
    };
    if cursor.position != frame.len() {
        return Err(ResourceError::Invalid);
    }
    Ok(Some(event))
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ObservedTicket {
    pub ticket_id: u32,
    pub count: u32,
    pub bonus: u32,
    pub time_left_ms: u64,
    pub observed_at_ms: u64,
    pub reason: Option<u8>,
    pub gained: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ObservedOdyle {
    pub ticket_id: u32,
    pub base: u32,
    pub bonus: u32,
    pub total: u64,
    pub time_left_ms: u64,
    pub observed_at_ms: u64,
    pub base_capacity: Option<u32>,
    pub capacity_source: Option<String>,
    pub membership_active: Option<bool>,
    pub capacity_mismatch: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ObservedMembership {
    pub expires_at_ms: Option<u64>,
    pub observed_at_ms: u64,
    pub active: bool,
    pub source: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct ResourceSnapshot {
    pub actor_id: Option<u64>,
    pub awaiting_identity: bool,
    pub snapshot_complete: bool,
    pub observed_at_ms: Option<u64>,
    pub source: String,
    pub odyle: Option<ObservedOdyle>,
    pub tickets: Vec<ObservedTicket>,
    pub membership: Option<ObservedMembership>,
}

#[derive(Clone, Debug, Default)]
pub struct ResourceStore {
    actor_id: Option<u64>,
    name: String,
    tickets: BTreeMap<u32, ObservedTicket>,
    pending: BTreeMap<u32, ObservedTicket>,
    pending_since: Option<u64>,
    complete: bool,
    observed_at_ms: Option<u64>,
    membership: Option<(Option<u64>, u64)>,
}

impl ResourceStore {
    pub fn clear(&mut self) {
        *self = Self::default();
    }

    /// The caller must supply a newly received authoritative local-character
    /// record, never a cached profile, manual selection or nearby actor.
    pub fn bind_self(&mut self, actor_id: u64, name: &str, now: u64) {
        if actor_id == 0
            || actor_id > u64::from(u32::MAX)
            || name.trim().is_empty()
            || name.len() > 96
            || name.chars().any(char::is_control)
        {
            return;
        }
        if let Some(since) = self.pending_since.take() {
            self.tickets.clear();
            if now >= since && now - since <= PENDING_IDENTITY_MS {
                self.tickets = std::mem::take(&mut self.pending);
            } else {
                self.pending.clear();
                self.complete = false;
                self.observed_at_ms = None;
                self.membership = None;
            }
        } else if self.actor_id.is_some_and(|old| old != actor_id)
            || (!self.name.is_empty() && self.name != name)
        {
            self.tickets.clear();
            self.complete = false;
            self.observed_at_ms = None;
            self.membership = None;
        }
        self.actor_id = Some(actor_id);
        self.name = name.into();
    }

    pub fn ingest(&mut self, event: ResourceEvent, now: u64) {
        let (entries, reason, gained) = match event {
            ResourceEvent::Membership { expires_at_ms } => {
                if self.actor_id.is_none() && self.pending_since.is_none() {
                    self.pending_since = Some(now);
                }
                if self
                    .pending_since
                    .is_some_and(|since| now < since || now - since > PENDING_IDENTITY_MS)
                {
                    self.clear();
                    return;
                }
                if self.membership.is_none_or(|(_, observed)| now >= observed) {
                    self.membership = Some((expires_at_ms, now));
                }
                return;
            }
            ResourceEvent::Snapshot { entries } => {
                // Login tickets arrive before the new self record. Erase the
                // old owner immediately, including same-account character swaps.
                self.clear();
                self.pending_since = Some(now);
                self.complete = true;
                (entries, None, None)
            }
            ResourceEvent::Change {
                reading,
                reason,
                gained,
            } => {
                // A late attachment may still learn an absolute update, but it
                // cannot attach it to an earlier character's identity.
                if self.actor_id.is_none() && self.pending_since.is_none() {
                    self.pending_since = Some(now);
                }
                (vec![reading], Some(reason), gained)
            }
        };
        if self
            .pending_since
            .is_some_and(|since| now < since || now - since > PENDING_IDENTITY_MS)
        {
            self.clear();
            return;
        }
        let values = if self.pending_since.is_some() {
            &mut self.pending
        } else {
            &mut self.tickets
        };
        for reading in entries {
            if values.len() >= 255 && !values.contains_key(&reading.ticket_id) {
                continue;
            }
            let observed = ObservedTicket {
                ticket_id: reading.ticket_id,
                count: reading.count,
                bonus: reading.bonus,
                time_left_ms: reading.time_left_ms,
                observed_at_ms: now,
                reason,
                gained,
            };
            if values
                .get(&observed.ticket_id)
                .is_none_or(|previous| previous.observed_at_ms <= now)
            {
                values.insert(observed.ticket_id, observed);
            }
        }
        self.observed_at_ms = Some(
            self.observed_at_ms
                .map_or(now, |previous| previous.max(now)),
        );
    }

    pub fn snapshot(&self, now: u64) -> ResourceSnapshot {
        let pending_fresh = self
            .pending_since
            .is_some_and(|since| now >= since && now - since <= PENDING_IDENTITY_MS);
        let visible = self.actor_id.is_some() && self.pending_since.is_none();
        let tickets = if visible {
            self.tickets.values().cloned().collect()
        } else {
            Vec::new()
        };
        let membership = if visible {
            self.membership
                .map(|(expires_at_ms, observed_at_ms)| ObservedMembership {
                    expires_at_ms,
                    observed_at_ms,
                    active: expires_at_ms.is_some_and(|expiry| expiry > now),
                    source: "server-benefit-list".into(),
                })
        } else {
            None
        };
        let odyle = if visible {
            self.tickets.get(&ODYLE_TICKET_ID).map(|entry| {
                let membership_active = membership.as_ref().map(|value| value.active);
                let rule_capacity = membership_active.map(|active| if active { 840 } else { 560 });
                let capacity_mismatch = rule_capacity.is_some_and(|maximum| entry.count > maximum);
                ObservedOdyle {
                    ticket_id: ODYLE_TICKET_ID,
                    base: entry.count,
                    bonus: entry.bonus,
                    total: u64::from(entry.count) + u64::from(entry.bonus),
                    time_left_ms: entry.time_left_ms,
                    observed_at_ms: entry.observed_at_ms,
                    base_capacity: rule_capacity.filter(|_| !capacity_mismatch),
                    capacity_source: rule_capacity
                        .filter(|_| !capacity_mismatch)
                        .map(|_| "membership-rule".into()),
                    membership_active,
                    capacity_mismatch,
                }
            })
        } else {
            None
        };
        ResourceSnapshot {
            actor_id: if visible { self.actor_id } else { None },
            awaiting_identity: pending_fresh,
            snapshot_complete: visible && self.complete,
            observed_at_ms: if visible { self.observed_at_ms } else { None },
            source: "server-contents-ticket".into(),
            odyle,
            tickets,
            membership,
        }
    }
}
