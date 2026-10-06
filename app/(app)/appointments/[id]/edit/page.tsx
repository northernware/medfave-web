import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { updateAppointment } from "@/app/actions/appointments";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { instantFromDb } from "@/lib/datetime";
import { bookingFormData } from "@/lib/queries";
import { dayKey, toDateTimeLocalValue } from "@/lib/datetime";
import { AppointmentForm } from "@/components/forms/appointment-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Edit appointment" };

export default async function EditAppointmentPage({ params }: PageProps<"/appointments/[id]/edit">) {
  const doctor = await requireDoctor();
  const { id } = await params;

  const appointment = await orm.Appointment
    .where((a) => a.id.eq(id))
    .where((a) => a.doctorId.eq(doctor.id))
    .first();
  if (!appointment) notFound();

  const scheduledAt = instantFromDb(appointment.scheduledAt);

  // Excluding this booking is what lets its own slot read as free.
  const { patients, busyByDay, followUps, schedule, window, walkInWindow, now } = await bookingFormData(doctor.id, appointment.id);

  return (
    <div className="space-y-3">
      <PageHeader title="Edit appointment" />
      <Card className="max-w-3xl p-5 sm:p-6">
        <AppointmentForm
          action={updateAppointment.bind(null, appointment.id)}
          patients={patients}
          busyByDay={busyByDay}
          followUps={followUps}
          schedule={schedule}
          walkInWindow={walkInWindow}
          now={now}
          window={window}
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
          cancelHref={`/appointments/${appointment.id}`}
        />
      </Card>
    </div>
  );
}
