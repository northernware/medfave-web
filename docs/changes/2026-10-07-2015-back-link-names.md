# Back link: real names, and going up counts as going back

Opened: 2026-10-07 20:15 PHT

## What
- The back link named the previous page from the tab's title, read just after it loaded. After an in-app navigation that title can still be the page before's, so a patient page could offer "‹ Visit note". Now a page is named from what we know: a section's name, a record's name from `CrumbName` (saved in the trail, so it survives a full page load), then its kind ("Patient"). The tab title is used only for forms.
- Going up to the page above the one you left (a note → its patient, via the clipboard name) counts as going back: from Today → note → Corazon, her page offers "‹ Today", not "‹ Visit note". Each trail entry remembers its page above (`up`).

## Why
Owner: on Corazon's page the back link said "Visit note".

## Tested
`tsc`, eslint. Headless Chrome: patient → panel → full page ("‹ Corazon Dela Cruz") → back ("‹ Patients"); Today → note ("‹ Today") → clipboard name → Corazon ("‹ Today").
