# Landing page: frosted header, solid status-bar strip

Opened: 2026-10-25 20:54 PHT

**What**
- The header is frosted glass again on every screen (undoes the phone-solid header from #289).
- Above it, the strip behind iOS Safari's status bar is solid canvas colour (the theme colour Safari paints that bar with). It's off screen elsewhere.

**Why**
Asked for a frosted header with just the status bar solid.

**Tested**
`tsc` and `eslint` pass; the header is frosted at 390px in dark mode. The status-bar strip only shows in iOS Safari: needs a look on the iPhone.
