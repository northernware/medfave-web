# Landing page remake and app waitlist

Opened: 2026-10-25 14:54 PHT

**What**
- `app/page.tsx` rebuilt, doctors and clinics first:
  - Hero with a silent loop from the introduction film and a "Watch the film" dialog (`public/landing/`).
  - A paper-trail band, then the product as a scroll story: one browser window stays pinned while six steps (Today, chart, schedule, households, documents, feedback) scroll past. Each step shows its own picture on small screens.
  - A "taken the way you were trained" bento (ICD-11, history, allergies, certificates, vaccines), the apps section with "coming soon" badges and the waitlist, and a fuchsia closing band.
- Scroll-driven rise-in CSS in `globals.css` (no script; off with reduced motion).
- **Waitlist:** migration `20261025T0647_waitlist` (additive), table `WaitlistEntry` (email unique, role DOCTOR / CLINIC / PATIENT, optional organization). `lib/waitlist.ts`, action `app/actions/waitlist.ts`, rate limit `waitlistAddress` (10 per hour per address). Signing up twice shows the same confirmation. **Applied to the shared dev DB** (`db:migrate --advance-ref db`); `db:verify` passes.

**Why**
A landing page for launch: the web app is live for doctors today, the apps are coming soon, so the page collects a waitlist for them.

**Tested**
- `tsc` and `eslint` pass.
- Locally: full page at 1440px and 390px, light theme. The pinned story changes with scroll. The waitlist refuses a bad email and accepts a good one. One test row was left in: `test+landing@medfave.com`.
- Not checked: dark theme in detail, Safari.

**Not done / next**
- Nothing reads the waitlist yet (an admin list, or an export when the apps launch).
- Screens are from the demo clinic (Dr. Ana Reyes); swap in fresh ones when the UI changes.

**Heads-up**
- New migration: pull and `npm run db:verify`.
- `public/landing/medfave-film.mp4` is about 8 MB.
