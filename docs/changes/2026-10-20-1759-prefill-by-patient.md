# API: start a certificate from a patient

Opened: 2026-10-20 17:59 PHT

## What
- `GET /api/v1/doctor/documents/prefill` also takes `?patientId=`: their latest note by this doctor (its day, diagnosis and visit), else today. The answer now includes `appointmentId` (the visit it's drawn from, or null).
- `docs/api.md` updated.

## Why
The app starts certificates from the patient page and the Documents list, not only from a visit.

## Tested
`tsc` and `eslint` pass. Locally, `?patientId=` for Corazon Dela Cruz gives her latest note (Oct 13) with its assessment and visit.

## Not done / next
Nothing.
