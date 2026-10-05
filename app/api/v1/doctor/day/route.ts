import { apiDoctor, apiError } from "@/lib/api";
import { APPOINTMENT_COLUMNS, shapeAppointment } from "@/lib/api-shapes";
import { dayKey, instantFromDb, instantToDb, startOfClinicDay } from "@/lib/datetime";
import { QUEUE_STATUSES } from "@/lib/domain";
import { sweepNoShows } from "@/lib/no-show";
import { sendDueReminders } from "@/lib/reminders";
import { orm } from "@/src/prisma/db";

/**
 * One clinic day for the doctor: its appointments in time order, the queue of
 * who is here (today only), and how many requests are waiting for an answer.
 *
 * `?date=YYYY-MM-DD` in clinic time; today when left out.
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;

  const now = new Date();
  const today = dayKey(now);
  const date = new URL(request.url).searchParams.get("date") ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiError(422, "Use a date like 2026-10-01.", { date: ["Invalid date"] });

  // As the dashboard does: a booking nobody spoke for long after its time is
  // marked before anything is listed, and tomorrow's reminders go out when the
  // clinic's own screens are read.
  await sweepNoShows(doctor.doctorId, now);
  await sendDueReminders(doctor.clinicId, now);

  const start = startOfClinicDay(date);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [rows, queueRows, pending] = await Promise.all([
    orm.Appointment
      .select(...APPOINTMENT_COLUMNS)
      .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
      .where((a) => a.doctorId.eq(doctor.doctorId))
      .where((a) => a.scheduledAt.gte(instantToDb(start)))
      .where((a) => a.scheduledAt.lt(instantToDb(end)))
      .orderBy((a) => a.scheduledAt.asc())
      .all(),
    date === today
      ? orm.Appointment
          .select(...APPOINTMENT_COLUMNS)
          .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
          .where((a) => a.doctorId.eq(doctor.doctorId))
          .where((a) => a.status.in(QUEUE_STATUSES))
          .all()
      : Promise.resolve([]),
    orm.AppointmentRequest
      .where((r) => r.clinicId.eq(doctor.clinicId))
      .where((r) => r.doctorId.eq(doctor.doctorId))
      .where((r) => r.status.eq("PENDING"))
      .aggregate((agg) => ({ n: agg.count() })),
  ]);

  // Whoever is with the doctor first, then the waiting room by arrival, longest
  // wait first: the queue is whoever got here first, not whose slot is earliest
  // (a walk-in has no meaningful slot). The same order as the patient's "ahead
  // of you" and the web's waiting list.
  const arrived = (a: (typeof queueRows)[number]) => (a.arrivedAt ? instantFromDb(a.arrivedAt).getTime() : 0);
  const queue = [...queueRows].sort(
    (a, b) =>
      Number(b.status === "IN_CONSULTATION") - Number(a.status === "IN_CONSULTATION") || arrived(a) - arrived(b),
  );

  return Response.json({
    date,
    isToday: date === today,
    appointments: rows.map(shapeAppointment),
    queue: queue.map(shapeAppointment),
    pendingRequests: pending.n,
  });
}
