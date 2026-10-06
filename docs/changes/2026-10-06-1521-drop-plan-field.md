# Visit notes: no Treatment plan field; "Advice and notes"

Opened: 2026-10-06 15:21 PHT

## What
- The note form has no **Treatment plan** field any more. A plan is now the prescriptions (with their instructions) plus **Advice and notes**, the renamed Notes field, for anything that isn't a medicine: lifestyle advice, handouts, labs, referrals.
- A note that already has a plan still shows the field when edited, so saving can't erase it. The plan still shows on the note page and the dashboard's last visit.
- **Carry-over** for a return visit brings the last note's advice, or its plan if it was written before this change, into Advice and notes. `carryOver.treatmentPlan` is always empty now; `carryOver.notes` is new. `docs/api.md` updated.
- No database change: the `treatmentPlan` column stays.

## Why
The doctor said the plan field duplicates the prescriptions and their notes. Of 15 notes on the dev DB, 3 had a plan, two with non-drug advice ("Reduce added salt…", "handout given"), so that advice needed a home.

## Tested
- `tsc` (apart from the missing `@solar-icons/react` install), eslint, `npm test` (20). Not seen in a browser.

## Not done / next
- The app's note screen (medfave-mobile PR).
