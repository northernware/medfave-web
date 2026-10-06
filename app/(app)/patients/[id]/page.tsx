import type { Metadata } from "next";
import { CrumbName } from "@/components/crumb-names";
import { DELETE_PHRASES } from "@/lib/confirm-phrase";
import Link from "next/link";
import { notFound } from "next/navigation";
import { archivePatient, deletePatient, reopenCondition, resolveCondition, restorePatient } from "@/app/actions/patients";
import { requireDoctor } from "@/lib/auth";
import { StartHousehold } from "@/components/start-household";
import { caresFor, logChartAccess, sharesCharts } from "@/lib/care";
import { orm } from "@/src/prisma/db";
import { appointmentListQuery, toAppointmentListItem } from "@/lib/queries";
import { calendarDateFromDb, instantFromDb } from "@/lib/datetime";
import { formatCalendarDate, formatDate, formatDateTime } from "@/lib/datetime";
import {
  ageFrom,
  bloodPressure,
  BLOOD_TYPE_LABELS,
  fullName,
  RELATIONSHIP_LABELS,
  SEX_LABELS,
} from "@/lib/domain";
import { AppointmentList } from "@/components/appointment-list";
import { AlertBanner, AllergyBanner } from "@/components/allergy-banner";
import { DangerZone } from "@/components/danger-zone";
import { Badge, Card, Detail, EmptyState, PageHeader, SectionTitle, buttonClass } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/patients/[id]">): Promise<Metadata> {
  const doctor = await requireDoctor();
  const { id } = await params;
  const patient = await orm.Patient
    .select("firstName", "middleName", "lastName")
    .where((p) => p.id.eq(id))
    .where((p) => p.clinicId.eq(doctor.clinicId))
    .first();
  return { title: patient ? fullName(patient) : "Patient" };
}

export default async function PatientPage({
  params,
  searchParams,
}: PageProps<"/patients/[id]">) {
  const doctor = await requireDoctor();
  const { id } = await params;
  const { blocked } = await searchParams;

  // Patients are the clinic's. Their details are open to every doctor there;
  // the chart only to doctors caring for them (lib/care.ts).
  if (!(await caresFor(doctor, id))) {
    const basic = await orm.Patient
      .select("id", "firstName", "middleName", "lastName", "dateOfBirth", "sex", "relationship", "contactNumber", "email", "patientNumber", "archivedAt")
      .include("household", (h) => h.select("id", "name"))
      .where((p) => p.id.eq(id))
      .where((p) => p.clinicId.eq(doctor.clinicId))
      .first();
    if (!basic) notFound();
    return <DetailsOnly patient={basic} />;
  }

  const shared = await sharesCharts(doctor.clinicId);
  const patient = await orm.Patient
    .include("household", (h) => h.select("id", "name", "contactNumber"))
    .include("allergies", (a) => a.select("id", "label", "reaction", "severity", "notes"))
    .include("conditions", (c) =>
      c.select("id", "label", "notes", "code", "resolvedAt").orderBy((x) => x.label.asc()),
    )
    .include("medications", (m) =>
      m
        .select("id", "label", "dosage", "frequency", "notes")
        .orderBy((x) => x.label.asc()),
    )
    .include("alerts", (a) => a.select("id", "label", "notes").orderBy((x) => x.label.asc()))
    .include("medicalRecords", (r) =>
      r
        .select(
          "id",
          "doctorId",
          "status",
          "archivedAt",
          "visitDate",
          "chiefComplaint",
          "assessment",
          "systolic",
          "diastolic",
          "temperatureC",
          "weightKg",
        )
        .include("prescriptions", (rx) => rx.count())
        .include("diagnoses", (d) => d.select("code", "title").orderBy((x) => x.position.asc()))
        // Visit notes are their author's (layer 3), unless the clinic shares charts.
        .where((x) => (shared ? x.clinicId.eq(doctor.clinicId) : x.doctorId.eq(doctor.id)))
        .orderBy((x) => x.visitDate.desc()),
    )
    // Counted for one decision only: whether this chart can still be deleted,
    // or has a history and can only be archived.
    .include("appointments", (a) => a.count())
    .include("documentRequests", (d) => d.count())
    .include("appointmentRequests", (r) => r.count())
    .where((p) => p.id.eq(id))
    .where((p) => p.clinicId.eq(doctor.clinicId))
    .first();
  if (!patient) notFound();

  // Every chart opened is logged, and shown to the doctors caring for them.
  await logChartAccess({ clinicId: doctor.clinicId, patientId: patient.id, accountId: doctor.accountId });
  const [authors, accessLog] = await Promise.all([
    orm.Doctor.select("id", "fullName").where((d) => d.clinicId.eq(doctor.clinicId)).all(),
    orm.ChartAccess
      .select("openedAt", "recordId")
      .include("account", (a) => a.select("fullName"))
      .where((c) => c.patientId.eq(patient.id))
      .orderBy((c) => c.openedAt.desc())
      .limit(12)
      .all(),
  ]);
  const authorName = (id: string) => authors.find((d) => d.id === id)?.fullName ?? "Another doctor";

  const appointments = (
    await appointmentListQuery()
      .where((a) => a.patientId.eq(patient.id))
      .where((a) => a.doctorId.eq(doctor.id))
      .orderBy((a) => a.scheduledAt.desc())
      .limit(8)
      .all()
  ).map(toAppointmentListItem);

  // An archived visit is out of the chart but not gone; it is listed apart,
  // below, so the history reads as what actually counts without pretending the
  // rest never happened.
  const visits = patient.medicalRecords.filter((r) => r.archivedAt === null);
  const archivedVisits = patient.medicalRecords.filter((r) => r.archivedAt !== null);

  const archived = patient.archivedAt !== null;
  // The rest of their household, for "Start their own household".
  const housemates = archived
    ? []
    : await orm.Patient
        .select("id", "firstName", "middleName", "lastName", "relationship")
        .where((p) => p.householdId.eq(patient.household.id))
        .where((p) => p.clinicId.eq(doctor.clinicId))
        .where((p) => p.id.neq(patient.id))
        .where((p) => p.archivedAt.isNull())
        .all();
  const archivedBy = patient.archivedById
    ? await orm.Account.select("fullName").where((a) => a.id.eq(patient.archivedById!)).first()
    : null;
  // The same test the delete action applies; the page only offers what the
  // action would accept.
  // Everyone's notes count here, not only the ones this doctor can read.
  const anyNotes = await orm.MedicalRecord.select("id").where((r) => r.patientId.eq(patient.id)).first();
  // Current conditions show; resolved ones are history, listed apart with their date.
  const activeConditions = patient.conditions.filter((c) => !c.resolvedAt);
  const pastConditions = patient.conditions.filter((c) => c.resolvedAt);
  const hasHistory =
    anyNotes !== null ||
    patient.appointments > 0 ||
    patient.documentRequests > 0 ||
    patient.appointmentRequests > 0 ||
    patient.allergies.length + activeConditions.length + patient.medications.length + patient.alerts.length > 0 ||
    patient.accountId !== null;

  return (
    <div className="space-y-3">
      <CrumbName id={patient.id} name={fullName(patient)} />
      <PageHeader
        title={fullName(patient)}
        subtitle={
          <>
            <Link href={`/households/${patient.household.id}`} className="text-accent-ink hover:underline">
              {patient.household.name} household
            </Link>
            {" · "}
            {RELATIONSHIP_LABELS[patient.relationship]} · {SEX_LABELS[patient.sex]} ·{" "}
            {ageFrom(calendarDateFromDb(patient.dateOfBirth))}
          </>
        }
        actions={
          archived ? (
            <>
              <form action={restorePatient}>
                <input type="hidden" name="patientId" value={patient.id} />
                <button className={buttonClass("primary")}>Restore chart</button>
              </form>
              {/* A certificate or an abstract is often wanted precisely after a
                  chart has been set aside, so this stays available. */}
              <Link href={`/documents/new?patientId=${patient.id}`} className={buttonClass("secondary")}>
                Request document
              </Link>
            </>
          ) : (
          <>
            <Link href={`/records/new?patientId=${patient.id}`} className={buttonClass("primary")}>
              Write note
            </Link>
            <Link href={`/appointments/new?patientId=${patient.id}`} className={buttonClass("secondary")}>
              Book
            </Link>
            <Link href={`/documents/new?patientId=${patient.id}`} className={buttonClass("secondary")}>
              Request document
            </Link>
            <Link href={`/patients/${patient.id}/edit`} className={buttonClass("secondary")}>
              Edit
            </Link>
          </>
          )
        }
      />

      {typeof blocked === "string" && blocked ? (
        <p
          role="alert"
          className="rounded-lg border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn-ink"
        >
          {blocked}
        </p>
      ) : null}

      {archived ? (
        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
          <p className="font-medium">
            Archived {formatDateTime(instantFromDb(patient.archivedAt!))}
            {archivedBy ? ` by ${archivedBy.fullName}` : ""}.
          </p>
          <p className="mt-0.5 text-ink-muted">
            {patient.archiveReason ?? "No reason was given."} Everything below is kept and
            readable; the chart is out of the working lists until it is restored.
            {patient.accountId ? " Their portal login still works." : ""}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* The timeline is what the doctor reads; it gets the width. */}
        <div className="space-y-6 lg:col-span-2">
      <section>
        <SectionTitle
          title="Visit history"
          hint={
            visits.length > 0
              ? `${visits.length} recorded${archivedVisits.length > 0 ? ` · ${archivedVisits.length} archived` : ""}`
              : archivedVisits.length > 0
                ? `${archivedVisits.length} archived`
                : undefined
          }
          action={
            archived ? undefined : (
              <Link
                href={`/records/new?patientId=${patient.id}`}
                className="font-medium text-accent-ink hover:underline"
              >
                Write note
              </Link>
            )
          }
        />
        <Card>
        {visits.length === 0 ? (
          <EmptyState
            title="No visits recorded"
            description="Document a consultation and it will build this patient's history."
            action={
              archived ? undefined : (
                <Link href={`/records/new?patientId=${patient.id}`} className={buttonClass("primary")}>
                  Write note
                </Link>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {visits.map((record) => {
              const bp = bloodPressure(record.systolic, record.diastolic);
              const vitals = [
                bp ? `BP ${bp}` : null,
                record.temperatureC != null ? `${record.temperatureC}°C` : null,
                record.weightKg != null ? `${record.weightKg} kg` : null,
              ].filter(Boolean);

              return (
                <li key={record.id} className="transition-colors hover:bg-surface-muted">
                  <Link href={`/records/${record.id}`} className="block px-4 py-3">
                    <div className="flex items-baseline gap-4">
                      <span className="tabular w-24 shrink-0 text-sm text-ink-muted">
                        {formatDate(instantFromDb(record.visitDate))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{record.chiefComplaint}</span>
                        {record.doctorId !== doctor.id ? (
                          <span className="mt-0.5 block text-xs text-ink-faint">by {authorName(record.doctorId)}</span>
                        ) : null}
                        {record.diagnoses.length > 0 ? (
                          <span className="mt-0.5 block truncate text-xs text-ink-muted">
                            {record.diagnoses.map((d) => `${d.code} ${d.title}`).join(" · ")}
                          </span>
                        ) : record.assessment ? (
                          <span className="mt-0.5 block truncate text-xs text-ink-muted">
                            {record.assessment}
                          </span>
                        ) : null}
                      </span>
                      {record.prescriptions > 0 ? (
                        <Badge tone="accent">
                          {record.prescriptions} Rx
                        </Badge>
                      ) : null}
                    </div>
                    {vitals.length > 0 ? (
                      <p className="tabular mt-1.5 pl-28 text-xs text-ink-faint">{vitals.join(" · ")}</p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        </Card>

        {/* Kept visible, and kept apart. Hiding archived visits entirely would
            make the chart quietly incomplete; mixing them in would make it
            wrong. */}
        {archivedVisits.length > 0 ? (
          <details className="mt-3 rounded-lg border border-border bg-surface">
            <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-medium text-ink-muted">
              {archivedVisits.length} archived{" "}
              {archivedVisits.length === 1 ? "visit" : "visits"}
            </summary>
            <ul className="divide-y divide-border border-t border-border">
              {archivedVisits.map((record) => (
                <li key={record.id} className="transition-colors hover:bg-surface-muted">
                  <Link
                    href={`/records/${record.id}`}
                    className="flex items-baseline gap-4 px-4 py-2.5 opacity-70"
                  >
                    <span className="tabular w-24 shrink-0 text-sm text-ink-muted">
                      {formatDate(instantFromDb(record.visitDate))}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {record.chiefComplaint || "Untitled draft"}
                    </span>
                    <Badge tone="neutral">Archived</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section>
        <SectionTitle
          title="Appointments"
          action={
            archived ? undefined : (
              <Link
                href={`/appointments/new?patientId=${patient.id}`}
                className="font-medium text-accent-ink hover:underline"
              >
                Book
              </Link>
            )
          }
        />
        <Card>
          <AppointmentList
            appointments={appointments}
            emptyTitle="No appointments"
            emptyDescription="Nothing booked for this patient, past or future."
          />
        </Card>
      </section>

        </div>

        {/* Standing clinical context, kept beside the timeline rather than above it. */}
        <aside className="space-y-3">
          <AlertBanner alerts={patient.alerts} />
          <AllergyBanner status={patient.allergyStatus} allergies={patient.allergies} />
      {housemates.length > 0 ? (
        <Card className="p-4">
          <StartHousehold patient={patient} others={housemates} back={`/patients/${patient.id}`} />
        </Card>
      ) : null}
      <Card className="p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <Detail label="Patient number" value={<span className="nums whitespace-nowrap">{patient.patientNumber ?? "—"}</span>} />
          <Detail label="Date of birth" value={formatCalendarDate(calendarDateFromDb(patient.dateOfBirth))} />
          <Detail label="Blood type" value={BLOOD_TYPE_LABELS[patient.bloodType]} />
          <Detail label="Contact" value={patient.contactNumber ?? patient.household.contactNumber} />
          <Detail label="Email" value={patient.email} />
          <Detail
            label="Primary contact"
            value={
              patient.emergencyContactName ? (
                <>
                  {patient.emergencyContactName}
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    {[patient.emergencyContactRelationship, patient.emergencyContactNumber]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </>
              ) : null
            }
          />
          <Detail
            label="Secondary contact"
            value={
              patient.emergencyContact2Name ? (
                <>
                  {patient.emergencyContact2Name}
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    {[patient.emergencyContact2Relationship, patient.emergencyContact2Number]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </>
              ) : null
            }
          />
          <Detail
            className="col-span-2"
            label="Current medications"
            value={
              patient.medications.length > 0 ? (
                <ul className="space-y-0.5">
                  {patient.medications.map((m) => (
                    <li key={m.id}>
                      {m.label}
                      {[m.dosage, m.frequency].filter(Boolean).length > 0 ? (
                        <span className="text-ink-faint">
                          {" "}
                          — {[m.dosage, m.frequency].filter(Boolean).join(", ")}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : patient.medicationStatus === "NONE_KNOWN" ? (
                "None"
              ) : (
                <span className="text-warn-ink">Not asked</span>
              )
            }
          />
          <Detail label="Visits recorded" value={visits.length} />
          <Detail
            className="col-span-2"
            label="Ongoing conditions"
            value={
              activeConditions.length > 0 ? (
                <span className="flex flex-wrap gap-1.5">
                  {activeConditions.map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pr-1 pl-2.5 text-xs font-medium text-accent-ink">
                      {c.code ? <span className="font-mono">{c.code}</span> : null}
                      {c.label}
                      <form action={resolveCondition}>
                        <input type="hidden" name="conditionId" value={c.id} />
                        <button
                          className="rounded-full px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-surface hover:text-ink"
                          aria-label={`Mark ${c.label} resolved`}
                          title="No longer current: move to past conditions"
                        >
                          Resolved
                        </button>
                      </form>
                    </span>
                  ))}
                </span>
              ) : patient.conditionStatus === "NONE_KNOWN" ? (
                "None known"
              ) : (
                <span className="text-warn-ink">Not asked</span>
              )
            }
          />
          {pastConditions.length > 0 ? (
            <Detail
              className="col-span-2"
              label="Past conditions"
              value={
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted">
                  {pastConditions.map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1">
                      {c.label} · resolved {formatDate(instantFromDb(c.resolvedAt!))}
                      <form action={reopenCondition}>
                        <input type="hidden" name="conditionId" value={c.id} />
                        <button className="text-xs text-accent-ink hover:underline" aria-label={`${c.label} is current again`}>
                          Reopen
                        </button>
                      </form>
                    </span>
                  ))}
                </span>
              }
            />
          ) : null}
        </dl>
        {activeConditions.some((c) => c.notes) ? (
          <dl className="mt-4 space-y-2 border-t border-border pt-4">
            {activeConditions
              .filter((c) => c.notes)
              .map((c) => (
                <div key={c.id}>
                  <dt className="text-xs font-medium text-ink-faint">{c.label}</dt>
                  <dd className="text-sm text-pretty">{c.notes}</dd>
                </div>
              ))}
          </dl>
        ) : null}
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Who opened this chart</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          {shared ? "This clinic shares charts between its doctors." : "Only doctors caring for this patient can open it."}
        </p>
        <ul className="mt-3 space-y-2.5 text-xs">
          {accessLog.map((entry, i) => (
            <li key={i}>
              <span className="block">
                {entry.account.fullName}
                {entry.recordId ? <span className="text-ink-faint"> · a visit note</span> : null}
              </span>
              <span className="tabular block text-ink-muted">{formatDateTime(instantFromDb(entry.openedAt))}</span>
            </li>
          ))}
        </ul>
      </Card>

        </aside>
      </div>

      {archived ? null : (
        <div className="lg:max-w-[calc(66.666%-0.75rem)]">
          {hasHistory ? (
            <DangerZone
              action={archivePatient}
              fieldName="patientId"
              fieldValue={patient.id}
              variant="secondary"
              summary="Archive this chart"
              warning={`Takes ${fullName(patient)} out of the working lists. Every note, its history, prescriptions and issued documents are kept, and restoring brings it all back. Upcoming appointments and pending requests have to be dealt with first.`}
              confirmLabel="Archive chart"
            >
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Reason</span>
                <input
                  name="archiveReason"
                  required
                  maxLength={300}
                  placeholder="Moved away, deceased, duplicate of another chart…"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
                />
              </label>
            </DangerZone>
          ) : (
            // Nothing clinical is attached, so this is the registered-by-mistake
            // case and deleting destroys nothing but the registration.
            <DangerZone
              action={deletePatient}
              fieldName="patientId"
              fieldValue={patient.id}
              summary="Delete this registration"
              warning={`${fullName(patient)} has no visits, appointments, requests or clinical lists, so deleting removes only the registration. Once anything is recorded, a chart can be archived but not deleted.`}
              confirmLabel="Delete registration"
              confirmPhrase={DELETE_PHRASES.registration}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A patient of the clinic this doctor hasn't cared for yet: who they are and
 * how to reach them, and a way to book them. Booking makes them this doctor's
 * patient too, and opens their chart.
 */
function DetailsOnly({
  patient,
}: {
  patient: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    dateOfBirth: string;
    sex: keyof typeof SEX_LABELS;
    relationship: keyof typeof RELATIONSHIP_LABELS;
    contactNumber: string | null;
    email: string | null;
    patientNumber: string | null;
    archivedAt: string | null;
    household: { id: string; name: string };
  };
}) {
  return (
    <div className="space-y-3">
      <CrumbName id={patient.id} name={fullName(patient)} />
      <PageHeader
        title={fullName(patient)}
        subtitle={`${patient.household.name} household · ${RELATIONSHIP_LABELS[patient.relationship]} · ${SEX_LABELS[patient.sex]} · ${ageFrom(calendarDateFromDb(patient.dateOfBirth))}`}
        actions={
          patient.archivedAt ? null : (
            <Link href={`/appointments/new?patientId=${patient.id}`} className={buttonClass("primary")}>
              Book
            </Link>
          )
        }
      />
      <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
        <p className="font-medium">A patient of the clinic you haven&rsquo;t seen yet.</p>
        <p className="mt-0.5 text-ink-muted">
          You can see their details and book them. Their chart opens once they&rsquo;re booked with you; other
          doctors&rsquo; visit notes stay with those doctors.
        </p>
      </div>
      <Card className="p-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Patient number" value={patient.patientNumber} />
          <Detail label="Date of birth" value={formatCalendarDate(calendarDateFromDb(patient.dateOfBirth))} />
          <Detail label="Phone" value={patient.contactNumber} />
          <Detail label="Email" value={patient.email} />
        </dl>
      </Card>
    </div>
  );
}
