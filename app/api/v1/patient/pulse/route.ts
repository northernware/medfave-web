import { apiPatient } from "@/lib/api";
import { clinicDayRange, instantToDb } from "@/lib/datetime";
import { QUEUE_STATUSES } from "@/lib/domain";
import { orm } from "@/src/prisma/db";

/**
 * "Anything changed?" for a patient around their visit: a stamp that moves when
 * one of their visits changes, or, while they're checked in today, when their
 * doctor's waiting room moves (their place in it). The app polls this instead
 * of /patient/appointments (about eight reads) and reloads only when it moves.
 */
export async function GET(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  const todayStart = instantToDb(clinicDayRange(new Date()).start);

  const [mine, waiting] = await Promise.all([
    orm.Appointment
      .select("updatedAt")
      .where((a) => a.patientId.eq(me.patientId))
      .orderBy((a) => a.updatedAt.desc())
      .first(),
    // Checked in today: whose waiting room it is.
    orm.Appointment
      .select("doctorId")
      .where((a) => a.patientId.eq(me.patientId))
      .where((a) => a.status.eq("CHECKED_IN"))
      .where((a) => a.scheduledAt.gte(todayStart))
      .first(),
  ]);
  const room = waiting
    ? await orm.Appointment
        .select("updatedAt")
        .where((a) => a.doctorId.eq(waiting.doctorId))
        .where((a) => a.status.in(QUEUE_STATUSES))
        .where((a) => a.scheduledAt.gte(todayStart))
        .orderBy((a) => a.updatedAt.desc())
        .first()
    : null;

  return Response.json({ stamp: `${mine?.updatedAt ?? ""}|${room?.updatedAt ?? ""}` });
}
