import "server-only";
import { db } from "@/src/prisma/db";
import { instantToDb } from "./datetime";
import { ranRecently } from "./throttle";

/**
 * How long a booked visit is given past its time before the clinic assumes the
 * patient is not coming.
 *
 * Long enough to cover ordinary lateness and a receptionist who is busy with
 * somebody else; short enough that the slot is understood to be free while
 * there is still a day left to use it.
 */
export const NO_SHOW_GRACE_MINUTES = 15;

/**
 * Marks visits nobody ever said anything about.
 *
 * A booking that is still merely booked a quarter of an hour after its time
 * has almost certainly not happened, and leaving it sitting at "confirmed"
 * makes every count on the dashboard wrong: it reads as a visit still to come,
 * it holds its slot against a walk-in, and the follow-up it was meant to
 * satisfy goes on looking satisfied. Recording the assumption is more honest
 * than carrying it silently.
 *
 * Only visits nobody has touched are affected. Anyone checked in is here;
 * anyone with the doctor is being seen; anything already finished, cancelled
 * or missed has an answer. `autoNoShowAt` marks these apart from a no-show a
 * person recorded, so the visit can say the clinic assumed this — and offer to
 * put it right — rather than claiming somebody decided it.
 *
 * There is no scheduler in this application, so this runs when the clinic's
 * own screens are read. That is enough: the state only matters when somebody
 * is looking at it, and the write is a single statement that usually matches
 * nothing.
 */
export async function sweepNoShows(doctorId: string, now = new Date()): Promise<number> {
  // Once a minute is enough; open screens poll far more often than that.
  if (ranRecently(`no-show:${doctorId}`)) return 0;
  const cutoff = instantToDb(new Date(now.getTime() - NO_SHOW_GRACE_MINUTES * 60_000));
  const at = instantToDb(now);

  return db.transaction(async (tx) => {
    const plan = db.raw.sql`
      UPDATE "Appointment"
         SET "status" = 'NO_SHOW', "autoNoShowAt" = ${at}, "updatedAt" = ${at}
       WHERE "doctorId" = ${doctorId}
         AND "status" IN ('PENDING', 'CONFIRMED')
         AND "scheduledAt" < ${cutoff}
    `
      .affectedCount()
      .build();

    const result = (await tx.execute(plan as never)) as { affectedRows: number };
    return result.affectedRows;
  });
}
