# Landing page: calmer type, rounder 3D corners

Opened: 2026-10-25 15:42 PHT

**What**
- Type scale down a step:
  - hero headline 64 / 52 / 38px (was 84 / 64 / 44);
  - section titles 40 / 28px (was 52 / 36);
  - story titles 30 / 24px (was 40 / 32);
  - closing 48 / 32px;
  - body text 16–18px.
- three.js phones: a larger squircle corner (17 mm outer, softer exponent), so the corners read like an iPhone's instead of square.

**Why**
The fonts felt too large, and the 3D phones' corners still looked square.

**Tested**
`tsc` and `eslint` pass. Hero and apps section checked at 1440×900. Not checked on a real device.
