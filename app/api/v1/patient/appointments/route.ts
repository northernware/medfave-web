import { apiPatient } from "@/lib/api";
import { instantFromDb, instantToDb } from "@/lib/datetime";
import { APPOINTMENT_STATUS_LABELS, QUEUE_STATUSES, SERVICE_LABELS } from "@/lib/domain";
import { cancelBy, cancelCutoffHours } from "@/lib/patient-visits";
import { canConfirm, CHANGEABLE, splitVisits } from "@/lib/visit-day";
import { orm } from "@/src/prisma/db";

/** How long after a visit it can still be rated or the rating changed. As lib/faves.ts. */
const RATE_FOR_DAYS = 14;

/**
 * The patient's own visits: what is coming and what has been.
 *
 * Scoped to the chart this login was activated against, like the portal —
 * nothing here takes an id from the request.
 */
export async function GET(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  const now = instantToDb(new Date());

  const [ahead, before] = await Promise.all([
    orm.Appointment
      .select("id", "scheduledAt", "durationMinutes", "service", "reason", "status", "visitType", "patientConfirmedAt", "arrivedAt")
      .include("doctor", (d) => d.select("id", "fullName"))
      .where((a) => a.patientId.eq(me.patientId))
      .where((a) => a.scheduledAt.gte(now))
      .orderBy((a) => a.scheduledAt.asc())
      .limit(50)
      .all(),
    orm.Appointment
      .select("id", "scheduledAt", "durationMinutes", "service", "reason", "status", "visitType", "patientConfirmedAt", "arrivedAt")
      .include("doctor", (d) => d.select("id", "fullName"))
      .where((a) => a.patientId.eq(me.patientId))
      .where((a) => a.scheduledAt.lt(now))
      .orderBy((a) => a.scheduledAt.desc())
      .limit(50)
      .all(),
  ]);
  const { upcoming, past } = splitVisits(ahead, before);

  const [hours, moves] = await Promise.all([
    cancelCutoffHours(me.clinicId),
    orm.AppointmentRequest
      .select("rescheduleOfId")
      .where((r) => r.patientId.eq(me.patientId))
      .where((r) => r.status.eq("PENDING"))
      .all(),
  ]);
  // Where a checked-in patient is in their doctor's waiting room: how many got
  // here before them and are still waiting, and whether the doctor is with
  // someone now. The same order as the doctor's queue: arrival, not slot.
  const waitingFor = upcoming.filter((a) => a.status === "CHECKED_IN");
  const queues = new Map<string, { status: string; arrivedAt: string | null }[]>();
  for (const doctorId of new Set(waitingFor.map((a) => a.doctor.id))) {
    queues.set(
      doctorId,
      await orm.Appointment
        .select("status", "arrivedAt")
        .where((a) => a.doctorId.eq(doctorId))
        .where((a) => a.status.in(QUEUE_STATUSES))
        .all(),
    );
  }
  const placeOf = (a: (typeof ahead)[number]) => {
    const queue = queues.get(a.doctor.id);
    if (a.status !== "CHECKED_IN" || !queue) return null;
    const mine = a.arrivedAt ? instantFromDb(a.arrivedAt).getTime() : Date.now();
    return {
      ahead: queue.filter((q) => q.status === "CHECKED_IN" && q.arrivedAt && instantFromDb(q.arrivedAt).getTime() < mine).length,
      doctorBusy: queue.some((q) => q.status === "IN_CONSULTATION"),
    };
  };
  const moving = new Set(moves.map((m) => m.rescheduleOfId).filter(Boolean));
  const changeable = (a: (typeof ahead)[number]) => (CHANGEABLE as readonly string[]).includes(a.status);

  const shape = (a: (typeof ahead)[number]) => ({
    id: a.id,
    scheduledAt: instantFromDb(a.scheduledAt).toISOString(),
    durationMinutes: a.durationMinutes,
    service: a.service,
    serviceLabel: SERVICE_LABELS[a.service],
    reason: a.reason,
    status: a.status,
    statusLabel: APPOINTMENT_STATUS_LABELS[a.status],
    visitType: a.visitType,
    doctor: a.doctor.fullName,
    doctorId: a.doctor.id,
  });
  // What the patient may still do with a visit to come.
  const upcomingShape = (a: (typeof ahead)[number]) => {
    const by = cancelBy(instantFromDb(a.scheduledAt), hours);
    return {
      ...shape(a),
      canCancel: changeable(a) && Date.now() <= by.getTime(),
      cancelBy: by.toISOString(),
      // Not once its time has come: today's late-running visit can't be moved from here.
      canMove: changeable(a) && !moving.has(a.id) && instantFromDb(a.scheduledAt).getTime() > Date.now(),
      movePending: moving.has(a.id),
      // Checked in: people ahead in the waiting room, and whether the doctor is with someone.
      queue: placeOf(a),
      // "I'll be there", from the day before (lib/patient-visits.ts).
      confirmedAt: a.patientConfirmedAt ? instantFromDb(a.patientConfirmedAt).toISOString() : null,
      canConfirm: canConfirm({
        status: a.status,
        scheduledAt: instantFromDb(a.scheduledAt),
        patientConfirmedAt: a.patientConfirmedAt ? instantFromDb(a.patientConfirmedAt) : null,
      }),
    };
  };

  // Finished visits carry what this login said about them, and whether it can
  // still say or change it (the two weeks the "How was it?" sheet is offered).
  const done = past.filter((a) => a.status === "COMPLETED");
  const [feedback, faves] = await Promise.all([
    done.length
      ? orm.VisitFeedback
          .select("appointmentId", "score", "tags", "note")
          .where((f) => f.accountId.eq(me.accountId))
          .where((f) => f.appointmentId.in(done.map((a) => a.id)))
          .all()
      : Promise.resolve([]),
    orm.Fave.select("doctorId").where((f) => f.accountId.eq(me.accountId)).all(),
  ]);
  const faved = new Set(faves.map((f) => f.doctorId));
  const rateUntil = Date.now() - RATE_FOR_DAYS * 86_400_000;
  const pastShape = (a: (typeof ahead)[number]) => {
    if (a.status !== "COMPLETED") return shape(a);
    const said = feedback.find((f) => f.appointmentId === a.id);
    return {
      ...shape(a),
      feedback: said?.score ? { score: said.score, tags: said.tags ? said.tags.split(",") : [], note: said.note } : null,
      canRate: instantFromDb(a.scheduledAt).getTime() >= rateUntil,
      doctorFaved: faved.has(a.doctor.id),
    };
  };

  return Response.json({ upcoming: upcoming.map(upcomingShape), past: past.map(pastShape), cancelHours: hours });
}
