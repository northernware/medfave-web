# Landing page: frosted header on phones again

Opened: 2026-10-25 18:52 PHT

**What**
- The sticky header is frosted glass on every screen (70% canvas, `backdrop-blur-xl`, slight saturation), like Safari's own bars. #273 had made it solid on phones while chasing scroll lag; the heavy effects that caused the lag are gone since.

**Why**
On an iPhone in dark mode, the solid header read as a heavy dark slab over the plum section.

**Tested**
`tsc` passes. **Scroll smoothness not checked on a real iPhone**: if it lags again, this is the first thing to revisit.
