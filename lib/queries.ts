import "server-only";
import { orm } from "@/src/prisma/db";
import {
  calendarDateToDb,
  dayKey,
  formatDateTime,
  instantFromDb,
  instantToDb,
  startOfClinicDay,
} from "./datetime";
import { and, or } from "@prisma/orm-postgres/orm-client";
import { holidaysBetween } from "@/lib/holidays-ph";
import { fullName, SERVICE_LABELS } from "./domain";
import type { DuplicateMatch } from "./validation";
import { DEFAULT_SCHEDULE, type Schedule } from "./availability";
import { caredForIds, idsOrNone } from "./care";
import { heldSlots } from "./held-slots";
import { addDays, minuteOfDay, occupiesSlot } from "./scheduling";
import { earliestBookableDay, latestBookableDay } from "./availability";
import type { AppointmentListItem } from "@/components/appointment-list";
import type { BusyByDay, FollowUpOptions, PatientOption } from "./form-defaults";

/**
 * The columns and relation branches every appointment list renders. Prisma 8
 * composes includes as callbacks rather than a shareable object literal, so the
 * shape lives in this one function and each page adds its own filters to it.
 */
export function appointmentListQuery() {
  return orm.Appointment
    .select(
      "id",
      "scheduledAt",
      "durationMinutes",
      "service",
      "reason",
      "status",
      // Both are already on the row and both change how a visit is prepared for,
      // so a list that hides them makes the reader open each one to find out.
      "priority",
      "visitType",
      "patientConfirmedAt",
    )
    .include("patient", (p) =>
      p
        .select("id", "firstName", "middleName", "lastName")
        .include("household", (h) => h.select("id", "name")),
    )
    .include("medicalRecord", (r) => r.select("id"));
}

/** One row of {@link appointmentListQuery}, with its instant back in `Date` form. */
export function toAppointmentListItem(
  row: Awaited<ReturnType<ReturnType<typeof appointmentListQuery>["all"]>>[number],
): AppointmentListItem {
  return {
    ...row,
    scheduledAt: instantFromDb(row.scheduledAt),
    patientConfirmedAt: row.patientConfirmedAt ? instantFromDb(row.patientConfirmedAt) : null,
  };
}

/** Every patient this doctor can book, ready for a grouped <select>. */
/** The patients a doctor cares for (lib/care.ts), for pickers of clinical work. */
export async function patientOptions(doctorId: string): Promise<PatientOption[]> {
  const doctor = await orm.Doctor.select("id", "clinicId").where((d) => d.id.eq(doctorId)).first();
  if (!doctor?.clinicId) return [];
  const mine = await caredForIds({ id: doctor.id, clinicId: doctor.clinicId });
  const patients = await orm.Patient
    .select("id", "firstName", "middleName", "lastName")
    .include("household", (h) => h.select("name"))
    .where((p) => p.clinicId.eq(doctor.clinicId!))
    .where((p) => p.id.in(idsOrNone(mine)))
    .where((p) => p.archivedAt.isNull())
    .all();

  // The ORM orders by columns of the queried model, so the household name — which
  // lives on the joined row — is sorted here instead. This is one doctor's
  // patients, so the list is small enough that the sort costs nothing.
  return patients
    .map((p) => ({ id: p.id, label: fullName(p), householdName: p.household.name }))
    .sort(
      (a, b) =>
        a.householdName.localeCompare(b.householdName) || a.label.localeCompare(b.label),
    );
}

async function doctorClinic(doctorId: string) {
  const d = await orm.Doctor.select("clinicId").where((x) => x.id.eq(doctorId)).first();
  return d?.clinicId ?? "";
}

/** Every current patient of a clinic, for booking: any of them, with any of its doctors. */
export async function clinicPatientOptions(clinicId: string): Promise<PatientOption[]> {
  const patients = await orm.Patient
    .select("id", "firstName", "middleName", "lastName")
    .include("household", (h) => h.select("name"))
    .where((p) => p.clinicId.eq(clinicId))
    .where((p) => p.archivedAt.isNull())
    .all();
  return patients
    .map((p) => ({ id: p.id, label: fullName(p), householdName: p.household.name }))
    .sort((a, b) => a.householdName.localeCompare(b.householdName) || a.label.localeCompare(b.label));
}

/**
 * Everything the booking form needs to offer slots without a round-trip: who can
 * be booked, which minutes of each day are already taken, and which earlier
 * visits a follow-up could point at.
 *
 * The whole bookable window is sent at once rather than fetched per date. For a
 * single doctor that is a few hundred rows, and it makes changing the date or
 * the service instant instead of a loading state.
 */
export async function bookingFormData(
  doctorId: string,
  excludeAppointmentId?: string,
  /** The desk's form: every patient of the clinic, not only this doctor's. */
  options: { clinicId?: string } = {},
) {
  const now = new Date();
  const schedule = await loadSchedule(doctorId);
  const earliest = earliestBookableDay(schedule, now);
  const latest = latestBookableDay(schedule, now);

  // A walk-in may be booked today, so today's bookings have to be loaded even
  // though a scheduled booking could not land there. The busy window therefore
  // starts at today, not at the earliest bookable day.
  const walkInEarliest = dayKey(now);
  const windowStart = instantToDb(startOfClinicDay(walkInEarliest));
  const windowEnd = instantToDb(startOfClinicDay(addDays(latest, 1)));

  let bookedQuery = orm.Appointment
    .select("scheduledAt", "durationMinutes", "status")
    .where((a) => a.doctorId.eq(doctorId))
    .where((a) => a.scheduledAt.gte(windowStart))
    .where((a) => a.scheduledAt.lt(windowEnd));

  let previousQuery = orm.Appointment
    .select("id", "patientId", "scheduledAt", "service")
    .where((a) => a.doctorId.eq(doctorId))
    .where((a) => a.scheduledAt.lt(instantToDb(now)))
    .orderBy((a) => a.scheduledAt.desc())
    .limit(300);

  if (excludeAppointmentId) {
    bookedQuery = bookedQuery.where((a) => a.id.neq(excludeAppointmentId));
    previousQuery = previousQuery.where((a) => a.id.neq(excludeAppointmentId));
  }

  const [patients, booked, previous] = await Promise.all([
    // Any of the clinic's patients can be booked with any of its doctors.
    clinicPatientOptions(options.clinicId ?? (await doctorClinic(doctorId))),
    bookedQuery.all(),
    previousQuery.all(),
  ]);

  const busyByDay: BusyByDay = {};
  for (const a of booked) {
    if (!occupiesSlot(a.status)) continue; // a cancelled visit frees its time
    const scheduledAt = instantFromDb(a.scheduledAt);
    const start = minuteOfDay(scheduledAt);
    (busyByDay[dayKey(scheduledAt)] ??= []).push({ start, end: start + a.durationMinutes });
  }

  // An early check-in still holds its old time, until the consultation starts.
  const held = await heldSlots(doctorId, startOfClinicDay(walkInEarliest), startOfClinicDay(addDays(latest, 1)), {
    ignoreAppointmentId: excludeAppointmentId,
  });
  for (const h of held) {
    const start = minuteOfDay(h.scheduledAt);
    (busyByDay[dayKey(h.scheduledAt)] ??= []).push({ start, end: start + h.durationMinutes });
  }

  const followUps: FollowUpOptions = {};
  for (const a of previous) {
    (followUps[a.patientId] ??= []).push({
      id: a.id,
      label: `${formatDateTime(instantFromDb(a.scheduledAt))} — ${SERVICE_LABELS[a.service]}`,
    });
  }

  return {
    patients,
    busyByDay,
    followUps,
    schedule,
    window: { earliest, latest },
    // The same rules, with the lead time lifted — the patient is at the desk.
    walkInWindow: { earliest: walkInEarliest, latest },
    // The clinic's own day and minute. The walk-in window includes today, so
    // the form needs this to stop offering slots the day has already passed —
    // and it must be the clinic's clock rather than the visitor's.
    now: { key: walkInEarliest, minute: minuteOfDay(now) },
  };
}


/**
 * Everything the document request form offers: who can be named, and which of
 * their visits a document could be drawn from.
 *
 * Archived visits are left out — a document should not cite a record that has
 * been taken out of the chart.
 */
export async function documentFormData(doctorId: string) {
  const [patients, records] = await Promise.all([
    patientOptions(doctorId),
    orm.MedicalRecord
      .select("id", "patientId", "visitDate", "chiefComplaint")
      .where((r) => r.doctorId.eq(doctorId))
      .where((r) => r.archivedAt.isNull())
      .orderBy((r) => r.visitDate.desc())
      .limit(500)
      .all(),
  ]);

  const visits: Record<string, { id: string; label: string }[]> = {};
  for (const r of records) {
    (visits[r.patientId] ??= []).push({
      id: r.id,
      label: `${formatDateTime(instantFromDb(r.visitDate))} — ${r.chiefComplaint || "Untitled"}`,
    });
  }

  return { patients, visits };
}

/**
 * Records whose follow-up has been asked for but never booked. The explicit
 * `followUpAppointmentId` link is what makes this exact — inferring it from
 * "is there an appointment near that date" would quietly drop real ones.
 */
export async function followUpsDue(doctorId: string, horizonDays = 14) {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + horizonDays);
  const by = calendarDateToDb(horizon);

  const shape = () =>
    orm.MedicalRecord
      .select("id", "followUpDate", "followUpClosedAt", "visitDate", "chiefComplaint")
      .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
      .include("followUpAppointment", (a) => a.select("id", "status", "scheduledAt"))
      .where((r) => r.doctorId.eq(doctorId))
      .where((r) => r.followUpDate.isNotNull())
      .where((r) => r.followUpDate.lte(by))
      .where((r) => r.followUpClosedAt.isNull())
      // A visit taken out of the chart does not go on asking for a follow-up.
      .where((r) => r.archivedAt.isNull());

  // Two passes rather than one `OR`: a follow-up is outstanding either because
  // nothing was ever booked, or because what was booked fell through. The
  // combinators that would express this as a single predicate are not on the
  // public façade yet, and two indexed reads are cheaper than being clever.
  const [neverBooked, fellThrough] = await Promise.all([
    shape()
      .where((r) => r.followUpAppointmentId.isNull())
      .orderBy((r) => r.followUpDate.asc())
      .all(),
    shape()
      .where((r) => r.followUpAppointment.some((a) => a.status.in(["CANCELLED", "NO_SHOW"])))
      .orderBy((r) => r.followUpDate.asc())
      .all(),
  ]);

  return [...neverBooked, ...fellThrough].sort((a, b) =>
    (a.followUpDate ?? "").localeCompare(b.followUpDate ?? ""),
  );
}

export type DayHours = { weekday: number; openMinute: number; closeMinute: number };

/** The clinic's own opening hours, by weekday. Empty: the clinic sets no limit. */
export async function loadClinicHours(clinicId: string): Promise<DayHours[]> {
  const rows = await orm.ClinicOpeningHours
    .select("weekday", "openMinute", "closeMinute")
    .where((h) => h.clinicId.eq(clinicId))
    .all();
  return rows.sort((a, b) => a.weekday - b.weekday);
}

/**
 * A doctor's days trimmed to the clinic's: a day the clinic is shut goes, and
 * the rest are cut to the clinic's opening and closing. No clinic hours: the
 * doctor's own, unchanged.
 */
export function withinClinicHours(doctorDays: DayHours[], clinicDays: DayHours[]): DayHours[] {
  if (clinicDays.length === 0) return doctorDays;
  return doctorDays.flatMap((d) => {
    const c = clinicDays.find((x) => x.weekday === d.weekday);
    if (!c) return [];
    const openMinute = Math.max(d.openMinute, c.openMinute);
    const closeMinute = Math.min(d.closeMinute, c.closeMinute);
    return closeMinute > openMinute ? [{ weekday: d.weekday, openMinute, closeMinute }] : [];
  });
}

/**
 * A doctor's schedule, as the availability rules need it.
 *
 * A clinic that has configured nothing gets `DEFAULT_SCHEDULE`, which matches
 * the constants this used to be — so behaviour is unchanged until someone
 * changes something.
 */
export async function loadSchedule(doctorId: string): Promise<Schedule> {
  const [settings, hours, breaks, closures, durations] = await Promise.all([
    orm.ScheduleSettings
      .select("slotStepMinutes", "minLeadMinutes", "maxLeadDays", "defaultDurationMinutes", "observeHolidays")
      .where((s) => s.doctorId.eq(doctorId))
      .first(),
    orm.ClinicHours
      .select("weekday", "openMinute", "closeMinute")
      .where((h) => h.doctorId.eq(doctorId))
      .orderBy((h) => h.weekday.asc())
      .all(),
    orm.ClinicBreak
      .select("weekday", "startMinute", "endMinute", "label")
      .where((b) => b.doctorId.eq(doctorId))
      .all(),
    orm.ClinicClosure
      .select("startsOn", "endsOn", "startMinute", "endMinute", "reason", "repeat")
      .where((c) => c.doctorId.eq(doctorId))
      .all(),
    orm.ServiceDuration
      .select("service", "minutes")
      .where((d) => d.doctorId.eq(doctorId))
      .all(),
  ]);

  // The doctor's week, kept inside the clinic's own opening hours (when the
  // clinic has set them): a doctor can't be booked while the clinic is shut.
  const doctor = await orm.Doctor.select("clinicId").where((d) => d.id.eq(doctorId)).first();
  const clinicWeek = doctor?.clinicId ? await loadClinicHours(doctor.clinicId) : [];
  const own = hours.length > 0 ? hours : DEFAULT_SCHEDULE.hours;

  return {
    // An unconfigured week means the defaults, not a clinic that never opens.
    hours: withinClinicHours(own, clinicWeek),
    breaks,
    // Philippine holidays count as whole days off unless the doctor works them.
    closures:
      settings?.observeHolidays === false
        ? closures
        : [
            ...closures,
            ...holidaysBetween(addDays(dayKey(new Date()), -1), (settings?.maxLeadDays ?? DEFAULT_SCHEDULE.maxLeadDays) + 31).map(
              (h) => ({ startsOn: h.date, endsOn: h.date, startMinute: null, endMinute: null, reason: `${h.name} (holiday)`, repeat: "NONE" }),
            ),
          ],
    slotStepMinutes: settings?.slotStepMinutes ?? DEFAULT_SCHEDULE.slotStepMinutes,
    minLeadMinutes: settings?.minLeadMinutes ?? DEFAULT_SCHEDULE.minLeadMinutes,
    maxLeadDays: settings?.maxLeadDays ?? DEFAULT_SCHEDULE.maxLeadDays,
    defaultDurationMinutes:
      settings?.defaultDurationMinutes ?? DEFAULT_SCHEDULE.defaultDurationMinutes,
    serviceDurations: Object.fromEntries(durations.map((d) => [d.service, d.minutes])),
  };
}

/**
 * Patients who might already be the person being registered.
 *
 * Three signals, any of which is worth a second look: the same name and date of
 * birth, the same phone number, or the same email. Nothing is merged — the
 * matches go back to the form for a person to judge, which is the only safe
 * way to treat a possible duplicate of a medical record.
 */
export async function findPossibleDuplicates(
  clinicId: string,
  candidate: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    contactNumber: string | null;
    email: string | null;
  },
  excludePatientId?: string,
): Promise<DuplicateMatch[]> {
  const phone = candidate.contactNumber?.replace(/\s+/g, "") || null;

  let query = orm.Patient
    .select("id", "patientNumber", "firstName", "middleName", "lastName", "dateOfBirth", "contactNumber", "email")
    .include("household", (h) => h.select("name"))
    .where((p) => p.clinicId.eq(clinicId))
    .where((p) =>
      or(
        and(
          p.firstName.ilike(candidate.firstName),
          p.lastName.ilike(candidate.lastName),
          p.dateOfBirth.eq(candidate.dateOfBirth),
        ),
        ...(phone ? [p.contactNumber.ilike(`%${phone}%`)] : []),
        ...(candidate.email ? [p.email.ilike(candidate.email)] : []),
      ),
    )
    .limit(10);

  if (excludePatientId) query = query.where((p) => p.id.neq(excludePatientId));

  return (await query.all()).map((p) => {
    const matchedOn: string[] = [];
    if (
      p.firstName.toLowerCase() === candidate.firstName.toLowerCase() &&
      p.lastName.toLowerCase() === candidate.lastName.toLowerCase() &&
      p.dateOfBirth === candidate.dateOfBirth
    ) {
      matchedOn.push("name and date of birth");
    }
    if (phone && p.contactNumber?.replace(/\s+/g, "") === phone) matchedOn.push("phone number");
    if (candidate.email && p.email?.toLowerCase() === candidate.email.toLowerCase()) {
      matchedOn.push("email");
    }
    return {
      id: p.id,
      patientNumber: p.patientNumber,
      name: fullName(p),
      dateOfBirth: p.dateOfBirth,
      householdName: p.household.name,
      matchedOn,
    };
  });
}
