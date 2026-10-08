# Loading skeletons match the pages again

Opened: 2026-10-08 17:51 PHT

## What
`components/page-skeleton.tsx` gains the shapes the pages now have, and each `loading.tsx` uses the one that matches:
- `ClipboardSkeleton` (tinted top, sheet with its clip, a few boxes).
- **Today:** the list and the narrow clipboard (was two equal cards).
- **Patient page** (`PatientSkeleton`): header and history on the left, clipboard on the right.
- **Visit page** (`VisitSkeleton`): header and details on the left, clipboard on the right.
- **Note pages** (`NoteSkeleton`, new `loading.tsx` for new, read and edit): centred, note at reading width, clipboard beside. The prescription print page keeps the plain outline.
- **Form pages** (`FormSkeleton`): centred header and card, doctor's and desk's.
- **Households list and a household** (`ListWithRailSkeleton`, `HouseholdSkeleton`): with the schedule panel.
- **Calendar:** the panel without its week strip (`RailSkeleton weekStrip={false}`).

## Why
Owner: the skeletons should match the pages after today's layout changes.

## Tested
`tsc`, eslint. Headless Chrome at 1600px through a temporary preview page (removed): Today, patient, visit and note skeletons. Form, households and calendar skeletons not screenshotted.
