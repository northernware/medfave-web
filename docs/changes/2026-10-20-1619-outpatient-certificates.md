# Outpatient medical certificates, and a documents API for the app

Opened: 2026-10-20 16:19 PHT

## What
- New document type `OUTPATIENT_CERTIFICATE`, labelled **Medical certificate**: seen on, diagnosis, advised rest from/to, fit to return on, remarks. Listed first; the web's New document defaults to it. Its printed wording: "seen and examined by me on …".
- The old `MEDICAL_CERTIFICATE` is relabelled **Certificate of confinement** (inpatient). Value unchanged; no data moved.
- Migration `20261020T0811_outpatient_certificate`: one additive enum value. **Applied to the shared dev DB** (`db:migrate --advance-ref db`), `db:verify` passes.
- Doctor API: `/doctor/documents` list and create (draft), `/prefill?appointmentId=`, `/:id` get / patch / delete (drafts only), `/:id/sign`, `/:id/share`. A draft is `REQUESTED`; signing makes it `READY`. `checkDetails` (lib/documents.ts) validates JSON details against the type's fields.
- Documented in `docs/api.md`.

## Why
Clinics write outpatient certificates daily (sick leave, fit to work), and the web only had the inpatient one. The doctor app issues them from a visit: draft → sign → share or print. Agreed with the owner: anyone at the clinic may start a draft later; only the doctor signs.

## Tested
- `tsc` and `eslint` pass.
- Against the dev DB on a local server, as doctor@: prefill from a visit; create a draft; sign refused while the diagnosis is empty (422 naming it); share refused before signing (409); edit; sign (READY, signedAt set); edit after signing refused (409); share; list; delete a signed one refused (409); delete a draft (204).
- One test certificate (Ramon S. Dela Cruz, signed, **unshared**) stays in the dev DB: signed documents can't be deleted by design.

## Not done / next
- The desk (secretaries) can't start drafts through the API yet: `apiDoctor` only.
- Patients asking for a document from their app.
- The web's records desk shows the new type but its flow is still request → ready → released.

## Heads-up
- Migration applied to the shared dev DB. Pull and `npm run db:verify`.
