# Team cooldowns

Luma 0.15.0 shows automatic cooldown observations in **Analysis → Team** (**Analiz → Takım**), inside the main application window. Your confirmed character and received game-party members appear by name and class, including members who have not dealt damage. Friends do not need Luma or an invitation. The panel reads supported records already received on your game connection; it does not contact a sharing server.

## Automatic view

1. Start Luma before entering the character so authoritative self identity and party records can be received.
2. Open **Analysis → Team**. Each confirmed actor has a separate card. The class filter keeps players of the same class separate.
3. Use a skill to receive supported cooldown data. Unknown skills keep their IDs; an unused or unobserved skill is not assumed to be ready.

Nearby actors do not become party members merely because their casts were observed. Manual aliases, imported reports and room participants cannot establish an authoritative party identity. Capture gaps, actor removal and session changes invalidate the corresponding observations. Opening Luma after login can miss identity data and leave the panel waiting.

## What the values mean

- Supported actor-bound `02 38` casts supply the actual per-cast cooldown in milliseconds. Luma shows this received total and a countdown, without assuming a static class duration. The first 400 milliseconds remain provisional while a follow-up record can arrive.
- Supported charge forms of `02 38` supply observed remaining uses and recharge time. Actorless `22 38` charge updates bind only to authoritative server self identity. Counts and recharge timers are displayed separately. No maximum charge count or shared cooldown group is inferred.
- A positive observed count means a use was available at that observation; it does not establish that every charge is full. A recharge countdown reaching zero never increments the count without another record.
- A fresh received own counter zero can confirm ordinary cooldown readiness. A cast countdown reaching zero displays an elapsed timer awaiting an update. Missing, stale, provisional or unsupported data cannot establish readiness.
- Own `47 38` packets also supply raw counters whose unit is not assumed to be milliseconds. Where direct cast duration is missing, sufficiently consistent falling observations can produce a learned estimate marked `~`.
- Active direct cooldowns remain observable through their received deadline and bounded retention. A held UI sample expires after six seconds without a new native sample. This is separate from the optional relay's short freshness window.
- The expandable party-use list retains completed cast observations. A use without supported timing fields does not become a duration or readiness prediction.

## Optional sharing between devices

Invitation rooms remain available in an expandable advanced section. They are not required for the automatic party panel.

1. Use the same Luma version as the intended participants. Select the consent to relay your own name, class and received own counter observations.
2. Choose **Create free room**, copy the invitation, and give it to your friends. They consent and enter it with **Join room**.
3. Use **Leave room** or **Stop sharing** to stop local synchronization. The host can request **Close room for everyone**.

No account or payment is required. A Luma room is not proof of game-party membership and does not independently authenticate a participant's data. The invitation grants permission to join; anyone receiving it can use or share it. Keep it within the intended group.

## Free service limits

| Limit | Initial value |
| --- | --- |
| Participants per room | 12 |
| Room lifetime | Up to 120 minutes |
| Active rooms across the service | 20 |
| Sync quota across the service | 20,000 requests per UTC day |
| Native client poll interval | 5 seconds after successful synchronization |
| Relayed cooldown freshness window | 6 seconds |
| Silent participant visibility | Up to 20 seconds |

Network failures back off rather than replaying requests continuously. When service limits are reached, relay updates can stop or fail; the app reports that state. Local damage measurement, history and exports continue. These are shared free quotas, not an unlimited service or a guarantee that rooms are always available.

## Privacy, stopping and expiry

The team relay makes no network request before explicit room creation or joining. Its payload contains your own display name, class, bounded own cooldown observations and freshness information. It excludes party members' names taken from capture, game actor IDs, damage records, equipment, private notes, raw packets and audio. Room observations are separate from public reports and rankings.

Invitation, host and participant keys stay in native memory for the session; they are not written to preferences/history or included in ordinary UI state snapshots. Copying an invitation deliberately exposes its join capability. The server stores capability hashes. Closing the app discards the native keys.

Leaving stops local synchronization immediately and requests participant removal. Host closure requests deletion of the room. Cleanup is best effort: an offline or interrupted request cannot confirm immediate remote deletion, and an already dispatched request may finish. Old cooldowns lose freshness; silent participants stop appearing after the visibility window, and rooms expire at their deadline. Reopening the app does not automatically rejoin. If a clock or snapshot error hides the normalized room, active local sharing still exposes a stop control; invalid peer values are not refreshed into live data.

## Validation and coverage

Independent synthetic engine/replay tests cover actor binding, cooldown and charge layouts, malformed tails, session invalidation and provisional/elapsed states. UI tests cover named healers before damage, different actors of the same class, class filtering, unknown duration, charge count versus recharge, explicit zero and expired samples. Native and SQL tests cover relay capability redaction, cancellation, privacy, quotas, rate/sequence checks, expiry and closure/join interleaving. Live EU cooldown/charge behavior, party roster updates and two-client relay behavior still require targeted checks with the final executable.

Primary protocol evidence includes Waffle's pinned [cast/charge parser](https://github.com/Waffle-ens/waffle_meter/blob/cf885f1a9fac1758a14164286ce4c28ce0a01660/dotnet/src/WaffleMeter.Capture/StreamProcessor.cs), [cooldown field tests](https://github.com/Waffle-ens/waffle_meter/blob/cf885f1a9fac1758a14164286ce4c28ce0a01660/dotnet/tests/WaffleMeter.Capture.Tests/CooldownStartParsingTests.cs) and [cast grace tests](https://github.com/Waffle-ens/waffle_meter/blob/cf885f1a9fac1758a14164286ce4c28ce0a01660/dotnet/tests/WaffleMeter.Data.Tests/CooldownCastGraceTests.cs), at MIT revision `cf885f1a9fac1758a14164286ce4c28ce0a01660`. Luma's decoder and synthetic fixtures are written independently; no external skill-duration catalog is bundled. Earlier [raw counter findings](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/92806d72b1bb9cec4d092dc601d23447c7d67e29/docs/protocol/cooldown-frames.md) remain relevant to the fallback path. See [feature coverage](feature-parity.md) for remaining limits and [resource observations](resource-protocol.md) for automatic Odyle energy.
