# Landing page: full-width bands on phones

Opened: 2026-10-25 17:33 PHT

**What**
- On phones the coloured sections (paper trail, for doctors, apps, closing) are full-width bands with the page's 16px side padding, not inset rounded panels. From `sm` up they stay inset panels with 44px corners.

**Why**
On a phone the inset panels made the content look like it had no side padding.

**Tested**
`tsc` and `eslint` pass. Checked at 390×844 (the plum band, the bento, the closing).
