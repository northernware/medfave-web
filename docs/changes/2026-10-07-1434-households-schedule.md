# Schedule panel on the households pages; cards open on hover and click

Opened: 2026-10-07 14:34 PHT · Updated: 2026-10-07 15:38 PHT

## What
- Today's schedule panel beside the households list (each visit names its household; no colour per household) and each household's page (only its members' visits, a coloured initials mark per member, with a legend).
- Pinned to the window's right edge, top to bottom, like Today's.
- Hovering or tabbing into a card lifts it over its neighbours, full width and height, every line showing (a one-line card shows its second line).
- The whole card links to the visit; Check in / Start / Undo check-in sit above the link.

## Why
Owner (the doctor's idea): the schedule on the households pages, per household and per member. Colour per household was dropped: more households than distinguishable colours, and no wall of colours.

## Tested
Headless Chrome at 1600px: both pages; hovering Marilou's one-line card; every card's corner hits its visit link with a pointer and the Check in button still gets its own click.

## Heads-up
`lib/schedule-rail.ts` (`loadScheduleRail(doctor, day, patientIds?)`); `ScheduleRail` gains `showHousehold` and `members` (`memberMarks()`).
