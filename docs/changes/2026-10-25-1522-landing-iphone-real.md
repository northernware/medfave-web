# Landing page: iPhones to real proportions

Opened: 2026-10-25 15:22 PHT

**What**
- `components/landing/iphone.tsx` rebuilt to iPhone 16 Pro measurements (71.5 × 149.6 × 8.25 mm, ~9.5 mm corners, thin bezel), sized in container units so it scales with its width:
  - a shaded titanium band at the real thickness;
  - the back glass;
  - side faces with the buttons where they are on the phone: Action button and volume up/down on the left, the side button and Camera Control on the right.
- The screen is a plain `<img>` of the already-sized WebP. `next/image` never loaded one of the three phones inside the 3D transform.

**Why**
The corners, thickness and buttons didn't look like an iPhone.

**Tested**
`tsc` and `eslint` pass. The apps section checked at 1440×900: all three screens load, and the side button and Camera Control show on the turned phone. Not checked on a real device or in Safari.
