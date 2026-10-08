# Patient showcase: Ramon's family comes back

Opened: 2026-10-08 21:22 PHT

## What
`db:seed-patient-showcase` now gives Ramon (patient@medfave.com) his family: he looks after his children's charts (Joaquin, Lia, Sofia) and his mother's (Corazon), each with its entry on his family list, as a clinic-made care link would. Whoever is missing is skipped (Lia comes from `db:seed-doctor-showcase`, so run this after it). Its rows have `seedId(MARK.patient, …)` ids and are replaced on every run.

Run on the dev database: `GET /family` as Ramon lists Joaquin, Sofia, Lia (CHILD) and Corazon (PARENT), each linked.

## Why
Owner: Ramon's "My family" in the app was empty. Those links were made by hand on the old dev database; the move on October 6 (#157) rebuilt the new one from the seed scripts, which never made them.

## Tested
`tsc`. The seed run on the dev database, then `GET /family` with Ramon's token.

## Heads-up
Rerunning the patient showcase also refreshes Ramon's demo visits and requests (as it always has).
