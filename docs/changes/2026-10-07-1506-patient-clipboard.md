# The patient clipboard, on the patient page and beside notes

Opened: 2026-10-07 15:06 PHT · Updated: 2026-10-07 19:48 PHT

## What
- **Patient page:** the right column is a clipboard (`components/patient-clipboard.tsx`). Top: patient number, born (with age), sex, blood type, then contact and primary/secondary contact (empty fields left out). Below it a sheet, its edge rising to a clip in the middle: allergies, alerts, medicines, conditions and their notes.
- The page header (name, buttons) heads the left column, so the clipboard starts level with the name.
- "Who opened this chart": last three, one line each, "Show all 12" for the rest.
- "Start their own household" is a quiet button beside "Archive this chart", opening a dialog (`components/action-dialog.tsx`); same on the desk's chart.
- **Beside a note:** the same clipboard with a slim top (name · sex · age linking to the chart, number, blood type, primary contact); the sheet stays changeable in place. Reason and last visit below it. The note header is just the title now. The column scrolls without a visible scrollbar.

## Why
Owner: a doctor's-clipboard style for the patient's details, one look on both pages, and fewer repeated or out-of-place pieces.

## Tested
Headless Chrome, dark and light: patient page top and bottom, new note for Corazon. Not checked: narrow screens, the desk's chart, the household dialog opened.
