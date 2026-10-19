# Visits API: Upcoming filtered to pending

Opened: 2026-10-19 22:11 PHT

## What
`GET /api/v1/doctor/appointments?view=upcoming&filter=pending` lists only bookings not yet confirmed.

## Why
The app's new filter menu on Visits offers "Needs confirming" for Upcoming.

## Tested
`tsc` and `eslint` pass. Checked on medfave.vercel.app after deploy.
