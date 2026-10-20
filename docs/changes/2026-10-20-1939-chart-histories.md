# Chart: past medical, family, and personal and social history

Opened: 2026-10-20 19:39 PHT

## What
- Migration `20261020T1137_chart_histories` (additive): tables `PatientPastHistory` (kind ILLNESS / SURGERY / HOSPITALIZATION, label, year, notes) and `PatientFamilyHistory` (condition, relative, notes); `Patient` columns `smoking`, `packYears`, `alcohol`, `occupation`, `socialNotes`. **Applied to the shared dev DB** (`db:migrate --advance-ref db`); `db:verify` passes.
- Chart actions (`POST /doctor/patients/:id/chart`): `past.add|remove`, `family.add|remove`, `social.set`.
- `GET /doctor/patients/:id` `chart` adds `pastHistory`, `familyHistory`, `social`.
- `docs/api.md` updated.

## Why
A doctor asked for the standard history: past medical, family, personal and social (OB and the children's histories next). Ongoing conditions already keep resolved ones; past surgeries and hospitalisations had nowhere to go.

## Tested
- `tsc` and `eslint` pass.
- Locally against the dev DB on Corazon Dela Cruz: added a family entry (Hypertension, Mother), refused one without a relative, added a past surgery (Appendectomy, 1998), set the social history, read them back, then removed / cleared them all.

## Not done / next
- The web chart doesn't show or edit these yet (the app first).
- OB history; development, birth and immunization history for children.

## Heads-up
- Migration applied to the shared dev DB. Pull and `npm run db:verify`.
