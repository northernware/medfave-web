# Doctor flows, step 2: Start on the visit page opens the note

Opened: 2026-10-08 15:47 PHT

## What
The visit page's "Start consultation" used the plain status change, which only reloaded the page. It now uses `startConsultation`, as Today's Start already did: the visit moves to in consultation and the doctor lands in its note (the existing draft if there is one, else a new note linked to the visit). `VisitMoves` takes an optional `start` action for this; the desk's page doesn't pass one.

## Why
Item 9 of medfave-design `plans/doctor-flows.md`: save the extra click when the patient sits down.

## Tested
`tsc`, eslint. Not clicked in the browser: starting would have moved a seeded visit to now. The action is the one Today's Start has used since #81.
