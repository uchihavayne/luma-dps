# Received character collections, zone and periodic amounts

This implementation uses received records on the existing local connection. It does not query an external character service, redistribute a game data dump or infer a complete collection from missing records.

## Character observations

* `56 36`: a supported own combat-power record has exactly 16 body bytes: current `u32`, four zero bytes, highest `u32`, four zero bytes. Both values must be positive and at most 100,000,000. Highest is a separately received field; a transient highest below current is retained rather than used to reject current. Unsupported shapes leave the value unknown. This is combat power, not item level or an official verified character badge.
* `33 36`: after independently validating the own identity header, a unique `100000, 100000` little-endian marker followed by two opaque `u32` fields and a supported `01`/`01 00 00 00 01` prefix identifies an equipped wing ID. IDs in the skin-only range are not accepted as wings. A following ID in `30400000..30499999` supplies the skin; otherwise the skin remains unknown. An absent or ambiguous marker supplies no wing observation. This does not enumerate all unlocked wings.
* `00 90`: the validated pet prefix is followed by the received species knowledge blocks. A unique, complete chain of groups 2 through 6 is required. Each block contains repeated group ID, `u32` level, `u64` progress, and counted pages/slots. Each nonempty effect stores its received page, slot, kind, stat ID and signed numeric value. Counts, levels, values and the whole frame are bounded. Unsupported/truncated species data does not discard an otherwise valid pet prefix. The stored values have no inferred names, thresholds, completion percentages or stat calculations.

These fields use the existing authoritative self binding. Pending own data expires after 30 seconds and cannot bind through a manually selected damage row. Each field preserves its receipt timestamp. A later equipment record cannot rejuvenate an older pending combat-power observation. Character changes and connection invalidation clear live ownership. Encounter-start build copies remain immutable.

## Zone announcements

`21 36` provides a local transition counter followed by a little-endian zone ID. Luma records the received ID separately from field-monster map lists. A different observed zone can segment encounter context. A repeated zone ID alone does not prove a new dungeon run; this implementation does not invent instance category, difficulty, boss identity or restart boundaries from numeric ranges or position proximity.

## Party context

The validated `02 97` roster header supplies the server party ID and capacity independently from its received member subset. The context is emitted before its members. The same party ID can carry a partial list, which must not erase omitted known members; a different nonzero ID starts a different party and cannot inherit the previous party's membership. Zero is not treated as a validated disband event. An empty recruitment description is valid, while a malformed/truncated roster cannot emit a context on its own.

## Periodic damage and healing

The supported `05 38` flag `0A` layout contains target, actor, stack, an effect ID, the damage amount and a trailing skill ID. The trailing skill is the skill attribution; the effect ID is a distinct identifier. The prior decoder incorrectly used that effect ID as the skill, though its amount was unchanged.

Flag `0B` adds a separate healing field before the trailing skill. That healing field is the received tick heal; the preceding amount represents the remaining heal total and must not be counted as damage or added again to healing. Flag `09` is an announcement without the actual damage/tick field and does not produce a live tick. Exact-end checks reject malformed or extra fields. The older flag `02` record remains supported with its legacy effect code because it does not carry a trailing skill.

For direct `04 38` amounts, extended forms 5, 6 and 7 use the same fixed byte region before the hit count/scalar/amount. Luma accepts all three, and the opaque middle byte does not become a variable-length field when its high bit is set. These forms remain subject to the normal source, target and amount checks; companion notices without the damage flag are excluded.

This is deliberately limited live healing coverage. The record does not supply effective healing, overheal, target missing HP before the tick or a complete direct-heal classification. Confirmed actor/body context and a supported player-skill family (`11000000 <= skill < 20000000`) are required before crediting a player's healing. A player-to-player amount is not automatically a heal. Summon spawn/full-health amounts, NPC self healing and classless resource effects do not become a party player's HPS. Imported character/CP/wing/context records are relabelled as imported observations rather than establishing a new live server binding.

Flag `0A` retains the effect ID until actor context is available. A documented NPC-effect proc can arrive with a player's class skill while restoring the NPC's own HP. Luma excludes a narrowly recognized uncertain shape from DPS/training only when the caster is a confirmed player (or its owned summon), the target is a confirmed NPC, the effect is a nine-digit NPC-family code ending in `11`, and the trailing skill has a supported player-family prefix `11..18`. The amount and event count are kept in current-encounter diagnostics and damage sample coverage becomes partial. This is an exclusion of an ambiguous amount, not a claim of verified healing. A nine-digit code alone is insufficient; normal ten-digit player effects, other suffixes, NPC-family skills and unresolved actor contexts continue through the existing amount classifier. Missing actor context and unsupported effect families remain limitations requiring capture validation.

## Retained HP observations

The assistance snapshot retains at most 512 actual received actor/HP observations, with receipt times and a shared retention-limit flag. It does not interpolate missing points or replace unknown max HP with the highest seen HP. Max-only records have no newly measured current HP; an explicit received zero remains zero. Frequent live IPC omits this history. Actor removal, capture invalidation and clock reversal clear the corresponding live history so reused IDs cannot inherit an old HP curve.

## Primary evidence

Wire facts were checked against the MIT [AionDPS frame decoder at revision `8459321`](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/8459321bf3405fbf41a1d7776d26fbbd22671d39/Client/Aion2/Protocol/Aion2FrameDecoder.cs) for species, wing, zone and periodic fields, its [direct-hit layout findings](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/8459321bf3405fbf41a1d7776d26fbbd22671d39/docs/protocol/hit-kinds.md), and the MIT [Waffle stream-parser findings at revision `cf885f1`](https://github.com/Waffle-ens/waffle_meter/blob/cf885f1a9fac1758a14164286ce4c28ce0a01660/dotnet/src/WaffleMeter.Capture/StreamProcessor.cs) for the combat-power record's validation shape. The Luma decoders and synthetic regression fixtures are independently written. Those repositories' bundled skill/item/NPC/image catalogs are not included. Supported wire forms still require regional live validation; passing synthetic tests does not establish complete EU coverage.
