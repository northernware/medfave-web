# Side column: an empty Medical alerts box like its neighbours

Opened: 2026-10-06 21:37 PHT

## What
- With no alerts, the side column shows a plain **Medical alerts** box (title, "None", + Add medical alert), styled like Ongoing conditions and Current medicines, instead of a lone add link. With alerts it stays the solid amber box.

## Why
Owner: the empty alerts box didn't match the others.

## Tested
- `tsc`, eslint. Headless Chrome on Paula's new note (no alerts) and Corazon's draft (two alerts).
