import "server-only";
import { revalidatePath } from "next/cache";
import { AppointmentStatus, type ClinicRole } from "@/lib/enums";
import { pickDoctor } from "@/lib/clinic";
import { db, orm } from "@/src/prisma/db";
import {
  clinicDayRange,
  dayKey,
  formatDateTime,
  fromDateTimeLocalValue,
  instantFromDb,
  instantToDb,
} from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { canMoveTo, fullName, movesFrom, SERVICE_MINUTES } from "@/lib/domain";
import { NO_SHOW_GRACE_MINUTES } from "@/lib/no-show";
import { formatSpan, minuteOfDay, occupiesSlot, overlaps } from "@/lib/scheduling";
import { checkAvailability, durationFor } from "@/lib/availability";
import { heldSlots } from "@/lib/held-slots";
import { loadSchedule } from "@/lib/queries";
import { appUrl, sendAppointmentConfirmation } from "@/lib/email";
import { appointmentSchema, toFieldErrors, type FormState } from "@/lib/validation";

/*
 * Booking and moving appointments, shared by the web's server actions and the
 * app's API. Every write to the appointment table that claims a slot goes
 * through `lockDoctorSchedule` and `findClash` here — there is no second copy.
 */

/** Who is acting: a member of the clinic's staff, already checked by the caller's gate. */
export type Actor = {
  accountId: string;
  clinicId: string;
  role: ClinicRole;
  /** Set when the actor is also a clinician. */
  doctorId: string | null;
};

/**
 * Confirms the patient is one of this clinic's.
 *
 * Scoped by clinic rather than by clinician: the desk books for whoever is
 * working, and a secretary is not any doctor. It stays the boundary that
 * matters — nothing outside the clinic is reachable through here.
 */
async function assertClinicPatient(clinicId: string, patientId: string) {
  const patient = await orm.Patient
    .select("id")
    .where((p) => p.id.eq(patientId))
    .where((p) => p.clinicId.eq(clinicId))
    // The picker leaves archived charts out; this is what stops a posted id
    // booking one anyway. Restore the chart to book it.
    .where((p) => p.archivedAt.isNull())
    .first();
  return patient !== null;
}

/** The appointment columns a booking form decides — relations and audit keys excluded. */
type AppointmentScalars = Omit<
  Parameters<typeof orm.Appointment.create>[0],
  | "id"
  | "doctorId"
  | "createdAt"
  | "updatedAt"
  | "doctor"
  | "patient"
  | "previousAppointment"
  | "followUps"
  | "medicalRecord"
  | "followUpForRecord"
  | "clinic"
  | "bookedBy"
  | "appointmentRequests"
  | "events"
  | "feedback"
>;

/**
 * Turns validated form fields into a row, refusing anything the clinic's rules
 * or an existing booking would not allow. The form mirrors these rules to keep
 * the UI honest, but this is what actually decides — a stale slot list or a
 * direct POST both land here.
 */
export async function resolveBooking(
  clinicId: string,
  doctorId: string,
  data: ReturnType<typeof appointmentSchema.parse>,
  ignoreAppointmentId?: string,
): Promise<{ error: FormState } | { data: AppointmentScalars; scheduledAt: Date; durationMinutes: number }> {
  const { patientId, date, time, service, previousAppointmentId, type, ...rest } = data;

  if (!(await assertClinicPatient(clinicId, patientId))) {
    return { error: { message: "That patient is not on your list." } };
  }

  const scheduledAt = fromDateTimeLocalValue(`${date}T${time}`);
  if (!scheduledAt) {
    return { error: { message: "Check the date and time.", fieldErrors: { time: ["Invalid time"] } } };
  }

  // Duration follows the service, unless the clinic has set its own length.
  const schedule = await loadSchedule(doctorId);
  const durationMinutes = durationFor(schedule, service, SERVICE_MINUTES[service]);

  // The clinic's own week, breaks and closures — not module constants. A
  // walk-in is exempt from the lead time: the patient is already at the desk.
  const ruleBreak = checkAvailability(
    schedule,
    scheduledAt,
    durationMinutes,
    minuteOfDay(scheduledAt),
    { allowSameDay: data.source === "WALK_IN" },
  );
  if (ruleBreak) {
    return {
      error: {
        message: ruleBreak,
        fieldErrors: { date: [ruleBreak] },
      },
    };
  }

  // The overlap check does NOT happen here. It has to run inside the same
  // transaction as the write, under a lock — see `findClash`.

  // Only chain to a previous visit that is this doctor's and this patient's.
  let previousId: string | null = null;
  if (previousAppointmentId) {
    let previousQuery = orm.Appointment
      .select("id")
      .where((a) => a.id.eq(previousAppointmentId))
      .where((a) => a.doctorId.eq(doctorId))
      .where((a) => a.patientId.eq(patientId));
    if (ignoreAppointmentId) {
      previousQuery = previousQuery.where((a) => a.id.neq(ignoreAppointmentId));
    }
    const previous = await previousQuery.first();
    if (!previous) {
      return { error: { message: "That previous appointment is not available to link." } };
    }
    previousId = previous.id;
  }

  return {
    scheduledAt,
    durationMinutes,
    data: {
      ...rest,
      patientId,
      service,
      durationMinutes,
      visitType: type,
      scheduledAt: instantToDb(scheduledAt),
      previousAppointmentId: previousId,
    },
  };
}

/** A transaction context, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The queue moves the desk is allowed to make.
 *
 * Confirming, checking in, cancelling and recording a no-show are all things
 * that happen at the front of the clinic. IN_CONSULTATION and COMPLETED are
 * assertions that a consultation began and ended, which is not the desk's to
 * assert.
 */
export const DESK_STATUSES: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CANCELLED",
  "NO_SHOW",
];

/**
 * Serialises every booking for one doctor.
 *
 * Checking availability and then inserting are two statements; without this
 * two concurrent requests both see the slot free and both write. Taking a row
 * lock on the doctor makes the second request wait for the first to commit, so
 * its re-check sees the appointment the first one just made. The lock is held
 * until the transaction ends — that is what `FOR UPDATE` gives us.
 *
 * A database-level exclusion constraint over a time range would be stronger
 * still, because it would bind writers that never take this lock. Prisma 8's
 * contract cannot express `EXCLUDE USING gist` today, so the guarantee lives
 * here instead: every write path for appointments must go through this.
 */
export async function lockDoctorSchedule(tx: Tx, doctorId: string) {
  // No rows are wanted — only the lock the statement takes. `affectedCount`
  // avoids having to name a codec for a column we would throw away.
  const plan = db.raw.sql`SELECT id FROM "Doctor" WHERE id = ${doctorId} FOR UPDATE`
    .affectedCount()
    .build();
  await tx.execute(plan as never);
}

/**
 * The first existing appointment the proposed one would overlap, or null.
 *
 * Overlap is `newStart < existingEnd AND newEnd > existingStart` — identical
 * start times are only the most obvious case of it. Cancelled and no-show
 * visits do not hold their time (see `occupiesSlot`), so their slots are free
 * to rebook. An early check-in still holds the time it was booked for (see
 * `heldSlots`), so undoing it can always put it back.
 */
export async function findClash(
  tx: Tx,
  doctorId: string,
  scheduledAt: Date,
  durationMinutes: number,
  ignoreAppointmentId?: string,
) {
  const { start, end } = clinicDayRange(scheduledAt);
  let query = tx.orm.public.Appointment
    .select("id", "scheduledAt", "durationMinutes", "status")
    .include("patient", (p) => p.select("firstName", "middleName", "lastName"))
    .where((a) => a.doctorId.eq(doctorId))
    .where((a) => a.scheduledAt.gte(instantToDb(start)))
    .where((a) => a.scheduledAt.lt(instantToDb(end)));
  if (ignoreAppointmentId) {
    query = query.where((a) => a.id.neq(ignoreAppointmentId));
  }

  const proposedStart = minuteOfDay(scheduledAt);
  for (const existing of await query.all()) {
    if (!occupiesSlot(existing.status)) continue;
    const existingStart = minuteOfDay(instantFromDb(existing.scheduledAt));
    if (
      overlaps(proposedStart, durationMinutes, [
        { start: existingStart, end: existingStart + existing.durationMinutes },
      ])
    ) {
      return { ...existing, startMinute: existingStart };
    }
  }
  for (const held of await heldSlots(doctorId, start, end, { q: tx.orm.public, ignoreAppointmentId })) {
    const heldStart = minuteOfDay(held.scheduledAt);
    if (overlaps(proposedStart, durationMinutes, [{ start: heldStart, end: heldStart + held.durationMinutes }])) {
      return {
        id: held.id,
        scheduledAt: instantToDb(held.scheduledAt),
        durationMinutes: held.durationMinutes,
        status: "CHECKED_IN" as const,
        patient: held.patient,
        startMinute: heldStart,
      };
    }
  }
  return null;
}

/**
 * Tells the patient their time is booked, if they asked to be told.
 *
 * Only when the booking says EMAIL. A patient who chose no reminders, or SMS,
 * has said something about how they want to be contacted, and booking them in
 * is not a reason to overrule it. SMS and app notifications are recorded as
 * preferences but nothing delivers them yet, so those stay silent rather than
 * quietly becoming email.
 *
 * Never blocks the booking: the appointment is made either way, and a mail
 * server having a bad afternoon is not a reason to fail a clinic's booking.
 */
export async function confirmByEmail(appointmentId: string) {
  const appointment = await orm.Appointment
    .select("id", "scheduledAt", "reminderPreference", "confirmationSentAt")
    .include("patient", (p) => p.select("firstName", "email"))
    .include("doctor", (d) => d.select("fullName"))
    .include("clinic", (c) => c.select("name"))
    .where((a) => a.id.eq(appointmentId))
    .first();

  if (!appointment) return;
  if (appointment.reminderPreference !== "EMAIL") return;
  if (!appointment.patient.email) return;
  if (appointment.confirmationSentAt) return;

  const outcome = await sendAppointmentConfirmation({
    to: appointment.patient.email,
    patientName: appointment.patient.firstName,
    clinicName: appointment.clinic.name,
    doctorName: appointment.doctor.fullName,
    when: formatDateTime(instantFromDb(appointment.scheduledAt)),
    link: appUrl("/portal"),
  });
  if (!outcome.sent) {
    console.error(`[email] confirmation for ${appointmentId}: ${outcome.reason}`);
  }

  // Stamped either way, for the same reason the reminder is: a retry on every
  // page load turns one failure into many.
  await orm.Appointment
    .where((a) => a.id.eq(appointmentId))
    .update({ confirmationSentAt: instantToDb(new Date()) });
}

/** The message a losing racer sees. Names the time so it is actionable. */
export function clashMessage(clash: { startMinute: number; durationMinutes: number }): FormState {
  const span = formatSpan(clash.startMinute, clash.durationMinutes);
  const message = `That time is no longer free — ${span} is already booked. Pick another slot.`;
  return { message, fieldErrors: { time: [message] } };
}

/**
 * The timestamps a move into the queue sets, given what is already recorded.
 *
 * Both are stamped once and then left alone: correcting a status later must not
 * restart a clock that has already run. Arrival is implied by being in the
 * room, so a patient taken straight into consultation gets an arrival time
 * too — otherwise the visit would show no waiting time at all rather than none.
 */
type Instant = ReturnType<typeof instantToDb>;

export function queueStamps(
  status: AppointmentStatus,
  existing: { arrivedAt: unknown; consultationStartedAt: unknown },
  now: Instant,
) {
  const stamps: { arrivedAt?: Instant | null; consultationStartedAt?: Instant } = {};
  // Not here after all (an undone check-in, or a booking put back): no arrival time.
  if (status === "CONFIRMED" || status === "PENDING") stamps.arrivedAt = null;
  if ((status === "CHECKED_IN" || status === "IN_CONSULTATION") && !existing.arrivedAt) {
    stamps.arrivedAt = now;
  }
  if (status === "IN_CONSULTATION" && !existing.consultationStartedAt) {
    stamps.consultationStartedAt = now;
  }
  return stamps;
}

function revalidateAppointmentPages(appointmentId?: string, patientId?: string) {
  revalidatePath("/appointments");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/desk");
  revalidatePath("/desk/appointments");
  if (appointmentId) revalidatePath(`/appointments/${appointmentId}`);
  if (patientId) revalidatePath(`/patients/${patientId}`);
}

export type BookResult =
  | { ok: true; id: string; patientId: string }
  /** `clash` when the time was taken by another booking; otherwise the input broke a rule. */
  | ({ ok: false; clash?: boolean } & FormState);

/**
 * Books a visit — the booking form's and the app's walk-in button alike.
 *
 * Booking is desk work. A secretary does it for the clinic's clinician, so the
 * gate is membership and the diary is the doctor's. `input` is the booking
 * form's fields (see `appointmentSchema`); `followUpFor` names an earlier
 * record this visit satisfies.
 */
export async function bookAppointment(
  actor: Actor,
  input: Record<string, unknown>,
  followUpFor = "",
): Promise<BookResult> {
  const parsed = appointmentSchema.safeParse(input);
  if (!parsed.success) return { ...toFieldErrors(parsed.error), ok: false };

  // A doctor books into their own diary; the desk names whose.
  const doctorId = actor.doctorId ?? (await pickDoctor(actor.clinicId, input.doctorId)).doctorId;
  if (!doctorId) return { ok: false, message: "Choose which doctor this visit is with." };

  const resolved = await resolveBooking(actor.clinicId, doctorId, parsed.data);
  if ("error" in resolved) return { ...resolved.error, ok: false };

  // The booking form starts at "No reminder" whether or not it knows who the
  // patient is, so a NONE coming out of it is an absence of a choice rather than
  // a refusal. Somebody who has asked the clinic to remind them is honoured
  // here; staff can still set the visit to anything else, and that stands.
  const standing = await orm.Patient
    .select("reminderPreference")
    .where((p) => p.id.eq(parsed.data.patientId))
    .where((p) => p.clinicId.eq(actor.clinicId))
    .first();
  const reminderPreference =
    resolved.data.reminderPreference === "NONE" && standing?.reminderPreference === "EMAIL"
      ? ("EMAIL" as const)
      : resolved.data.reminderPreference;

  // Availability is re-checked here, inside the lock, rather than trusting the
  // check the form did: between rendering the slot list and this write, anyone
  // could have taken it.
  const outcome = await db.transaction(async (tx) => {
    await lockDoctorSchedule(tx, doctorId);

    const clash = await findClash(tx, doctorId, resolved.scheduledAt, resolved.durationMinutes);
    if (clash) return { clash, created: null };

    const now = instantToDb(new Date());

    // A walk-in is already standing at the desk, so it joins the queue on
    // arrival rather than waiting for someone to check it in afterwards. Only
    // a status that means "has not turned up yet" is overridden: staff writing
    // up a visit that already happened, or one the patient left before, said
    // what they meant and it is not this action's place to argue.
    const walkIn = resolved.data.source === "WALK_IN";
    const notYetArrived =
      resolved.data.status === "PENDING" || resolved.data.status === "CONFIRMED";
    const status = walkIn && notYetArrived ? ("CHECKED_IN" as const) : resolved.data.status;

    const created = await tx.orm.public.Appointment.select("id", "patientId").create({
      ...resolved.data,
      reminderPreference,
      id: newId(),
      clinicId: actor.clinicId,
      doctorId,
      // Who made the booking, kept apart from the clinician it is with.
      bookedById: actor.accountId,
      status,
      // Arrival is stamped whenever the visit starts out in the queue, however
      // it got there — not only on the walk-in path.
      ...(status === "CHECKED_IN" ? { arrivedAt: now } : {}),
      createdAt: now,
      updatedAt: now,
    });

    // Booked to satisfy an earlier visit's follow-up: link it so the record
    // stops showing as due. Scoped to this doctor and patient.
    if (followUpFor) {
      const record = await tx.orm.public.MedicalRecord
        .select("id", "followUpAppointmentId")
        .include("followUpAppointment", (a) => a.select("status"))
        .where((r) => r.id.eq(followUpFor))
        .where((r) => r.clinicId.eq(actor.clinicId))
        .where((r) => r.patientId.eq(created.patientId))
        .first();

      // A link to a booking that fell through is not a satisfied follow-up —
      // it is the reason the follow-up came back. Refusing to replace it meant
      // rebooking a cancelled or missed follow-up left the record pointing at
      // the dead appointment, so it stayed on the due list however many times
      // it was rebooked. A link to a visit that is still expected or already
      // happened is left alone.
      const replaceable =
        record !== null &&
        (record.followUpAppointmentId === null ||
          record.followUpAppointment?.status === "CANCELLED" ||
          record.followUpAppointment?.status === "NO_SHOW");

      if (replaceable) {
        await tx.orm.public.MedicalRecord
          .where((r) => r.id.eq(record.id))
          .update({ followUpAppointmentId: created.id, updatedAt: now });
      }
    }

    return { clash: null, created };
  });

  if (outcome.clash) return { ...clashMessage(outcome.clash), ok: false, clash: true };
  const appointment = outcome.created;
  await confirmByEmail(appointment.id);
  if (followUpFor) revalidatePath(`/records/${followUpFor}`);

  revalidateAppointmentPages(appointment.id, appointment.patientId);
  return { ok: true, id: appointment.id, patientId: appointment.patientId };
}

export type StatusChange =
  | { ok: true; status: AppointmentStatus }
  | { ok: false; reason: "invalid" | "not-found" }
  | { ok: false; reason: "role" }
  | { ok: false; reason: "transition"; current: AppointmentStatus }
  | { ok: false; reason: "clash"; clashId: string; clashWith: string; clashAt: Date; restoring: boolean }
  /** Checking in or starting a visit that isn't today. */
  | { ok: false; reason: "not-today" };

/**
 * Moves an appointment through the queue: confirm, check in, start, complete,
 * cancel, no-show — whatever `canMoveTo` allows from where it is.
 */
export async function changeAppointmentStatus(
  actor: Actor,
  appointmentId: string,
  raw: string,
): Promise<StatusChange> {
  if (!appointmentId || !(raw in AppointmentStatus)) return { ok: false, reason: "invalid" };

  const now = instantToDb(new Date());
  const status = raw as AppointmentStatus;

  // The desk moves people through the queue; it does not begin or end a
  // consultation. Those two say something clinical happened, and only somebody
  // clinical may say it.
  if (actor.role === "SECRETARY" && !DESK_STATUSES.includes(status)) {
    return { ok: false, reason: "role" };
  }

  const existing = await orm.Appointment
    .select("status", "doctorId", "scheduledAt", "durationMinutes", "arrivedAt", "consultationStartedAt")
    .where((a) => a.id.eq(appointmentId))
    .where((a) => a.clinicId.eq(actor.clinicId))
    .first();
  if (!existing) return { ok: false, reason: "not-found" };

  // The page only offers moves that exist, but the page is not the authority.
  if (!canMoveTo(existing.status, status) || !movesFor(existing).includes(status)) {
    return { ok: false, reason: "transition", current: existing.status };
  }

  // Somebody who turns up on another day than booked is here now: checking
  // them in (or starting their visit) moves it to now, so it is in today's
  // queue. Undoing the check-in puts it back where it was (below); the move is
  // in the visit's history either way.
  const arriving = status === "CHECKED_IN" || status === "IN_CONSULTATION";
  // Somebody assumed (or marked) not to be coming who turns up later the same
  // day: they are here now, so the visit moves to now and joins the queue in
  // arrival order, as a walk-in does. Only on its day.
  const lateArrival = existing.status === "NO_SHOW" && status === "CHECKED_IN";
  if (lateArrival && !isClinicToday(existing.scheduledAt)) return { ok: false, reason: "not-today" };
  const movedFrom = arriving && (lateArrival || !isClinicToday(existing.scheduledAt)) ? existing.scheduledAt : null;

  // Undoing a check-in that moved the visit: back to the time it had.
  let restoreTo: typeof existing.scheduledAt | null = null;
  if (existing.status === "CHECKED_IN" && status === "CONFIRMED") {
    const moved = await orm.AppointmentEvent
      .select("previousScheduledAt")
      .where((e) => e.appointmentId.eq(appointmentId))
      .where((e) => e.status.eq("CHECKED_IN"))
      .orderBy((e) => e.at.desc())
      .first();
    restoreTo = moved?.previousScheduledAt ?? null;
  }

  const changes = {
    status,
    ...queueStamps(status, existing, now),
    ...(movedFrom ? { scheduledAt: now } : {}),
    ...(restoreTo ? { scheduledAt: restoreTo } : {}),
    // A person deciding this is not the clinic assuming it, so an earlier
    // assumption stops applying the moment anybody says otherwise.
    autoNoShowAt: null,
    updatedAt: now,
  };
  const event = {
    id: newId(),
    appointmentId,
    clinicId: actor.clinicId,
    status,
    previousScheduledAt: movedFrom ?? (restoreTo ? existing.scheduledAt : null),
    byId: actor.accountId,
    at: now,
  };

  /**
   * Cancelling frees the slot, so someone else can be booked into it. Putting
   * this appointment back therefore re-claims a time that may no longer be
   * free, which makes it a booking — and every booking goes through the lock
   * and the overlap check. Skipping them here was how a restored cancellation
   * could quietly land on top of the visit booked to replace it.
   *
   * Every other move is safe without the lock: cancelling and marking a
   * no-show give a slot up, and the rest are between statuses that all hold
   * the slot this appointment already had.
   */
  // Putting an early check-in back re-claims its old slot, which may have gone
  // since: that is a booking, so it takes the lock and the overlap check too.
  // A late arrival joins the queue whatever the book says about now: no overlap check.
  if (((occupiesSlot(existing.status) || !occupiesSlot(status)) && !restoreTo) || lateArrival) {
    await db.transaction(async (tx) => {
      await tx.orm.public.Appointment
        .where((a) => a.id.eq(appointmentId))
        .where((a) => a.clinicId.eq(actor.clinicId))
        .update(changes);
      await tx.orm.public.AppointmentEvent.create(event);
    });
  } else {
    const clash = await db.transaction(async (tx) => {
      await lockDoctorSchedule(tx, existing.doctorId);

      const found = await findClash(
        tx,
        existing.doctorId,
        instantFromDb(restoreTo ?? existing.scheduledAt),
        existing.durationMinutes,
        appointmentId,
      );
      if (found) return found;

      await tx.orm.public.Appointment
        .where((a) => a.id.eq(appointmentId))
        .where((a) => a.clinicId.eq(actor.clinicId))
        .update(changes);
      await tx.orm.public.AppointmentEvent.create(event);
      return null;
    });
    if (clash) {
      return {
        ok: false,
        reason: "clash",
        clashId: clash.id,
        clashWith: fullName(clash.patient),
        clashAt: instantFromDb(clash.scheduledAt),
        restoring: Boolean(restoreTo),
      };
    }
  }

  revalidateAppointmentPages(appointmentId);
  return { ok: true, status };
}

/** What may be done with a visit now: `movesFrom`, with its day and whether its time is still to come. */
export function movesFor(a: { status: AppointmentStatus; scheduledAt: string }, now = new Date()) {
  const stillDue = instantFromDb(a.scheduledAt).getTime() + NO_SHOW_GRACE_MINUTES * 60_000 > now.getTime();
  return movesFrom(a.status, isClinicToday(a.scheduledAt, now), stillDue);
}

/** Whether a stored visit time falls on today, by the clinic's clock. */
export function isClinicToday(scheduledAt: string, now = new Date()) {
  return dayKey(instantFromDb(scheduledAt)) === dayKey(now);
}
