# Front desk: patient page gets a contacts clipboard; visit page drops empty rows

Opened: 2026-10-08 20:36 PHT

## What
- **Desk patient page:** the "Contact details" card (a long list with dashes, at the bottom of the right column) becomes `PatientClipboard` at the top of the column: patient number, born (with age) and sex on top; on the sheet only the contacts that are filled in (mobile, email, reminders, household address and number, primary and secondary contacts). Nothing clinical, as before: the desk's sheet is contacts only. The header heads the left column, so the clipboard starts level with the name.
- **Desk visit page:** Reason, Room, Arrived and Contact show only when they have something.

## Why
Owner: bring the desk's pages in line with the doctor's polish. The doctor's clinical clipboard isn't the desk's to have, so the desk gets the same card with contacts.

## Tested
`tsc`, eslint. Headless Chrome at 1600px: Corazon's desk page, Elena's desk visit for tomorrow. Not checked: phone width; a patient with a secondary contact.
