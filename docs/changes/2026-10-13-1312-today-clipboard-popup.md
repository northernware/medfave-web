# Today at laptop width: the clipboard opens as a panel

Opened: 2026-10-13 13:12 PHT

## What
- At 1280–1439px (where the schedule panel is beside the page too), the visits list takes the full width. Clicking a visit opens the patient's clipboard in a panel from the right (`app/(app)/dashboard/clipboard-popup.tsx`). Esc, Close or the backdrop closes it. At 1440px and up, and below 1280px, the clipboard stays beside the list as before.
- At those widths each card shows a red "2 allergies" tag, so allergies are visible without opening anything.
- `SidePanel` takes an optional `onClose` for panels that aren't routes.

## Why
Design pass: at 1280px the list was squeezed between the clipboard and the schedule panel, cutting names to "Co…".

## Tested
`tsc`, eslint. Screenshots at 1280px: full names, allergy tags, the panel opens on clicking Ramon and Esc closes it. At 1440px: no panel, the clipboard beside the list as before.
