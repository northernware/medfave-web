# The patient page's right column starts with an ID card

The column used to open with a two-column grid of every detail, dashes for anything empty. It now starts with a card that says who this is at a glance, styled like a clipboard:

- **Top:** the patient number, then born (with age), sex and blood type in large type.
- **Sheet:** contact, email, primary and secondary contact. Its top edge rises to a clip in the middle, with a small bar on it. Empty fields are left out.
- **Order of the column:** the card, allergies, medical alerts, medicines and conditions, then "Start their own household" (moved down: it's rarely needed), then who opened the chart. "Visits recorded" is gone: the visit history header already counts them.

Our own colours (`surface-muted` top, `surface` sheet); no QR code yet. That waits for the desk being able to scan a patient in.

Code: `components/patient-clipboard.tsx`.

## Follow-up: the clinical summary is the clipboard's sheet

The sheet now holds what to know before treating: allergies, medical alerts, current and past medicines, ongoing and past conditions, and the conditions' notes (one card instead of three). The contacts moved up into the top half, under born, sex and blood type, two to a row. `PatientClipboard` takes the sheet as `children`.
