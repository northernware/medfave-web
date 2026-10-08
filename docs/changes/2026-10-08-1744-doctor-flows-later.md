# Doctor flows, later items: patients list dates and sorting; one day picker on Calendar

Opened: 2026-10-08 17:44 PHT

## What
From medfave-design `plans/doctor-flows.md`, *Later*:
- **Patients list:** each row says when you last saw them ("Seen Oct 3, 2026", or "Not seen yet") and their next visit with you. **Sort by** Name, Last seen (never seen first, then longest ago) or Next visit (soonest first). Computed from this doctor's completed and upcoming visits, loaded in one query for the listed patients.
- **Calendar:** the schedule panel hides its month and week strip (`ScheduleRail weekStrip={false}`); the month grid beside it is the day picker.

## Why
Owner: finish the plan. "Who haven't I seen in a while" had no answer, and the Calendar had two day pickers side by side.

## Tested
`tsc`, eslint. Headless Chrome at 1600px: `/patients?sort=last`, `/calendar`.

## Not done / next
The sort happens after loading the whole list; fine at clinic scale, worth moving into the query if lists grow to thousands.
