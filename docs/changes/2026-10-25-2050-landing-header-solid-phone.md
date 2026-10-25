# Landing page: solid header on phones, one bar with Safari's status bar

Opened: 2026-10-25 20:50 PHT

**What**
- On phones the header background is the solid canvas colour, the theme colour Safari paints its status bar with, so the status bar and the header read as one bar with no seam. Desktop keeps the frosted glass.

**Why**
On an iPhone there was a seam where the header met the status bar: Safari's solid theme colour against the see-through frosted header with the pink hero behind it. Chosen over removing the theme colour, which would change the browser bar on every page.

**Tested**
`tsc` passes. Needs a look on the iPhone in Safari.
