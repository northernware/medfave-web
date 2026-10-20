# API: the clinic's households, listed

Opened: 2026-10-20 15:03 PHT

## What
- `GET /api/v1/doctor/households?q=`: the clinic's households by name, each with its members' first names (eldest first). `q` matches the household or a member's name, as the web's Households list. Archived left out; at most 100.
- Documented in `docs/api.md`.

## Why
The doctor app gets a Households view on Patients, so households can be found without opening a patient first.

## Tested
`tsc` and `eslint` pass. Ran the same query against the dev database: "dela" finds the Dela Cruz household with its six members in order.

## Not done / next
- Archived households aren't offered in the app.
