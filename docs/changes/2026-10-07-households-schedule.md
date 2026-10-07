# The schedule panel on the households pages

The day timeline from Today now sits beside the households list and each household's page (right column on wide screens, under the page on narrow ones). It shows this doctor's visits, with the same week strip and day picking (`?day=`).

- **Households list:** every visit says its household ("Dela Cruz household" on full cards, right after the time on short ones). No colour per household: a clinic has more households than colours anyone can tell apart, and a panel of coloured cards is the wall of colours we avoid.
- **A household's page:** only its members' visits, each member with a coloured initials mark and a legend above the day. A few people, so a colour each reads at a glance. The status dot stays as it was.

Code: `lib/schedule-rail.ts` (`loadScheduleRail(doctor, day, patientIds?)`), `ScheduleRail` gains `showHousehold` and `members` (`memberMarks()` in `app/(app)/dashboard/panels.tsx`).

## Follow-up: squeezed cards open on hover

Hovering a schedule card (or tabbing into it) lifts it over its neighbours, full width and as tall as it needs, with every line unwrapped. A one-line card shows its hidden second line (time, household, status, service). It keeps its own top, so it reads as the same card. On Today and the households pages alike.
