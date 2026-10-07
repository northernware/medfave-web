# The patient page's right column starts with an ID card

The column used to open with a two-column grid of every detail, dashes for anything empty. It now starts with a card that says who this is at a glance, styled like a clipboard:

- **Top:** the patient number, then born (with age), sex and blood type in large type.
- **Sheet:** contact, email, primary and secondary contact. Its top edge rises to a clip in the middle, with a small bar on it. Empty fields are left out.
- **Order of the column:** the card, allergies, medical alerts, medicines and conditions, then "Start their own household" (moved down: it's rarely needed), then who opened the chart. "Visits recorded" is gone: the visit history header already counts them.

Our own colours (`surface-muted` top, `surface` sheet); no QR code yet. That waits for the desk being able to scan a patient in.

Code: `components/patient-clipboard.tsx`.

## Follow-up: the clinical summary is the clipboard's sheet

The sheet now holds what to know before treating: allergies, medical alerts, current and past medicines, ongoing and past conditions, and the conditions' notes (one card instead of three). The contacts moved up into the top half, under born, sex and blood type, two to a row. `PatientClipboard` takes the sheet as `children`.

## Follow-up: the clipboard beside a visit note

The note's side column is the same clipboard, so a patient looks the same on both pages. Its top is slim (patient number, blood type, primary contact), since the note's header already names the patient, sex, age and household. The sheet holds allergies, alerts, ongoing conditions and current medicines, all still changeable in place. Reason for visit and Last visit sit below it; on a narrow screen those fold away ("Reason and last visit") while the clipboard stays open.

## Follow-up: the note's clipboard names the patient

Beside a note the clipboard stays in view while the header scrolls away, so it now starts with who it is: "Corazon Dela Cruz · Female · 74 years". A guard against writing on the wrong chart with several notes open. Not on the patient page, where the name is the title right beside it. `PatientClipboard` takes an optional `name`.

## Follow-up: the note header is just the title

With the patient named on the clipboard, the note header drops its patient line (name · sex · age · household); a draft or amend keeps its status line. The clipboard's name is now the link to the chart. The clipboard column scrolls without a visible scrollbar, like the schedule panel.

## Follow-up: the clipboard starts level with the name; a shorter access list

- The patient page's header (name, household line, Write note · Book · Request document · Edit) now heads the left column, so the clipboard starts level with the name instead of below the buttons.
- "Who opened this chart" shows the last three openings, one line each (who · when), with "Show all 12" expanding the rest in place. The line on who may open the chart stays.
