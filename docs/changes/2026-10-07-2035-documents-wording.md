# "Documents", and "New document" instead of "Request document"

Opened: 2026-10-07 20:35 PHT

## What
- Sidebar, list page, back link and landing page: "Records requests" → "Documents".
- Buttons on the patient page and the list: "Request document" / "Request a document" → "New document"; the form's title too, with the subtitle "Who asked and why, then prepared and handed over…".
- The "can't delete" reason says "document request" instead of "records request".

## Why
Owner: "Request document" read as the doctor asking for a document, when the doctor records someone else's request and produces it.

## Tested
`tsc`; grep finds no old wording left. Pages not looked at in the browser (text only).

## Not done / next
Open question for the doctor (in medfave-design `plans/mobile-next.md`): should the front desk record document requests, leaving the doctor to prepare and sign?
