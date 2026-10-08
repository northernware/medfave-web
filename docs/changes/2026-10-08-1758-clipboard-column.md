# The clipboard: our corner radius, top-aligned, sticks while scrolling

Opened: 2026-10-08 17:58 PHT

## What
- **Radius:** `PatientClipboard` (and its skeleton) used `rounded-2xl`, a fixed 16px outside our radius scale; it now uses `rounded-xl` like every card (20px, or the 44px squircle where supported).
- **One rule for the column it sits in** (`CLIPBOARD_COLUMN` in `components/patient-clipboard.tsx`), used on the patient page, the visit page and the note pages: on wide screens its top is level with the sidebar and schedule panel (lifted over the back link's line), it sticks at the top while the page scrolls, and scrolls within itself (no visible bar) when taller than the window. The patient and visit pages didn't stick before.
- **Patient page:** "Start their own household" and "Archive this chart" moved inside the left column; below both columns they let the page scroll past the clipboard's column and pushed it up.

## Why
Owner: the clipboard's corners didn't match, it sat below the back link, and it didn't stick on some pages.

## Tested
`tsc`, eslint. Headless Chrome at 1600×900, the clipboard's top measured before and after scrolling: patient page 12px → 12px (scrolled 105px), visit 12px, new note 12px → 12px (scrolled 700px); radius 44px. Not checked: phone width (unchanged there).

## Heads-up
The column's lift (`lg:-mt-[35px]`) assumes the back link line above the page, which these pages always have.
