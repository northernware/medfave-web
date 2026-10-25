# Landing page: whole symbols in the patterns

Opened: 2026-10-25 18:34 PHT

**What**
- `public/landing/pattern-*.svg`: the symbol at the right edge of the second row ran past the 180px tile and was cut off (most visibly the plus). It's now drawn on both edges, so it joins up whole across the seam.
- The tonal tile (on fuchsia) sets its transparency on the whole group, so strokes no longer look brighter where they cross.

**Why**
"Why are some of the symbols in the patterns cut off, like the +?"

**Tested**
All three tiles rendered repeated 3 × 3: every symbol is whole across the seams.
