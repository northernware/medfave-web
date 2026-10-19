# Week API: the calendar's whole range in one call

Opened: 2026-10-19 16:32 PHT

## What
`GET /api/v1/doctor/week` allows up to 800 days with `names=1` (31 otherwise), so the app's calendar asks once for its whole two-year range.

## Why
The calendar asked once per visible month, and again on every style switch: about 150 `/doctor/week` calls in 30 minutes. That likely helped exhaust the database plan's query allowance (production is failing with Prisma `planLimitReached`).

## Tested
`tsc` and `eslint` pass. Not run against a database: production's is restricted right now.

## Heads-up
Production is down on Prisma `planLimitReached`. Check which Prisma workspace production's database URL points at.
