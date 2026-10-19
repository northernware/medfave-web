# Dev database moved to Supabase

Opened: 2026-10-19 20:02 PHT

## What
- The shared dev database, which medfave.vercel.app also uses, is now a free Supabase project in Mumbai (`ap-south-1`), next to Vercel's `bom1` functions.
- Applied all 44 migrations (`db:migrate`); `db:verify` matches the contract.
- Seeded `db:seed`, `db:seed-doctor-showcase` and `db:seed-patient-showcase`. Logins: doctor@, desk@, patient@ and marilou@medfave.com, all with password `password`.
- README: which connection string goes where.

## Why
The Prisma Postgres free workspace hit `planLimitReached` (an operations cap, until November 1), which took the dev site and local development down. Supabase's free plan has no query cap (500 MB). Production, when it comes, is planned as a separate Supabase Pro project.

## Tested
- `db:verify` passes.
- On medfave.vercel.app: doctor sign-in, `/doctor/pulse`, `/doctor/day` and `/doctor/appointments` all return 200.

## Heads-up
- **Every developer:** set `DATABASE_URL` in your `.env` to the Supabase **Session pooler** string (port 5432; ask the owner), then restart `npm run dev`. Vercel already uses the **Transaction pooler** (port 6543).
- The old Prisma workspace is no longer used. Data created there before today isn't in Supabase; the database starts from the seeds.
- A free Supabase project pauses after a week with no use. Wake it from the dashboard.
