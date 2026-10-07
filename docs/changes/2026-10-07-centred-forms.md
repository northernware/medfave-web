# Forms are centred, like the clinic settings pages

The form pages (add or edit a patient, household, appointment or document) and the note pages (new note, draft, amend) now centre the whole page, title and all, in a readable column. Before, the card sat on the left under a full-width header.

- Forms: `mx-auto max-w-3xl` on the page wrapper (the card no longer sets its own width).
- Notes: `mx-auto max-w-[69rem]`, the width of the note and its side column.
