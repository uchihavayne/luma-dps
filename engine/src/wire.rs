//! A reader for the game's newer message layouts: little-endian numbers, variable-length counts,
//! length-prefixed text, and booleans that share bytes. The first boolean of a message takes a byte
//! of its own; the next seven take that byte's other bits before a new byte is taken, wherever in the
//! message they come. A reader that gives every boolean a byte reads every later field wrongly.
//!
//! A failed read leaves the reader failed: later reads return zeros and `ok()` stays false, so a
//! decoder reads straight through and checks once at the end.
pub struct Wire<'a> {
    data: &'a [u8],
    pos: usize,
    bit_at: Option<usize>,
    bit: u8,
    ok: bool,
}

impl<'a> Wire<'a> {
    pub fn new(data: &'a [u8], start: usize) -> Self {
        Self {
            data,
            pos: start,
            bit_at: None,
            bit: 0,
            ok: true,
        }
    }

    pub fn ok(&self) -> bool {
        self.ok
    }

    pub fn position(&self) -> usize {
        self.pos
    }

    fn take<const N: usize>(&mut self) -> [u8; N] {
        if !self.ok {
            return [0; N];
        }
        match self.data.get(self.pos..self.pos + N) {
            Some(bytes) => {
                self.pos += N;
                bytes.try_into().unwrap_or([0; N])
            }
            None => {
                self.ok = false;
                [0; N]
            }
        }
    }

    pub fn u8(&mut self) -> u8 {
        self.take::<1>()[0]
    }

    pub fn u16(&mut self) -> u16 {
        u16::from_le_bytes(self.take())
    }

    pub fn i32(&mut self) -> i32 {
        i32::from_le_bytes(self.take())
    }

    pub fn i64(&mut self) -> i64 {
        i64::from_le_bytes(self.take())
    }

    /// An unsigned LEB128 value of up to 32 bits (counts and text lengths).
    pub fn varint(&mut self) -> u32 {
        if !self.ok {
            return 0;
        }
        let mut value = 0u32;
        let mut shift = 0;
        loop {
            let Some(byte) = self.data.get(self.pos).copied() else {
                self.ok = false;
                return value;
            };
            self.pos += 1;
            value |= u32::from(byte & 0x7f).checked_shl(shift).unwrap_or(0);
            shift += 7;
            if byte & 0x80 == 0 {
                return value;
            }
            if shift > 35 {
                self.ok = false;
                return value;
            }
        }
    }

    /// Text: a length, then that many bytes, a trailing zero byte not counted.
    pub fn text(&mut self) -> String {
        let length = self.varint() as usize;
        if !self.ok {
            return String::new();
        }
        let Some(bytes) = self.data.get(self.pos..self.pos.saturating_add(length)) else {
            self.ok = false;
            return String::new();
        };
        self.pos += length;
        let bytes = bytes.strip_suffix(&[0]).unwrap_or(bytes);
        String::from_utf8_lossy(bytes).into_owned()
    }

    pub fn bool(&mut self) -> bool {
        if !self.ok {
            return false;
        }
        let at = match self.bit_at {
            Some(at) => at,
            None => {
                if self.pos >= self.data.len() {
                    self.ok = false;
                    return false;
                }
                let at = self.pos;
                self.pos += 1;
                self.bit_at = Some(at);
                self.bit = 0;
                at
            }
        };
        let value = self.data[at] & (1 << self.bit) != 0;
        self.bit += 1;
        if self.bit > 7 {
            self.bit_at = None;
            self.bit = 0;
        }
        value
    }

    /// The length of a list. A count the rest of the message could not hold fails the read.
    pub fn count(&mut self, limit: usize) -> usize {
        let count = self.varint() as usize;
        if count > limit || count > (self.data.len().saturating_sub(self.pos)) * 8 + 64 {
            self.ok = false;
            return 0;
        }
        count
    }
}
