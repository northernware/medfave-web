"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDoctor, requireStaff } from "@/lib/auth";
import { db, orm } from "@/src/prisma/db";
import { instantFromDb, instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { DELETE_PHRASES, phraseTyped } from "@/lib/confirm-phrase";
import { isClinicToday,
  bookAppointment,
  changeAppointmentStatus,
  clashMessage,
  findClash,
  lockDoctorSchedule,
  queueStamps,
  resolveBooking,
} from "@/lib/booking";
import { appointmentSchema, toFieldErrors, type FormState } from "@/lib/validation";

/*
 * The booking rules themselves live in `lib/booking.ts`, shared with the app's
 * API. These actions read the form, call them, and decide where the browser
 * goes next.
 */

export async function createAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const result = await bookAppointment(
    staff,
    Object.fromEntries(formData),
    String(formData.get("followUpFor") ?? ""),
  );
  if (!result.ok) return result;
  redirect(`/appointments/${result.id}`);
}

export async function updateAppointment(
  appointmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = appointmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  const owned = await orm.Appointment
    .select("id", "doctorId", "scheduledAt")
    .where((a) => a.id.eq(appointmentId))
    .where((a) => a.clinicId.eq(staff.clinicId))
    .first();
  if (!owned) return { message: "That appointment no longer exists." };

  // Rescheduling keeps the clinician it was booked with; the desk is moving a
  // time, not reassigning a patient.
  const doctorId = owned.doctorId;
  const resolved = await resolveBooking(staff.clinicId, doctorId, parsed.data, appointmentId);
  if ("error" in resolved) return resolved.error;

  // Rescheduling races the same way a new booking does, and a service change
  // can lengthen the visit into a neighbour, so the same locked re-check applies.
  const outcome = await db.transaction(async (tx) => {
    await lockDoctorSchedule(tx, doctorId);

    const clash = await findClash(
      tx,
      doctorId,
      resolved.scheduledAt,
      resolved.durationMinutes,
      appointmentId,
    );
    if (clash) return { clash };

    const now = instantToDb(new Date());
    const moved = resolved.scheduledAt.getTime() !== instantFromDb(owned.scheduledAt).getTime();
    await tx.orm.public.Appointment
      .where((a) => a.id.eq(appointmentId))
      // The patient's "I'll be there" was for the old time.
      .update({ ...resolved.data, ...(moved ? { patientConfirmedAt: null } : {}), updatedAt: now });
    // A new time goes in the visit's history, with the one it had before.
    if (moved) {
      await tx.orm.public.AppointmentEvent.create({
        id: newId(),
        appointmentId,
        clinicId: staff.clinicId,
        status: null,
        previousScheduledAt: owned.scheduledAt,
        byId: staff.accountId,
        at: now,
      });
    }
    return { clash: null };
  });

  if (outcome.clash) return clashMessage(outcome.clash);

  revalidatePath("/appointments");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/appointments/${appointmentId}`);
  revalidatePath(`/patients/${parsed.data.patientId}`);
  redirect(`/appointments/${appointmentId}`);
}

/**
 * Takes the patient into the room and opens their notes in one move.
 *
 * Writing up a consultation used to leave the appointment sitting at "checked
 * in", so the queue still showed someone as waiting while the doctor was with
 * them. The state change and the notes are the same action now, because in the
 * clinic they are the same act.
 */
export async function startConsultation(formData: FormData) {
  // Deliberately the clinical gate: this opens the notes.
  const doctor = await requireDoctor();
  const appointmentId = String(formData.get("appointmentId") ?? "");
  if (!appointmentId) return;

  const appointment = await orm.Appointment
    .select("id", "patientId", "arrivedAt", "consultationStartedAt", "scheduledAt")
    .include("medicalRecord", (r) => r.select("id"))
    .where((a) => a.id.eq(appointmentId))
    .where((a) => a.doctorId.eq(doctor.id))
    .first();
  if (!appointment) return;
  // Seen on another day than booked: the visit moves to now, and its history says so.
  const now = instantToDb(new Date());
  const movedFrom = isClinicToday(appointment.scheduledAt) ? null : appointment.scheduledAt;
  await db.transaction(async (tx) => {
    await tx.orm.public.Appointment
      .where((a) => a.id.eq(appointmentId))
      .where((a) => a.doctorId.eq(doctor.id))
      .update({
        status: "IN_CONSULTATION",
        ...queueStamps("IN_CONSULTATION", appointment, now),
        ...(movedFrom ? { scheduledAt: now } : {}),
        updatedAt: now,
      });
    await tx.orm.public.AppointmentEvent.create({
      id: newId(),
      appointmentId,
      clinicId: doctor.clinicId,
      status: "IN_CONSULTATION",
      previousScheduledAt: movedFrom,
      byId: doctor.accountId,
      at: now,
    });
  });

  revalidatePath("/appointments");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/appointments/${appointmentId}`);

  // Straight to the notes: an existing record is resumed rather than duplicated.
  redirect(
    appointment.medicalRecord
      ? `/records/${appointment.medicalRecord.id}/edit`
      : `/records/new?patientId=${appointment.patientId}&appointmentId=${appointmentId}`,
  );
}

/** Quick status change from the detail page — no full form round-trip. */
export async function setAppointmentStatus(formData: FormData) {
  const staff = await requireStaff();
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const result = await changeAppointmentStatus(staff, appointmentId, String(formData.get("status") ?? ""));
  if (result.ok) return;

  // A plain form has nowhere to put an error, so the appointment's own page
  // says what happened.
  switch (result.reason) {
    case "role":
      redirect(`/desk/appointments/${appointmentId}?blocked=role`);
    case "transition":
      redirect(`/appointments/${appointmentId}?blocked=${result.current}`);
    case "clash":
      redirect(`/appointments/${appointmentId}?clash=${result.clashId}`);
    case "not-today":
      redirect(`${staff.role === "SECRETARY" ? "/desk" : ""}/appointments/${appointmentId}?blocked=not-today`);
  }
}

export async function deleteAppointment(formData: FormData) {
  const staff = await requireStaff();
  const appointmentId = String(formData.get("appointmentId") ?? "");
  if (!appointmentId) return;
  // Permanent: the phrase has to have been typed, whatever the page showed.
  if (!phraseTyped(formData, DELETE_PHRASES.appointment)) redirect(`/appointments/${appointmentId}?blocked=confirm`);

  await orm.Appointment
    .where((a) => a.id.eq(appointmentId))
    .where((a) => a.clinicId.eq(staff.clinicId))
    .delete();

  revalidatePath("/appointments");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect("/appointments");
}
