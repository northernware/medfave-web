# Note pages: the header heads the left column; the back link lines up

Opened: 2026-10-07 20:09 PHT

## What
- `NoteLayout` takes a `header`: on wide screens it heads the left column and the clipboard spans both rows beside it, starting level with the title (not below the Amend button). Narrow: header, clipboard, form. Used on the new, edit and read note pages.
- The back link centres over a note being read too (`/records/[id]` added to `columnFor`), not only new and edit.

## Why
Owner: on the note page the clipboard sat below the button, and the back link didn't line up with the content.

## Tested
`tsc`, eslint. Headless Chrome at 1600px: Corazon's July note and a new note for her. Narrow screens not checked.
