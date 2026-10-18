# Visits API: how many visits need a note

Opened: 2026-10-18 20:44 PHT

## What
`GET /api/v1/doctor/appointments` now includes `needsNote`: how many of the doctor's visits are completed without a signed note. It counts all of them, whatever the view, filter or search.

## Why
The app shows this count on its "Needs a note" chip and as a badge on the Visits tab.

## Tested
`tsc` and `eslint` pass. On the local dev server, it returns 2 for Upcoming and for Past filtered to missed, which matches the 2 in the needs-note list from #232.
