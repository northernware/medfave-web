# Visits API: earlier days' unfinished visits go to Past

Opened: 2026-10-19 12:16 PHT

## What
- `view=upcoming` keeps only **today's** checked-in or in-consultation visits, plus everything from now on.
- `view=past` adds visits from earlier days never closed (still checked in or in consultation). The app marks those "Not completed". Today's "Left open" still lists them.

## Why
Owner's screenshot: after #234, Upcoming opened with Saturday's and yesterday's unfinished visits, above what's actually ahead.

## Tested
`tsc` and `eslint` pass. On the local dev server:
- Upcoming returns 9 visits: today's 2 under way, 5 confirmed, 2 pending.
- Past returns 31: 26 over, plus 5 from earlier days never closed.
