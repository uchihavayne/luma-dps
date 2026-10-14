# Native packet clock audit

The 0.9.1 capture adapter accepted every positive metadata timestamp after the
Windows epoch. Local captured records exposed an invalid timestamp that converted
to `550085638326210` Unix milliseconds, outside the supported calendar range.
The encounter clock then started after the current system clock, so its elapsed
time remained zero. The one-second minimum denominator made DPS equal total
damage. This affects the rate and time-dependent features, without changing the
parsed damage amounts.

Microsoft documents Packet Monitor's `TimeStamp` as the value of
`KeQuerySystemTime`, expressed in 100-nanosecond intervals since 1601. The adapter
now accepts the converted value only if it is no later than the callback's
current time and at most 60 seconds older. Invalid, negative, stale or future
metadata uses the callback time. The callback still receives and queues the
same complete packet bytes. No protocol, actor attribution or damage counting
rules changed.

The metadata layout itself was not changed without verified ABI evidence. The
sanity check also contains incompatible or corrupt timestamp values instead of
letting them freeze the encounter, training session, cooldowns and effect clocks.

Regression checks cover valid FILETIME precision, invalid and future values,
the actual invalid timestamp, the native callback, unchanged observed combat
frames with personal and party elapsed time, idle finalization, and the exclusive
60-second training cutoff. These tests use synthetic packets and do not open a
capture session. New live capture has not yet been verified for this change.

Existing zero-duration records cannot supply their true elapsed time; retaining
the original damage amounts does not make their saved DPS reliable. Their time
and rate should be shown as unavailable rather than assigning an invented
duration.

Source: [PacketMonitorCreateRealtimeStream and metadata contract](https://learn.microsoft.com/en-us/windows/win32/pktmon/packetmonitor/nf-packetmonitor-packetmonitorcreaterealtimestream).
