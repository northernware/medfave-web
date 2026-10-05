# Patient API: place in the waiting room

Opened: 2026-10-05 13:25 PHT

## What
- `GET /patient/appointments`: a checked-in upcoming visit carries `queue: { ahead, doctorBusy }`. `ahead` counts the doctor's checked-in patients who arrived earlier, in the same arrival order as the doctor's queue. `doctorBusy` says whether someone is in consultation. Other visits get `queue: null`.

## Why
Plan mobile-next, step B: "2 ahead of you" on the checked-in card.

## Tested
- `tsc` (apart from the missing `@solar-icons/react` install) and eslint clean. Checked against the deployed API with check-ins: see the mobile PR.
