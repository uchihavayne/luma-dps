# Reviewed game reference data

Luma's UI, native capture and encounter engine remain in this repository. The class artwork and NPC name facts added in 0.25.0 come from the public [Aion DPS Meter repository](https://github.com/SkeeveAN/Aion-DPS-Meter/tree/f7abcbf6ba0a4c5f85ca93d4abb89b5fb65c5eee), pinned to `f7abcbf6ba0a4c5f85ca93d4abb89b5fb65c5eee`. The upstream software license is preserved in `dependency-notices/aion-dps-meter-MIT.txt`.

## Class images

The nine `Client/assets/aion2/classes/*.png` images are bundled unchanged under `ui/assets/classes/`. Their SHA-256 values and class mappings are recorded in that directory's README. Class names and aliases select an explicit local file; unknown classes use a neutral indicator. No image host, account or download is needed while playing.

Game artwork, names and trademarks belong to NCSOFT. The upstream MIT software license and Luma's application license do not claim ownership of those game assets.

## NPC names

`engine/src/npc_names.json` contains 12,587 English NPC id/name pairs extracted from `Client/assets/aion2/npcs/npc_names.json` at the pinned revision. The original file SHA-256 is `c888b85da70901c7fe00a035dfdb514d27eeab0515f1a87200f4766653796d32`. Only id/name facts are retained; no descriptions, coordinates, icon databases or other application implementation are included.

A received NPC spawn model id resolves the name. Scene actor handles, damage amounts and nearby player names are never used to guess an NPC's name. Spawn text can name the NPC's target, so an exact catalog match takes precedence for confirmed NPC spawns. An unlisted model retains its received text; an unnamed unlisted model remains unknown. This catalog identifies NPCs, not player characters or owners of summons.

The same revision's `Client/assets/aion2/npcs/boss_npcs.json` supplies 559 exact boss model variants (source SHA-256 `fb376c3dc58f478de0d3323ee6ac89e8d8aeb28f29fdc74be03b6dc77a6c3c21`). Their sorted IDs are retained in `npc_catalog.rs`. Only a confirmed NPC spawn can use this classification. A large HP value or a scene handle does not identify a boss. Model matching applies to boss filters and completed encounters, with each encounter's own identities; reused handles cannot inherit an earlier classification.

Current and maximum HP still come from received health observations. Name lookup does not manufacture HP, infer maximum HP from the first reading, or subtract damage from a guessed maximum. A stale value is marked as last received. A known maximum enables a percentage; otherwise the bar is striped and displays the received current amount. A confirmed NPC death supplies zero current HP.

## Skill names

`ui/skill-names.mjs` holds 16,899 English skill id/name pairs copied unchanged from `Client/assets/aion2/skills/skill_names.json` in the same repository (revision `7e37d59b0a783a0685b8131cc50ef82cb7878ded`, file SHA-256 `8d5e30edb81d37f8f0735044a7b6ebf98e82ccdf25055be00752ff90abdcba9f`). The file states no terms of its own beyond the repository's MIT license, and its README says it was generated from the Aion 2 client database, so the names belong to NCSOFT. See [the notice](../dependency-notices/aion-dps-meter-skill-names.txt). Including it was a decision of the project owner; deleting `ui/skill-names.mjs` falls back to `Skill #<id>` everywhere.

A name is resolved only from the received numeric skill id, after the record's own name when it carries a real one. A real match covered 295 of 297 skill ids and all of the damage in one reviewed local history. Only damage and healing skill rows, rotation, reports, cooldown and windup labels use it; buff and effect ids have no table.

## Reviewed implementation differences

The reference meter resolves non-boss monster names through an NPC table, while Luma previously relied on optional spawn text. Luma now uses the same exact NPC-id lookup approach with the attributed data above. Its transparent meter, display preferences, scope totals and capture pipeline remain Luma's implementation. This change does not establish complete feature parity or certify live combat accuracy on every server version.
