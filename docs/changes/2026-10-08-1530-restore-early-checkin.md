# Early check-in restored

Opened: 2026-10-08 15:30 PHT

## What
- #203 limited Check in and Start to the visit's day. That undid a deliberate feature (#102, #130): someone who turns up early, with the slot free, is checked in and seen then. Check in and Start are offered on any day again.
- #203 had also dropped the rule that a no-show is checked in late only on its own day; restored.
- What stays from #203: No-show is offered only once the visit's time has passed.
- "Cancel visit" now sits at the right end of the row as intended.

## Why
Owner: early check-in on any day is intended.

## Tested
`npm test` (21; the moves test now expects early check-in). Headless Chrome: tomorrow's visit offers Check in, Reschedule, and Cancel visit at the right.

## Heads-up
The API's `nextStatuses` offers CHECKED_IN on any day again, as before #203.
