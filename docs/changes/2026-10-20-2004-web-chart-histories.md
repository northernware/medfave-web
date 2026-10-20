# Web chart: the history

Opened: 2026-10-20 20:04 PHT

## What
- The patient page's chart shows a history block under the conditions: past medical history, family history, personal and social, OB history (women), birth and development and immunizations (children). Past, family and immunization lines can be removed if recorded by mistake; the rest is edited in the app's clipboard for now.
- With nothing recorded it says so, pointing to the app.

## Why
The histories (#255–#257) were only visible in the app.

## Tested
`tsc` and `eslint` pass. **Not rendered:** the page needs a web sign-in, which I couldn't do from here. Check a patient with some history (and a child) on the web.

## Not done / next
- Adding and editing these on the web.
