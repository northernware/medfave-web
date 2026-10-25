# Landing page: no sideways overflow on phones

Opened: 2026-10-25 17:24 PHT

**What**
- The page clips sideways overflow (`overflow-x-clip` on its root). The dotted grid behind the product story reached 24px past each side, making the page 398px wide on a 390px phone, so the panels sat off-centre.

**Why**
A screenshot from an iPhone showed the plum panel with a bigger gap on the right than the left.

**Tested**
At 390px the page's scroll width is now 390 (was 398).
