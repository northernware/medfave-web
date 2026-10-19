# Visits API: Past is only visits that are over

Opened: 2026-10-19 11:28 PHT

## What
`GET /api/v1/doctor/appointments`:
- `view=past` lists visits due before now **and** over: completed, missed or cancelled.
- `view=upcoming` lists what's ahead, plus anyone checked in or in consultation, whatever their booked time. They come first, being the earliest.

Pending or confirmed visits whose time has passed (Today's "Left open") are in neither list, as before.

## Why
Owner's screenshot: Past listed "Waiting 10 h" and "In consultation" visits, because their booked time had passed.

## Tested
`tsc` and `eslint` pass. On the local dev server:
- Upcoming returns 14 visits (5 checked in, 2 in consultation, 5 confirmed, 2 pending).
- Past returns 26 visits (14 no-show, 11 completed, 1 cancelled).
- Needs a note still returns 2.

## Heads-up
Upcoming's later pages (`after=`) are by time only. With more than 50 under way at once, some could fall between pages.
