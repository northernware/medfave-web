# Landing page: smoother scrolling on phones

Opened: 2026-10-25 17:28 PHT

**What**
Below the large breakpoint:
- The sticky header is solid (95%), not frosted. A backdrop blur re-blurs the page under it on every scrolled frame.
- The hero and phone glows are soft gradients without a CSS blur filter (blur from `lg` up only).
- The story phones lose their `drop-shadow` filter.
- The story's scroll tracker doesn't run (it only drives the desktop pinned window).

Everywhere:
- The hero loop pauses when it's off screen.
- The film button has no backdrop blur.

**Why**
Scrolling the page lagged on a phone.

**Tested**
`tsc` and `eslint` pass. **Not measured on a real iPhone**; these are the known scroll-time costs on iOS Safari.
