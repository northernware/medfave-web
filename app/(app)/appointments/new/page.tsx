import type { Metadata } from "next";
import Link from "next/link";
import { createAppointment } from "@/app/actions/appointments";
import {
  AppointmentStatus,
  AppointmentType,
  BookingSource,
  ReminderPreference,
  ServiceType,
  VisitPriority,
} from "@/lib/enums";
import { requireDoctor } from "@/lib/auth";
import { bookingFormData } from "@/lib/queries";
import { fullDayClosure, hoursFor, type Schedule } from "@/lib/availability";
import { AppointmentForm } from "@/components/forms/appointment-form";
import { buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Book appointment" };

/**
 * The requested day, if the clinic could actually take it.
 *
 * This asks the clinic's own schedule. Using a fixed "closed on Sundays" rule
 * here let the page prefill a date the server would then refuse — a clinic that
 * shuts on Saturdays, or a holiday, sailed straight through.
 */
function usableDate(
  requested: unknown,
  window: { earliest: string; latest: string },
  schedule: Schedule,
) {
  if (typeof requested !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(requested)) return "";
  if (requested < window.earliest || requested > window.latest) return "";
  if (fullDayClosure(schedule, requested)) return "";
  return hoursFor(schedule, requested) ? requested : "";
}

export default async function NewAppointmentPage({ searchParams }: PageProps<"/appointments/new">) {
  const doctor = await requireDoctor();
  const { patientId, date, service, followUpFor, source } = await searchParams;
  const { patients, busyByDay, followUps, schedule, window, walkInWindow, now } = await bookingFormData(doctor.id);

  if (patients.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Book appointment" />
        <Card>
          <EmptyState
            title="No patients to book yet"
            description="Create a household and add its members first — then you can schedule them."
            action={
              <Link href="/households/new" className={buttonClass("primary")}>
                New household
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const preselected = typeof patientId === "string" && patients.some((p) => p.id === patientId);
  // A walk-in is judged against the walk-in window, which includes today.
  // Checking it against the scheduled window meant arriving here with today's
  // date threw it away and left the form empty.
  const walkIn = source === "WALK_IN";

  return (
    <div className="space-y-3">
      <PageHeader title="Book appointment" />
      <Card className="max-w-3xl p-5 sm:p-6">
        <AppointmentForm
          action={createAppointment}
          patients={patients}
          busyByDay={busyByDay}
          followUps={followUps}
          schedule={schedule}
          walkInWindow={walkInWindow}
          now={now}
          window={window}
          staffFields
          defaults={{
            patientId: preselected ? (patientId as string) : "",
            date: usableDate(date, walkIn ? walkInWindow : window, schedule),
            time: "",
            service:
              typeof service === "string" && service in ServiceType
                ? (service as ServiceType)
                : ServiceType.GENERAL_CONSULTATION,
            reason: "",
            type: AppointmentType.IN_PERSON,
            priority: VisitPriority.ROUTINE,
            // Staff booking on the patient's behalf, so it is already agreed.
            status:
              source === "WALK_IN" ? AppointmentStatus.CHECKED_IN : AppointmentStatus.CONFIRMED,
            // A "Register walk-in" link lands here already set to WALK_IN, which
            // opens today's dates and slots without another click.
            source:
              source === "WALK_IN" ? BookingSource.WALK_IN : BookingSource.STAFF,
            reminderPreference: ReminderPreference.NONE,
            previousAppointmentId: "",
            room: "",
            notes: "",
            internalNotes: "",
          }}
          submitLabel="Book appointment"
          cancelHref="/appointments"
          followUpForRecordId={typeof followUpFor === "string" ? followUpFor : undefined}
        />
      </Card>
    </div>
  );
}
