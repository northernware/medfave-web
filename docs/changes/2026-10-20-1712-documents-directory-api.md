# API: all of a doctor's documents

Opened: 2026-10-20 17:12 PHT

## What
- `GET /api/v1/doctor/documents` no longer needs `patientId`: without it, all this doctor's documents (at most 200), newest first, narrowed by `q` (patient name) and `show=drafts|signed|shared`. Each item now carries `patient: { id, fullName }`.
- `docs/api.md` updated.

## Why
The doctor app gets a Documents directory (Profile → Practice), as SeriousMD and NowServing keep one.

## Tested
`tsc` and `eslint` pass. Locally against the dev DB as doctor@: all (3), drafts (0), signed (3), shared (2), `q=ramon` (3), `q=zzz` (0).

## Not done / next
- No paging past 200.
