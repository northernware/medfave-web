# Buttons show the hand cursor

Tailwind 4 no longer gives buttons `cursor: pointer`, so every button in the app showed the arrow (most visibly Check in and Start on the schedule cards, inside a card that shows the hand). `app/globals.css` now sets the pointer on buttons, `role="button"`, `summary`, selects, checkboxes and radios, unless they're disabled.
