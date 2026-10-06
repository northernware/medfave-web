import type { Metadata } from "next";
import { CrumbName } from "@/components/crumb-names";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAppointment, setAppointmentStatus } from "@/app/actions/appointments";
import { requireDoctor } from "@/lib/auth";
import { visitHistory } from "@/lib/visit-history";
import { VisitHistory } from "@/components/visit-history";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, instantFromDb } from "@/lib/datetime";
import { formatDateTime, formatTime } from "@/lib/datetime";
import { NO_SHOW_GRACE_MINUTES } from "@/lib/no-show";
import {
  ageFrom,
  statusActionLabel,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  APPOINTMENT_TYPE_LABELS,
  BOOKING_SOURCE_LABELS,
  fullName,
  REMINDER_LABELS,
  SERVICE_DESCRIPTIONS,
  SERVICE_LABELS,
  VISIT_PRIORITY_LABELS,
  VISIT_PRIORITY_TONE,
} from "@/lib/domain";
import { movesFor } from "@/lib/booking";
import { AlertBanner, AllergyBanner } from "@/components/allergy-banner";
import { DELETE_PHRASES } from "@/lib/confirm-phrase";
import { DangerZone } from "@/components/danger-zone";
import { Badge, buttonClass, Card, CardHeader, Detail, PageHeader, Prose } from "@/components/ui";

export const metadata: Metadata = { title: "Appointment" };

/** "12 minutes early" / "5 minutes late" — the arrival, relative to the booking. */
function describeArrival(scheduledAt: Date, arrivedAt: Date) {
  const minutes = Math.round((arrivedAt.getTime() - scheduledAt.getTime()) / 60_000);
  if (Math.abs(minutes) < 5) return "on time";
  return minutes < 0 ? `${-minutes} minutes early` : `${minutes} minutes late`;
}



export default async function AppointmentPage({
  params,
  searchParams,
}: PageProps<"/appointments/[id]">) {
  const doctor = await requireDoctor();
  const { id } = await params;
  const { clash, blocked } = await searchParams;

  const appointment = await orm.Appointment
    .include("patient", (p) =>
      p
        .select("id", "firstName", "middleName", "lastName", "dateOfBirth", "allergyStatus")
        .include("allergies", (a) => a.select("id", "label", "reaction", "severity", "notes"))
        .include("alerts", (x) => x.select("id", "label", "notes").orderBy((y) => y.label.asc()))
        .include("household", (h) => h.select("id", "name")),
    )
    .include("medicalRecord", (r) => r.select("id"))
    .include("previousAppointment", (a) => a.select("id", "scheduledAt", "service"))
    .include("followUps", (a) =>
      a.select("id", "scheduledAt", "service").orderBy((x) => x.scheduledAt.asc()),
    )
    .where((a) => a.id.eq(id))
    .where((a) => a.doctorId.eq(doctor.id))
    .first();
  if (!appointment) notFound();

  const { patient } = appointment;
  const history = await visitHistory(appointment.id, doctor.clinicId);

  // Named rather than described: the reader's next question is "taken by whom".
  const blocking =
    typeof clash === "string" && clash
      ? await orm.Appointment
          .select("id", "scheduledAt")
          .include("patient", (p) => p.select("firstName", "middleName", "lastName"))
          .where((a) => a.id.eq(clash))
          .where((a) => a.doctorId.eq(doctor.id))
          .first()
      : null;

  return (
    <div className="space-y-3">
      <CrumbName id={appointment.id} name={`Visit · ${fullName(appointment.patient)}`} />
      <PageHeader
        title={fullName(patient)}
        subtitle={
          <>
            {formatDateTime(instantFromDb(appointment.scheduledAt))} · {appointment.durationMinutes} min ·{" "}
            <Link href={`/households/${patient.household.id}`} className="text-accent-ink hover:underline">
              {patient.household.name} household
            </Link>
          </>
        }
        actions={
          appointment.medicalRecord ? (
            <Link href={`/records/${appointment.medicalRecord.id}`} className={buttonClass("primary")}>
              Open note
            </Link>
          ) : (
            <Link
              href={`/records/new?patientId=${patient.id}&appointmentId=${appointment.id}`}
              className={buttonClass("primary")}
            >
              Write note
            </Link>
          )
        }
      />

      {/* The clinic assumed this one rather than anybody deciding it, so it
          says so, and offers the move that is almost always wanted next. */}
      {appointment.autoNoShowAt ? (
        <div className="rounded-lg border border-warn/40 bg-warn-tint px-4 py-3 text-sm">
          <p className="font-medium text-warn-ink">
            Marked as a no-show automatically{" "}
            {formatDateTime(instantFromDb(appointment.autoNoShowAt))}.
          </p>
          <p className="mt-0.5 text-ink-muted">
            Nobody checked this patient in within {NO_SHOW_GRACE_MINUTES} minutes of{" "}
            {formatTime(instantFromDb(appointment.scheduledAt))}, so the slot was given up. If
            they did attend, put the booking back; otherwise book them a new time.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Link
              href={`/appointments/new?patientId=${patient.id}&service=${appointment.service}`}
              className={buttonClass("primary")}
            >
              Book a new time
            </Link>
            <form action={setAppointmentStatus}>
              <input type="hidden" name="appointmentId" value={appointment.id} />
              <input type="hidden" name="status" value="CONFIRMED" />
              <button className={buttonClass("secondary")}>They did attend — restore</button>
            </form>
          </div>
        </div>
      ) : null}

      {/* Set when a status change was refused because it does not exist from
          where the visit currently is — a stale page, or a hand-made request. */}
      {blocked === "not-today" ? (
        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
          <p className="font-medium">Not today&rsquo;s visit.</p>
          <p className="mt-0.5 text-ink-muted">Check in and start a visit on its day. Nothing was changed.</p>
        </div>
      ) : blocked === "confirm" ? (
        <div className="rounded-lg border border-danger/30 bg-danger-tint px-4 py-3 text-sm">
          <p className="font-medium text-danger-ink">Not deleted.</p>
          <p className="mt-0.5 text-ink-muted">The appointment is still here: the confirmation phrase wasn&rsquo;t typed.</p>
        </div>
      ) : typeof blocked === "string" && blocked ? (
        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
          <p className="font-medium">That change is not available from here.</p>
          <p className="mt-0.5 text-ink-muted">
            The visit has moved on since the page was loaded. The buttons below are the moves it
            can make now.
          </p>
        </div>
      ) : null}

      {/* Set when putting this appointment back would have double-booked its
          slot. The status was left alone, and the booking in the way is named
          so the next move is obvious. */}
      {blocking ? (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
          <p className="font-medium text-danger-ink">
            This appointment was left as it was — its slot is taken.
          </p>
          <p className="mt-0.5 text-ink-muted">
            {formatDateTime(instantFromDb(blocking.scheduledAt))} is booked for{" "}
            <Link href={`/appointments/${blocking.id}`} className="font-medium underline">
              {fullName(blocking.patient)}
            </Link>
            . Reschedule one of them, then try again.
          </p>
        </div>
      ) : null}

      {/* The visit and what to do with it on the left; the clinic's side of it on the right. */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-3">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone={APPOINTMENT_STATUS_TONE[appointment.status]}>
                {APPOINTMENT_STATUS_LABELS[appointment.status]}
              </Badge>
              <Badge tone="neutral">{APPOINTMENT_TYPE_LABELS[appointment.visitType]}</Badge>
              {appointment.priority !== "ROUTINE" ? (
                <Badge tone={VISIT_PRIORITY_TONE[appointment.priority]}>
                  {VISIT_PRIORITY_LABELS[appointment.priority]}
                </Badge>
              ) : null}
              {appointment.medicalRecord ? <Badge tone="neutral">Documented</Badge> : null}
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail
                label="Service"
                value={
                  <>
                    {SERVICE_LABELS[appointment.service]}
                    <span className="mt-0.5 block text-xs text-ink-faint">
                      {SERVICE_DESCRIPTIONS[appointment.service]}
                    </span>
                  </>
                }
              />
              <Detail
                label="Patient"
                value={
                  <Link href={`/patients/${patient.id}`} className="text-accent-ink hover:underline">
                    {fullName(patient)}, {ageFrom(calendarDateFromDb(patient.dateOfBirth))}
                  </Link>
                }
              />
              <Detail label="Reason for visit" value={appointment.reason} />
              <Detail label="Room" value={appointment.room} />
              {/* When they were booked for and when they actually turned up are
                  different facts, so they are shown as different facts. */}
              <Detail
                label="Arrived"
                value={
                  appointment.arrivedAt ? (
                    <>
                      {formatDateTime(instantFromDb(appointment.arrivedAt))}
                      <span className="mt-0.5 block text-xs text-ink-faint">
                        {describeArrival(
                          instantFromDb(appointment.scheduledAt),
                          instantFromDb(appointment.arrivedAt),
                        )}
                      </span>
                    </>
                  ) : null
                }
              />
              <Detail
                label="Seen"
                value={
                  appointment.consultationStartedAt ? (
                    <>
                      {formatDateTime(instantFromDb(appointment.consultationStartedAt))}
                      {appointment.arrivedAt ? (
                        <span className="mt-0.5 block text-xs text-ink-faint">
                          after waiting{" "}
                          {Math.max(
                            0,
                            Math.floor(
                              (instantFromDb(appointment.consultationStartedAt).getTime() -
                                instantFromDb(appointment.arrivedAt).getTime()) /
                                60_000,
                            ),
                          )}{" "}
                          minutes
                        </span>
                      ) : null}
                    </>
                  ) : null
                }
              />
              <Detail
                label="Follows on from"
                value={
                  appointment.previousAppointment ? (
                    <Link
                      href={`/appointments/${appointment.previousAppointment.id}`}
                      className="text-accent-ink hover:underline"
                    >
                      {formatDateTime(instantFromDb(appointment.previousAppointment.scheduledAt))} —{" "}
                      {SERVICE_LABELS[appointment.previousAppointment.service]}
                    </Link>
                  ) : null
                }
              />
              <Detail
                label="Later follow-ups"
                value={
                  appointment.followUps.length > 0 ? (
                    <ul className="space-y-0.5">
                      {appointment.followUps.map((f) => (
                        <li key={f.id}>
                          <Link href={`/appointments/${f.id}`} className="text-accent-ink hover:underline">
                            {formatDateTime(instantFromDb(f.scheduledAt))} — {SERVICE_LABELS[f.service]}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null
                }
              />
            </dl>

            {appointment.notes ? (
              <div className="mt-4 border-t border-border pt-4">
                <Prose label="Scheduling notes" text={appointment.notes} />
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
              {/* Only the moves that exist from here. The first is the one the
                  visit is expected to make next, so it leads. */}
              {movesFor(appointment).map((next, i) => (
                <form key={next} action={setAppointmentStatus}>
                  <input type="hidden" name="appointmentId" value={appointment.id} />
                  <input type="hidden" name="status" value={next} />
                  <button className={buttonClass(i === 0 ? "primary" : "secondary")}>
                    {statusActionLabel(appointment.status, next)}
                  </button>
                </form>
              ))}
              {movesFor(appointment).length === 0 ? (
                <p className="text-sm text-ink-muted">
                  {appointment.status === "COMPLETED"
                    ? "This visit is finished. Its visit note is where anything further belongs."
                    : "Its time has passed. Book a new visit if they still need one."}
                </p>
              ) : null}
              <Link href={`/appointments/${appointment.id}/edit`} className={buttonClass("ghost")}>
                Reschedule
              </Link>
            </div>
          </Card>
          {/* Keep deletion beneath the visit actions, independent of history length. */}
          <DangerZone
            action={deleteAppointment}
            fieldName="appointmentId"
            fieldValue={appointment.id}
            summary="Delete this appointment"
            warning="Removes the booking entirely. If the visit happened, cancelling or marking it a no-show keeps a more honest history than deleting it."
            confirmLabel="Delete appointment"
            confirmPhrase={DELETE_PHRASES.appointment}
          />
        </div>
        <div className="space-y-3">
          {/* What to know before the visit, at the head of the clinic's side. */}
          <AllergyBanner status={patient.allergyStatus} allergies={patient.allergies} />
          <AlertBanner alerts={patient.alerts} />
          <Card>
            <CardHeader title="Clinic use" subtitle="Not shown to the patient." />
            <div className="px-5 py-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail label="Booking source" value={BOOKING_SOURCE_LABELS[appointment.source]} />
                <Detail
                  label="Reminder"
                  value={REMINDER_LABELS[appointment.reminderPreference]}
                />
              </dl>
              {appointment.internalNotes ? (
                <div className="mt-4 border-t border-border pt-4">
                  <Prose label="Internal notes" text={appointment.internalNotes} />
                </div>
              ) : null}
            </div>
          </Card>
          <VisitHistory entries={history} />
        </div>
      </div>
    </div>
  );
}
