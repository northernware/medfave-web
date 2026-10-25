# Landing page: spacing on phones

Opened: 2026-10-25 17:18 PHT

**What**
- Section padding on phones 56px (was 80px); the hero, section titles and grids open tighter too. Tablet and desktop unchanged.
- Panels keep one left edge with the rest of the page on phones: panel 8px plus content 8px, matching the page's 16px (`inPanel`).
- Cards: 20px padding on phones (28px from `sm` up).
- The "trail of paper" cards are a compact 2 × 2 grid on phones instead of four tall cards.
- ICD-11 demo rows fit on one line on phones (smaller code column and type).
- The story steps are spaced evenly on phones.

**Why**
On a phone the spacing looked off: big gaps, left edges that jumped between panels and plain sections, and squeezed cards.

**Tested**
`tsc` and `eslint` pass. Checked at 390×844 down the page; desktop spot-checked. Not checked on a real device.
