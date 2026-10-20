# API: a household for the app

Opened: 2026-10-20 14:50 PHT

## What
- `GET /api/v1/doctor/households/:id`: the household's name, address and number, and its members (eldest first) with relationship to the head, age, sex, whether adult, and who the household's primary contact is. Archived members left out.
- Documented in `docs/api.md`.

## Why
The doctor app's new Household sheet (opened from a patient): who lives with them, at a glance.

## Tested
`tsc` and `eslint` pass. Not called against a database yet; checked once deployed via the app.

## Not done / next
- Registering a new patient into an existing household (`/doctor/patients` POST taking a household) is step 2.
