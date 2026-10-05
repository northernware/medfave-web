# Doctor showcase data

Opened: 2026-10-05 15:03 PHT

## What
- `npm run db:seed-doctor-showcase` fills what the doctor's app shows for doctor@medfave.com (Dr. Ana Reyes), timed from when it runs:
  - Today: one patient with the doctor, two waiting (26 and 6 min), two still to come (Paula said she's coming);
  - visits on most days this week;
  - 3 requests, one from a new patient;
  - charts: a severe allergy and a pregnancy alert (Elena), "No known allergies" (Marilou), and Jnmark left as "Not asked yet";
  - 7 past visits with notes, 6 of them rated: 5, 5, 4, 3, 2 with tags and notes, plus two faves.
- Rows have ids starting `drshow-`, so a rerun replaces them. Re-run it to make Today current again.
- `docs/api.md`: `GET /doctor/feedback` (missed in #146).

## Why
The owner asked for sample data so everything on the doctor's mobile side shows.

## Tested
- Run against the shared dev DB. Checked through the local API: today's queue and statuses, Paula's "coming", 9 ratings (average 4.3), 3 faves, Elena's chart.
- `tsc` and eslint clean.

## Heads-up
- Already run on the shared dev DB. It sets the allergy/condition/medication status on Elena's, Marilou's and Paula's charts, and those settings stay after a rerun.
