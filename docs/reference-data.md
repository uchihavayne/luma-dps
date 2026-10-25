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

## Game catalog (tickets, items, servers)

The game sends tickets, items and servers by number only. `ui/game-catalog.mjs` holds the English names the game's own screens show for them: 73 contents tickets with the most each holds (and with membership) and how it refills, 9,604 item names and 224 server names with their short tags, and 2,730 effect (buff and debuff) names with the control each one applies (stun, knockdown, airborne, fear, paralysis, sleep) and whether it harms, which is what the loss-of-control warning and the Effects window read. It is generated, not edited, by `tools/fetch_catalog.py`, which makes four read-only requests to the public game database that Questlog serves (`combatLog.entities.tickets`, `combatLog.entities.names`, `combatLog.entities.buffs` and `armory.getServers` of its AION 2 API, the same calls its own desktop app makes) and writes the module; `--check` says whether the committed file is out of date. Only names, numbers and refill rules are kept: no icons, art, prices or layout. The names are NCSOFT's, and the data was fetched on 2026-10-25; Questlog's terms for its database were not reviewed, so check them before redistributing this file beyond your own use. Luma never calls that service while it runs.

## World maps

The Map window uses seven pictures of the open-world maps in `ui/assets/maps` (the game's own, shrunk to 2048 x 2048, about 1.5 MB together) and `ui/maps.mjs`, which says where each picture's corners are in game coordinates. Both come from the public game database that Questlog serves: `tools/fetch_maps.py` downloads each picture once from its CDN, and the corner values were read from the map definition of that site's own client (a map is a grid of 102,000-unit sectors; north is the smallest y). Luma never fetches a map while it runs. The artwork is NCSOFT's, fetched on 2026-10-25; Questlog's terms for its CDN were not reviewed, so check them before redistributing the files beyond your own use. Dungeons, arenas and the middle and upper Abyss are tiled there and are not bundled.

## Game icons

The skills, effects, tickets and currencies are shown with the game's own icons: 683 small WebP files in `ui/assets/icons` (64 x 64, about 1.1 MB together, plus the game's gold and red Hidden Cube pictures at 128 x 128, which the Cube marker and the compass dock show instead of a drawn cube) and `ui/game-icons.mjs`, which maps a skill, effect, ticket or currency number to its file. They are generated by `tools/fetch_icons.py`, which takes the icon each id has in the same public game database (see above) and downloads it once from the CDN that database uses, shrinks it and writes it here; Luma never fetches an icon while it runs. A skill finds its icon through its own number, then its ten-step, then its family, and an id with no icon shows none rather than another one. The artwork is NCSOFT's, fetched on 2026-10-25; as with the names, Questlog's terms for its CDN were not reviewed, so check them before redistributing the files beyond your own use.

A name the player types always wins over the catalog, and a number the catalog does not know stays a number (`Eşya #id`) rather than being guessed.

## Reviewed implementation differences

The reference meter resolves non-boss monster names through an NPC table, while Luma previously relied on optional spawn text. Luma now uses the same exact NPC-id lookup approach with the attributed data above. Its transparent meter, display preferences, scope totals and capture pipeline remain Luma's implementation. This change does not establish complete feature parity or certify live combat accuracy on every server version.
