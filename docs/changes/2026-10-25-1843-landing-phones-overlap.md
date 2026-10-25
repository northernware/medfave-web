# Landing page: phones hang over the closing band

Opened: 2026-10-25 18:43 PHT

**What**
- Apps section: the three phones sit at the bottom of the section and hang about half over the fuchsia closing band. The apps section is no longer clipped and sits above the closing (`z-10`). The closing makes room with more top padding (46vw / 40vw / 16vw by breakpoint).
- Shadows: the blurred floor shadow under the phones is gone. The CSS iPhones lose their blurred shadow layer and get a short, soft shadow on the frame instead. The three.js phones have none.

**Why**
The phones' shadows didn't look good, and the phones were asked to overlap the coloured band below.

**Tested**
`tsc` and `eslint` pass. Checked at 1440×900 (three.js phones) and 390×844 (CSS phones).
