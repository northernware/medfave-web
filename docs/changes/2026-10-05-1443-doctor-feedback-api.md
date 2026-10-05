# Doctor API: patient feedback

Opened: 2026-10-05 14:43 PHT

## What
- `GET /api/v1/doctor/feedback` returns the doctor's own feedback, as `/feedback` shows it:
  - figures: `average`, `count`, `good` (4–5), `faves`, and `mentions` (tag, label, count);
  - a page of ratings, newest first: score, tags with labels, note, the visit and the patient.
- `?view=attention` returns ratings of 1–3 only; `?page=` pages through 25 at a time.
- The queries moved from `components/feedback-view.tsx` to `lib/feedback.ts` (`readFeedback`), which the web pages and the API share. The pages are unchanged.

## Why
Plan *mobile-next*, step D: feedback in the doctor's app.

## Tested
- `tsc` (apart from the missing `@solar-icons/react` install) and eslint clean.
- Against the local dev server as doctor@medfave.com: 4 ratings, average 5, 1 fave, tags counted; `view=attention` gives 0.
- **Not seen in a browser:** the web pages after the move.
