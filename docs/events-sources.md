# Event clocks and calendar sources

EU presets work offline without entering an interval or anchor. The compact header starts with Spacetime Rift; players can select another event, their own custom timer or hide it. Reminders are enabled separately for each event and begin disabled for built-in clocks.

| Preset | Clock model | Source boundary |
| --- | --- | --- |
| Spacetime Rift | Three-hour UTC cycle from 00:00; ten-minute portal window | [Published Rift subscription](https://aion2atlas.app/rift.ics). The portal window is separate from the longer event. |
| Shugo Festival | Each UTC hour at :00; published ten-minute reference window | [Community timer reference](https://shugo.gg/timers), checked 13 October 2026. |
| Dimensional Invasion | Each UTC hour at :30; published fifteen-minute reference window | [Community timer reference](https://shugo.gg/timers), checked 13 October 2026. |
| Artifact Siege | Monday, Thursday, Saturday at 21:00 Europe/Berlin | [Published Europe boss calendar](https://aion2atlas.app/calendar/bosses-eu.ics); calendar uses equivalent Europe/Paris timezone. |
| Siege Bosses | Monday, Thursday, Saturday at 21:30 Europe/Berlin | Same Europe subscription; spawn time does not establish an individual boss's death/despawn time. |
| Watcher Kaira | 01:00 then each three hours on the Europe server clock | Same Europe subscription; separate daily records retain their timezone rules. |
| Guardian Lord Nahma | Friday and Sunday at 21:00 Europe/Berlin | [Community reference](https://aion2tierlist.com/world-boss-timer/). This remains a provisional preset; it is not supplied by the Atlas subscription. |
| Daily reset | 07:00 UTC | [Published reset subscription](https://aion2atlas.app/resets.ics). |
| Weekly reset | Wednesday at 07:00 UTC | Same reset subscription. |

These are community schedules, not NCSOFT-confirmed availability. Source, checked date and publisher date stay attached to each event. Fixed spawn schedules differ from the received map-slot alive/respawn observations. A boss's published thirty-minute reference duration is not treated as proof of a thirty-minute lifespan.

The application reads the explicitly offered Atlas subscriptions through its bounded native calendar provider. It does not automatically collect the Shugo site or its internal JSON endpoint. Its independently authored offline presets contain timing facts; they do not reproduce descriptions, artwork, code or another site's interface. A failed refresh leaves the offline clocks usable.

## Time rules

Rift and reset UTC rules retain their UTC instant across daylight-saving changes. Europe boss wall-clock rules retain their local hour and convert to different UTC instants when daylight saving changes. Calculations use the event's UTC or IANA timezone, then display the resulting instant in the player's local clock.

Custom recurring calendars can use UTC intervals or IANA weekly wall times. A nonexistent spring time is skipped. For repeated autumn wall times, the default selects the earlier occurrence; custom rules can request the later occurrence or both. This is an explicit calendar policy and does not establish an undocumented game-server policy. Existing manually saved anchor timers retain their prior local-input interpretation.

An open status means the scheduled reference window is open. It does not confirm the portal's actual capacity or admission. Rift's ten-minute entry window and its longer event duration are separate. Opening reminders use the opening deadline; a closing deadline never triggers an opening reminder.

## Import, update and export

The supported published calendar subset contains VEVENT dates with UTC or an IANA TZID, hourly UTC intervals, daily and weekly rules with weekdays, and optional UNTIL. COUNT is supported for hourly UTC intervals. Unsupported rule types or malformed documents are rejected as a whole; a partial document cannot replace only some of its events. Publisher descriptions, links inside descriptions and VALARM instructions are not executed or adopted as app reminders.

Calendar documents are limited to 128 KiB and 64 events. Downloaded calendars map only recognized Rift, reset and Europe boss records to stable built-in IDs. Refresh data cannot add executable code or silently enable notifications.

ICS export expands a finite UTC occurrence set for the selected horizon, with no perpetual recurrence rule. It has a 60-day horizon and 4,096-occurrence limit, escapes text and folds at UTF-8 boundaries. Exported alarms appear only when the player enabled that event's reminder. The source label remains in the exported description.
