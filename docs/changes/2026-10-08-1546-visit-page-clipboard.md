# Doctor flows, step 2: the visit page gets the clipboard; no empty rows

Opened: 2026-10-08 15:46 PHT

## What
From medfave-design `plans/doctor-flows.md`, step 2 items 7 and 8:
- The doctor's visit page (`/appointments/[id]`) shows the patient's clipboard on the right (`NoteContext`: name, number, blood type; allergies, alerts, conditions and medicines, changeable in place; last visit), instead of separate allergy and alert boxes. Clinic use and History stay below it.
- The header heads the left column, so the clipboard starts level with the name. The "Patient" row is gone (the clipboard names and links them).
- Room, Arrived, Seen, Follows on from and Later follow-ups show only when they have something.

## Why
Owner agreed the doctor-flows plan; the visit page was the last one in the old style.

## Tested
`tsc`, eslint. Headless Chrome at 1600px: Elena's visit tomorrow. Not checked: a visit in progress or finished (where the rows show), phone width, the desk's visit page (unchanged).

## Not done / next
Item 9 (Start leads into the note) in a separate PR.
