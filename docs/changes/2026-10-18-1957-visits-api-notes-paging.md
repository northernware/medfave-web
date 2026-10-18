# Visits API: note status, outcome filters, paging

Opened: 2026-10-18 19:57 PHT

## What
`GET /api/v1/doctor/appointments` changes:
- Each visit has `note`: `{ id, status: "DRAFT" | "SIGNED" }`, or null when there's no note.
- Past takes `filter=completed | missed | cancelled | needs-note`. `needs-note` means completed with no signed note (none, or a draft).
- Results come in pages of 50, with `more`. Ask for the next page with `before=` (past) or `after=` (upcoming), set to the last visit's `scheduledAt`. The old hard cap of 100 is gone.

## Why
For the app's Visits tab: show which past visits still need their note, filter by outcome, and reach visits older than the cap.

## Tested
- `tsc` and `eslint` pass.
- On the local dev server as doctor@medfave.com:
  - Upcoming returns 10 visits; Past returns 30, 9 of them with signed notes.
  - The filters return 11 completed, 13 missed, 1 cancelled and 2 needing a note.
  - Asking for the page after the last past visit returns nothing.
- Not tested with more than 50 results, because the dev data has 30.

## Heads-up
- The response adds `more` and `note`. Older app builds ignore them.
- A page now holds 50 visits, not 100.
