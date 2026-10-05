import type { Metadata } from "next";
import { CrumbName } from "@/components/crumb-names";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setAppointmentStatus } from "@/app/actions/appointments";
import { requireStaff } from "@/lib/auth";
import { visitHistory } from "@/lib/visit-history";
import { VisitHistory } from "@/components/visit-history";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, formatDateTime, formatTime, instantFromDb } from "@/lib/datetime";
import {
  ageFrom,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  APPOINTMENT_TYPE_LABELS,
  BOOKING_SOURCE_LABELS,
  fullName,
  REMINDER_LABELS,
  SERVICE_LABELS,
  statusActionLabel,
  VISIT_PRIORITY_LABELS,
} from "@/lib/domain";
import { movesFor } from "@/lib/booking";
import type { AppointmentStatus } from "@/lib/enums";
import { Badge, buttonClass, Card, CardHeader, Detail, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Appointment" };

/**
 * The moves the front desk may make.
 *
 * Beginning and ending a consultation are assertions that something clinical
 * happened, so they are not offered here and the action refuses them for a
 * secretary as well — the buttons are the smaller half of that.
 */
const DESK_STATUSES: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CANCELLED",
  "NO_SHOW",
];

export default async function DeskAppointmentPage({
  params,
  searchParams,
}: PageProps<"/desk/appointments/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const { blocked } = await searchParams;

  const appointment = await orm.Appointment
    .include("patient", (p) =>
      p
        .select("id", "firstName", "middleName", "lastName", "dateOfBirth", "contactNumber", "patientNumber")
        .include("household", (h) => h.select("id", "name", "contactNumber")),
    )
    .include("doctor", (d) => d.select("id", "fullName"))
    .where((a) => a.id.eq(id))
    .where((a) => a.clinicId.eq(staff.clinicId))
    .first();
  if (!appointment) notFound();

  const { patient } = appointment;
  const history = await visitHistory(appointment.id, staff.clinicId);
  const moves = movesFor(appointment).filter(
    (next) => staff.role !== "SECRETARY" || DESK_STATUSES.includes(next),
  );

  return (
    <div className="space-y-3">
      <CrumbName id={appointment.id} name={`Visit · ${fullName(appointment.patient)}`} />
      <PageHeader
        title={formatDateTime(instantFromDb(appointment.scheduledAt))}
        subtitle={
          <>
            {fullName(patient)} · {ageFrom(calendarDateFromDb(patient.dateOfBirth))}
            {patient.patientNumber ? ` · ${patient.patientNumber}` : ""} · with{" "}
            {appointment.doctor.fullName}
          </>
        }
        actions={
          <Link href={`/desk/appointments/${appointment.id}/edit`} className={buttonClass("secondary")}>
            Reschedule
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge dot tone={APPOINTMENT_STATUS_TONE[appointment.status]}>
          {APPOINTMENT_STATUS_LABELS[appointment.status]}
        </Badge>
        {appointment.autoNoShowAt ? <Badge tone="warn">Marked automatically</Badge> : null}
      </div>

      {blocked === "not-today" ? (
        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
          <p className="font-medium">Not today&rsquo;s visit.</p>
          <p className="mt-0.5 text-ink-muted">Check people in on the day of their visit. Nothing was changed.</p>
        </div>
      ) : null}
      {blocked === "role" ? (
        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
          <p className="font-medium">That is not a front-desk change.</p>
          <p className="mt-0.5 text-ink-muted">
            Starting and finishing a consultation are the doctor&rsquo;s to record.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-3">
          <Card>
            <CardHeader title="The visit" />
            <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <Detail label="Service" value={SERVICE_LABELS[appointment.service]} />
              <Detail label="Reason" value={appointment.reason} />
              <Detail label="Type" value={APPOINTMENT_TYPE_LABELS[appointment.visitType]} />
              <Detail label="Priority" value={VISIT_PRIORITY_LABELS[appointment.priority]} />
              <Detail label="Room" value={appointment.room} />
              <Detail label="Booked as" value={BOOKING_SOURCE_LABELS[appointment.source]} />
              {/* The desk books, so the desk is who needs to know whether anything
                  goes out the day before. */}
              <Detail label="Reminder" value={REMINDER_LABELS[appointment.reminderPreference]} />
              <Detail
                label="Arrived"
                value={appointment.arrivedAt ? formatTime(instantFromDb(appointment.arrivedAt)) : null}
              />
              <Detail
                label="Contact"
                value={patient.contactNumber ?? patient.household.contactNumber}
              />
            </dl>
            {/* Scheduling notes are for the desk; internal notes are not shown
                here, and neither is anything clinical. */}
            {appointment.notes ? (
              <div className="border-t border-border px-5 py-4 text-sm">
                <p className="font-medium">Scheduling notes</p>
                <p className="mt-1 text-ink-muted">{appointment.notes}</p>
              </div>
            ) : null}
          </Card>

          {moves.length > 0 ? (
            <Card>
              <CardHeader title="Move it along" />
              <div className="flex flex-wrap gap-2 px-5 py-4">
                {moves.map((next, i) => (
                  <form key={next} action={setAppointmentStatus}>
                    <input type="hidden" name="appointmentId" value={appointment.id} />
                    <input type="hidden" name="status" value={next} />
                    <button className={buttonClass(i === 0 ? "primary" : "secondary")}>
                      {statusActionLabel(appointment.status, next)}
                    </button>
                  </form>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
          <VisitHistory entries={history} />
      </div>
    </div>
  );
}
