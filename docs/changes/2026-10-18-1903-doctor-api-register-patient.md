# Doctor API: register a patient and issue an activation code

Opened: 2026-10-18 19:03 PHT

## What
- `POST /api/v1/doctor/patients`: registers a patient, by the same rules as the web's Add patient. Without `householdId`, they start a new household named after their last name, as its head. Possible duplicates come back as a **409** with `duplicates` and `confirmToken`; send that token back as `confirmDuplicate` to register anyway. Field errors are a 422. Returns 201 `{ patient: { id, fullName, patientNumber } }`.
- `POST /api/v1/doctor/patients/[id]/activation`: issues an activation code, as the desk's "Issue code" does. Returns the long code, the 6-digit `pin`, the `link`, the QR as `qrSvg` and the `mail` outcome. Optional `for: "caregiver"` and `caregiverName`. Returns 404 for another clinic's chart, or for a chart that already has a login.
- Refactor, with no behaviour change: `createPatient`'s core and the patient form helpers moved to `lib/patient-registration.ts` (`registerPatient`), and `issuePatientActivation`'s core moved to `lib/activation.ts` (`issueActivation`). The web actions call them.

## Why
So doctors can add patients, and give them their app code, from the mobile app, as they can from the web's desk tab. The mobile PR follows.

## Tested
- `tsc`, `eslint` and `vitest` (29) pass.
- Against the local dev server on the dev DB, as doctor@medfave.com:
  - bad input gets a 422 with field errors;
  - registering gets a 201 (MK-2026-000014);
  - the same person again gets a 409 with the match and a token;
  - issuing a code gets a 201 with the code, PIN, link and QR;
  - an unknown id gets a 404.
- The web Add patient and Issue code forms weren't clicked through after the refactor.

## Heads-up
- Test data on the dev DB: the patient "Test Walkin-Claude" (MK-2026-000014, household "Walkin-Claude") and one live activation code for them.
