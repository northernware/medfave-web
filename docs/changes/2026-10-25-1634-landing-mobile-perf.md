# Landing page: light version on phones

Opened: 2026-10-25 16:34 PHT

**What**
On touch screens (`hover: none` / `pointer: coarse`, and narrower than 1024px for the grain and drift):
- No film grain: it was a full-screen fixed layer blending over everything on every frame.
- No cursor light (`.spot-card` borders, plum spotlight): fixed-attachment backgrounds, and they do nothing on touch.
- Glows and patterns hold still instead of drifting.
- The product story's phones use `IPhone flat`: the front only, no edge slices, side faces, 3D or scroll turn.
- The three.js phones render at 1.25× pixel ratio without antialiasing.
- The plum cards lose their backdrop blur.

Desktop with a mouse is unchanged.

**Why**
The page lagged and crashed on a phone after #267.

**Tested**
`tsc` and `eslint` pass. Chrome at 390×844, touch emulation, 4× CPU throttle: style and layout time while scrolling fell from 0.35 s to 0.10 s. **Not reproduced on a real iPhone**, so the crash fix is unconfirmed until someone opens it on one.
