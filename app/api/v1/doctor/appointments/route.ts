import { or } from "@prisma/orm-postgres/orm-client";
import { apiDoctor, apiError, readJson } from "@/lib/api";
import { APPOINTMENT_COLUMNS, shapeAppointment } from "@/lib/api-shapes";
import { bookAppointment } from "@/lib/booking";
import { instantToDb } from "@/lib/datetime";
import { likeSafe } from "@/lib/diagnosis-rank";
import { orm } from "@/src/prisma/db";

/**
 * This doctor's visits as a list, for the app's Visits tab:
 * `?view=upcoming` (default; from now, soonest first) or `past` (most recent
 * first), optionally `&q=` a patient's name → `{ appointments[] }`, each as
 * in `/doctor/day` (with `nextStatuses`). Up to 100.
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const params = new URL(request.url).searchParams;
  const past = params.get("view") === "past";
  const q = (params.get("q") ?? "").trim();
  const now = instantToDb(new Date());

  let query = orm.Appointment
    .select(...APPOINTMENT_COLUMNS)
    .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName", "householdId"))
    .where((a) => a.doctorId.eq(doctor.doctorId))
    .where((a) => (past ? a.scheduledAt.lt(now) : a.scheduledAt.gte(now)))
    .orderBy((a) => (past ? a.scheduledAt.desc() : a.scheduledAt.asc()))
    .limit(100);
  if (q) {
    const like = `%${likeSafe(q)}%`;
    query = query.where((a) => a.patient.some((p) => or(p.firstName.ilike(like), p.lastName.ilike(like))));
  }
  return Response.json({ appointments: (await query.all()).map(shapeAppointment) });
}

/**
 * Book a visit, or a walk-in.
 *
 * Body: `{ patientId, service, reason, date: "YYYY-MM-DD", time: "HH:MM", walkIn?: boolean }`.
 * A walk-in skips the clinic's booking lead time (the patient is at the desk)
 * and joins the queue as checked in. Same rules, lock and overlap check as the
 * web booking form.
 */
export async function POST(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;

  const body = await readJson(request);
  if (!body) return apiError(400, "Send the booking as JSON.");
  const text = (v: unknown) => (typeof v === "string" ? v : "");

  const result = await bookAppointment(doctor, {
    patientId: text(body.patientId),
    service: text(body.service),
    reason: text(body.reason),
    date: text(body.date),
    time: text(body.time),
    source: body.walkIn === true ? "WALK_IN" : "STAFF",
    status: "CONFIRMED",
  });
  if (!result.ok) {
    return apiError(result.clash ? 409 : 422, result.message ?? "Check the booking details.", result.fieldErrors);
  }
  return Response.json({ id: result.id }, { status: 201 });
}
