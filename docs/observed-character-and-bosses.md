# Observed character records and map boss slots

These modules consume the same received game connection as damage. They do not install a capture driver, query another meter's account, open game windows automatically or bundle an item/skill/icon catalog.

## Character records

| Record | Stored observations | Boundary |
| --- | --- | --- |
| `11 56` login equipment | Item ID, slot, validated enchant, stone stat/tier, rolled stat values, godstone ID and skill-level bonuses where their structural blocks match | Gear coverage is explicitly partial. Unknown detail fields remain null; zero means a received zero. |
| `00 51` login skills | Counted skill records with total/base levels, including unknown IDs | The supported counted layout consumes the whole frame. Unsupported record kinds are rejected rather than recovered by scanning for familiar names. |
| `26 e2` login Daevanion | Board IDs and activated node IDs | Complete bounded count parsing; duplicate/truncated lists fail atomically. No node effects are guessed from their IDs. |
| `50 36` inspection | Received name, class code, level, gear score and validated equipment blocks | No combat actor ID is supplied. These profiles stay unbound, including when the name matches the local character. Equipment coverage stays partial. |

Login lists belong to the receiving character but do not supply an actor ID themselves. Luma keeps them unbound until an explicit server self identity arrives. Pending lists expire after 30 seconds. A manually chosen damage row or a typed alias does not establish equipment ownership. Character switching, reconnection and capture invalidation clear the live observations.

Each list has its own observation timestamp. Encounter-start build records are immutable copies; later equipment or login data cannot fill a missing earlier snapshot. An item name or stone value requires a separately verified data source. Current display can use received IDs and explicit user labels without changing the measurements.

Gear entry recognition deliberately requires structural item markers. Inspection items additionally require a consistent stone/owner block; the owner identifier is discarded. Failed detail parsing does not produce a +0 enchant, empty stone collection or invented slot. Partial coverage is not a complete equipped-build guarantee.

## Field bosses

`01 91` carries map ID, numbered slots, alive/dead state, optional positions and server timestamps. An alive row's timestamp is its reported spawn time; a dead row's timestamp is its reported respawn time. Zero is unknown. The module retains these meanings separately and records when Luma received the list.

The wire record does not contain a boss NPC ID or name. Luma displays map and slot IDs until a separately validated mapping exists. A passed respawn deadline does not prove the boss spawned: a fresh game-map list is needed. This differs from a user-entered recurring event schedule.

The parser bounds frames, slot count, numeric values and alternative offsets for the observed optional byte. Duplicate slots, ambiguous parses, noncanonical IDs, impossible timestamps and malformed trailing data fail before any map state changes. Updates replace that map's previous list; retention is limited to 16 maps and 64 slots per map. No recurring schedule is inferred from one observed timestamp.

## Primary evidence

Wire facts were checked against [AionDPS revision 72417dc](https://github.com/SkeeveAN/Aion-DPS-Meter/tree/72417dc72457844f514729fd2680fcbbd4423a93): [character decoder](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/72417dc72457844f514729fd2680fcbbd4423a93/Client/Aion2/Protocol/Aion2FrameDecoder.cs), [public character regressions](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/72417dc72457844f514729fd2680fcbbd4423a93/Client/Combat/SelfCheckAion2.cs) and [map boss records](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/72417dc72457844f514729fd2680fcbbd4423a93/Client/Aion2/Aion2FieldBosses.cs). The independent modules and synthetic tests do not copy those methods or bundled catalogs.

The counted `00 51` entry boundary is an inference checked against that revision's public 63-entry fixture: normal records occupy 16 bytes; kind 5 includes one additional opaque byte. This layout still requires live regional validation. Static catalog provenance remains separate, as described in [feature comparison](feature-parity.md).
