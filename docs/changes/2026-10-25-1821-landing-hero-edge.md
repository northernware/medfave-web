# Landing page: no cut line under the hero

Opened: 2026-10-25 18:21 PHT

**What**
- The hero clips only sideways (`overflow-x-clip`, was `overflow-hidden`), so its glows fade out past its bottom edge under the next section instead of stopping in a straight line.

**Why**
There was a line below the film that made the section look cut off.

**Tested**
`tsc` passes; checked at 390×844 and 1440×900. The page still doesn't scroll sideways (the root clips it too).
