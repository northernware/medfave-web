# API: change the chart from the app; blood type and primary contact

Opened: 2026-10-08 21:12 PHT

## What
- `POST /api/v1/doctor/patients/:id/chart` — one chart change, the same as the web's side column: it hands the body to `editChart` (`lib/chart-edits.ts`), so the rules (caresFor, not archived, duplicate names, which row belongs to whom) stay in one place. `200 { ok: true }`, `422 { error }`.
- `GET /api/v1/doctor/patients/:id` adds `patient.bloodType` and `patient.primaryContact` for the app's clipboard.
- `docs/api.md` updated.

## Why
The app is catching up with the web's chart: the clipboard look and changing the chart in place.

## Tested
`tsc`, eslint. Against the local server with a doctor token: `allergy.add` on Paula → ok, read back, `allergy.remove` → ok (her chart as before), `condition.add` without a label → 422 "Name the condition."

## Heads-up
New API route; the app's screens follow in medfave-mobile.
