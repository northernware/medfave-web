# Resolve and Stop ask first

Opened: 2026-10-06 20:55 PHT

## What
- **Resolve** on a condition (side column and patient page) and **Stop** on a medicine (side column) ask before acting: "Mark Hypertension resolved? It moves to past conditions; you can reopen it." The patient page's Resolve now goes through the same `ChartForm` as the side column; the separate `resolveCondition` action is gone.

## Why
Owner: Resolve had no confirmation.

## Tested
- `tsc`, eslint.
