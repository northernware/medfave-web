# Landing page: motion back on phones

Opened: 2026-10-25 17:42 PHT

**What**
- Reveal on scroll where scroll-driven animations aren't supported (iOS Safari never ran them): `CursorLight` marks the page `data-reveal` and adds `.in` with an IntersectionObserver. Sections rise in, flat phones rise in, and the vaccine chips turn green one after another. Transform and opacity only.
- The hero glows drift again on phones (they're plain gradients now, so moving them is cheap). The pattern drift stays desktop-only, because it repaints.
- The flat iPhones float gently. The side phones use margin instead of `translate`, so the float doesn't override their offset.

**Why**
After the phone performance fixes, phones had no motion left.

**Tested**
`tsc` and `eslint` pass. Chrome at 390px with scroll timelines switched off to act like Safari: all 23 reveal elements and all 6 chips get `.in` while scrolling. Not checked on a real iPhone.
