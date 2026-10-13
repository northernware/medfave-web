# Today's clipboard panel: no default highlight, titled "Clipboard"

Opened: 2026-10-13 13:18 PHT

## What
- At 1280–1439px, the first patient isn't lit pink until you click one; its initials, "+1" and allergy tag keep their colours (CSS in `app/globals.css`, `data-default-pick`). Other widths unchanged: the clipboard is beside the list there, so the first patient stays lit.
- The panel's title is "Clipboard", not the patient's name, which the clipboard already shows.

## Why
Follow-up to #223: a lit card with no panel open looked selected for no reason, and the name showed twice.

## Tested
`tsc`, eslint. Screenshots at 1280px (no highlight, tags in colour; the panel opens titled Clipboard, Esc closes it) and 1440px (Ramon lit with the clipboard beside, as before).
