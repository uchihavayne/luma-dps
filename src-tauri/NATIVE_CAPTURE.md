# Windows capture adapter

This new shell calls the Windows in-box `pktmonapi.dll` directly. It creates a
named independent live session and a real-time stream, selects network interface
data sources, and closes only its own handles on exit. It never invokes global
`pktmon start`, `pktmon stop`, installs Npcap, or installs another driver.

Microsoft documents administrator privileges as a requirement. The release
executable embeds `requireAdministrator` and requests the standard Windows UAC
approval on launch. Debug and unit-test builds keep the normal as-invoker policy.
The meter reports the process elevation status and actual HRESULT if Windows
refuses capture. `LUMA_CAPTURE_DISABLED=1` suppresses capture for QA.

The executable supports a bounded headless diagnostic:
`luma-desktop.exe --probe-seconds 2 --probe-output native-probe.json`.
This opens no window and writes a state/capability snapshot. Native capture is
disabled in this path unless `--probe-capture` is supplied or
`LUMA_PROBE_CAPTURE=1` is explicitly set in the launched process. The explicit
argument works across UAC launches, which may not inherit temporary environment
variables. Live capture requires running the process as administrator. Durations are
limited to 1–30 seconds. The probe does not download runtime components.

The adapter resolves the DLL from System32 only. Packet callbacks validate their
offsets and lengths, extract complete IPv4 TCP packets from IP, Ethernet/VLAN,
or unencrypted 802.11 LLC frames. A process
snapshot and Windows' owner-PID TCP table identify connections belonging to
`aion2.exe`, `aion2-win64-shipping.exe`, or `aion2_client.exe`.
Incoming IPv4 TCP constraints for those exact source/destination address and
port tuples are installed with `PacketMonitorAddCaptureConstraint` before
activating the session. TCP port 443 is excluded. When no owned connection
exists, no capture session is active. The endpoint set is refreshed once a
second; changes recreate only this application's session. The callback also
checks the owned tuple before retaining bytes in its bounded nonblocking queue.

The Windows stream's cumulative read-miss counter is counted by delta; its
per-descriptor write misses and local queue drops are counted separately.
Oversized-packet warnings are not added again for every subsequent descriptor.
Queued packets carry a loss epoch. Accepted packets before a gap are decoded
before partial framing/cooldown state is invalidated for subsequent packets.
Delivered TCP positions and confirmed TLS classification remain available to
suppress retransmissions. Normal shutdown and terminal capture failures stop
callbacks, drain accepted packets, and preserve final counters. Packet Monitor
and local queue loss counts are surfaced in capture state.

The documented stream API limits packet snapshots to 9000 bytes. Larger,
incomplete, fragmented IPv4, IPv6, and encrypted link-layer frames do not enter
the engine. Adapter hot-plug requires reopening Luma because NIC data sources
are selected at session creation. A game using another executable name or IPv6
requires extending the allowlist/backend. Older Windows builds without the API
report an unavailable-backend error; there is no third-party-driver fallback.

An owned game packet exceeding the stream API's internal 9000-byte limit can
still produce warning 122 and missing data. The warning count and largest
reported packet size are retained. Luma does not change adapter offload settings
or conceal that measurement limitation.

## Evidence and remaining validation

On this development host, System32's DLL provides the eleven required function
exports. The constraint layout and cumulative read counter were also checked
against the installed Microsoft DLL. The packaged release's actual manifest
resource is checked for `requireAdministrator` before distribution.

The 0.9.0 source passes 130 engine, 27 desktop/native, and 109 frontend tests.
These include exact tuple constraints, cumulative loss counters, warning
deduplication, queued loss boundaries, retransmission suppression, retained TLS
classification, and panel geometry rollback. The browser preview was checked
at compact and expanded sizes; it does not prove native mouse movement.

A consented ten-second administrator probe of the initial 0.8.1 build activated
its own session, received AION2 TCP traffic, and decoded a damage event. It also
exposed the loss-counter and host-traffic issues addressed in the final source.

After those fixes, a consented ten-second probe of the rebuilt 0.8.1 release
received 198 incoming game packets and framed 712 messages across three owned
connections. It reported zero missed packets, stream gaps, and stream warnings.
Administrator permission was confirmed. No meter window opened, and the probe
closed its own capture session after the test. This test contained no damage
events and therefore confirms capture connectivity rather than combat accuracy.

Matching a controlled live encounter against Combat Analyzer and testing native
panel dragging remain runtime validation steps. Receiving a decoded hit alone
does not establish complete combat accuracy or compatibility with every region.

A consented ten-second probe of the final 0.9.0 release received 280 incoming
game packets, framed 774 messages and decoded 13 damage events. It reported
zero missed packets, stream gaps and warnings; administrator permission was
confirmed. Map boss observations were available. The probe opened no window
and closed its own session. The local character remained unresolved because no
self identity arrived during that mid-session sample. Automatic names still
require a live login capture, and personal totals require a synchronized test.

The 0.9.1 display/calendar update preserves the measurement engine's seven
source files byte-for-byte from 0.9.0. The user reported matching the game's
analysis before this update. The new release passes 35 desktop/native and 131
frontend tests; its eight calendar-provider tests are network-free. A separate
explicit HTTPS test read all three published subscription feeds through the
same Windows TLS client and validation path without starting capture or UAC.

The 0.9.2 capture adapter rejects stale or future packet metadata times and
falls back to callback receipt time. This fixes zero elapsed time and rates
that equalled accumulated damage while preserving the engine's packet parsing
and damage amounts. Four clock regressions and the reinforced callback test
cover personal/party timing, idle finalization and the 60-second training cutoff.
The full desktop suite passes 39 tests; the frontend suite passes 139. Actual
320 × 116 and 320 × 240 previews retain separate totals and K/second rates
without horizontal overflow. No new game capture was run for this revision.
See [native clock audit](../docs/native-clock-audit.md).

## Sources

The 0.9.3 desktop polish keeps the seven engine source files unchanged. It adds
one desktop instance guard, zero-size resize filtering, work-area/DPI panel
placement and ordered live snapshots. The latest suite passes 45 desktop and
156 frontend tests; packaging passes nine offline regressions. Browser checks
cover the 320 × 116/240 and 420 × 240 overlay layouts and the 820 × 700 expanded
panel, with dark/light themes and keyboard/form persistence. Actual native
drag/resize and synchronized live combat checks remain required before a
verified-accuracy claim. No game capture was started for this revision.

- [Microsoft Packet Monitor API overview](https://learn.microsoft.com/en-us/windows/win32/pktmon/pktmon)
- [API reference](https://learn.microsoft.com/en-us/windows/win32/pktmon/pktmon-reference)
- [Initialization and administrator requirement](https://learn.microsoft.com/en-us/windows/win32/pktmon/packetmonitor/nf-packetmonitor-packetmonitorinitialize)
- [Independent session creation](https://learn.microsoft.com/en-us/windows/win32/pktmon/packetmonitor/nf-packetmonitor-packetmonitorcreatelivesession)
- [Real-time stream, packet metadata, and size limits](https://learn.microsoft.com/en-us/windows/win32/pktmon/packetmonitor/nf-packetmonitor-packetmonitorcreaterealtimestream)
- [Network data source enumeration](https://learn.microsoft.com/en-us/windows/win32/pktmon/packetmonitor/nf-packetmonitor-packetmonitorenumdatasources)
- [Session capture constraints](https://learn.microsoft.com/en-us/windows/win32/pktmon/packetmonitor/nf-packetmonitor-packetmonitoraddcaptureconstraint)

## Shell dependencies and original work

The independent desktop shell uses `main.rs`, `native_capture.rs`, its own
configuration and Luma icon. Application-specific source and artwork terms
are in `LICENSE`; dependency notices remain separate in the release package.

Direct third-party Rust dependencies are Tauri/Tauri Build/Tauri Runtime (MIT OR Apache-2.0),
Serde/serde_json, reqwest and windows-sys (MIT OR Apache-2.0).
Transitive dependency license texts and notices should be preserved in the
release distribution. Windows Packet Monitor and WebView2 are operating-system
components; they are not bundled as third-party capture drivers by this shell.

Preferences and exports use Tauri's app-local directory for identifier
`com.luma.independent`, separate from any previous meter's data directory.
Exports are local JSON, CSV, HTML or ICS files in its `exports` child directory; the command
returns the actual saved path and does not imply a file dialog appeared.
