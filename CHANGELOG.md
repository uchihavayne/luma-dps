# Changelog

Entries describe preview builds. Live validation is listed separately from automated checks.

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
