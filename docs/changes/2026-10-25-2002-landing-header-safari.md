# Landing page: frosted strip under the iPhone status bar

Opened: 2026-10-25 20:02 PHT

**What**
- The header's frosted glass is its own layer, reaching 112px above the header (`-top-28`). iOS Safari shows the page under the status bar, above the sticky header, so text was scrolling there unfrosted. Off screen on other browsers.
- The blur is on that layer, not the header, so it isn't nested inside another backdrop filter.

**Why**
On Safari on an iPhone the page was visible and sharp above the header, behind the time and battery.

**Tested**
`tsc` and `eslint` pass; the header is unchanged in Chrome at 390px. **Needs a check on an iPhone in Safari**: the status-bar area can't be reproduced here.
