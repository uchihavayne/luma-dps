# Received Odyle energy and Contents Tickets

Luma decodes the server's Contents Ticket records independently. It does not infer Odyle from mana, pet progress, loot or a manually entered planner value.

## Protocol evidence

The pinned [EU ticket findings](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/92806d72b1bb9cec4d092dc601d23447c7d67e29/docs/protocol/ticket-frames.md) report exact-length validation against 25 login lists and 56 changes from 10–13 October 2026:

| Frame, including opcode | Structure after opcode |
| --- | --- |
| `0B 61` | Entry count `u8`, then that many ticket entries |
| `0C 61` | Flag `u8`, one ticket entry, reason `u8`, and a gained `u32 LE` when flag is 1 |

A ticket entry contains a mask `u8`, ticket ID `u32 LE`, then selected fields in order: mask bit `0x01` selects remaining time `u64 LE` in milliseconds; `0x04` selects count `ULEB128`; `0x08` selects bonus `ULEB128`. Omitted fields are zero, including in updates. Odyle is ticket **60000001**: count is regular energy, bonus is additional energy, and their sum is the observed total. Other ticket IDs remain separate observations.

The [pinned membership findings](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/92806d72b1bb9cec4d092dc601d23447c7d67e29/Client/Aion2/Aion2Tickets.cs) describe the `3B E3` benefit list: count `u8`, then 21-byte entries containing effect ID `u32 LE`, a flag byte, and start/end Unix milliseconds `u64 LE`. Effects 34–42 identify the observed membership benefit set. The normal/membership regular-energy capacities are 560/840. This is a rule derived from membership evidence, not a maximum transmitted with the Odyle ticket.

## Luma behavior

- The decoder requires a complete frame and consumes it exactly. Unknown mask bits, unsupported flag shapes, duplicate ticket IDs, malformed or overflowing varints and trailing bytes fail validation. Frames, counters and stored records are bounded.
- Login lists clear the old resource owner immediately. The new list waits up to 30 seconds for a newly received authoritative self-character record. Cached names, nearby players and manual identity overrides do not bind it.
- Capture loss, a connection reset or a character change clears the resource state. A missing ticket remains unknown; a present zero remains zero. Absolute updates replace both energy components without inventing gains or retaining an omitted component.
- Regular capacity remains unknown until a complete supported membership observation exists. Bonus energy has no inferred capacity. Conflicting regular-energy observations remain visible without clamping; the incompatible capacity becomes unknown.
- The remaining-time field is retained as an observation. Luma does not interpret it as the next Odyle recharge, infer server time or automatically apply a refill to the received balance. The planner remains separate.

No external game catalog, implementation or private capture is redistributed. Decoder/state tests use independently constructed frames; UI tests check identity, numeric validation, membership expiry and the distinction between regular, bonus and total energy. Passing these checks does not replace a synchronized in-game comparison of the final executable.
