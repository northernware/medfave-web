import { apiDoctor } from "@/lib/api";
import { sweepNoShows } from "@/lib/no-show";
import { orm } from "@/src/prisma/db";

/**
 * "Anything changed?", for the app to poll instead of whole screens: a stamp
 * that moves when any of this doctor's visits change (booked, checked in,
 * started, done, moved, swept as a no-show) or a request comes or goes, and
 * how many visits still need a note (the Visits badge).
 *
 * Three small reads. `/doctor/day` is about ten (sweep, reminders, four reads
 * with patients), and Today and With you asked for it every minute: that was
 * most of the database's use. Screens now reload only when the stamp moves.
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;

  // Still marks the untouched past visits while the app is open (it did on every day read).
  await sweepNoShows(doctor.doctorId);

  const [latest, pending, owed] = await Promise.all([
    orm.Appointment
      .select("updatedAt")
      .where((a) => a.doctorId.eq(doctor.doctorId))
      .orderBy((a) => a.updatedAt.desc())
      .first(),
    orm.AppointmentRequest
      .where((r) => r.clinicId.eq(doctor.clinicId))
      .where((r) => r.doctorId.eq(doctor.doctorId))
      .where((r) => r.status.eq("PENDING"))
      .aggregate((agg) => ({ n: agg.count() })),
    orm.Appointment
      .where((a) => a.doctorId.eq(doctor.doctorId))
      .where((a) => a.status.eq("COMPLETED"))
      .where((a) => a.medicalRecord.none((r) => r.status.in(["FINALIZED", "AMENDED"])))
      .aggregate((agg) => ({ n: agg.count() })),
  ]);

  return Response.json({
    stamp: `${latest?.updatedAt ?? ""}|${pending.n}|${owed.n}`,
    pendingRequests: pending.n,
    needsNote: owed.n,
  });
}
