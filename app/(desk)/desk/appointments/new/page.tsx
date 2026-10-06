import type { Metadata } from "next";
import Link from "next/link";
import { createAppointment } from "@/app/actions/appointments";
import { requireStaff } from "@/lib/auth";
import { lastDoctorFor, pickDoctor } from "@/lib/clinic";
import { DoctorPicker, withParam } from "@/components/doctor-picker";
import { bookingFormData } from "@/lib/queries";
import { fullDayClosure, hoursFor, type Schedule } from "@/lib/availability";
import {
  AppointmentStatus,
  AppointmentType,
  BookingSource,
  ReminderPreference,
  ServiceType,
  VisitPriority,
} from "@/lib/enums";
import { AppointmentForm } from "@/components/forms/appointment-form";
import { buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Book appointment" };

/** The requested day, if the clinic could actually take it. */
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

export default async function DeskNewAppointmentPage({
  searchParams,
}: PageProps<"/desk/appointments/new">) {
  const staff = await requireStaff();
  const params = await searchParams;
  const { patientId, date, service, source } = params;

  // Whose diary: the doctor asked for, else the one this patient saw last, else
  // the only doctor. With several and no hint, the desk chooses first.
  const lastSeen = typeof patientId === "string" ? await lastDoctorFor(staff.clinicId, patientId) : null;
  const { doctorId, doctors } = await pickDoctor(staff.clinicId, params.doctor, staff.doctorId ?? lastSeen);
  const picker = (
    <DoctorPicker
      label="Booking with"
      doctors={doctors}
      selected={doctorId}
      hrefFor={(id) => withParam("/desk/appointments/new", params, "doctor", id)}
    />
  );

  if (doctors.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Book appointment" />
        <Card>
          <EmptyState
            title="No clinician to book with"
            description="This clinic has no doctor on file, so there is no diary to book into."
          />
        </Card>
      </div>
    );
  }

  if (!doctorId) {
    return (
      <div className="space-y-6">
        <PageHeader title={source === "WALK_IN" ? "Register walk-in" : "Book appointment"} subtitle="Choose the doctor first." />
        <Card className="max-w-3xl p-5 sm:p-6">{picker}</Card>
      </div>
    );
  }

  // The desk books any of the clinic's patients, for whichever doctor.
  const { patients, busyByDay, followUps, schedule, window, walkInWindow, now } =
    await bookingFormData(doctorId, undefined, { clinicId: staff.clinicId });

  if (patients.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Book appointment" />
        <Card>
          <EmptyState
            title="No patients to book yet"
            description="Register somebody first, then you can give them a time."
            action={
              <Link href="/desk/patients/new" className={buttonClass("primary")}>
                Add patient
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const walkIn = source === "WALK_IN";
  const preselected = typeof patientId === "string" && patients.some((p) => p.id === patientId);

  return (
    <div className="space-y-3">
      <PageHeader title={walkIn ? "Register walk-in" : "Book appointment"} />
      <Card className="space-y-6 p-5 sm:p-6">
        {picker}
        <AppointmentForm
          doctorId={doctorId}
          action={createAppointment}
          patients={patients}
          busyByDay={busyByDay}
          followUps={followUps}
          schedule={schedule}
          walkInWindow={walkInWindow}
          window={window}
          now={now}
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
            status: walkIn ? AppointmentStatus.CHECKED_IN : AppointmentStatus.CONFIRMED,
            source: walkIn ? BookingSource.WALK_IN : BookingSource.STAFF,
            reminderPreference: ReminderPreference.NONE,
            previousAppointmentId: "",
            room: "",
            notes: "",
            internalNotes: "",
          }}
          submitLabel={walkIn ? "Register walk-in" : "Book appointment"}
          cancelHref="/desk/appointments"
        />
      </Card>
    </div>
  );
}
