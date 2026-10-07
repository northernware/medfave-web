# Chart confirmations are our own dialog, not the browser's

Opened: 2026-10-07 19:57 PHT

## What
- Remove (allergy, alert), Resolve (condition) and Stop (medicine) open an in-app dialog in `ChartForm`: the question as title, the reason beneath, Cancel focused, the action named ("Mark resolved", "Stop", solid red "Remove"). Escape or a click outside cancels.
- Dialog backdrops dim with a dark tint in both themes; they washed the page out pink in dark mode.

## Why
Owner: browser `confirm()` boxes look out of place.

## Tested
Headless Chrome: Resolve on Arthritis opens the dialog with its text; Cancel closes it and the condition stays.
