# Landing page: film shadow fits on phones

Opened: 2026-10-25 18:26 PHT

**What**
- On phones the hero film has a small shadow (12px down, 28px blur) and no pink glow under it, so both finish inside the 32px before the plum band. From `sm` up, the large shadow and glow are unchanged.

**Why**
On a phone the film's shadow still looked clipped where the plum band starts.

**Tested**
`tsc` passes; checked at 390×844.
