# Radar and replay

The Radar chip opens a compact radar inside the meter. Analysis → Radar offers a larger view, 20/50/100/200 metre ranges and all/party/creature/pet-source filters. Matching pet sources have the same pin action as the pet guide. It uses received NPC IDs or exact creature names from the existing factual catalog.

Radar uses received world coordinates in centimetres, converted to horizontal metres. A fresh server-identified self position is required. +X/+Y are fixed world axes; they have not been calibrated to geographic north or camera heading. The self triangle is a position marker, not a measured facing arrow. Height is shown only when both positions include received Z. Observations older than five seconds fade; after fifteen seconds they disappear. Map changes, capture gaps, despawns and actor reuse invalidate positions. The radar does not discover objects that the server has not supplied.

Supported observations are documented `xx37` movement records, NPC `4136` spawn coordinates, `2136` zone spawn coordinates after self binding, and bounded effect-tail coordinates for an already confirmed local self. A skill cast's coordinates are retained separately as its **aim point**, never as the caster's position. This release does not include licensed map tiles, a calibrated map overlay, resource-node discovery or a network Cube-position decoder. The audio Cube indicator remains separate from world coordinates.

Analysis → Replay loads a local encounter or an explicit snapshot of the current encounter. Controls provide play/pause, scrubbing and 0.5/1/2/4× playback. The selected self/party/observed damage scope applies to retained hit events. Sample DPS uses the retained event timeline; it is not a reconstruction of unrecorded pause intervals. Missing samples are never scaled to match aggregate totals. Partial samples are labelled. Older recordings still replay their damage timeline, with no invented positions.

Position playback holds the last received observation and honours removal and actor generations. It does not interpolate a path through unobserved movement. The store retains at most 256 live positions, 1,024 actor labels, 12,000 sampled positions and 512 aim events per snapshot. History has a shared 50,000 position budget; truncated paths are marked. Live IPC excludes the recorded path. New encounters acquire spatial history automatically; old recordings cannot gain past positions retroactively.

Local JSON exports preserve bounded spatial data and numeric actor IDs. Personal/party exports filter spatial actors to the selected report. Anonymous exports omit spatial data and embedded names entirely. Public community summaries do not upload these paths.

## Protocol evidence

The wire layouts were checked against the MIT [AionDPS decoder](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/395c5ecee9fd25bd85701e5ee7e05aff3c41d291/Client/Aion2/Protocol/Aion2FrameDecoder.cs) and [entity directory](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/395c5ecee9fd25bd85701e5ee7e05aff3c41d291/Client/Aion2/Aion2EntityDirectory.cs). Luma's Rust store, decoders, UI and synthetic tests are independently written. Third-party implementation, map images and catalogs from that repository are not bundled. Synthetic tests do not establish complete regional live coverage.

The same evidence distinguishes permanent character IDs in player lists from session combat actor IDs. Those IDs are not interchangeable. Nearby nickname frames require a bounded name position and a complete typed server/class/faction/level suffix; appearance frames preserve the acting actor's home server. Neither route guesses self or party membership. An unowned summon is not assigned another player's name by class, proximity or damage timing alone.
