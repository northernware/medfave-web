import "server-only";
import { newId } from "@/lib/ids";
import { revalidatePath } from "next/cache";
import { orm } from "@/src/prisma/db";
import { formatDateTime, instantFromDb, instantToDb } from "@/lib/datetime";

/*
 * A patient's own changes to a visit they already have, shared by the app's
 * API (and any portal form). The clinic decides how late a patient may cancel
 * (`Clinic.patientCancelHours`); moving a visit is a request the clinic
 * accepts (lib/requests.ts, `rescheduleOf`).
 */

/** Statuses a patient may still cancel or move: not started, not over. */
export { canConfirm, CHANGEABLE, confirmWindow } from "@/lib/visit-day";
import { canConfirm, CHANGEABLE } from "@/lib/visit-day";

export async function cancelCutoffHours(clinicId: string): Promise<number> {
  const clinic = await orm.Clinic.select("patientCancelHours").where((c) => c.id.eq(clinicId)).first();
  return clinic?.patientCancelHours ?? 2;
}

/** The last moment the patient may cancel this visit themselves. */
export function cancelBy(scheduledAt: Date, hours: number) {
  return new Date(scheduledAt.getTime() - hours * 3_600_000);
}

export type PatientChange = { ok: true } | { ok: false; status: number; message: string };

/**
 * The patient cancelling a visit. Theirs only, still to come, and no later than
 * the clinic allows; after that the message says to ring the clinic. A move
 * they had asked for is withdrawn with it.
 */
export async function cancelByPatient(
  patient: { patientId: string; clinicId: string; accountId?: string },
  appointmentId: string,
): Promise<PatientChange> {
  const visit = await orm.Appointment
    .select("id", "status", "scheduledAt", "internalNotes")
    .where((a) => a.id.eq(appointmentId))
    .where((a) => a.patientId.eq(patient.patientId))
    .first();
  if (!visit) return { ok: false, status: 404, message: "Visit not found." };
  if (!(CHANGEABLE as readonly string[]).includes(visit.status)) {
    return { ok: false, status: 409, message: "This visit can no longer be cancelled here." };
  }
  const hours = await cancelCutoffHours(patient.clinicId);
  const at = instantFromDb(visit.scheduledAt);
  if (Date.now() > cancelBy(at, hours).getTime()) {
    return {
      ok: false,
      status: 409,
      message: `It's less than ${hours} hour${hours === 1 ? "" : "s"} before your visit. Please call the clinic to cancel.`,
    };
  }

  const now = new Date();
  const note = `Cancelled by the patient in the app, ${formatDateTime(now)}.`;
  await orm.Appointment.where((a) => a.id.eq(appointmentId)).update({
    status: "CANCELLED",
    internalNotes: visit.internalNotes ? `${visit.internalNotes}\n${note}` : note,
    updatedAt: instantToDb(now),
  });
  await orm.AppointmentEvent.create({
    id: newId(),
    appointmentId,
    clinicId: patient.clinicId,
    status: "CANCELLED",
    byId: patient.accountId ?? null,
    at: instantToDb(now),
  });
  await orm.AppointmentRequest
    .where((r) => r.rescheduleOfId.eq(appointmentId))
    .where((r) => r.status.eq("PENDING"))
    .update({ status: "WITHDRAWN", updatedAt: instantToDb(now) });

  revalidatePath("/desk");
  revalidatePath("/desk/appointments");
  revalidatePath("/dashboard");
  revalidatePath("/portal");
  return { ok: true };
}

/**
 * The patient saying they will come to a visit. Theirs only, booked and not
 * started, inside the confirm window. Saying it twice is fine: the first time
 * stands.
 */
export async function confirmByPatient(
  patient: { patientId: string },
  appointmentId: string,
): Promise<{ ok: true; confirmedAt: Date } | { ok: false; status: number; message: string }> {
  const visit = await orm.Appointment
    .select("id", "status", "scheduledAt", "patientConfirmedAt")
    .where((a) => a.id.eq(appointmentId))
    .where((a) => a.patientId.eq(patient.patientId))
    .first();
  if (!visit) return { ok: false, status: 404, message: "Visit not found." };
  if (visit.patientConfirmedAt) return { ok: true, confirmedAt: instantFromDb(visit.patientConfirmedAt) };
  const shaped = { status: visit.status, scheduledAt: instantFromDb(visit.scheduledAt), patientConfirmedAt: null };
  if (!canConfirm(shaped)) {
    return { ok: false, status: 409, message: "This visit can't be confirmed now." };
  }
  const now = new Date();
  await orm.Appointment.where((a) => a.id.eq(appointmentId)).update({ patientConfirmedAt: instantToDb(now) });
  revalidatePath("/desk");
  revalidatePath("/dashboard");
  return { ok: true, confirmedAt: now };
}

/** For move requests: when each visit being moved is now, by its id. */
export async function visitTimes(ids: (string | null)[]): Promise<Map<string, Date>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return new Map();
  const rows = await orm.Appointment.select("id", "scheduledAt").where((a) => a.id.in(wanted)).all();
  return new Map(rows.map((r) => [r.id, instantFromDb(r.scheduledAt)]));
}
