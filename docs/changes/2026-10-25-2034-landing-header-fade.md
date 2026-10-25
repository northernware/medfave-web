# Landing page: header fades into the page on phones

Opened: 2026-10-25 20:34 PHT

**What**
- On phones the header's frosted layer reaches 20px below the header and fades out over its last 28px (a mask on `.landing-header-glass`). It no longer ends in a hard edge against the lighter hero. Desktop keeps the straight edge and divider.

**Why**
After #286 an iPhone still showed a seam: the frosted panel's own bottom edge, darker than the glowing hero behind it.

**Tested**
`tsc` passes; checked at 390px in dark mode. Needs a look on the iPhone in Safari.
