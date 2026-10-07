# Buttons show the hand cursor

Opened: 2026-10-07 14:49 PHT

## What
`app/globals.css` sets `cursor: pointer` on buttons, `role="button"`, `summary`, selects, checkboxes and radios, unless disabled.

## Why
Tailwind 4 dropped it, so every button showed the arrow (noticed on the schedule cards' Check in).

## Tested
Headless Chrome: Check in on a schedule card computes `cursor: pointer`.
