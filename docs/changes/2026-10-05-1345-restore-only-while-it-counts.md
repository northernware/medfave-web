# Restore booking only while the visit's time is still to come

Opened: 2026-10-05 13:45 PHT

## What
- Restoring a cancelled or missed visit (to CONFIRMED) is offered and accepted only before its time plus the 15-minute grace. After that it would just be marked missed again. On the visit's day, a missed visit offers only "Check in (arrived late)"; on later days, nothing.
- `movesFrom(status, onItsDay, stillDue)` in `lib/domain.ts`; `movesFor(appointment)` in `lib/booking.ts` works out both and is what the API's `nextStatuses`, the doctor and desk visit pages, and `changeAppointmentStatus` (`409` otherwise) use.
- The doctor's visit page says "Its time has passed. Book a new visit if they still need one." for a past visit with nothing to do. It used to say "finished".

## Why
Owner asked what Restore booking was for on a morning no-show. Restoring a time that has passed only bounced back to missed.

## Tested
- `tsc` (apart from the missing `@solar-icons/react` install) and eslint clean. To check after deploy: this morning's no-shows offer only Check in.
