# Team cooldowns

Luma offers two distinct views in **Analysis → Team** (**Analiz → Takım**): received skill uses by confirmed game-party actors, and optional invitation rooms for participants' own cooldown observations. Both remain inside the main application window.

## Create or join

1. Run the same Luma version as your friends. Enter your character with Luma open so automatic identity and supported own counters can be received.
2. Open **Analysis → Team** and select the consent to share your own character name, class and cooldown observations.
3. Choose **Create free room**, copy the invitation, and give it to the intended participants. Friends select the same consent and enter the code using **Join room**.
4. Use **Leave room** to stop your synchronization. The host can request **Close room for everyone**.

No account or payment is required. A Luma room is not proof that its members are in your game party. The invitation grants permission to join; anyone receiving it can use or share it. Keep it within the intended group.

## What the values mean

- Own `47 38` packets supply raw cooldown counters. Their unit is not established as milliseconds. Luma learns an approximate duration only from sufficiently consistent falling observations and labels it with `~`.
- A fresh received zero can confirm readiness. An estimate reaching zero does not. Missing, stale or unsupported observations remain unknown; they do not become ready skills.
- Charge layout `22 38` is unsupported and ignored. Charge counts therefore remain unavailable rather than being inferred from damage or a static class timer.
- The separate game-party list shows actual received skill-use observations. It does not predict the next use, remaining cooldown or readiness. Nearby players and invitation-room participants are not silently added to the game-party roster.
- A room relays each participating Luma client's own observations. It does not obtain automatic cooldown data for people who have not joined or independently authenticate another participant's game data.

## Free service limits

| Limit | Initial value |
| --- | --- |
| Participants per room | 12 |
| Room lifetime | Up to 120 minutes |
| Active rooms across the service | 20 |
| Sync quota across the service | 20,000 requests per UTC day |
| Native client poll interval | 5 seconds after successful synchronization |
| Cooldown freshness window | 6 seconds |
| Silent participant visibility | Up to 20 seconds |

Network failures back off rather than replaying requests continuously. When service limits are reached, relay updates can stop or fail; the app reports that state. Local damage measurement, history and exports continue. These are shared free quotas, not an unlimited service or a guarantee that rooms are always available.

## Privacy, stopping and expiry

The team relay makes no network request before explicit room creation or joining. Its payload contains your own display name, class, bounded own cooldown observations and freshness information. It excludes party members' names taken from capture, game actor IDs, damage records, equipment, private notes, raw packets and audio. Room observations are separate from public reports and rankings.

Invitation, host and participant keys stay in native memory for the session; they are not written to preferences/history or included in ordinary UI state snapshots. Copying an invitation deliberately exposes its join capability. The server stores capability hashes. Closing the app discards the native keys.

Leaving stops local synchronization immediately and requests participant removal. Host closure requests deletion of the room. Cleanup is best effort: an offline or interrupted request cannot confirm immediate remote deletion, and an already dispatched request may finish. Old cooldowns lose freshness; silent participants stop appearing after the visibility window, and rooms expire at their deadline. Reopening the app does not automatically rejoin.

## Validation and coverage

Native tests cover request bounds, capability redaction, stale data, cancellation and room lifecycle. SQL service tests cover authorization, privacy, sequence/rate checks, quotas, participant limits, expiry and closure/join interleaving. UI tests cover source/freshness distinctions and unknown versus estimated or confirmed readiness. These checks use synthetic inputs. Live game cooldown accuracy, two-client synchronization and failure behavior still require targeted testing with the final executable.

The pinned [cooldown findings](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/92806d72b1bb9cec4d092dc601d23447c7d67e29/docs/protocol/cooldown-frames.md) explain the raw counter and unresolved charge layout. See [feature coverage](feature-parity.md) for remaining limits and [resource observations](resource-protocol.md) for automatic Odyle energy, which is separate from cooldown sharing.
