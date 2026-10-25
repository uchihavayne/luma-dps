//! What the player carries: the full item list the game sends once (`11 56`) and the changes after
//! it (`1b 56`). Currencies are the items numbered 930100xxx; loot is an increase whose reason the
//! game lists as a drop, a reward, gathering or a quest. The layouts are the game's own item
//! messages, read the way a second meter documents them.
use crate::wire::Wire;

const MAX_ITEMS: usize = 20_000;

/// The increase reasons that are loot: a drop, a reward from combat, a dungeon, a monster, a box,
/// gathering, a quest or the abyss.
const LOOT_REASONS: [u8; 20] = [
    5, 12, 24, 25, 31, 35, 41, 43, 55, 56, 57, 58, 74, 75, 76, 77, 82, 85, 86, 93,
];
const REMOVE: u8 = 2;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Stack {
    pub key: u64,
    pub item: u32,
    pub count: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Change {
    pub key: u64,
    pub item: u32,
    /// What the stack holds after the change; zero when it was removed.
    pub count: u64,
    pub loot: bool,
}

pub fn is_currency(item: u32) -> bool {
    item / 1000 == 930_100
}

/// The details only equipment carries; they have to be read to reach the next item.
fn equipment_detail(wire: &mut Wire) {
    wire.u8();
    wire.i32();
    wire.i32();
    wire.u8();
    wire.i32();
    wire.i32();
    wire.bool();
    wire.u8();
    for _ in 0..wire.count(64) {
        wire.i32();
        wire.u16();
        wire.u8();
    }
    wire.i64();
    wire.u8();
    for _ in 0..wire.count(64) {
        wire.i32();
    }
    for _ in 0..3 {
        for _ in 0..wire.count(64) {
            wire.u16();
            wire.i32();
        }
    }
    for _ in 0..2 {
        for _ in 0..wire.count(64) {
            wire.i32();
            wire.u8();
        }
    }
    for _ in 0..wire.count(64) {
        wire.u16();
        wire.i32();
    }
    for _ in 0..wire.count(64) {
        wire.i32();
        wire.u8();
    }
    wire.u8();
}

fn stack(wire: &mut Wire) -> Option<Stack> {
    let flags = wire.u8();
    let key = wire.i64() as u64;
    let item = wire.i32() as u32;
    let count = wire.i64();
    wire.u8();
    wire.i32();
    wire.bool();
    wire.text();
    wire.i64();
    wire.bool();
    if flags & 1 != 0 {
        equipment_detail(wire);
    }
    (wire.ok() && item != 0 && count >= 0).then_some(Stack { key, item, count: count as u64 })
}

/// The whole item list (`11 56`); `None` when it fails or is not that message.
pub fn inventory(frame: &[u8]) -> Option<Vec<Stack>> {
    if frame.get(..2) != Some(&[0x11, 0x56]) || frame.len() > 1 << 20 {
        return None;
    }
    let mut wire = Wire::new(frame, 2);
    if wire.u16() != 0 {
        return None;
    }
    let count = wire.count(MAX_ITEMS);
    let mut stacks = Vec::with_capacity(count.min(1024));
    for _ in 0..count {
        stacks.push(stack(&mut wire)?);
    }
    wire.ok().then_some(stacks)
}

/// Changes to the item list (`1b 56`). Reading stops at the first entry that cannot be read; what
/// was read before it is kept.
pub fn changes(frame: &[u8]) -> Vec<Change> {
    if frame.get(..2) != Some(&[0x1b, 0x56]) || frame.len() > 1 << 20 {
        return Vec::new();
    }
    let mut wire = Wire::new(frame, 2);
    let count = wire.count(MAX_ITEMS);
    let mut rows = Vec::new();
    for _ in 0..count {
        let kind = wire.u8();
        let Some(stack) = stack(&mut wire) else {
            break;
        };
        let increase = wire.u8();
        wire.u8();
        wire.u8();
        if !wire.ok() {
            break;
        }
        rows.push(Change {
            key: stack.key,
            item: stack.item,
            count: if kind == REMOVE { 0 } else { stack.count },
            loot: LOOT_REASONS.contains(&increase),
        });
    }
    rows
}
