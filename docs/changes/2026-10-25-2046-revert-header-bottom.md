# Revert: header bottom changes (#286, #287)

Opened: 2026-10-25 20:46 PHT

**What**
- Reverts #286 (header divider hidden on phones) and #287 (header frost faded at its bottom). The header is back as it was after #285.

**Why**
Both changed the wrong edge. The seam reported on the iPhone is at the top of the header, where it meets Safari's status-bar area, not at its bottom.

**Not done / next**
- The top seam itself: see the next change.
