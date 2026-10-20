# API: delete a draft note

Opened: 2026-10-20 16:55 PHT

## What
- `DELETE /api/v1/doctor/records/:id`: throws away a draft note, as a mail draft. This doctor's own, status DRAFT and never finalized; prescriptions and diagnoses cascade, documents drawn from it are unlinked (SetNull). Signed notes get `409` (archive them instead).
- Documented in `docs/api.md`.

## Why
The owner asked to delete their draft for Corazon Dela Cruz and for a Gmail-like way to discard drafts in the app.

## Tested
- `tsc` and `eslint` pass.
- Locally against the dev DB as doctor@: deleting a signed note → 409; deleting Corazon Dela Cruz's draft ("Ubo ubo", Oct 20) → 204, her chart now lists only her two signed notes. **That draft is gone from the dev DB**, as asked.

## Not done / next
- The web has no "Delete draft" button yet.
