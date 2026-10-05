# Test scenarios: family waiting, running late

Opened: 2026-10-05 20:12 PHT

## What
- `npm run db:seed-doctor-showcase` also puts **Ramon** in the waiting room (checked in 12 minutes ago), so three of the Dela Cruz household wait together (Joaquin, Ramon, Marilou) for the "start together" test.
- `npm run db:scenario -- late` (`src/prisma/seed-scenario.ts`): a visit for Ramon (patient@medfave.com) 2 minutes ago, not checked in, so the patient app shows "Held until …" and **Call the clinic** for 13 minutes. Rerun to reset; its row is `scenario-late`.
- The steps for each test are in medfave-design `testing/doctor-and-patient.md`.

## Why
The owner wants to show these tests to a developer without editing the database by hand.

## Tested
- `db:scenario -- late` run against the shared dev DB: Ramon's patient API lists the visit, held until 8:24 PM. An unknown name prints "Pick a scenario: late".
- The doctor seed change typechecks; not rerun, so the owner's test in progress isn't reset.

## Heads-up
- `db:scenario` writes to whatever DATABASE_URL points at. Dev data only.
