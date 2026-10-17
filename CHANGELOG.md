# Changelog

Entries describe preview builds. Live validation is listed separately from automated checks.

## 0.17.0 preview Â· 2026-10-18

- Recover received nearby player names from typed `04 8D` appearance records instead of discarding the acting character's name as an ownership notice. Hold early structural profiles briefly for an exact current party name/home-server match; clear pending bindings after loss, reconnect, despawn, clock reversal or party changes.
- Keep confirmed local identity separate from nearby announcements. Prevent actor-ID reuse from relabelling an earlier completed encounter or inheriting the previous occupant's class/health. Replace unconfirmed placeholder names with actor IDs while preserving a server-confirmed character literally named `Unknown`.
- Add the compact Luma Clear layout and dark Graphite/light Pearl palettes, with cleaner spacing and value hierarchy. Compact rows place names, damage/DPS and shares on one line; new installations start at 420 × 340 while saved geometry is preserved. Relative-DPS bars progress from green through yellow/orange to red against the displayed roster's highest DPS; class and theme colors remain optional.
- Add a transparent fullscreen canvas with a draggable/resizable HUD and settings/analysis drawers in the same window. Preserve normal window geometry across fullscreen transitions and drawer closure. Background opacity now supports the full 0â€“100% range without hiding text or values.
- Add the default global fullscreen recovery shortcut `Ctrl+Alt+Shift+F5`; require a working rescue binding before entering fullscreen. Local `F11` toggles the mode when Luma has keyboard focus. `Escape` closes an open drawer before exiting fullscreen; clicks outside the HUD are routed through to the game.

Replay and interaction tests cover the implemented cases. Live EU name/combat checks and actual fullscreen pointer routing, shortcuts, multi-monitor and display-scaling behavior over AION2 remain pending. Full premium parity, missing protocol data and unsupported catalogs are not claimed; see [feature coverage](docs/feature-parity.md).

## 0.16.0 preview Â· 2026-10-16

- Decode supported own character power, equipped wing and species progression; retain actual zone boundaries without guessing dungeon identity or completion. Clear stale character observations after capture discontinuity.
- Keep explicit received periodic healing and per-skill HPS separate from damage, personal DPS and training. Correct trailing periodic skill IDs and exclude the narrowly identified ambiguous NPC recovery proc from DPS with partial-coverage disclosure.
- Add rotation/activity analysis, per-skill received effect overlap, fresh boss HP trend projections and grouped map/local sessions in the same analysis drawer. Preserve full bounded timelines, HP observations and healing through local history and anonymous exports.
- Add six configurable global shortcuts, 200% UI scale, compact strip, optional click-through lock with a working rescue shortcut, game-aware topmost behavior, idle fade and roster name hiding. Preserve settings drafts, analysis expansions and normal window geometry.
- Extend optional OBS streaming to a second computer on a private LAN. Keep exposure off by default, access keys fresh and party scope tied to confirmed membership.
- Add free public/unlisted/private sharing, separate hashed viewing capabilities and public opt-in class/CP-band community statistics. Private and unlisted reports cannot enter rankings. Sparse cohorts remain unavailable; community percentiles are record-based and not official game rankings.
- Add update checks and explicit download/install using an embedded publisher public key, RSA-PSS signatures, SHA-256 and an atomic native replacement helper. No unsigned update fallback or automatic installation.

Automated tests cover the specified layouts and failure cases. Live EU content, second-PC OBS and an actual self-update still require final interactive checks. Full catalogs, universal live healing, exact Cube coordinates and official game-verified world rankings are not claimed; see [feature coverage](docs/feature-parity.md).

## 0.15.0 preview Â· 2026-10-16

- Read supported actor-bound cast cooldowns directly from game traffic. Confirmed party members do not need Luma, an invitation or a room. Keep actual cooldown duration, observed uses and next-charge recharge separate; never invent available charges or readiness when a timer expires.
- Decode incremental party additions/removals and uniquely matched player profiles, including non-damaging healers. Invalidate bindings after capture gaps, reconnects and actor reuse. Keep completed encounter membership separate from the current live team.
- Put the automatic team board first in the existing analysis drawer, with class filtering and optional compact DPS-row indicators. Move cross-device rooms into an optional advanced section. Preserve active-sharing visibility, form drafts and keyboard focus while observations age.
- Keep all 200 retained desktop encounters available to history filters. Clear imported records on disk before removing them from memory; a failed write preserves the records. Keep manually selected boss actor IDs within their current game session.
- Allow whole-second training durations from 10 to 300 seconds. Retain up to 600 passive connection RTT observations per encounter with average, minimum, maximum, P95 and a graph. Preserve bounded samples in scoped HTML/CSV/JSON exports and shift their timestamps in anonymous reports.

Automated replay and integration checks cover the accepted layouts and failure cases. Live EU party cooldown/charge validation remains pending. Unsupported catalogs, game-wide verified rankings, complete live healing and other limits remain listed in [feature coverage](docs/feature-parity.md).

## 0.14.0 preview Â· 2026-10-15

- Read EU ContentsTicket snapshots and updates for automatic Odyle. Keep regular energy, bonus and available total separate; derive the regular capacity only from received membership evidence. Login records wait for authoritative self identity; capture gaps and character changes clear old ownership.
- Correct own cooldown semantics: raw server counters are not milliseconds. Learn a rate from consistent decreases, mark time estimates with `~`, and reserve confirmed readiness for a fresh received zero. Ignore the unvalidated `0x2238` charge layout.
- Add explicit free team rooms in the same analysis drawer. Participants share only their own name, class and cooldown observations; room membership does not establish game-party membership. Show received completed party casts separately, including actors who have not dealt damage.
- Keep team capabilities in memory, hash them on the service and expire rooms after two hours. Bound participant count, request size and free daily usage. Age observations through HTTP delay and clock changes; report unconfirmed remote closure honestly.
- Add local history search, filters, favorites, notes, tags and comparisons between eligible personal boss encounters. Preserve incomplete-capture evidence and do not send annotations with shared reports.
- Add automatic Odyle and active-room chips without replacing the DPS roster or Cube compass. Keep form focus, invitation drafts and expanded skill details stable during live updates.

Replay, native client, SQLite/API and UI checks cover the implemented cases. A synchronized live Odyle and multi-player cooldown check remains pending. Full premium parity, complete catalogs, official rankings and universal protocol coverage are not claimed.

## 0.13.0 preview Â· 2026-10-15

- Add Sharing and rankings to the existing analysis drawer: explicit aggregate-only upload, anonymous names by default, separate ranking participation, filtered community results, link copying/opening and revocation. No automatic uploads or account requirement.
- Add free offline encounter-text sharing alongside the existing scoped HTML, CSV and JSON reports. Keep only the uploader's own name when name hiding is disabled; alias other participants.
- Introduce an optional shared report service with SQL validation, short-lived report retention, deletion capabilities, bounded requests and capacity limits. Community submissions are not official or game-verified world records.
- Restrict ranking eligibility to complete captured personal encounters of at least ten seconds with confirmed identity, a known class and one received boss matching the comparison context. Mixed-target, incomplete and imported records remain shareable without entering rankings.
- Measure passive Windows TCP round-trip time for active game connections, expire old samples and expose unavailable/collecting states without extra probe packets.
- Decode received self-bound pet levels and progress, clear unknown progress after capture loss and retain nullable requirements. Do not substitute pet progress for Odyle.
- Show received boss stagger values and break observations in the existing effects panel. Expire live bars without inventing a break duration; preserve scoped observations in local reports.
- Keep received cooldown readiness distinct from an elapsed local countdown, bind timers to the correct character and retain separately observed charge information.
- Test atomic sharing-key storage, retry/revocation failures, request privacy, scoped ranking gates, actual SQL operations, telemetry freshness and unified responsive UI behavior.

Service update Â· 2026-10-15: the [free Luma Community service](https://luma-dps-community.uchihavayne.chatgpt.site) is publicly available without an account. Public creation, report retrieval, filtered rankings, wrong-key rejection and revocation were verified without authentication. This service activation does not change the published 0.13.0 executable, tag or archive assets.

Live gate: combat, Cube recognition and new protocol telemetry still require matching in-game observations across supported regions. Unsupported live healing/Odyle, ally cooldowns, provider catalogs, spatial replay and official world rankings are not claimed as implemented. See the feature comparison and community sharing documentation.

## 0.12.0 preview Â· 2026-10-15

- Keep the DPS roster and Hidden Cube compass in one overlay. Remove the DPS/Cube page switch; a fresh Cube match opens the compass beside the player list and an expired match hides it without replacing the damage view.
- Start AION2-only Cube listening automatically, wait for the game when absent and migrate older preferences to the automatic default. An explicit stop disables the saved automatic-listening preference. Automatic listening never selects system output or a microphone.
- Separate roster visibility from the header/report scope. Show received nearby players by default while retaining a personal summary, and show separate personal, party and nearby rates in the footer. Unknown self identity no longer hides other received actors.
- Filter a known party roster to its members. If membership has not arrived, display nearby rows with an explicit notice and keep the unknown party total unavailable; nearby presence does not create party membership.
- Add smooth relative-DPS bar colors, with class-color and theme-accent choices. Keep received names, total damage, per-second DPS and configurable shares in the roster.
- Raise the compact overlay minimum to 320 Ã— 200 so controls and player rows have space together. Migrate shorter saved windows without resetting their themes or other appearance choices.
- Add transport regressions for nearby actors, late received names, per-player DPS and a split late party roster. All 132 engine tests pass; production engine parsing is unchanged.

Live gate: the final executable still needs synchronized solo/nearby/party combat checks and a real Cube scene with audible stereo output, camera turns and other-game-sound negatives. Automated coverage does not establish full premium-feature parity or detection accuracy in every scene. This remains a preview.

## 0.11.0 preview Â· 2026-10-15

- Add a prominent DPS/CUBE header switch and a compass in the meter body, with compact/detailed layouts, a smooth steering needle, relative signal and signal/noise readings. Minimize or Escape returns to DPS; listening remains an explicit choice and starts off on every launch.
- Preserve stereo front/back ambiguity with a dashed rear candidate. Clear the needle for stale, missing or conflicting directional evidence instead of presenting an unsupported bearing. The display does not calculate GPS coordinates or calibrated distance.
- Compare Cube tone clusters against local per-channel noise floors and tolerate briefly masked frames. Offline reference mixtures with wind, voice, rumble and harmonic music detect more matching sections than the previous filter; tested directional mixtures do not steer to the opposite side. Tested background-only mixtures, silence and unrelated tones remain rejected; strong masking can still prevent detection.
- Stop treating Windows' timestamp-uncertainty flag as a loss of audio samples. Actual sample discontinuities still reset detector history.
- Separate raw input level from matched Cube strength and show a quiet-input diagnostic, helping distinguish a silent game stream from a non-matching sound. Retain AION2-only capture by default, explicit system-output selection and no microphone or automatic audio recording/upload.
- Add detector, stream-flag, stale-state and compass interaction regressions. A bounded AION2-only stereo capture opened and stopped successfully; its effectively silent input did not verify a Cube scene.

Live gate: detection beside a real Cube, false positives around other game sounds and camera-relative stereo guidance remain pending. Final native window checks and synchronized combat trials also remain pending; this build remains a preview.

## 0.10.0 preview Â· 2026-10-14

- Add an opt-in Hidden Cube sound locator with an included spectral reference, sound similarity, matched stereo left/right balance and relative signal changes. No absolute distance, map position or front/back direction is inferred.
- Capture only the AION2 process tree with Windows process loopback by default. A separate, explicitly selected system-output mode supports older Windows builds. No microphone or additional capture driver is used.
- Add a compact Cube indicator and a dedicated Turkish/English settings section, with source/sensitivity controls, bounded local WAV/M4A reference import and restoration of the built-in reference. Listening starts off on every launch.
- Clear stale directions after silence, gaps, device changes, stop or errors; preserve stop responsiveness and retry only the selected source. Serialize reference changes and retain only the spectral template locally.
- Resolve AION2 parent/child processes as one game tree and preserve Rust ownership of borrowed Windows activation data. A bounded 10-second AION2-only stereo capture opened and stopped successfully after these corrections.
- Validate the supplied Cube recording offline at normal/reduced volume and with left/right panning; add audio format, decoding, detector, lifecycle and UI regressions. Synthetic noise, silence and unrelated test tones do not produce detections in these checks.

Live gate: real-game sound detection, false positives around other game sounds and camera-relative stereo guidance remain pending. The meter's synchronized solo, nearby-player, party and native window checks also remain pending on the final preview.

## 0.9.3 preview Â· 2026-10-14

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
