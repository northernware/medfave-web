# Ongoing conditions keep their history; diagnoses can join them

Opened: 2026-10-06 19:56 PHT

## What
- **Resolved, not deleted:** on the patient page, each ongoing condition has **Resolve**. It moves to **Past conditions** with its date; **Reopen** brings it back. Migration `20261006T1152_condition_history` adds `PatientCondition.resolvedAt`, `resolvedById` and `code` (ICD-11, when it came from a visit). Additive only.
- **From the note:** each diagnosis on the note form has **Ongoing condition (add to the chart when signed)**, ticked by default for long-term codes (diabetes, hypertension, asthma, COPD, CKD, thyroid, epilepsy, depression and anxiety, arthritis, gout, HIV, TB: `looksLongTerm` in `lib/diagnosis-rank.ts`). It shows "On the chart" when the patient already has it. Signing adds the ticked ones (`lib/conditions.ts`). A resolved one with the same code or name becomes current again.
- **Only current conditions** show in the note's side column (now **Ongoing conditions · On the chart**), the app's chart, the emergency card and the patient edit form.
- **The patient edit form** no longer wipes and rewrites conditions: it keeps current ones (with their codes), removes ones taken off, adds new ones, and reopens a past one listed again by name. Resolved ones are untouched.
- **History of present illness** has a hint: "Today's complaint: when it started, how it's changed, what helped or didn't."
- **API:** `POST /doctor/records` takes `ongoing: [code]`; `/doctor/patients/:id` lists current conditions only.

## Why
The owner found "History of present illness" next to "Conditions" confusing, and asked whether conditions stay forever. They did, with no way to mark one past, and deleting lost the history.

## Tested
- `tsc` (apart from the missing `@solar-icons/react` install), eslint, `npm test` (20).
- Migration applied to the dev DB; `migrations/app/refs/db.json` moved to `c8dd5721…`.
- Signing a note for Paula with BA00.Z (marked ongoing) and MD12 (not) added only Essential hypertension to her conditions, with its code.
- Headless Chrome on her page: **Resolve** moved it to Past conditions ("resolved October 6, 2026"); **Reopen** brought it back.

## Heads-up
- **Migration** `20261006T1152_condition_history`: run `npm run db:verify` after pulling.
