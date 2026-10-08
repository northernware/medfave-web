# Today's "Last visit details" is the patient clipboard

Opened: 2026-10-08 15:37 PHT

## What
- The panel beside Upcoming visits is now `PatientClipboard`, as on the patient and note pages: name (linking to the chart) · sex · age, patient number and blood type on top; allergies and medical alerts on the sheet (read-only boxes, colour rule), then the last visit with this doctor (complaint, diagnoses, prescription, follow-up, advice, who saw them) and Open the note.
- `loadLastVisit` loads the allergies in full, the alerts, blood type and allergy status.
- `PatientClipboard`'s sheet fills the card's height when the card is stretched (a grid cell).

## Why
Owner: the panel should look like the patient clipboard.

## Tested
`tsc`, eslint. Headless Chrome at 1600px: Today with Elena selected. Not checked: a patient with no notes, phone width.
