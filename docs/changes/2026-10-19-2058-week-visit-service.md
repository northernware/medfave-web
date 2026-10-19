# Week API: each visit's service

Opened: 2026-10-19 20:58 PHT

## What
With `names=1`, each visit also has `service`, its label ("Follow-up Checkup").

## Why
The app's calendar day view is moving to one ranged request for its pages, and its visit blocks show the service.

## Tested
`tsc` and `eslint` pass. Checked on medfave.vercel.app after deploy.
