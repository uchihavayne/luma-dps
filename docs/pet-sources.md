# Pet reference data

The bundled `ui/pet-catalog.mjs` is a static reference for EU/NA pet farming. It contains **207 pets**, **495 monster/area records** and a source map link for **155 pets**, checked on **2026-10-18**. It is not a complete current-client catalog or a live spawn service. Its source describes global client build `0.0.4387.0`; newer pets and server changes can be missing.

The catalog supplies reference names, genus labels and places. The character's received level, progress and session gains still come from Luma's own packet decoder. Static reference data never changes a received character value. No character name, account identifier or capture is sent to these sources.

## Sources and reproducibility

* Pet IDs, English names, genera and monster/area facts come from [MartinLVila's published snapshot](https://github.com/MartinLVila/aion2-pet-overlay/blob/fd0214ade31b47577f5a6aaaa7e6aea21ac48eb8/data/pets.json), at commit `fd0214ade31b47577f5a6aaaa7e6aea21ac48eb8`. Its repository has an MIT license, reproduced below. Luma includes no code from that tracker.
* The snapshot credits [MetaBot.GG's AION 2 mounts data](https://metabot.gg/en/aion-2/mounts). Each of the 207 ID/name pairs was separately matched against the current primary list's explicit `own:m:<pet ID>` marker and its pet-page link. No name was matched to a raw packet ID by similarity or list position.
* Snapshot SHA-256: `2cc5f138ab34b6452e1383a5bb0e2c92b8ce14b3ca5049b070ec5d7bc2373641`. Its Git blob ID is `b808fb456bcf62270bfabd46394770a95d489393`. The primary-list HTML's SHA-256 is retained in the catalog's `primary_list_sha256` field. These identify the reviewed inputs, not a promise that a remote page will remain unchanged.
* [MetaBot.GG's data-use terms](https://metabot.gg/en/legal/terms-of-service) were checked on 2026-10-18. They permit reuse with attribution to the **specific source page**. Keep the per-pet `source_url` and display an ordinary source link wherever the referenced pet/location data is shown. Do not apply `nofollow`, `sponsored` or `ugc` to that attribution link. Do not imply that MetaBot endorses Luma. The repository's MIT notice does not replace these upstream data-attribution conditions.
* Game names and game content remain associated with NCSOFT. No game icons, map images, textures, models or promotional assets are bundled by this catalog.

The application does not fetch these pages automatically. A catalog update is a reviewed source change. A source link is a reference for the displayed facts, not a requirement to install another application.

## Soul counter semantics

The [tracker's pinned protocol observations](https://github.com/MartinLVila/aion2-pet-overlay/blob/fd0214ade31b47577f5a6aaaa7e6aea21ac48eb8/pet_protocol.py) describe a **per-level counter**: the full `00 90` list contains current levels and current points; `0D 90` supplies increments. The counter resets for the next tier. The independently published [AionDPS extraction notes](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/87671a06bd024f198f9d36f47d5d11728f45e3a9/Tools/aion2-dat/README.md) likewise describe 25 at level 1 and 75 at level 2.

| Received pet level | Next result | Current-tier requirement |
| --- | --- | ---: |
| 0 / not registered, when explicitly known | Register at level 1 | 5 |
| 1 | Level 2 | 25 |
| 2 | Level 3 | 75 |
| 3 | Maximum ordinary-pet level | No next tier |

The cumulative acquisition totals are therefore 5, 30 and 105. A received level-2 value of 32 means **32 toward 75**, rather than 32 lifetime souls toward 105. After a level transition, a missing fresh absolute baseline must remain unknown; it is not safe to subtract an old tier's value from the new requirement. Out-of-range or unsupported values must remain visible as received data without a fabricated remaining count. Missing inventory entries alone are not proof of level 0. An explicitly received level zero is preserved and, with a valid counter, can show registration progress. These thresholds concern ordinary global pets, not Genus Insight EXP or arbitrary soul-crystal conversions.

The [published packet observations](https://github.com/elkaida/AION2-pet-tracker/blob/main/docs/PROTOCOL.md), checked on 2026-10-18, describe the full-state level list as levels 0 through 3 and the points list as independently counted. Luma therefore keeps points-only rows without inventing a level. A header word that does not match a listed pet leaves summoned-pet identity unknown rather than invalidating the collection. Exact bounded parsing, duplicate checks and authoritative self binding remain required. The independently written regressions include a literal wire fixture, compressed TCP framing and delayed self identification; they are not a private captured game recording.

The initial list is received during character login. Starting Luma mid-session cannot recover that earlier packet; leave Luma open for one character re-entry. The UI refresh button reloads Luma's already received snapshot and does not send a packet to the game. Supported later soul increments and level changes update the received state. Catalog locations, reference bonuses and pinning remain usable before any live counter is received.

The [official NCSOFT Taiwan pet guide](https://tw.ncsoft.com/aion2/guidebook/view?title=%E5%AF%B5%E7%89%A9) describes a different regional maximum of five. It confirms the general soul/collection/stat system, but is **not** the source for EU/NA's three-level thresholds. Regional rules must not be silently substituted.

## Locations and map links

Each location records the source's map/zone name, area name and monster. Optional monster level and spawn count are source metadata, not live monster observations or guaranteed kills-to-completion. A pet with no location in this snapshot must not be labelled unobtainable or shop-only.

The upstream minimap `dots` are percentages inside a separately cropped per-monster viewport. They are not normalized coordinates of the whole world map. Luma therefore does **not** copy those dots, tiles or inferred `x/y` coordinates. The source's existing map URL is retained where available. Faction is left `unknown`, because a map's origin does not prove a player's access restriction during rifts or shared-world play.

## Owned effects and genus effects

The reference includes only explicitly listed level-1 and level-3 values. Level-2 values are not interpolated. The [MetaBot type-bonus table](https://metabot.gg/en/aion-2/mounts) and individual pet pages list the relevant stat names and values. Their interpretation as **per-pet owned effects** is cross-checked against the small aggregate genus examples published by [Aion2.gg](https://aion2.gg/database/pets): for example, 65 Fera pets multiplied by the listed level-3 values produces its stated genus total. This is labelled `verification: "cross-source-inference"`, not a character-stat packet.

These static owned-effect references are separate from Genus Insight levels, EXP, reroll slots and rolled options. No numeric combat-power gain, combined character bonus or random genus option is inferred from them. Special pets have no owned-effect rows in this reference; this does not assert that every future Special pet lacks all benefits.

Aion2.gg's current page reports 209 pets, but its [terms](https://aion2.gg/terms) prohibit building or mirroring a bulk dataset from the site. Its database was not copied. Only the cited, limited aggregate check was used; the bundled factual snapshot remains the 207-record source described above.

## Live continuity

Received values belong to an authoritative self identity. Transient capture loss, an auxiliary connection change or a backwards clock keeps eligible observations as `continuity: last-known` with a reason/time and per-row `progress_stale`. Farming-rate sessions reset. A received delta after a missing interval cannot advance the preserved absolute value. A fresh absolute inventory restores the baseline; missed gains are never estimated. Unknown levels remain unknown.

Routine overlapping game connection changes no longer require restarting the Windows capture session. Microsoft's [active-session constraint API](https://learn.microsoft.com/windows/win32/pktmon/packetmonitor/nf-packetmonitor-packetmonitoraddcaptureconstraint) permits adding exact filters during capture. At most 128 exact filters are retained; a synchronized gate accepts only currently owned AION2 tuples before queueing. Removed tuples cannot deliver through cached filters. A true game connection change, cache limit or API failure retains the filtered restart fallback. This reduces avoidable gaps; it does not claim that real packet loss can be recovered without new received state.

Confirmed character/name/server changes, a true connection generation change or a reset of a flow previously validated by pet messages clear old ownership. A new login list must wait for fresh authoritative self identity. Old per-flow associations are bounded and reset with the generation. The UI also retains same-actor values on a failed snapshot read, marks them last-known and fetches after missed-packet changes. A source timestamp is not rejuvenated by a refresh.

The EU local test confirmed initial counter arrival after character re-entry; the subsequent disappearing-counter report led to these continuity changes. Extended live continuity, exact value comparison and all-pet coverage still need validation.

## Upstream MIT notice

MIT License

Copyright (c) 2026 MartinLVila

Copyright (c) 2026 AION2-pet-tracker contributors (pet_protocol.py is adapted from their work)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
