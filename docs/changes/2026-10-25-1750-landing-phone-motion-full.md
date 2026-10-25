# Landing page: the full motion on phones, built cheaper

Opened: 2026-10-25 17:50 PHT

**What**
The effects from the desktop version are back on phones, each in a form a phone's GPU handles:
- **3D phones turning in:** CSS iPhones with `lite` (6 edge slices instead of 18) in the story and in the apps section on touch. They turn into place with the scroll and float. The three.js scene stays desktop-only (it crashed iOS Safari).
- **Scroll-linked rise:** where scroll timelines are missing (iOS Safari), `CursorLight` drives the rise and the phone turn from the scroll position, once per frame, transform and opacity only. The vaccine chips still tick over once as they appear.
- **Drifting patterns:** the pattern tile moves as one layer (`.landing-pattern-move`, a transform loop of one tile) instead of animating `background-position`, which repainted. The masks stay on a wrapper. Same on desktop.
- **Grain:** on phones a still texture that scrolls with the page (absolute, normal blend, low opacity), not a fixed full-screen blend layer.
- **Light:** phones have no cursor, so the plum band gets a slow drifting light.

**Why**
"I like the animations before": the phone fixes had taken them away.

**Tested**
`tsc` and `eslint` pass. Chrome at 390px acting like Safari (scroll timelines off): the phones' turn follows the scroll (15° part way in, 0° in view) and the sections rise. **Not checked on a real iPhone for smoothness.**
