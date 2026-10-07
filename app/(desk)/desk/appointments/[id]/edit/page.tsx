import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { updateAppointment } from "@/app/actions/appointments";
import { requireStaff } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { bookingFormData } from "@/lib/queries";
import { dayKey, instantFromDb, toDateTimeLocalValue } from "@/lib/datetime";
import { fullName } from "@/lib/domain";
import { AppointmentForm } from "@/components/forms/appointment-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Reschedule" };

export default async function DeskReschedulePage({
  params,
}: PageProps<"/desk/appointments/[id]/edit">) {
  const staff = await requireStaff();
  const { id } = await params;

  const appointment = await orm.Appointment
    .include("patient", (p) => p.select("firstName", "middleName", "lastName"))
    .where((a) => a.id.eq(id))
    .where((a) => a.clinicId.eq(staff.clinicId))
    .first();
  if (!appointment) notFound();

  const scheduledAt = instantFromDb(appointment.scheduledAt);
  // Its own slot has to read as free, or the visit could not be saved at all.
  const { patients, busyByDay, followUps, schedule, window, walkInWindow, now } =
    await bookingFormData(appointment.doctorId, appointment.id);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <PageHeader title="Reschedule" subtitle={fullName(appointment.patient)} />
      <Card className="p-5 sm:p-6">
        <AppointmentForm
          action={updateAppointment.bind(null, appointment.id)}
          patients={patients}
          busyByDay={busyByDay}
          followUps={followUps}
          schedule={schedule}
          walkInWindow={walkInWindow}
          window={window}
          now={now}
          staffFields
          defaults={{
            patientId: appointment.patientId,
            date: dayKey(scheduledAt),
            time: toDateTimeLocalValue(scheduledAt).slice(11, 16),
            service: appointment.service,
            reason: appointment.reason,
            type: appointment.visitType,
            priority: appointment.priority,
            status: appointment.status,
            source: appointment.source,
            reminderPreference: appointment.reminderPreference,
            previousAppointmentId: appointment.previousAppointmentId ?? "",
            room: appointment.room ?? "",
            notes: appointment.notes ?? "",
            internalNotes: appointment.internalNotes ?? "",
          }}
          submitLabel="Save changes"
          cancelHref={`/desk/appointments/${appointment.id}`}
        />
      </Card>
    </div>
  );
}
