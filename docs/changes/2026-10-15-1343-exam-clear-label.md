# Exam: "Not examined" button renamed "Clear"

Opened: 2026-10-15 13:43 PHT

## What
Once a system (or a HEENT/neurologic part) is examined, the button beside it that takes the finding back out is labelled "Clear" (with "not examined" in its tooltip / accessibility hint), not "Not examined".

## Why
Reported in testing: after clicking Normal, the row "says not examined". The finding was recorded and saved correctly; the undo button's label read like the row's status.

## Tested
`tsc`, eslint. Web: on a new note, Normal on Abdomen shows "Abdomen · Normal", the finding, and "Clear"; the form's exam value holds the Abdomen line.
