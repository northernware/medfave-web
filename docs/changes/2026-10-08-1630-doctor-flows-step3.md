# Doctor flows, step 3: follow-ups

Opened: 2026-10-08 16:30 PHT

## What
From medfave-design `plans/doctor-flows.md`, step 3:
- **Book the follow-up on signing.** Finishing a note lands on it with `?signed=1`; if the note asks for a follow-up that isn't booked yet, a banner under the title says so ("Signed. You asked to see them again on …") with **Book the follow-up**: patient, Follow-up Checkup, the date and the note's link filled in. The existing Book follow-up in the note's Follow-up row stays.
- **Book again** on a finished, missed or cancelled visit: the booking form opens with the patient, the same service, and "Follows on from" set to that visit (new `after` parameter on `/appointments/new`).

## Why
Owner agreed the doctor-flows plan: the follow-up was only offered later, as "1 follow-up due" on Today.

## Tested
`tsc`, eslint. Headless Chrome: Joaquin's note opened with `?signed=1` shows the banner and its link; a completed visit's Book again opens the form with patient, service and Follows on from set. Not checked: actually signing a note end to end, the desk's pages (unchanged).
