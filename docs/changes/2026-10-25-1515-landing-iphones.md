# Landing page: 3D iPhones, 16:9 hero

Opened: 2026-10-25 15:15 PHT

**What**
- `components/landing/iphone.tsx`: an iPhone mockup in CSS 3D (titanium edge with depth, Dynamic Island, side buttons, glass glare). It tilts toward the mouse pointer, and turns into place as it scrolls into view (a scroll-driven animation in `globals.css`, no script). With reduced motion it stays still.
- Used for the three phones in the apps section and for the phone screens in the product story on phones.
- Hero film back to 16:9 on every screen size (#261 had cropped it to 4:5 on phones).

**Why**
The phones looked flat and not like iPhones; the hero looked better in landscape.

**Tested**
`tsc` and `eslint` pass. Checked at 390×844 and 1440×900. Not checked on a real device or in Safari. Safari doesn't run scroll-driven animations yet; the phones simply sit at their resting angle there.

**Not done / next**
- No three.js. CSS 3D gives the phones depth without adding a library. A three.js moment, if wanted, fits the closing section.
