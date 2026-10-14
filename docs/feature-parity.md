# Feature comparison and restoration checks

Product descriptions checked on 13 October 2026. This document compares the independent 0.8.1 baseline with the previous local Luma installation and published product descriptions. The historical table retains that baseline to show the work identified; the current preview includes strict personal/party identity, received assistance, partial character observations, map boss slots, timed training, recorded curves, persistent history, scoped reports, game-report comparison, automatic EU event presets/subscriptions, individual reminders/calendar export and optional same-PC OBS. See the [current feature and coverage list](../README.md). A feature name is not proof of equivalent protocol coverage or measurement accuracy. A manual note or timer is not counted as automatic game telemetry.

## Published comparison

| Product | Capabilities described by its publisher | Service boundary |
| --- | --- | --- |
| [Abyss Logs](https://github.com/karim-mo/aion2-abysslogs-dps-meter) | Personal and party views, healing, hit quality, observed specialities, rotation/buff timelines, timed training, boss HP/berserk projection, roster, event alerts and local history. | Online logs, badges and statistics depend on that provider's uploads. Its public download repository does not supply an openly licensed full implementation. |
| [Aion2t Premium](https://aion2t.com/premium) | Target and ally cooldowns; boss casts, targeting badges and configurable move alerts. | Current auction information, extended online history and character collections are collected website services. |
| [Aletheia](https://github.com/p62003/aletheia_AION2_DPS_Meter) | Party SkillMAP with range analysis, personal reports, damage/healing analysis and speedrun/class/skill comparisons. | The publisher marks the full party workspace, analyzer and some community tools as sponsor features. |
| [JaMeter](https://github.com/jeojabon/JaMeter) | Skill quality, damage taken/healing, buffs, readiness alerts, field-boss reminders, skill descriptions, combat-speed fitting and buff-adjusted performance. | Its efficiency grades and rankings require its model and uploaded population; they cannot be inferred from one local total. |
| [DaevaMeter](https://daevameter.online/) | Damage/healing/taken, observed equipment, rotation, boss casts, event selection and game-map boss timers. | Spatial replay is described as early testing. Public records depend on uploaded Global encounters. |
| [AionDPS](https://github.com/SkeeveAN/Aion-DPS-Meter) | Damage/healing, skill details, character observations, bosses, events and community records. | Client code is MIT. Game content and hosted user records need separate provenance; the MIT notice does not turn them into Luma-owned assets. |

These links document the comparison. They are not proposed footer links or automatic network dependencies for the Luma overlay.

## Current preview coverage

| Area | Implemented behavior | Remaining boundary |
| --- | --- | --- |
| Identity and DPS | Personal default; explicit/received identity and party membership; scoped direct/DoT totals, per-skill quality and separate totals/rates | Final synchronized live trials remain pending; only received eligible events can be measured |
| Training and analysis | Own-hit timed runs, retained sample curves/activity/progress and local game-report comparison | Incomplete/retention-limited curves remain unavailable; game report totals do not supply missing live events |
| Healing and damage taken | Verified NPC-to-player body damage, nullable unsupported HPS and retained unclassified amounts | HP healing versus resource/PvP distinction is not validated; effective healing/overheal is unavailable |
| Cooldowns, effects, boss assistance | Received own cooldowns/charges, windup/target records, applied/refreshed/removed effects and conditional max HP | No guessed readiness or complete named boss mechanic catalog; known layout coverage is bounded |
| Character and equipment | Partial own/login lists, unbound inspections, skills/Daevanion and frozen own encounter-start builds | Complete item/skill/icon catalogs and field coverage are not bundled; automatic ownership needs server self identity |
| Reports and history | Persistent local history, scoped HTML/CSV/JSON, anonymous export and bounded import | No automatic cloud upload, public verification or online percentile |
| Event clocks | Nine ready EU clocks, fixed public calendar subscriptions/cache, individual reminders and finite ICS | Community schedules are planned times; Nahma is provisional; unverified Arena/Beritra clocks are not invented |
| World bosses | Server map-slot alive/respawn observations and selectable compact countdowns | Unknown slots retain IDs; passed deadlines do not prove an actual spawn |
| Appearance and OBS | Four original layouts, editable palettes/backgrounds/fonts, independent row/summary choices and optional token-protected same-PC browser source | Native drag/resize/DPI still needs final executable checks; second-PC LAN mode is not included |
| Odyle and world rankings | Explicit manual Odyle planner and local personal progress | Automatic inventory and a shared verified world-ranking service are not implemented |

This is a capability comparison, not a claim that every premium feature or every encounter is supported. The historical requirements below also include ideas that remain future work.

## Baseline regressions and acceptance criteria

The earlier local installation advertised the behaviors listed below. That installation was GPL based; restoring behavior in the independent application does not mean copying its implementation into this package.

| Area | Independent 0.8.1 baseline | Restoration requirement |
| --- | --- | --- |
| Own character | Name records decoded in some supported layouts; own identity not exposed consistently | Keep name, class, server and actor identity separate; display own name, allow an explicit manual binding when login identity is missing, invalidate the binding on a new connection/character. |
| Personal totals | Nearby damage merged into the principal total | Default to personal damage/DPS; preserve an explicitly labelled observed-player view. Two nearby strangers must not alter personal total or personal encounter start. |
| Party totals | No proven live roster filter in the overlay | Include only a server roster or explicitly selected manual members. Unknown membership must show unknown status rather than all nearby actors. |
| Target filters | Manual boss marking; all/boss/both modes | Confirmed NPC identity, selectable targets, primary/sub-boss/nightmare/training categories, and distinct actor/target filters. Unknown NPCs keep their IDs. |
| Summons | Explicit owners supported; unresolved owners remain separate | Preserve explicit owner bindings through despawn; never give two same-class players each other's summon damage. |
| Hit quality | Critical counts, hit counts and min/max | Retain supported quality flags and nullable unknown counters; separate direct and DoT samples. Unvalidated direction must be labelled. |
| Healing and taken | Not decoded as complete independent telemetry | Classify from validated wire evidence, keep healing and incoming damage separate, preserve recipient/time data, and leave effective healing/overheal unavailable when missing. |
| Skill names and descriptions | IDs shown when no name is received | Runtime names and editable aliases now; bundle external tables only after provenance review. Names must not change exact skill ownership, cooldown IDs or hit grouping. |
| Timeline and curves | Totals only | Retain bounded timestamped amount samples and received cast/effect records; draw curves and range analysis only from the data actually present. Damage timestamps are not every cast start. |
| Active rates and burst | Not implemented | State the activity model and window, retain clipping/coverage, and compare equivalent durations. A local model must not be labelled the game's official active DPS. |
| Training | No dedicated timed measurement | Select dummy and own actor; start on the next direct owned hit, use exclusive 60/120/180/300-second cutoff, admit in-window DoTs and prevent unrelated players from starting the test. |
| Boss HP and finish | Observed current/peak HP and manual boss list | Decode a validated maximum separately, retain last known HP with freshness, finalize on confirmed completion/reset without ending the fight during mechanics. |
| Cooldowns and charges | Server-reported own cooldown/charge records supported | Add validated actor-bound records and selectable local notices; server ready, locally elapsed and unknown maximum charge count remain distinct. |
| Boss assistance | No validated cast countdown in baseline | Use received windup duration, cast/target events and applied effects with freshness/cancellation handling. Do not infer a precast timer from a damage hit. |
| Buffs and debuffs | No complete effect workspace | Decode apply/refresh/remove and persistent effects; preserve caster, recipient, instance and observed duration. Debuff classification requires a stated rule or validated field. |
| Equipment and build | Manual equipment notes only | Received own/login/inspection lists, nullable enchant/socket/stat fields, immutable encounter-start snapshots, and local same-character comparisons. Names alone cannot bind an inspection to a combat actor. |
| Odyle | Manual planning | Keep entered balances/predictions clearly manual until a genuine current/max resource field is validated. No pet progress, loot amount or MP field substitution. |
| History | Local encounter totals and bounded JSON export | Search, category/difficulty, notes/tags, deletion, matching local progress and build comparison; preserve source and incomplete-data flags. |
| Game reports | No importer | Independently validate the game-created report container/version and nullable counters before comparing the same timed run. |
| Sharing | JSON only | Scope-aware CSV, standalone HTML and bounded JSON collections; optional anonymous aliases; no automatic upload. Implemented and integrated in the current preview. |
| Events | User schedules and three-hour Rift draft | Region/source/timezone-aware calendars, reminders, chosen compact timer and finite calendar export. A recurrence alone does not establish its opening anchor. |
| Field bosses | Manual schedules | Decode the game-map list's alive/respawn times; unknown map slots remain slot IDs until an independently sourced mapping is confirmed. |
| Community rankings | Not included | A named, requested read-only dataset with target/difficulty/server/population scope, or an explicitly deployed Luma service. A local leaderboard is not a world rank. |
| Streaming and privacy | No separate OBS server | Optional source with access token, name hiding, explicit scope and bounded data. Current preview is loopback only; LAN needs a separate design. |
| Native interaction | Permission, drag and resize corrections in 0.8.1 | Test movement, close/Escape, minimum sizing, scroll, lock/click-through, saved position and multi-monitor DPI on the real Windows build. Browser layout tests do not prove OS window gestures. |
| Appearance | Twelve editable palettes and local background | Add independent preset layouts, own configurable colors/fonts/columns and coherent small-window limits. No setting may oscillate due to a render/save feedback loop. |
| Distribution | Portable preview with source and dependency notices | Repeatable signed/checksummed release process, rollback-safe preferences and separately tested live accuracy before claiming a complete replacement. |

## Independent implementation packages

1. **Identity and scope.** Finish own-name resolution, explicit override, session invalidation, personal/default view and observed/party boundaries before extending analysis. Verify with a replay containing self, two strangers, a real roster, character switching and summon ownership.
2. **Recorded combat and training.** Retain bounded owned direct/DoT/heal/taken samples, complete quality fields, synchronized timestamps, timed dummy capture and local curves/range analysis. Add models only after samples and coverage are preserved.
3. **Effects and boss assistance.** Implement the currently documented windup, cast, effect apply/refresh/remove and HP-maximum records with bounded parsing and unsupported-tail handling. Test local targeting, persistent effects, cancellation, stale events and capture invalidation before exposing countdowns.
4. **Character observations.** Decode login gear/skills/Daevanion and inspection separately, then freeze own build at encounter start. Add server, CP and gear power only from known fields. Runtime aliases and per-character armory imports can supply display names without a copied static catalog.
5. **History and tools.** Search, tags, matching personal trends, robust collections, scope-aware CSV/HTML, game report import and opt-in local streaming. These do not require a paid server.
6. **Events.** Combine observed map timers with source-labelled regional schedule presets and user calibration; add per-event reminders, header selection and ICS. Fixed opening times require regional evidence and an anchor.
7. **Community and advanced models.** A requested public top list can use a permitted API, but cannot supply an all-player percentile. Luma upload validation, cloud history, ready-state badges, speed-cap fitting, buff-adjusted damage and spatial replay each require their own dataset/validation work. No paid entitlement is planned; unavailable evidence stays unavailable.

## Current primary protocol evidence

The current [AionDPS commit](https://github.com/SkeeveAN/Aion-DPS-Meter/tree/72417dc72457844f514729fd2680fcbbd4423a93) was inspected separately from the old Luma source. It supplies MIT code and records its own validation boundaries.

| Package | Primary paths | Evidence and limit |
| --- | --- | --- |
| Names, roster and character lists | [Frame decoder](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/72417dc72457844f514729fd2680fcbbd4423a93/Client/Aion2/Protocol/Aion2FrameDecoder.cs), [opcode configuration](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/72417dc72457844f514729fd2680fcbbd4423a93/Client/assets/aion2/protocol/opcodes.json) | Login/appearance, gear, skills, Daevanion and inspection routes are present. Early calibration comments are not a guarantee for every later region. |
| Windup, cast, effects and max HP | [Combat frame findings](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/72417dc72457844f514729fd2680fcbbd4423a93/docs/protocol/combat-frames.md) | `09 38` supplies windup timing; `02 38` does not. `2a/2b/2c 38` distinguish apply/refresh/remove. `00 8d` kind 7 is a conditional maximum. Stagger duration and geometry still have stated limitations. |
| Direction/quality | [Hit kinds](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/72417dc72457844f514729fd2680fcbbd4423a93/docs/protocol/hit-kinds.md) | Direction bytes exist; the author explicitly leaves geometric back/front validation incomplete. Healing and DoT quality stays unknown when the record lacks it. |
| Field-boss times | [Aion2FieldBosses](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/72417dc72457844f514729fd2680fcbbd4423a93/Client/Aion2/Aion2FieldBosses.cs) | `01 91` reports alive/respawn timing by map slot. NPC mapping is separate; slots must not be guessed into boss names. |
| Optional official armory access | [nuriland API client](https://github.com/nuriland/aion2-api), [region configuration](https://github.com/nuriland/aion2-api/blob/main/config.go), [endpoints](https://github.com/nuriland/aion2-api/blob/main/endpoint.go) | Describes official character search/profile/equipment routes and distinct Global shards. Direct API availability was not verified in this comparison session. No bulk mirror or implicit account lookup is included. |

## Data provenance

The [AionDPS skill-table README](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/72417dc72457844f514729fd2680fcbbd4423a93/Client/assets/aion2/skills/README.md) says its catalog originated in an installed third-party meter and lists separately excluded, uncalibrated performance values. That provenance must be reviewed before bundling a table; a repository-wide MIT label alone is insufficient evidence for every third-party asset inside it. The [Aion2t terms](https://aion2t.com/terms) separately restrict copying/scraping their site content and retain game-content ownership.

No external skill/NPC/icon catalog was imported by this comparison. Current safe display paths are protocol-received player identities, validated entity IDs and user-entered aliases. Generic independent vector/class graphics can be created in Luma. NCsoft icons, client tables or another operator's database need a declared source, version and redistribution basis before becoming release assets.

## Release gate

The critical live gate is one synchronized 60-second solo dummy run against Combat Analyzer, plus an open-world run with nearby strangers and a real-party run. Verify names, self/party/observed totals, direct/DoT attribution, exact cutoff and capture health. Healing, buffs, gear, boss windup and map timers need separate targeted replay/live cases. Counted unit tests are evidence for the tested behavior; they do not certify untested content or full premium parity.
