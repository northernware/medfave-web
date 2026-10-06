# Lighter on the database: jobs once a minute, today's room only, a guard for sample data

Opened: 2026-10-06 17:50 PHT

## What
- **Background jobs throttled:** the no-show sweep (per doctor) and tomorrow's reminders (per clinic) run at most once a minute on a server instance (`lib/throttle.ts`). They were running on every read of every clinic screen, and the app reads Today every 30 s.
- **Today's room only:** the doctor's queue (`GET /doctor/day` and the web dashboard), the front desk's, and the patient's "ahead of you" only count visits from today. A visit left checked in or in consultation on an earlier day used to stay in the room for good.
- **Leftovers:** those earlier open visits are listed instead:
  - `GET /doctor/day` → `leftovers[]` (today only, up to 20);
  - the web dashboard's **Left open** card, with **Close visit**, which goes to the visit.
- The dashboard's unfinished-note button reads **Continue note**.
- **Sample data never in production:** `db:seed`, the other seeds, the showcases and `db:scenario` stop when `MEDFAVE_ENV=production` (`src/prisma/dev-only.ts`). `icd11:import` and the backfills still run there.

## Why
The old dev database ran out at about 20,000 operations a day, mostly from polling, and each poll also ran these jobs. The owner asked to cut usage, fix yesterday's visits sitting in today's room, and keep sample data out of production.

## Tested
- `tsc` (apart from the missing `@solar-icons/react` install), eslint, `npm test`.
- `MEDFAVE_ENV=production npm run db:scenario -- late` stops with a message.
- On this branch's Vercel preview (dev database), with Ramon's checked-in visit moved to yesterday: the queue is Elena, Joaquin, Marilou; `leftovers` lists Ramon; repeat reads of `/doctor/day` take about 0.26 s instead of 0.6 s. The live site, on the old code, still showed Ramon in today's queue.

## Heads-up
- Set `MEDFAVE_ENV=production` in Vercel's **Production** environment when the production database exists, and in any shell pointed at it.
- The app's side (slower polling, one check for the requests badge) is in medfave-mobile.
