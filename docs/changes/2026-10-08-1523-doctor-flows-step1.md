# Doctor flows, step 1: quick fixes

Opened: 2026-10-08 15:23 PHT

## What
From medfave-design `plans/doctor-flows.md`, step 1:
- **Visit moves** (`movesFrom` in `lib/domain.ts`, so the buttons, the server check and the API's `nextStatuses` agree): Check in and Start only on the visit's day; No-show only once its time has passed.
- **Cancel sits apart:** a quiet "Cancel visit" at the end of the row that asks first (`components/visit-moves.tsx`, used on the doctor's and the desk's visit pages).
- **Calendar** cells name the patient ("9:00a Ramon D."), full name on hover, not the surname.
- **Today:** "Patients list" → "Upcoming visits · Soonest first". The Today card's second line says what the count is made of ("1 to come · 1 seen · 2 no-show").
- **Last visit details:** allergies in the red box (colour rule); the chief complaint as one line instead of chips split from it; the last visit's diagnoses; Assessment / Plan only for older notes.
- **Allergy counts** on the patients list and a household's members are red-family whatever the severity.

## Why
Owner agreed the doctor-flows audit as a plan; this is its first step.

## Tested
`tsc`, eslint, `npm test` (21, one new for the moves rule). Headless Chrome at 1600px: tomorrow's visit (Reschedule and Cancel visit only), Today, Calendar, Patients. Not checked: the Cancel dialog opened, the desk's visit page, phone width.

## Heads-up
`movesFrom` takes a fourth argument, `begun` (default true). The mobile app reads `nextStatuses`, so it stops offering Check in on other days and No-show early too.
