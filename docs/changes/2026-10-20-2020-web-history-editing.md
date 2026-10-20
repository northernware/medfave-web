# Web chart: add and edit the history

Opened: 2026-10-20 20:20 PHT

## What
- The patient chart's history block shows every section (with "Not recorded" when empty) and its form, as the app's clipboard: **Add** for past medical history, family history and vaccine doses; **Edit** (filled with what's there) for personal and social, OB history (women) and birth and development (children). Dates use the browser's date input.
- Forms in `components/history-forms.tsx`, posting the existing chart actions through `ChartForm`.

## Why
The owner asked to fill in the history on the web too, not only in the app.

## Tested
`tsc` and `eslint` pass. **Not rendered:** the page needs a web sign-in, which I couldn't do from here. The chart actions behind the forms were tested through the API (#255–#257).

## Not done / next
- Recording a dose straight from a schedule row (the app has it; the web lists only doses given).
