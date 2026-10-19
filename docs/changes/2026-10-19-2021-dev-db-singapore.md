# Dev database moved to Supabase Singapore

Opened: 2026-10-19 20:21 PHT

## What
- The shared dev Supabase project is now in Singapore (`ap-southeast-1`), replacing #243's Mumbai project. It's closer to the Philippines, and Vercel's functions are being moved to `sin1` beside it.
- Applied all 44 migrations, ran the seeds (`db:seed`, doctor and patient showcases) and `db:verify`; same logins as #243.
- README: Singapore, and a note to URL-encode special characters in the password (`@` → `%40`).

## Why
Owner chose Singapore for the region.

## Tested
- `db:verify` passes on the new project.
- medfave.vercel.app: doctor sign-in, `/doctor/pulse` and `/doctor/day` all return 200.

## Heads-up
- **Every developer:** update `DATABASE_URL` to the Singapore **Session pooler** string (ask the owner), URL-encode the password, and restart `npm run dev`.
- The Mumbai project can be deleted.
