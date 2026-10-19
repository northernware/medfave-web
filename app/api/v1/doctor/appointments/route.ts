import { and, or } from "@prisma/orm-postgres/orm-client";
import { apiDoctor, apiError, readJson } from "@/lib/api";
import { APPOINTMENT_COLUMNS, shapeAppointment } from "@/lib/api-shapes";
import { bookAppointment } from "@/lib/booking";
import { instantToDb } from "@/lib/datetime";
import { likeSafe } from "@/lib/diagnosis-rank";
import { orm } from "@/src/prisma/db";

/** Past visits, by how they ended; `needs-note` are seen but not yet written up and signed. */
const PAST_FILTERS = ["completed", "missed", "cancelled", "needs-note"] as const;
type PastFilter = (typeof PAST_FILTERS)[number];

const PAGE = 50;

/** Visits that are over, for Past; under way ones stay in Upcoming whatever their booked time. */
const ENDED = ["COMPLETED", "CANCELLED", "NO_SHOW"] as const;
const UNDER_WAY = ["CHECKED_IN", "IN_CONSULTATION"] as const;

/**
 * This doctor's visits as a list, for the app's Visits tab:
 * `?view=upcoming` (default; from now, soonest first, with anyone waiting or
 * with the doctor first whatever their booked time) or `past` (visits over:
 * completed, missed, cancelled; most recent first), optionally `&q=` a patient's name → `{ appointments[], more, needsNote }`, each
 * as in `/doctor/day` (with `nextStatuses`) plus `note`: the visit's note
 * (`{ id, status: "DRAFT" | "SIGNED" }`) or null.
 *
 * Past only: `&filter=` one of PAST_FILTERS. Pages of 50: `more` says there are
 * further ones; ask for the next with `&before=` (past) or `&after=`
 * (upcoming) the last one's `scheduledAt`.
 *
 * `needsNote`: how many of this doctor's visits are seen but not written up
 * and signed, whatever the view, filter or search (the app's chip and badge).
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const params = new URL(request.url).searchParams;
  const past = params.get("view") === "past";
  const q = (params.get("q") ?? "").trim();
  const filter = PAST_FILTERS.find((f) => f === params.get("filter")) as PastFilter | undefined;
  const cursor = params.get(past ? "before" : "after");
  const from = cursor && !Number.isNaN(Date.parse(cursor)) ? instantToDb(new Date(cursor)) : instantToDb(new Date());

  let query = orm.Appointment
    .select(...APPOINTMENT_COLUMNS)
    .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName", "householdId"))
    .include("medicalRecord", (r) => r.select("id", "status"))
    .where((a) => a.doctorId.eq(doctor.doctorId))
    // Past: visits that are over (seen, missed, cancelled) and were due before now. Upcoming: what's
    // ahead, and anyone waiting or with the doctor whatever their booked time (not over yet).
    // A page after the first starts past the last one shown (a cursor).
    .where((a) =>
      past
        ? and(a.scheduledAt.lt(from), a.status.in(ENDED))
        : cursor
          ? a.scheduledAt.gt(from)
          : or(a.scheduledAt.gte(from), a.status.in(UNDER_WAY)),
    )
    .orderBy((a) => (past ? a.scheduledAt.desc() : a.scheduledAt.asc()))
    .limit(PAGE + 1);
  if (q) {
    const like = `%${likeSafe(q)}%`;
    query = query.where((a) => a.patient.some((p) => or(p.firstName.ilike(like), p.lastName.ilike(like))));
  }
  if (past && filter === "completed") query = query.where((a) => a.status.eq("COMPLETED"));
  if (past && filter === "missed") query = query.where((a) => a.status.eq("NO_SHOW"));
  if (past && filter === "cancelled") query = query.where((a) => a.status.eq("CANCELLED"));
  if (past && filter === "needs-note") {
    query = query
      .where((a) => a.status.eq("COMPLETED"))
      .where((a) => a.medicalRecord.none((r) => r.status.in(["FINALIZED", "AMENDED"])));
  }

  const [rows, owed] = await Promise.all([
    query.all(),
    orm.Appointment
      .where((a) => a.doctorId.eq(doctor.doctorId))
      .where((a) => a.status.eq("COMPLETED"))
      .where((a) => a.medicalRecord.none((r) => r.status.in(["FINALIZED", "AMENDED"])))
      .aggregate((agg) => ({ n: agg.count() })),
  ]);
  const appointments = rows.slice(0, PAGE).map((a) => ({
    ...shapeAppointment(a),
    note: a.medicalRecord ? { id: a.medicalRecord.id, status: a.medicalRecord.status === "DRAFT" ? "DRAFT" : "SIGNED" } : null,
  }));
  return Response.json({ appointments, more: rows.length > PAGE, needsNote: owed.n });
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
