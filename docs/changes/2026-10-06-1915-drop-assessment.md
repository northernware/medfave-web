# Visit notes: no Assessment field

Opened: 2026-10-06 19:15 PHT

## What
- The note form has no **Assessment** field any more: the coded ICD-11 diagnoses say it. A note that already has an assessment still shows the field when edited (so saving can't erase it), and the assessment still shows wherever it did (the note, the panel, the visit lists when a note has no diagnoses).
- **Carry-over** for a return visit brings the last note's **diagnoses** (ICD-11) instead of its assessment. The banner reads "diagnoses, advice, medicines and height". `carryOver.diagnoses` is new; `carryOver.assessment` is always empty. `docs/api.md` updated.
- The landing page describes notes as "vitals, ICD-11 diagnoses, prescriptions and advice".
- No database change.

## Why
The doctor said the assessment doesn't belong in the form now that diagnoses are coded.

## Tested
- `tsc` (apart from the missing `@solar-icons/react` install), eslint, `npm test` (20).
- Headless Chrome on Elena's new note against the local server: the form shows Diagnoses (ICD-11) and Advice and notes, with no Assessment or Plan; the banner reads "diagnoses, advice, medicines and height".
