# Automatic party cooldown observations

Luma reads actor-bound cooldown and charge observations from received game
traffic. A room, account, remote service, or another running Luma client is not
required. Only a confirmed current party member or the server-confirmed local
character is shown in the automatic team panel. Seeing an actor cast is not
itself proof that the actor belongs to the party.

## Protocol evidence

The wire-field investigation was checked against the following primary MIT
sources, pinned at Waffle revision
`cf885f1a9fac1758a14164286ce4c28ce0a01660`:

- [Capture parser](https://github.com/Waffle-ens/waffle_meter/blob/cf885f1a9fac1758a14164286ce4c28ce0a01660/dotnet/src/WaffleMeter.Capture/StreamProcessor.cs)
- [Cooldown wire examples and boundary tests](https://github.com/Waffle-ens/waffle_meter/blob/cf885f1a9fac1758a14164286ce4c28ce0a01660/dotnet/tests/WaffleMeter.Capture.Tests/CooldownStartParsingTests.cs)
- [Cast grace and counter correction tests](https://github.com/Waffle-ens/waffle_meter/blob/cf885f1a9fac1758a14164286ce4c28ce0a01660/dotnet/tests/WaffleMeter.Data.Tests/CooldownCastGraceTests.cs)
- [Incremental party membership tests](https://github.com/Waffle-ens/waffle_meter/blob/cf885f1a9fac1758a14164286ce4c28ce0a01660/dotnet/tests/WaffleMeter.Capture.Tests/PartyRosterIncrementParsingTests.cs)
- [Member profile identity tests](https://github.com/Waffle-ens/waffle_meter/blob/cf885f1a9fac1758a14164286ce4c28ce0a01660/dotnet/tests/WaffleMeter.Capture.Tests/MemberProfileParsingTests.cs)

The Rust decoder and ledger are implemented within Luma. No external skill
duration catalog or shared cooldown-group catalog is bundled. Small public wire
examples exercise field interpretation; private capture files and account
identifiers are not test fixtures.

## Completed cast: bytes `02 38`

The existing cast header supplies actor ID, actor flags, skill ID, sequence,
position flags, target ID and facing. Position flag `02` additionally supplies
three coordinates. After this header the validated tail is:

| Field | Encoding | Meaning used by Luma |
| --- | --- | --- |
| A | Varint | Opaque; no timing meaning assigned |
| B | Varint | Opaque; no timing meaning assigned |
| C | Varint | Ordinary skill's actual cooldown in milliseconds |
| Charges, when actor flags contain `04` | Varint | Received available charge count |
| Recharge, when actor flags contain `08` | Varint | Received next-charge remainder in milliseconds |
| Target list, when actor flags contain `20` | Count followed by actor ID and three floats per item | Parsed to establish the exact end; never used as duration |

When either charge flag is set, C must be zero; absent charge/recharge fields
then mean zero. The last varint is not generally a cooldown. In particular,
recharge remainder and multi-target coordinates must not become ordinary skill
durations. Unsupported flags or a malformed, truncated or trailing tail retain
the independently valid cast header but provide no timing observation.

The accepted class-skill range is 11,000,000 through 19,999,999. Received timing
values are bounded to one hour, charge counts to nine, and target lists to 64.
These are decoder safety limits, not an assertion about a skill's maximum
charges. The last four skill-ID digits identify observed rank/specialization
variants within the same family; Luma does not invent shared groups across
different families.

An ordinary positive cooldown starts a native deadline. Its initial 400 ms are
provisional because a subsequent local periodic counter may report a correction
or reset. C=0 alone does not cancel an earlier active cooldown: a proc or another
zero-duration cast is not sufficient reset evidence.

## Local charge notice: bytes `22 38`

The supported complete form is a one-byte mask, a little-endian skill ID, then
charge count when mask bit `01` is set and recharge milliseconds when mask bit
`02` is set. Only masks 1, 2 and 3 are accepted; absent fields mean zero and the
frame must end exactly. This notice has no actor field. It binds only to the
current character identified by the server's local-character message, never to
a selected row, typed alias, party member or room participant.

The older local `47 38` counter remains separate. Its raw unit is not established
as milliseconds. A dynamically calibrated stable counter sequence may produce
an estimate, and a received zero may confirm local readiness. There is no fixed
2.4 conversion in Luma. Raw observations are serialized as `server-counter`;
validated actor-bound durations are serialized as `milliseconds`.

## Membership and actor identity

Counted `02 97` records and validated `1F 97` member updates merge the observed
party slots. Absence from an incremental record does not remove another member.
The current wire roster is marked `complete: false`; no unsupported complete-list
or disband flag is inferred. `22 96` removes the received member key and home
server. A matching local member removal clears current party membership.

`00 92` profile records can bind a combat actor ID only after a unique matching
name and home server has been received in the current party roster. The profile
record validates a structured GUID field and repeated server value. It cannot
create party membership or promote an actor to the local character. Ambiguous
duplicate names are omitted from automatic name-only matching. A healer can be
identified through these records before dealing damage.

The supported counted roster variant retains its existing typed name, slot,
level and repeated home-server boundary checks. Incremental updates validate a
bounded known member prefix and metadata anchors; other metadata remains opaque.
Unrecognized regional or future layouts are rejected rather than guessed.

## Snapshot and readiness semantics

`actor_cooldowns` contains actor and skill IDs, source, observation kind, unit,
native observation/sample timestamps, ordinary duration and deadline, independent
charge count and recharge deadline, readiness, provisional/fresh flags and
confirmation source. Nullable fields are always serialized. `max_charges` stays
null because a received available count does not establish capacity.

Long received deadlines remain usable through expiry, with a bounded 30-second
elapsed display period. Expiry is labeled elapsed, never server-ready. Recharge
expiry does not increment a charge count. Available-use evidence is distinct
from full charge capacity. A received local zero confirms readiness for at most
six seconds; a contradictory nonzero raw counter invalidates that confirmation.

Capture loss, connection/session changes, clock reversal, entity removal and
identity reuse invalidate current timing evidence. Live party membership becomes
unknown after capture loss. Archived encounter attribution remains unchanged.
There is no prediction for a party skill that has not been observed, no initial
all-skills-ready assumption, and no inferred cooldown reduction from static data.
