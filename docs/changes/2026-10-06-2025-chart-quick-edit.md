# Change the chart from the note's side column; medicines keep their history

Opened: 2026-10-06 20:25 PHT

## What
- While writing a note (new or draft/amend), the side column changes the patient's chart in place:
  - **Allergies:** + Add (name, severity, reaction), **Remove** one recorded by mistake, **No known allergies** when none are recorded;
  - **Medical alerts:** + Add, Remove;
  - **Ongoing conditions:** + Add, **Resolve**;
  - **Current medicines:** + Add (name, dose, how often), **Stop**.
  Each saves at once, apart from the note. The draft in the form stays as typed. Only a doctor caring for the patient can do it (`lib/chart-edits.ts`, `app/actions/chart.ts`, `components/chart-form.tsx`).
- **Medicines keep their history**, like conditions (#162): migration `20261006T1219_medication_history` adds `PatientMedication.stoppedAt` / `stoppedById`. Stopped ones leave the current lists (side column, app chart, emergency card, edit form) and show on the patient page as **Past medicines** with **Restart**. Adding a stopped medicine again brings it back with the new dose. The patient edit form now updates medicines in place instead of wiping them.
- The allergy and alert boxes only offer editing beside a note; elsewhere they're read-only as before.

## Why
The owner: the details on the right of the note couldn't be updated without leaving the note.

## Tested
- `tsc` (apart from the missing `@solar-icons/react` install), eslint, `npm test` (20).
- Migration applied to the dev DB; `migrations/app/refs/db.json` moved to `70db0307…`.
- Headless Chrome on Paula's new note, with a chief complaint typed: added Sulfa drugs (moderate), added Amlodipine 5 mg, stopped it, resolved Contact dermatitis, removed Sulfa drugs. The database matched each step, and the typed complaint was still there after every change.

## Heads-up
- **Migration** `20261006T1219_medication_history`: run `npm run db:verify` after pulling.
- On the dev DB, Paula now has Amlodipine stopped and Contact dermatitis resolved (from the test).
