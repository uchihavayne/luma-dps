use std::collections::HashMap;

const MAX_PENDING: usize = 128;
const MAX_STREAM_BYTES: usize = 1_048_576;
const GAP_MS: u64 = 5_000;

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct Connection {
    pub source: [u8; 16],
    pub destination: [u8; 16],
    pub source_port: u16,
    pub destination_port: u16,
}

pub struct Segment<'a> {
    pub connection: Connection,
    pub sequence: u32,
    pub syn: bool,
    pub fin: bool,
    pub reset: bool,
    pub payload: &'a [u8],
}

pub fn tcp_segment(packet: &[u8]) -> Option<Segment<'_>> {
    let version = packet.first()? >> 4;
    let mut source = [0u8; 16];
    let mut destination = [0u8; 16];
    let (offset, length) = match version {
        4 => {
            if packet.len() < 20 || packet[9] != 6 {
                return None;
            }
            let header = (packet[0] as usize & 15) * 4;
            let size = u16::from_be_bytes([packet[2], packet[3]]) as usize;
            let fragments = u16::from_be_bytes([packet[6], packet[7]]);
            if header < 20 || size < header + 20 || size > packet.len() || fragments & 0x3fff != 0 {
                return None;
            }
            source[12..].copy_from_slice(&packet[12..16]);
            destination[12..].copy_from_slice(&packet[16..20]);
            (header, size)
        }
        6 => {
            if packet.len() < 40 {
                return None;
            }
            let size = 40 + u16::from_be_bytes([packet[4], packet[5]]) as usize;
            if size > packet.len() {
                return None;
            }
            source.copy_from_slice(&packet[8..24]);
            destination.copy_from_slice(&packet[24..40]);
            let mut next = packet[6];
            let mut offset = 40;
            for _ in 0..8 {
                if next == 6 {
                    break;
                }
                if ![0, 43, 60].contains(&next) || offset + 2 > size {
                    return None;
                }
                let extension = (packet[offset + 1] as usize + 1) * 8;
                next = packet[offset];
                offset += extension;
                if offset > size {
                    return None;
                }
            }
            if next != 6 || offset + 20 > size {
                return None;
            }
            (offset, size)
        }
        _ => return None,
    };
    let header = (packet[offset + 12] as usize >> 4) * 4;
    if header < 20 || offset + header > length {
        return None;
    }
    let flags = packet[offset + 13];
    Some(Segment {
        connection: Connection {
            source,
            destination,
            source_port: u16::from_be_bytes([packet[offset], packet[offset + 1]]),
            destination_port: u16::from_be_bytes([packet[offset + 2], packet[offset + 3]]),
        },
        sequence: u32::from_be_bytes(packet[offset + 4..offset + 8].try_into().ok()?),
        syn: flags & 2 != 0,
        fin: flags & 1 != 0,
        reset: flags & 4 != 0,
        payload: &packet[offset + header..length],
    })
}

#[derive(Default)]
struct Flow {
    next: Option<u32>,
    waiting: Vec<(u32, Vec<u8>)>,
    gap_since: Option<u64>,
    last_seen: u64,
    recovering: bool,
    closed: bool,
}

#[derive(Default)]
pub struct StreamSet {
    flows: HashMap<Connection, Flow>,
    pub gaps: u64,
}

impl StreamSet {
    pub fn push(&mut self, segment: &Segment<'_>, now: u64) -> Vec<u8> {
        if self.flows.len() >= 64 && !self.flows.contains_key(&segment.connection) {
            if let Some(oldest) = self
                .flows
                .iter()
                .min_by_key(|(_, f)| f.last_seen)
                .map(|(key, _)| key.clone())
            {
                self.flows.remove(&oldest);
            }
        }
        let flow = self.flows.entry(segment.connection.clone()).or_default();
        flow.last_seen = now;
        if segment.reset {
            flow.waiting.clear();
            flow.gap_since = None;
            flow.closed = true;
            return Vec::new();
        }
        let sequence = segment.sequence.wrapping_add(u32::from(segment.syn));
        if segment.syn {
            *flow = Flow {
                next: Some(sequence),
                last_seen: now,
                ..Default::default()
            };
        }
        if flow.closed {
            return Vec::new();
        }
        if flow.next.is_none() {
            flow.next = Some(sequence);
        }
        let mut result = Vec::new();
        let mut next = flow.next.unwrap_or(sequence);
        let mut payload = segment.payload;
        let relative = sequence.wrapping_sub(next) as i32;
        if relative < 0 {
            let overlap = next.wrapping_sub(sequence) as usize;
            if overlap >= payload.len() {
                if segment.fin {
                    flow.closed = true;
                    flow.waiting.clear();
                    flow.gap_since = None;
                }
                return result;
            }
            payload = &payload[overlap..];
        } else if relative > 0 && flow.recovering {
            // A reported loss already invalidated framing. Keep the delivered
            // high-water for retransmission suppression, but resume at genuinely
            // new payload immediately rather than waiting for known missing bytes.
            if payload.is_empty() {
                return result;
            }
            next = sequence;
        } else if relative > 0 {
            if !payload.is_empty()
                && !flow
                    .waiting
                    .iter()
                    .any(|(seq, data)| *seq == sequence && data.as_slice() == payload)
            {
                flow.waiting.push((sequence, payload.to_vec()));
                flow.gap_since.get_or_insert(now);
            }
            let bytes: usize = flow.waiting.iter().map(|(_, bytes)| bytes.len()).sum();
            if flow.waiting.len() > MAX_PENDING
                || bytes > MAX_STREAM_BYTES
                || flow
                    .gap_since
                    .is_some_and(|start| now.saturating_sub(start) >= GAP_MS)
            {
                self.gaps += 1;
                flow.waiting.clear();
                flow.gap_since = None;
                next = sequence;
            } else {
                return result;
            }
        }
        if !payload.is_empty() {
            result.extend_from_slice(payload);
            next = next.wrapping_add(payload.len() as u32);
            flow.recovering = false;
        }
        loop {
            let candidate = flow
                .waiting
                .iter()
                .enumerate()
                .filter(|(_, (seq, _))| seq.wrapping_sub(next) as i32 <= 0)
                .min_by_key(|(_, (seq, _))| next.wrapping_sub(*seq))
                .map(|(index, _)| index);
            let Some(index) = candidate else {
                break;
            };
            let (sequence, data) = flow.waiting.swap_remove(index);
            let overlap = next.wrapping_sub(sequence) as usize;
            if overlap < data.len() {
                result.extend_from_slice(&data[overlap..]);
                next = next.wrapping_add((data.len() - overlap) as u32);
            }
        }
        flow.next = Some(next);
        if flow.waiting.is_empty() {
            flow.gap_since = None;
        }
        if segment.fin {
            // Keep a bounded tombstone so a replayed terminal segment cannot
            // open a new stream and emit already delivered bytes a second time.
            flow.closed = true;
            flow.waiting.clear();
            flow.gap_since = None;
        }
        result
    }

    /// Discard uncertain pending bytes after capture loss without forgetting
    /// which bytes were already delivered in each existing TCP generation.
    pub fn invalidate(&mut self) {
        for flow in self.flows.values_mut() {
            flow.waiting.clear();
            flow.gap_since = None;
            flow.recovering = true;
        }
    }

    pub fn expire(&mut self, now: u64) {
        self.flows
            .retain(|_, flow| now.saturating_sub(flow.last_seen) < 120_000);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn segment(seq: u32, payload: &[u8]) -> Segment<'_> {
        Segment {
            connection: Connection {
                source: [0; 16],
                destination: [1; 16],
                source_port: 123,
                destination_port: 456,
            },
            sequence: seq,
            syn: false,
            fin: false,
            reset: false,
            payload,
        }
    }
    #[test]
    fn reordered_and_retransmitted_data_is_emitted_once() {
        let mut streams = StreamSet::default();
        assert_eq!(streams.push(&segment(100, b"ab"), 0), b"ab");
        assert!(streams.push(&segment(104, b"ef"), 1).is_empty());
        assert!(streams.push(&segment(104, b"ef"), 2).is_empty());
        assert_eq!(streams.push(&segment(102, b"cd"), 3), b"cdef");
        assert!(streams.push(&segment(100, b"abcdef"), 4).is_empty());
        assert_eq!(streams.push(&segment(105, b"fgh"), 5), b"gh");
    }
    #[test]
    fn sequence_wrap_is_ordered() {
        let mut streams = StreamSet::default();
        assert_eq!(streams.push(&segment(u32::MAX - 1, b"abc"), 0), b"abc");
        assert_eq!(streams.push(&segment(1, b"def"), 1), b"def");
    }
    #[test]
    fn a_persistent_gap_is_reported_and_memory_bounded() {
        let mut streams = StreamSet::default();
        streams.push(&segment(1, b"x"), 0);
        assert!(streams.push(&segment(5, b"a"), 1).is_empty());
        assert_eq!(streams.push(&segment(6, b"b"), 6000), b"b");
        assert_eq!(streams.gaps, 1);
    }
    #[test]
    fn invalid_ipv4_fragment_or_truncated_header_is_rejected() {
        let mut bytes = vec![0u8; 40];
        bytes[0] = 0x45;
        bytes[2..4].copy_from_slice(&40u16.to_be_bytes());
        bytes[9] = 6;
        bytes[32] = 0x50;
        assert!(tcp_segment(&bytes).is_some());
        bytes[6] = 0x20;
        assert!(tcp_segment(&bytes).is_none());
        assert!(tcp_segment(&bytes[..10]).is_none());
    }
}
