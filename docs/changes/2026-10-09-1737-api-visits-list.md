# API: the doctor's visits as a list

Opened: 2026-10-09 17:37 PHT

## What
`GET /api/v1/doctor/appointments?view=upcoming|past&q=` → `{ appointments[] }`: this doctor's visits from now (soonest first) or before now (most recent first), optionally narrowed by the patient's name; shaped as in `/doctor/day`. Up to 100. `docs/api.md` updated.

## Why
The app's new Visits tab (replacing Requests in the tab bar).

## Tested
`tsc`, eslint. Against the local server with a doctor token: upcoming (11), past (29), `q=elena` (2).
