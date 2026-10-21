# Changelog

## 0.23.0 · 21 October 2026

- Added an integrated coordinate radar with 20–200 metre ranges, party/creature/pet filters and pet pin actions. Only received positions are shown; cast aim points remain separate from actor positions.
- Added local encounter replay with play/pause, scrubbing, speed controls and self/party/observed retained-hit totals. New recordings retain bounded position paths and actor generations; older recordings play their available hit timeline.
- Recovered nearby names from a bounded typed nickname profile and preserved home servers in acting-player appearance frames. Permanent character-list IDs are not substituted for combat actor IDs. Added Brawler class metadata.
- Fixed old capture gaps permanently disqualifying subsequent clean boss-DPS bests and completeness checks. Gaps during the active encounter still invalidate coverage.
- Kept radar controls stable during updates. Scoped JSON preserves selected spatial data; anonymous exports omit paths and embedded identities. No complete server-wide Top 10, calibrated world bearing or complete feature parity is claimed.

## 0.22.0 · 21 October 2026

- Add automatic highest-single-PvE-hit records for server-identified self and confirmed game-party members, keyed by received character/home server/class. Ties and smaller hits do not create records. Received summon-owner attribution is respected; nearby strangers and manual rosters cannot establish party records.
- Persist up to 512 local records with validated bounded JSON, atomic replacement, delayed writes and visible storage errors. Reconnects preserve records; startup, history imports and browser demos cannot replay or create native live notices.
- Add a quiet same-window New personal best card, coalesced updates, fixed display lifetime, dismissal, hidden-name handling and Me/Party/Off notification preferences. Add searchable/filterable Personal bests cards with previous score and percentage improvement.
- Keep single-hit damage distinct from DPS. Completed personal single-boss DPS records require complete retained samples, no stream gaps, at least ten seconds, and matching received character/class/server/map/NPC/reported-maximum-HP context. This does not verify difficulty or a boss kill.
- Give the player roster more room on 720p/laptop fullscreen dashboards and improve DPS contrast over green/yellow/orange/red performance bars and retain separate total-damage/rate labels, saved typography, light/dark themes and responsive fullscreen layouts.
- Add regression checks for strict increases, party/identity boundaries, summon attribution, pause, bounded persistence, exact rate comparison, notification throttling and safe rendering. Review current Questlog and A2 Pro public feature descriptions; spatial radar/replay and broader unreceived counters remain documented gaps.


Entries describe preview builds. Live validation is listed separately from automated checks.

## 0.21.1 preview · 2026-10-20

- Automatically save received pet counters locally for each server-confirmed character and home server. Restore prior-session counters as visibly last received after the same profile is confirmed. New server baselines take precedence; missing offline gains are never invented or added to stale counters.
- Retain the validated home-server field from the own identity packet so saved pet profiles remain isolated across servers without manual configuration. Keep storage bounded, validate disk records and report storage failures in the pet guide.
- Show actual session soul gains even before the initial inventory baseline arrives. Pinning the pet preserves that counter; it no longer replaces a received gain with only “counter not received”. Unknown totals do not receive a fabricated percentage or ETA.
- Label target rankings as received/observed contributions; local capture completeness does not prove that every world-boss hit was broadcast. Refresh the publisher comparison and record this protocol limitation.
- Coalesce character reads through identity/revision changes so refresh and diagnostic export wait for the current in-flight snapshot instead of returning early. Same-character revisions do not discard a valid snapshot, and a bounded catch-up prevents a busy stream from keeping the reader pending indefinitely.
- Add disk roundtrip, profile/server isolation, stale/future data, fresh-level replacement and concurrent-read regressions. First-time missing login data, full live pet continuity and live World Boss coverage remain separate validation limits.

## 0.21.0 preview · 2026-10-18

- Add a reproducible automated release gate with source fingerprints, fail-closed test discovery/timeouts, local JSON reports and a CI build barrier. Independently review the gate itself and test stale-success and missing-module failures.
- Preserve confirmed pet collection ownership through self death/despawn while invalidating old character/session generations. Reject delayed previous-owner snapshots, retain disconnected/clock-reversed counters as last-known, and stop their ETA/recent-gain estimates. Preserve pressed/focused pet guide controls through live updates.
- Freeze completed boss classifications across zone/reconnect boundaries without carrying them into a new encounter. Keep incomplete party totals and missing target clocks unknown. Preserve pressed player rows until release during live ranking changes.

- Keep same-encounter observed target boards available independently of the Boss category filter. Add a direct target selector for the observed Top 10, including targets without a boss label or a recent personal hit. Preserve a real personally attacked target while fresh received damage continues on it; clear continuity on identity, encounter or capture discontinuities.
- Show a dedicated same-window target DPS, personal contribution and rank summary, including a personally hit target before other contributors arrive. Automatically show a single fresh shared target with ten or more received contributors; multiple candidates remain selectable. Do not infer a boss classification from crowd size.
- Distinguish Boss-filtered damage, missing identity/contribution and undecoded traffic from measured zero. Retain an unfiltered encounter summary and offer a direct Show All action. Preserve missing/invalid rates as unknown rather than turning them into zero.
- Fix paused-time subtraction shrinking a completed personal/target activity window and inflating its DPS. Preserve zero scoped durations and derive missing rates from their matching scoped total and duration.
- Keep every pinned pet accessible in compact mode, increase saved pins to twelve and append one recent unpinned soul-gain row with a direct Pin action. Display received points when the level is still unknown instead of claiming no counter was received.
- Add a direct Show DPS action from the pet workspace, preserve pressed tracker controls through refresh and clarify the duration used by target rankings. Refresh the feature comparison from six current publisher sources; unsupported radar/map/full-catalog features remain explicitly listed.

## 0.20.4 preview · 2026-10-18

- Automatically report the local Windows version/build, system/app architectures and System32 Packet Monitor DLL/export availability in **Settings → Controls → Capture compatibility**, also reached from a capture error notice. Copy or save the bounded JSON report locally; no automatic upload is added.
- Keep the inspection read-only: no capture initialization, extra UAC prompt or network request. Required exports being present does not confirm that a capture session can start.
- Distinguish API loading, version and unsupported-operation failures; retain actual permission codes and stop treating generic error text as an unsupported Windows version. No capture fallback or Windows 10 compatibility fix is claimed.

## 0.20.3 preview · 2026-10-18

- Keep visible controls usable while locked click-through is enabled, in window and fullscreen modes. Only their clipped input regions and pet scroll areas accept input; surrounding space still passes clicks to the game. Preserve an accepted pointer press through release and reject stale input-policy writes after mode or drawer changes.
- Pin the pet the user selected from the displayed suggestion without silently cancelling when its recent-hit timer expires. Keep a pressed suggestion connected through the click.
- Expand and show the tracker after adding a pet, scroll the added row into view and confirm the action. Preserve existing pins and the six-pet limit.

## 0.20.2 preview · 2026-10-18

- Preserve the server NPC template ID through the combat engine and live target snapshot. Match it to validated pet-location IDs even when the spawn has no monster name; scene actor IDs are never used as template IDs.
- On a received pet level event, start that tier at zero and apply subsequent soul gains. Decode the separate registration event and bounded documented level/registration prefixes with opaque suffixes. A completed local threshold alone does not invent a level change.
- Keep duplicate registration/level notifications from erasing already received progress. Add focused regressions for the previously failing unnamed-monster and tier-transition paths.
- Provide visible pet matching status and an explicit, bounded local diagnostic export for troubleshooting.

## 0.20.1 preview · 2026-10-18

- Let the pet list fill the available height whenever DPS is hidden, including views with other modules still enabled. Keep one scrolling list in small windows and remove the duplicate pet introduction card while the tracker is visible.
- Offer direct pet pinning beside a recently hit personal target when its received monster name exactly matches the pet reference. A target may offer more than one pet; each uses the existing six-pin limit and saved preferences.
- Keep the last received target suggestion briefly after a kill, measured from the actual hit time. Clear it on a new target, identity change, capture gap or disconnection. Scene actor IDs and partial names are never treated as catalog IDs.

## 0.20.0 preview · 2026-10-18

- Add saved module visibility controls and a pet-only preset. Users can hide DPS, Cube, event, Odyle and team sections independently and restore them from the persistent header control. Visibility choices do not silently change capture or listening settings.
- Keep verified self-bound pet observations as explicitly last-known values across transient capture loss. Invalidate their live counter baseline and farming rate; missed increments are not guessed. A fresh received absolute counter restores its baseline. Confirmed identity or connection-generation changes still clear ownership.
- Update bounded exact Windows capture constraints while a session is active when the owned game connection set overlaps. Current process ownership is checked before queueing; removed tuples cannot deliver through cached filters. A full filter cache, failed API update or a real game connection change uses the filtered restart path.
- Give pinned pet trackers a more visible counter, percentage and colored progress bar, with separate unknown and last-known states. Keep the guide, tracking and module controls in the same window.

The initial pet-counter and filter fixes from the 0.19.1 local test are included. Live checks confirmed initial counter arrival; extended continuity and value comparison remain separate validation steps.

## 0.19.1 local test · 2026-10-18

- Preserve explicitly received level-zero pets and independently counted soul rows. A soul row without a level remains an observation with an unknown level, rather than rejecting the full pet list or inventing registration progress. An unrecognized header word no longer discards the collection or claims a summoned pet.
- Carry explicit level zero through the UI and calculate ordinary-pet registration progress only from a valid received counter. Keep malformed, duplicate and truncated collections atomic.
- Explain when the initial pet list has not been received. Add clear-filter and reference-catalog actions so received-only filters cannot hide all location, bonus and pinning information without an explanation. The refresh action reads data Luma has already received; it does not request missing packets from the game.

Opening Luma after character login does not recover an earlier pet list. Start Luma before one character re-entry to receive the initial collection; subsequent supported gains update automatically. Live EU validation remains pending.

## 0.19.0 preview · 2026-10-18

- Make the main fullscreen control open a responsive dashboard that fills the viewport, with larger measurements, readable participants and an integrated Cube dock. Preserve the small draggable/resizable transparent HUD as a separate layout, its saved size and the normal window geometry. Compact-strip preferences no longer collapse the fullscreen dashboard.
- Keep fullscreen layout changes authoritative alongside native window state, so a queued theme/opacity save cannot restore a stale HUD mode after a fullscreen shortcut. Retain the required global recovery shortcut, drawer interaction and zero-background-opacity support.
- Add a same-app pet guide with 207 reference pets, 495 monster/area records and source map links for 155 pets. Include search, genus/status filters, remaining/recent sorting, next/max goals and up to six pinned trackers above the DPS roster. Preserve source attribution; map links open reference pages rather than supplying in-game GPS or live routing.
- Correct ordinary EU/NA pet progress to use current-tier soul requirements of 5/25/75. Bind absolute lists and increments to confirmed self identity, invalidate stale baselines across gaps and level changes, and keep unsupported values unknown. Show remaining souls only from valid counters and ETA only from a valid observed gain rate; do not infer a future drop rate.

Browser checks confirm a 1920 × 1080 dashboard fills that viewport. Geometry, layout-state and pet-counter regressions cover the implemented cases. Actual AION2 pointer routing, global rescue, monitor/DPI transitions, EU pet baseline/counter integration and real Cube navigation still need live validation. The static reference is not a complete current-client catalog. See [pet sources](docs/pet-sources.md) and [feature coverage](docs/feature-parity.md).

## 0.18.0 preview · 2026-10-18

- Decode supported canonical variable-length prefixes in own/nearby character snapshots and retain received class suffixes. Read structurally validated member-profile names before or without a party roster, while keeping exact home-server matching, local identity and party membership separate. Missing received names remain explicitly pending; not every anonymous actor is claimed to be resolved.
- Remove unconfirmed zero-damage participant artifacts without discarding uncertainty counters, real confirmed zero-DPS support actors or received positive-damage contributors. Do not relabel saved reports with guessed names or distribute private captured records as fixtures.
- Verify supported summon ownership against both the spawn's varint owner and its tagged `u16` repetition. Stop treating an unverified bare `04 8D` prefix as ownership; decode the exact short death shape separately. Freeze prior attribution when a pet/NPC actor ID respawns, then reset stale owner/name/class/health metadata.
- Add an integrated recently attacked personal-target HP view, preserved across boss filtering. Track actual-current HP timestamps separately from maximum updates; clear freshness after capture gaps and leave missing maximum/percentage unavailable.
- Open a bounded **Observed Top 10** automatically for a boss or a shared PvE target with at least two observed contributors, without party membership. Retain the own rank beyond the first ten and separately known party totals. These are received same-target contributions, not official server-wide or world rankings.
- Improve faint Cube-reference evidence with a longer analysis path while requiring fresh stereo support for a side arrow. A weak match may take about two seconds and still leave direction unavailable. Balanced, mono, stale or uncertain direction does not produce an arrow; stereo does not establish GPS position, distance or an absolute bearing.
- Keep target HP, Top 10 and the inline Cube dock clear of connection notices. Match header and footer totals to the selected target, preserve access to personal/party/nearby lists, and retain scrollable contributors in short windows with dark and light themes.

Replay and UI checks cover the implemented cases. Live EU name recovery, shared-target totals and HP transitions, actual pointer behavior over AION2, and real faint Cube detection/steering remain pending. The 0.17 fullscreen implementation retains its native game-interaction validation limits. No full premium parity, complete protocol/catalog coverage or perfect detection is claimed; see [feature coverage](docs/feature-parity.md).

## 0.17.0 preview · 2026-10-18

- Recover received nearby player names from typed `04 8D` appearance records instead of discarding the acting character's name as an ownership notice. Hold early structural profiles briefly for an exact current party name/home-server match; clear pending bindings after loss, reconnect, despawn, clock reversal or party changes.
- Keep confirmed local identity separate from nearby announcements. Prevent actor-ID reuse from relabelling an earlier completed encounter or inheriting the previous occupant's class/health. Replace unconfirmed placeholder names with actor IDs while preserving a server-confirmed character literally named `Unknown`.
- Add the compact Luma Clear layout and dark Graphite/light Pearl palettes, with cleaner spacing and value hierarchy. Compact rows place names, damage/DPS and shares on one line; new installations start at 420 × 340 while saved geometry is preserved. Relative-DPS bars progress from green through yellow/orange to red against the displayed roster's highest DPS; class and theme colors remain optional.
- Make the player-list text-size setting apply to player names and values across all layouts, up to 200%; larger text expands rows while controls retain their usable size.
- Add a transparent fullscreen canvas with a draggable/resizable HUD and settings/analysis drawers in the same window. Preserve normal window geometry across fullscreen transitions and drawer closure. Background opacity now supports the full 0–100% range without hiding text or values.
- Add the default global fullscreen recovery shortcut `Ctrl+Alt+Shift+F5`; require a working rescue binding before entering fullscreen. Local `F11` toggles the mode when Luma has keyboard focus. `Escape` closes an open drawer before exiting fullscreen; clicks outside the HUD are routed through to the game.

Replay and interaction tests cover the implemented cases. Live EU name/combat checks and actual fullscreen pointer routing, shortcuts, multi-monitor and display-scaling behavior over AION2 remain pending. Full premium parity, missing protocol data and unsupported catalogs are not claimed; see [feature coverage](docs/feature-parity.md).

## 0.16.0 preview · 2026-10-16

- Decode supported own character power, equipped wing and species progression; retain actual zone boundaries without guessing dungeon identity or completion. Clear stale character observations after capture discontinuity.
- Keep explicit received periodic healing and per-skill HPS separate from damage, personal DPS and training. Correct trailing periodic skill IDs and exclude the narrowly identified ambiguous NPC recovery proc from DPS with partial-coverage disclosure.
- Add rotation/activity analysis, per-skill received effect overlap, fresh boss HP trend projections and grouped map/local sessions in the same analysis drawer. Preserve full bounded timelines, HP observations and healing through local history and anonymous exports.
- Add six configurable global shortcuts, 200% UI scale, compact strip, optional click-through lock with a working rescue shortcut, game-aware topmost behavior, idle fade and roster name hiding. Preserve settings drafts, analysis expansions and normal window geometry.
- Extend optional OBS streaming to a second computer on a private LAN. Keep exposure off by default, access keys fresh and party scope tied to confirmed membership.
- Add free public/unlisted/private sharing, separate hashed viewing capabilities and public opt-in class/CP-band community statistics. Private and unlisted reports cannot enter rankings. Sparse cohorts remain unavailable; community percentiles are record-based and not official game rankings.
- Add update checks and explicit download/install using an embedded publisher public key, RSA-PSS signatures, SHA-256 and an atomic native replacement helper. No unsigned update fallback or automatic installation.

Automated tests cover the specified layouts and failure cases. Live EU content, second-PC OBS and an actual self-update still require final interactive checks. Full catalogs, universal live healing, exact Cube coordinates and official game-verified world rankings are not claimed; see [feature coverage](docs/feature-parity.md).

## 0.15.0 preview · 2026-10-16

- Read supported actor-bound cast cooldowns directly from game traffic. Confirmed party members do not need Luma, an invitation or a room. Keep actual cooldown duration, observed uses and next-charge recharge separate; never invent available charges or readiness when a timer expires.
- Decode incremental party additions/removals and uniquely matched player profiles, including non-damaging healers. Invalidate bindings after capture gaps, reconnects and actor reuse. Keep completed encounter membership separate from the current live team.
- Put the automatic team board first in the existing analysis drawer, with class filtering and optional compact DPS-row indicators. Move cross-device rooms into an optional advanced section. Preserve active-sharing visibility, form drafts and keyboard focus while observations age.
- Keep all 200 retained desktop encounters available to history filters. Clear imported records on disk before removing them from memory; a failed write preserves the records. Keep manually selected boss actor IDs within their current game session.
- Allow whole-second training durations from 10 to 300 seconds. Retain up to 600 passive connection RTT observations per encounter with average, minimum, maximum, P95 and a graph. Preserve bounded samples in scoped HTML/CSV/JSON exports and shift their timestamps in anonymous reports.

Automated replay and integration checks cover the accepted layouts and failure cases. Live EU party cooldown/charge validation remains pending. Unsupported catalogs, game-wide verified rankings, complete live healing and other limits remain listed in [feature coverage](docs/feature-parity.md).

## 0.14.0 preview · 2026-10-15

- Read EU ContentsTicket snapshots and updates for automatic Odyle. Keep regular energy, bonus and available total separate; derive the regular capacity only from received membership evidence. Login records wait for authoritative self identity; capture gaps and character changes clear old ownership.
- Correct own cooldown semantics: raw server counters are not milliseconds. Learn a rate from consistent decreases, mark time estimates with `~`, and reserve confirmed readiness for a fresh received zero. Ignore the unvalidated `0x2238` charge layout.
- Add explicit free team rooms in the same analysis drawer. Participants share only their own name, class and cooldown observations; room membership does not establish game-party membership. Show received completed party casts separately, including actors who have not dealt damage.
- Keep team capabilities in memory, hash them on the service and expire rooms after two hours. Bound participant count, request size and free daily usage. Age observations through HTTP delay and clock changes; report unconfirmed remote closure honestly.
- Add local history search, filters, favorites, notes, tags and comparisons between eligible personal boss encounters. Preserve incomplete-capture evidence and do not send annotations with shared reports.
- Add automatic Odyle and active-room chips without replacing the DPS roster or Cube compass. Keep form focus, invitation drafts and expanded skill details stable during live updates.

Replay, native client, SQLite/API and UI checks cover the implemented cases. A synchronized live Odyle and multi-player cooldown check remains pending. Full premium parity, complete catalogs, official rankings and universal protocol coverage are not claimed.

## 0.13.0 preview · 2026-10-15

- Add Sharing and rankings to the existing analysis drawer: explicit aggregate-only upload, anonymous names by default, separate ranking participation, filtered community results, link copying/opening and revocation. No automatic uploads or account requirement.
- Add free offline encounter-text sharing alongside the existing scoped HTML, CSV and JSON reports. Keep only the uploader's own name when name hiding is disabled; alias other participants.
- Introduce an optional shared report service with SQL validation, short-lived report retention, deletion capabilities, bounded requests and capacity limits. Community submissions are not official or game-verified world records.
- Restrict ranking eligibility to complete captured personal encounters of at least ten seconds with confirmed identity, a known class and one received boss matching the comparison context. Mixed-target, incomplete and imported records remain shareable without entering rankings.
- Measure passive Windows TCP round-trip time for active game connections, expire old samples and expose unavailable/collecting states without extra probe packets.
- Decode received self-bound pet levels and progress, clear unknown progress after capture loss and retain nullable requirements. Do not substitute pet progress for Odyle.
- Show received boss stagger values and break observations in the existing effects panel. Expire live bars without inventing a break duration; preserve scoped observations in local reports.
- Keep received cooldown readiness distinct from an elapsed local countdown, bind timers to the correct character and retain separately observed charge information.
- Test atomic sharing-key storage, retry/revocation failures, request privacy, scoped ranking gates, actual SQL operations, telemetry freshness and unified responsive UI behavior.

Service update · 2026-10-15: the [free Luma Community service](https://luma-dps-community.uchihavayne.chatgpt.site) is publicly available without an account. Public creation, report retrieval, filtered rankings, wrong-key rejection and revocation were verified without authentication. This service activation does not change the published 0.13.0 executable, tag or archive assets.

Live gate: combat, Cube recognition and new protocol telemetry still require matching in-game observations across supported regions. Unsupported live healing/Odyle, ally cooldowns, provider catalogs, spatial replay and official world rankings are not claimed as implemented. See the feature comparison and community sharing documentation.

## 0.12.0 preview · 2026-10-15

- Keep the DPS roster and Hidden Cube compass in one overlay. Remove the DPS/Cube page switch; a fresh Cube match opens the compass beside the player list and an expired match hides it without replacing the damage view.
- Start AION2-only Cube listening automatically, wait for the game when absent and migrate older preferences to the automatic default. An explicit stop disables the saved automatic-listening preference. Automatic listening never selects system output or a microphone.
- Separate roster visibility from the header/report scope. Show received nearby players by default while retaining a personal summary, and show separate personal, party and nearby rates in the footer. Unknown self identity no longer hides other received actors.
- Filter a known party roster to its members. If membership has not arrived, display nearby rows with an explicit notice and keep the unknown party total unavailable; nearby presence does not create party membership.
- Add smooth relative-DPS bar colors, with class-color and theme-accent choices. Keep received names, total damage, per-second DPS and configurable shares in the roster.
- Raise the compact overlay minimum to 320 × 200 so controls and player rows have space together. Migrate shorter saved windows without resetting their themes or other appearance choices.
- Add transport regressions for nearby actors, late received names, per-player DPS and a split late party roster. All 132 engine tests pass; production engine parsing is unchanged.

Live gate: the final executable still needs synchronized solo/nearby/party combat checks and a real Cube scene with audible stereo output, camera turns and other-game-sound negatives. Automated coverage does not establish full premium-feature parity or detection accuracy in every scene. This remains a preview.

## 0.11.0 preview · 2026-10-15

- Add a prominent DPS/CUBE header switch and a compass in the meter body, with compact/detailed layouts, a smooth steering needle, relative signal and signal/noise readings. Minimize or Escape returns to DPS; listening remains an explicit choice and starts off on every launch.
- Preserve stereo front/back ambiguity with a dashed rear candidate. Clear the needle for stale, missing or conflicting directional evidence instead of presenting an unsupported bearing. The display does not calculate GPS coordinates or calibrated distance.
- Compare Cube tone clusters against local per-channel noise floors and tolerate briefly masked frames. Offline reference mixtures with wind, voice, rumble and harmonic music detect more matching sections than the previous filter; tested directional mixtures do not steer to the opposite side. Tested background-only mixtures, silence and unrelated tones remain rejected; strong masking can still prevent detection.
- Stop treating Windows' timestamp-uncertainty flag as a loss of audio samples. Actual sample discontinuities still reset detector history.
- Separate raw input level from matched Cube strength and show a quiet-input diagnostic, helping distinguish a silent game stream from a non-matching sound. Retain AION2-only capture by default, explicit system-output selection and no microphone or automatic audio recording/upload.
- Add detector, stream-flag, stale-state and compass interaction regressions. A bounded AION2-only stereo capture opened and stopped successfully; its effectively silent input did not verify a Cube scene.

Live gate: detection beside a real Cube, false positives around other game sounds and camera-relative stereo guidance remain pending. Final native window checks and synchronized combat trials also remain pending; this build remains a preview.

## 0.10.0 preview · 2026-10-14

- Add an opt-in Hidden Cube sound locator with an included spectral reference, sound similarity, matched stereo left/right balance and relative signal changes. No absolute distance, map position or front/back direction is inferred.
- Capture only the AION2 process tree with Windows process loopback by default. A separate, explicitly selected system-output mode supports older Windows builds. No microphone or additional capture driver is used.
- Add a compact Cube indicator and a dedicated Turkish/English settings section, with source/sensitivity controls, bounded local WAV/M4A reference import and restoration of the built-in reference. Listening starts off on every launch.
- Clear stale directions after silence, gaps, device changes, stop or errors; preserve stop responsiveness and retry only the selected source. Serialize reference changes and retain only the spectral template locally.
- Resolve AION2 parent/child processes as one game tree and preserve Rust ownership of borrowed Windows activation data. A bounded 10-second AION2-only stereo capture opened and stopped successfully after these corrections.
- Validate the supplied Cube recording offline at normal/reduced volume and with left/right panning; add audio format, decoding, detector, lifecycle and UI regressions. Synthetic noise, silence and unrelated test tones do not produce detections in these checks.

Live gate: real-game sound detection, false positives around other game sounds and camera-relative stereo guidance remain pending. The meter's synchronized solo, nearby-player, party and native window checks also remain pending on the final preview.

## 0.9.3 preview · 2026-10-14

- Organize Settings into six keyboard-accessible sections with retained drafts and scroll positions; open the calendar directly from the timer.
- Serialize rapid panel open/close requests and combine queued preference writes so the latest choice wins without unnecessary disk writes.
- Improve dark/light/custom-light readability, warning colours, disabled-control focus handling and analysis tab accessibility.
- Prevent duplicate desktop capture instances, preserve window dimensions through minimization, and fit expanded panels to the monitor work area and DPI.
- Keep live snapshot ordering consistent across pushed updates and fallback reads, while retaining legitimate resets and character changes.
- Show history-read failures with a retry option, use the selected scope's duration in progress records, and withhold report-match confirmation when timing is unavailable.

- Refresh Turkish/English quick-start and developer documentation, including automatic EU event clocks and current report limits.
- Reject stale or mismatched executable/source versions during packaging; validate x64 resources and build-input freshness.
- Package public documentation, source/dependency hashes and license notices while excluding runtime settings, captures, exports and caches.
- Add deterministic, integrity-checked ZIP output and packaging regressions. Pin the verified Windows workflow actions and test the packaging tool in CI.

Live gate: a new synchronized dummy trial, a nearby-stranger trial and a real-party trial remain pending. These checks must use the final executable.

## 0.9.2 preview

- Validate packet metadata time and fall back to receipt time when it is stale, invalid or in the future, restoring advancing encounter/training clocks.
- Keep per-second values in K above 1,000, distinguish total damage from DPS, and allow independent summary/row display choices.
- Show unavailable DPS for saved damage records with zero duration, including offline HTML and OBS. Keep original numeric JSON/CSV values for review.

New live capture was not run for the clock correction. Existing zero-duration histories cannot recover their actual elapsed time.

## 0.9.1 preview

- Add ready EU event presets, optional individual reminders, compact timer selection and finite UTC calendar export.
- Refresh public Rift/reset/Europe-boss calendar subscriptions through the bounded Windows HTTPS client with an offline cache.
- Preserve personal/party/observed scope labels and clarify rates on small overlays.

Community schedules describe planned times, not confirmed live availability; Nahma remains provisional.

## 0.9.0 preview

- Add explicit character/party identity, timed personal training, retained damage curves, persistent local history and scoped HTML/CSV/JSON reports.
- Add received windups/effects/conditional max HP, partial character/equipment/Daevanion observations and map-slot boss timers.
- Add local Combat Analyzer comparison, original layout presets and optional token-protected same-PC OBS streaming.

Live healing/PvP classification, automatic Odyle inventory, full game catalogs and public world rankings remain outside verified coverage.
