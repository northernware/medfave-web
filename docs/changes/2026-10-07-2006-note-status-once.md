# A note's page says its status once

Opened: 2026-10-07 20:06 PHT

## What
Under the title the note page said the date three times over: the visit date, "Signed September 30, 2026… by…", then a "Signed" badge. Now: the header gives the visit date and age; one row holds the status badge (and the note's kind), followed by when and by whom it was signed. A draft keeps its warning box below.

## Why
Owner: the same information stacked three times.

## Tested
`tsc`. Headless Chrome: Corazon's July note (seeded without a signing time, so the row shows the badge alone). A note with a signing time not looked at.
