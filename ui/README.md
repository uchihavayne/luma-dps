# Luma UI

Live snapshots include a process-local `state_revision`. A later snapshot can
replace the current frame even after a legitimate reset; an older or duplicated
IPC reply cannot rewind newer pushed data. Failed fallback reads also preserve
newer events received while the request was pending.

The desktop interface uses vanilla HTML, CSS and ES modules with no npm runtime dependency. The native build embeds this directory. Turkish and English translations share the same layout and measurement rules.

Luma Clear keeps only the target/HP, summary, roster selector, aligned DPS/damage
columns and a short footer visible by default. The header's overflow menu opens
the existing tools, settings and analysis. Its independent `hudPanels` choices
show pet tracking, event timers, team shortcuts or Odyle when requested. Hiding
a panel retains its pins and does not stop capture or collection/audio updates.
Pinning a pet opens its tracker. `hudDetailRows` restores optional class labels,
shares and cooldown text; original class symbols remain visible in simple rows.
The nine local SVG symbols are rendered from received class metadata only.

Browser-only synthetic layout previews accept `?demo=1&frame=320x200` through
`frame=1600x1600`. These dimensions are ignored in native sessions. Narrow or
large-text rows stack their numeric columns; the roster and tools menu scroll
within their own available area. Fullscreen uses the monitor area directly.

## Preview and tests

From the source root, run `node ui/serve.mjs`, then open `http://127.0.0.1:7335/`. The normal preview starts empty and disconnected; `/?demo=1` enables deterministic samples with a visible DEMO label. Samples never enter a native desktop session. `LUMA_PREVIEW_PORT` can select another local port.

Run `node --test ui/tests/*.test.mjs`. Tests cover identity/scope, display formats, keyboard/focus behavior, serialized preference edits, reports/privacy, training/curves, observed assistance/character data, and calendar timing. They do not establish live capture accuracy or prove Windows window gestures.

`/?demo=1&cubeDemo=1` also supplies an explicitly labelled, non-live Cube UI sample. It does not open an audio input or output device.

`/?demo=1&partyDemo=1&cubeDemo=1&telemetryDemo=1` demonstrates the unified roster, party summaries, contextual Cube compass, TCP RTT, pet progress and boss stagger with labelled fictional data. It performs no live capture or community upload. The Community drawer uses real native IPC in the desktop application; a browser preview cannot create a successful public share or ranking.

Sharing and rankings remain in the existing analysis drawer. Ranking pages replace bounded sets of 25 results with Next/Previous controls. Sharing requires explicit consent, defaults to anonymous names and keeps deletion capabilities outside renderer snapshots. Free encounter-text copying works offline and falls back to selectable text when clipboard access is unavailable. See [sharing rules and service limits](../docs/community-sharing.md).

## Measurement and displays

The player list defaults to Nearby, independently of the header/report scope, which defaults to Personal. Received nearby names and per-player total/DPS rows remain visible even when self identity is unresolved. The footer shows personal, party and nearby rates separately. Automatic server self identity, an exact unique saved-name match or an explicit session row selection can identify your character; nearby damage stays excluded from personal totals. Party needs received membership or an explicitly selected session roster. When membership is unknown, the list can fall back to nearby rows with an explicit notice while the party total remains unavailable. A known party list includes only members. Imported records never establish live identity.

Target filters (All/Boss/Both) and actor scope (Personal/Party/Observed) are separate choices. Both displays all-target player amounts with a separate boss total; a target does not become a boss solely because it has high HP. Unfamiliar names retain their received IDs and manual boss classification remains available.

DPS uses an explicit per-second suffix: `12.3K/sn` in Turkish, `12.3K/s` in English. Above 1,000 the rate stays in K, including `1234.57K/s`; total damage can use K/M. Summary and row display choices are independent. A damage record without positive measured duration displays unavailable DPS rather than treating its accumulated total as a rate.

Four layouts, twelve palettes, editable colors, separate target/interface fonts, density, columns and a local raster background are available. Player bars use relative DPS by default, with class colors or theme accent as alternatives. Theme import/export includes appearance fields only. PNG/JPEG/WebP images are limited to 1 MB and 2048 × 2048; remote and SVG backgrounds are excluded.

## Window and update behavior

The compact frame supports 320 × 200 and larger. Older shorter saved windows expand to the new minimum while retaining their themes and other appearance preferences. At short heights the roster scrolls within the frame, while controls remain accessible. A visible compact timer increases header height without changing the selected target font size. Closing Settings or Analysis, Escape and backdrop dismissal hide the panel immediately and restore focus; native geometry restoration follows separately.

The panel title or empty header starts native dragging even while the compact meter is locked. Buttons, inputs, tabs and other interactive descendants do not start a drag. The resize corner supports native mouse resizing and arrow keys in 10-pixel steps, or 20 with Shift. Native movement and resize controls report their availability in browser preview.

Live updates reuse keyed player rows, preserve roster/drawer scroll and keyboard focus, and avoid rewriting unchanged text. Preference commits are serialized; only the latest failed edit rolls back to the last acknowledged value. Reduced-motion preferences disable entry and bar animations.

Status distinguishes administrator permission, unsupported capture, starting/error, waiting for the game or incoming connection, fresh traffic, received combat, pause and capture loss. The tooltip retains the raw backend error and diagnostic details. A successful IPC call or cumulative packet count alone does not mean traffic is current. Capture errors take precedence over previously retained encounters, whose statistics remain available after a poll failure.

## Events and observed data

Nine EU clocks work offline: Rift, Shugo Festival, Dimensional Invasion, Artifact Siege, siege bosses, Kaira, provisional Nahma, daily reset and weekly reset. Rift is the default header timer. The player can select another event, a received boss slot, an optional custom timer or Off. Built-in reminders begin disabled and are enabled per event. No interval/anchor entry is required for built-in events.

The native provider refreshes three explicitly offered public calendar subscriptions daily or on request and retains its valid cache offline. Community/source/date labels remain visible. UTC cycles and European wall clocks have distinct DST behavior; a scheduled opening is not proof of live availability. See [event sources](../docs/events-sources.md). Manual anchor timers remain an advanced optional feature.

Received cooldowns, windups, effects, HP and map-slot timers retain their source and freshness. An elapsed timer is not confirmed readiness. Partial equipment/skills/Daevanion observations remain separate from manual equipment notes and Odyle estimates. Own build binding requires confirmed server self identity; an inspection name alone cannot bind gear to a combat actor.

The game-report panel reads selected Combat Analyzer files up to 4 MB locally. Comparisons require matching personal identity, target, time window and capture health. Live ambiguous player-target healing/resource amounts remain unclassified; game-report healing totals do not create live HPS coverage.

## Native data and reports

Hidden Cube is monitored automatically in the background using only the AION2 process tree. The listener waits when the game is absent; older preferences without an automatic-listening field use the enabled default. An explicit stop saves an opt-out for later launches. Automatic listening never falls back to system output or a microphone. System output requires an explicit manual choice.

A fresh match opens a compact or detailed compass beside the player list in the same overlay, without changing pages or hiding DPS rows. The compass disappears when the match expires. Its header control opens the dedicated audio settings; hiding the indicator does not stop capture. Source, threshold and reference controls are disabled while active; imported references are limited to WAV/M4A, 8 MB and 30 seconds. Native `luma-cube-state` events and a bounded polling fallback are ordered by their separate revision. Stop, stale data, errors and non-stereo input clear directional cues. Left/right describes matched stereo weighting, while strength/trend remain relative; no metres, map position or confirmed front/back is displayed. Browser samples cannot enable native listening.

The bridge uses `window.__TAURI__.core.invoke`. Live `luma-state` updates have a state-poll fallback. They carry lean current values, `history_revision`/`history_count`, `encounter_active` and observation revisions. Full history, current samples, assistance and character/boss snapshots are loaded on demand. Stale asynchronous responses are rejected. A failed read retains the last confirmed data.

Commands cover state/app metadata, preferences, character/party selection, target/boss selection, training, history/report import/export, observed character/assistance/boss getters, calendar refresh, optional OBS start/stop and window controls. The command definitions and argument names in `src-tauri/src/main.rs` are authoritative. The external support action opens only the publisher's Buy Me a Coffee link.

JSON reports use `{type:'luma-history',version:1,encounters:[...]}`. The report parser accepts up to 200 encounters and 16 MB, with per-list/sample limits; excess data is rejected rather than silently omitted. Native imported history is stored through the bounded local-history service. Browser preview's preference-backed import remains capped at 30 records. Retention limits and unknown counters survive JSON. HTML is standalone/offline and escapes names/notes; CSV neutralizes spreadsheet formulas; numeric JSON/CSV rates retain their original values. Optional stable anonymous aliases remove private names and notes.

The same-PC OBS source is off by default and requires an explicit scope choice. Hidden names are the default. Its per-session URL and every asset/data endpoint require a token; restart changes the URL. The source sends a scoped allowlisted snapshot, uses text nodes, and shows totals separately from K/s rates. See [OBS setup and boundaries](../docs/obs-source.md).

Target-mode previews use `?demo=1&targetDemo=1&targetBoardDemo=shared`, `shared-no-own`, `filtered` or `solo`. These synthetic scenes exercise the same-window target card, automatic shared-fight selection, missing contribution, Boss-filter recovery and a single received contributor. They are disabled in the desktop application and are not live validation. Target boards scroll as one workspace with their header and pet cards when the window is short.
