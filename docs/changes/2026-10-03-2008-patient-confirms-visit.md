# Patients confirm a visit: "I'll be there"

Opened: 2026-10-03 20:08 PHT

## What
- `Appointment.patientConfirmedAt` (migration `20261003T2001_patient_confirmed_at`): when the patient said "I'll be there". Separate from the `CONFIRMED` status, which is the clinic accepting the booking.
- `POST /api/v1/patient/appointments/:id/confirm`, open from the start of the clinic day before the visit until its time (`lib/patient-visits.ts`: `confirmWindow`, `canConfirm`, `confirmByPatient`). Sending it again keeps the first time.
- `GET /patient/appointments`: upcoming visits carry `confirmedAt` and `canConfirm`. The doctor's appointment shape carries `patientConfirmedAt`.
- Web: "Coming" next to the patient on the desk's *Coming today* list and on the schedule rail (desk and doctor dashboard).
- A staff reschedule to a new time clears it. An accepted move makes a new visit, so it starts empty.
- Patient showcase seed: a confirmed visit tomorrow (`showcase-tomorrow-visit`), to show the buttons.

## Why
Plan *mobile-next*, step A: confirming a visit without push, to cut no-shows. The push action buttons can call the same endpoint later.

## Tested
- `tsc` (apart from the missing `@solar-icons/react`, which is in `package.json` but not installed here) and eslint on the changed files.
- Against the dev server: `409` outside the window, `404` for another visit, `200` inside it and again on repeat; `canConfirm` flips to false; `/doctor/day` shows `patientConfirmedAt`.
- **Not seen:** the "Coming" mark on the web pages (no screenshot taken); the reschedule clearing it.

## Not done / next
- The app's buttons (medfave-mobile, separate PR).
- `db:seed-patient-showcase` failed twice with a duplicate `showcase-doc-certificate` before succeeding; that delete-then-create looks racy.

## Heads-up
- Migration applied to the shared dev database; `migrations/app/refs/db.json` moved to `bb5b4857…`.
