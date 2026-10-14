# Changelog

Entries describe preview builds. Live validation is listed separately from automated checks.

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
