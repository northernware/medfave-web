# Doctor API: whether a patient has a login

Opened: 2026-10-18 19:04 PHT

## What
`GET /api/v1/doctor/patients/[id]` now includes `patient.hasLogin`, which is true when the chart is linked to a Medfave login.

## Why
The doctor app only offers "Give app code" (`POST …/activation`, #230) for patients who don't have a login yet.

## Tested
`tsc` and `eslint` pass. On the local dev server, the test patient from #230 returns `false`.
