# Doctor showcase: coded diagnoses on past notes

Opened: 2026-10-06 19:18 PHT

## What
- `db:seed-doctor-showcase` gives four past notes ICD-11 diagnoses: Marilou 5A11 (type 2 diabetes), Corazon BA00.Z (essential hypertension), Joaquin CA23.30 (asthma with exacerbation) and Lia MG26 (fever). They show in the visit lists, the side panel, the chart glance and carry-over. They're skipped if the ICD-11 list isn't loaded.

## Why
The demo had no coded diagnoses, so the new feature (#152, #160) showed nothing.

## Tested
- Rerun on the dev DB. A new note for Marilou carries over 5A11. Joaquin's carries none, because the main seed has a newer, uncoded note for him, and carry-over uses the latest signed note.
