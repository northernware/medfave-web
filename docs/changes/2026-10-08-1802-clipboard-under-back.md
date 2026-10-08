# The clipboard starts under the back link again

Opened: 2026-10-08 18:02 PHT

## What
`CLIPBOARD_COLUMN` no longer lifts the clipboard over the back link (#212). It starts level with the page title on every page, then sticks at the top while scrolling, as #212 made it. Radius and sticking are unchanged.

## Why
Owner: top-aligning only reads right for a panel pinned to the window's edge (the schedule panel). The clipboard is the page's, and on centred pages (notes) or very wide screens it isn't at the edge, so it would be inconsistent.

## Tested
Headless Chrome at 1600×900: patient, visit and new note pages, clipboard top 47px, then 12px after scrolling.
