# Week API: each day's visits, for the calendar's Details and List

Opened: 2026-10-19 13:14 PHT

## What
`GET /api/v1/doctor/week` takes `names=1`: each day also has `visits: [{ time, name, status }]`, in time order. It combines with `count=any`.

## Why
The app's month calendar is getting Apple Calendar's view styles. Details shows the visits' names in each day, and List shows the chosen day's.

## Tested
`tsc` and `eslint` pass. On the local dev server, Oct 18–19 return their visits with names, times and statuses.
