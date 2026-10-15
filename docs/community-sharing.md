# Free sharing and community rankings

This document describes the **0.13.0 preview**. Local fight text, HTML, CSV and JSON sharing works without a hosted service. The online client and report/ranking service are implemented; public service activation/configuration remains a deployment gate. An unavailable endpoint does not prevent local measuring or exporting.

## Using the same application window

Open **Analysis → Sharing and rankings**. Choose the finished current encounter or a saved encounter, select Personal/Group/Observed, review privacy and explicitly accept public publication. The current encounter must have finished and entered local history; stop attacking and wait for completion or choose a saved record. A paused unfinished encounter is not a finished record.

**Create a free share link** sends only that selected summary. Copy/open it from **My shared records**. The browser report shows scoped totals, duration, players, skills and targets. It also offers public JSON download and printing. No account, payment or automatic upload is required.

For a server-free option, use **Copy encounter text** in Overview or Community. The text keeps total damage and per-second DPS separate, uses the selected scope and labels other players anonymously. HTML/CSV/JSON export remains available in History. Clipboard access failure provides selectable text instead of pretending it was copied.

## What is public

Player names are hidden by default. Disabling **Also hide my name** exposes only the uploader's own name; all other players remain `Player N`. Actor IDs are remapped. The chosen scope controls whose totals are included. Region, server, boss and difficulty labels are supplied by the uploader.

Published summaries contain the chosen scope's damage, duration, computed DPS, bounded player/skill/target lists and quality/context labels. They do not include raw network packets, captures, Cube recordings/templates, private notes/tags, other local encounters, account credentials or local file paths. Public links can be opened and copied by anyone who receives them. There is no private-report access control in this preview.

The local app keeps a random deletion key for each upload. The key is never included in report links, public API responses or the renderer's sharing state. Keep the local sharing data if you want to revoke links from this installation. Losing that key cannot be repaired by guessing an actor name.

## Removal and retention

Use **Remove link**, then confirm, to revoke a shared record. The app removes its stored public share only after a successful service response. Failed removal keeps the entry and key available for retry.

Public reports expire **30 days** after creation. Expiry/removal of a public report does not delete the local encounter. Repeating a request after a lost response can recover the same published link rather than creating duplicate entries. Pending requests remain visible so the same record can be retried. This service is bounded; it is not an unlimited permanent cloud archive.

The native client retains at most **200** public/pending sharing-key entries on this installation. Revoke older shares when that store is full. This limit is separate from local combat-history retention.

## Opting into rankings

Link creation alone never enters a result into rankings. The separate ranking option starts off and is available only for Personal scope. A ranked submission must meet all of these checks:

- A finished encounter from live capture, with complete retained samples.
- Automatically confirmed own actor identity and a known class. A manually selected row is insufficient.
- At least **10 seconds** of personal measured duration and positive personal damage.
- Exactly one personal target, marked as a boss, with a received meaningful name matching the entered boss label. Mixed boss/add totals can be shared but cannot be ranked as that boss.
- Region, server, boss and difficulty context supplied for comparable filtering.

Imported or incomplete records, group/nearby summaries, unknown identity/class, mixed targets and short attempts may be shared when their scoped totals are valid; they do not qualify for rankings. The app explains eligibility and the native client/service enforce it independently.

Rankings contain only players who chose to share and opt in. Filters include region, server, class, boss, difficulty and scope. The app replaces one bounded **25-result page** at a time; use **Next / Previous** to browse further matches. Changing the filters restarts at the first page. A failed page request preserves the last confirmed page and does not advance the page indicator. The public website also supports pagination. Compare equivalent targets, difficulty and durations. An empty filter result is not a measurement of your rank among all players.

The service validates structured summaries, arithmetic and ranking conditions. It cannot prove that a user-controlled client submitted an authentic game encounter. Results are explicitly **community submitted**, not official game records, verified world ranks, anti-cheat certifications or population percentiles.

## Availability and errors

Community reads preserve previously received results during a network error and label the failure. Upload failures never create a fake successful link; revocation failures never erase the retained deletion key. The client does not silently switch providers, scrape a competing site's logs or upload every encounter.

The application uses its configured Luma HTTPS endpoint; redirects or unrelated report origins are rejected. The service limits request sizes, record shapes and traffic and expires old data. There is no paid entitlement in Luma. Public endpoint availability still depends on deployment and the hosting service's limits.

### Initial service limits

These are the implemented 0.13.0 defaults, not a promise of unlimited hosting. Daily buckets reset at **00:00 UTC**. Deployment operators may change limits in a later version; the API response remains authoritative.

| Limit | Initial default |
| --- | --- |
| Upload request body | 1 MiB (1,048,576 bytes) |
| Report duration accepted for sharing | 1 second to 24 hours; ranking minimum is 10 seconds |
| Report rows | Up to 100 players, 100 targets and 500 skills per player, within the body limit |
| Stored report count | 5,000 across the service |
| Stored report JSON | 100 MiB across the service; database/index overhead is separate |
| Upload burst | 5 per source IP in a fixed one-minute bucket |
| Uploads per source IP | 20 per UTC day |
| Uploads across the service | 100 per UTC day |
| Ranking API reads across the service | 600 per UTC day |
| Individual report API reads across the service | 2,000 per UTC day |
| Ranking page | 25 entries by default; at most 50, with a pagination cursor |
| Public retention | 30 days from creation |

Recovering the same unexpired upload with its matching deletion key/fingerprint returns its existing link before consuming another upload quota. Expired reports are unavailable immediately; bounded cleanup removes their stored rows during later writes. Quota and storage failures return HTTP `429` and `507` respectively. They do not upgrade the user to a paid plan, erase local encounters or create a fake share. Stored links are not deleted merely because capacity is full; online reads still obey the service's read quotas.

For supported measurement boundaries, see [feature coverage](feature-parity.md) and [capture details](../src-tauri/NATIVE_CAPTURE.md).
