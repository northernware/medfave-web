# Clipboard: conditions and medicines in outlined boxes

Opened: 2026-10-17 22:44 PHT

## What
On the patient clipboard, Ongoing conditions and Current medicines are outlined boxes, like Allergies and Medical alerts when none are recorded. Only allergies and alerts are ever coloured. Web: the note and visit pages' clipboard (`components/note-context.tsx`) and the patient page's (`app/(app)/patients/[id]/page.tsx`). App: `src/features/patient-clipboard.tsx`.

## Why
Owner's choice: with no container the two sections looked unfinished on the sheet.

## Tested
`tsc`, eslint. Screenshots, dark: web patient page and new-note page for Corazon; app patient screen.
