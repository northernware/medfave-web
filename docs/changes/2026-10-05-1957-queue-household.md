# Doctor API: household on the day's visits

Opened: 2026-10-05 19:57 PHT

## What
- `GET /doctor/day`: each visit's `patient` also has `householdId`, in `appointments` and `queue`. Other endpoints are unchanged (the field is optional in `AppointmentRow`).
- `docs/api.md` updated.

## Why
Seeing family together: the app offers to start household members waiting with the one being started.

## Tested
- `tsc` (apart from the missing `@solar-icons/react` install), eslint. Local API: the Dela Cruz family share a householdId, Elena has her own.
