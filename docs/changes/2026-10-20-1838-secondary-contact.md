# API: a patient's second emergency contact

Opened: 2026-10-20 18:38 PHT

## What
- `GET /api/v1/doctor/patients/:id` adds `patient.secondaryContact` (`{ name, relationship, number }` or null), from the `emergencyContact2…` fields the web already keeps.
- `docs/api.md` updated.

## Why
The doctor app's Contact group shows both emergency contacts; it only had the first.

## Tested
`tsc` passes. Locally: Corazon Dela Cruz returns her primary (Ramon, son) and `secondaryContact: null`.

## Not done / next
Nothing.
