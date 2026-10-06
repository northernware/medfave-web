import type { Metadata } from "next";
import { ICD11_CREDIT } from "@/lib/diagnoses";
import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveMedicalRecord, restoreMedicalRecord } from "@/app/actions/records";
import { closeFollowUp, reopenFollowUp } from "@/app/actions/records";
import {
  followUpState,
  needsAction,
  FOLLOW_UP_LABELS,
  FOLLOW_UP_TONE,
  RETURNED_BY_LABELS,
} from "@/lib/follow-up";
import { requireDoctor } from "@/lib/auth";
import { canReadNote, logChartAccess } from "@/lib/care";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, formatDate, instantFromDb } from "@/lib/datetime";
import { formatCalendarDate, formatDateTime, toDateInputValue } from "@/lib/datetime";
import {
  ageFrom,
  bloodPressure,
  bmi,
  fullName,
  RECORD_STATUS_LABELS,
  RECORD_STATUS_TONE,
  SEX_LABELS,
} from "@/lib/domain";
import { changesBetween, parseSnapshot } from "@/lib/record-versions";
import { AlertBanner, AllergyBanner } from "@/components/allergy-banner";
import { DangerZone } from "@/components/danger-zone";
import { Badge, Card, CardHeader, Detail, PageHeader, Prose, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Visit note" };

/** Long prose in a change line is a wall; the point is which field moved. */
function brief(value: string, max = 110) {
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}

export default async function RecordPage({ params }: PageProps<"/records/[id]">) {
  const doctor = await requireDoctor();
  const { id } = await params;

  const record = await orm.MedicalRecord
    .include("patient", (p) =>
      p
        .select("id", "firstName", "middleName", "lastName", "dateOfBirth", "sex", "allergyStatus")
        .include("allergies", (a) => a.select("id", "label", "reaction", "severity", "notes"))
        .include("alerts", (x) => x.select("id", "label", "notes").orderBy((y) => y.label.asc()))
        .include("household", (h) => h.select("id", "name")),
    )
    .include("appointment", (a) => a.select("id", "scheduledAt", "reason"))
    .include("finalizedBy", (d) => d.select("id", "fullName"))
    .include("archivedBy", (d) => d.select("id", "fullName"))
    .include("versions", (v) =>
      v
        .select("id", "version", "snapshot", "reason", "createdAt")
        .include("author", (a) => a.select("id", "fullName"))
        .orderBy((x) => x.version.desc()),
    )
    .include("followUpAppointment", (a) => a.select("id", "scheduledAt", "status"))
    .include("diagnoses", (d) => d.select("code", "title").orderBy((x) => x.position.asc()))
    .include("prescriptions", (rx) =>
      rx
        .select("id", "drugName", "dosage", "frequency", "duration", "instructions")
        .orderBy((x) => x.createdAt.asc()),
    )
    .where((r) => r.id.eq(id))
    .where((r) => r.clinicId.eq(doctor.clinicId))
    .first();
  // Their author's, or any at a clinic that shares charts (lib/care.ts).
  if (!record || !(await canReadNote(doctor, record))) notFound();
  // Only the author changes, prints or archives a note; others read it.
  const mine = record.doctorId === doctor.id;
  const author = mine ? null : await orm.Doctor.select("fullName").where((d) => d.id.eq(record.doctorId)).first();
  await logChartAccess({ clinicId: doctor.clinicId, patientId: record.patientId, accountId: doctor.accountId, recordId: record.id });

  const { patient } = record;
  const draft = record.status === "DRAFT";
  const archived = record.archivedAt !== null;

  // Newest first for reading; each entry is compared against the one before it
  // in time, which is the next element in this order.
  const versions = record.versions.map((v) => ({
    ...v,
    createdAt: instantFromDb(v.createdAt),
    parsed: parseSnapshot(v.snapshot),
  }));

  // Derived on read from the linked appointment's status — never stored.
  const followUp = followUpState({
    followUpDate: record.followUpDate ? calendarDateFromDb(record.followUpDate) : null,
    followUpClosedAt: record.followUpClosedAt ? instantFromDb(record.followUpClosedAt) : null,
    followUpAppointment: record.followUpAppointment,
  });
  const visitDate = instantFromDb(record.visitDate);
  const vitals = [
    { label: "Temp", value: record.temperatureC, unit: "°C" },
    { label: "Pulse", value: record.heartRate, unit: "bpm" },
    { label: "Resp", value: record.respiratoryRate, unit: "/min" },
    { label: "BP", value: bloodPressure(record.systolic, record.diastolic), unit: "mmHg" },
    { label: "SpO₂", value: record.oxygenSaturation, unit: "%" },
    { label: "Weight", value: record.weightKg, unit: "kg" },
    { label: "Height", value: record.heightCm, unit: "cm" },
    { label: "BMI", value: bmi(record.weightKg, record.heightCm), unit: "" },
  ].filter((v) => v.value != null);

  return (
    <div className="space-y-3">
      <PageHeader
        title={record.chiefComplaint || "Untitled draft"}
        subtitle={
          <>
            <Link href={`/patients/${patient.id}`} className="text-accent-ink hover:underline">
              {fullName(patient)}
            </Link>
            {" · "}
            {SEX_LABELS[patient.sex]} · {ageFrom(calendarDateFromDb(patient.dateOfBirth), visitDate)} at visit ·{" "}
            {formatDateTime(visitDate)}
            {author ? ` · by ${author.fullName}` : ""}
          </>
        }
        actions={
          !mine ? null : archived ? (
            <form action={restoreMedicalRecord}>
              <input type="hidden" name="recordId" value={record.id} />
              <button className={buttonClass("primary")}>Restore note</button>
            </form>
          ) : (
            <Link
              href={`/records/${record.id}/edit`}
              className={buttonClass(draft ? "primary" : "secondary")}
            >
              {draft ? "Continue note" : "Amend note"}
            </Link>
          )
        }
      />

      {archived ? (
        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
          <p className="font-medium">
            Archived {formatDateTime(instantFromDb(record.archivedAt!))}
            {record.archivedBy ? ` by ${record.archivedBy.fullName}` : ""}.
          </p>
          <p className="mt-0.5 text-ink-muted">
            {record.archiveReason
              ? record.archiveReason
              : "No reason was given."}{" "}
            It is out of the patient&rsquo;s chart but nothing has been destroyed — restore it to
            put it back.
          </p>
        </div>
      ) : null}

      {/* An unfinished note is not the record of the visit yet, and reading it
          as though it were is the mistake worth preventing. */}
      {draft ? (
        <div className="rounded-lg border border-warn/40 bg-warn-tint px-4 py-3 text-sm">
          <p className="font-medium text-warn-ink">This consultation is still a draft.</p>
          <p className="mt-0.5 text-ink-muted">
            It saves as it is written and can be picked up again. The visit stays open until it is
            finished, and nothing here is signed.
          </p>
        </div>
      ) : record.finalizedAt ? (
        <p className="text-xs text-ink-faint">
          Signed {formatDateTime(instantFromDb(record.finalizedAt))}
          {record.finalizedBy ? ` by ${record.finalizedBy.fullName}` : ""}.
        </p>
      ) : null}

      <div>
        <Badge dot tone={RECORD_STATUS_TONE[record.status]}>
          {RECORD_STATUS_LABELS[record.status]}
        </Badge>
      </div>

      <AllergyBanner status={patient.allergyStatus} allergies={patient.allergies} />
      <AlertBanner alerts={patient.alerts} />

      {vitals.length > 0 ? (
        <Card>
          <CardHeader title="Vitals" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 py-4 sm:grid-cols-4">
            {vitals.map((v) => (
              <Detail
                key={v.label}
                label={v.label}
                value={
                  <span className="tabular text-base font-medium">
                    {v.value}
                    {v.unit ? <span className="ml-1 text-xs text-ink-faint">{v.unit}</span> : null}
                  </span>
                }
              />
            ))}
          </dl>
        </Card>
      ) : null}

      <Card className="space-y-5 p-5">
        <Prose label="History of present illness" text={record.historyOfPresentIllness} />
        <Prose label="Physical examination" text={record.physicalExamination} />
        {record.diagnoses.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Diagnoses (ICD-11)</p>
            <ol className="mt-1.5 space-y-1 text-sm">
              {record.diagnoses.map((d, i) => (
                <li key={d.code} className="flex gap-3">
                  <span className="w-16 shrink-0 font-mono text-xs font-semibold">{d.code}</span>
                  <span>
                    {d.title}
                    {i === 0 && record.diagnoses.length > 1 ? <span className="ml-2 text-xs text-ink-muted">Primary</span> : null}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-1.5 text-xs text-ink-faint">{ICD11_CREDIT}</p>
          </div>
        ) : null}
        <Prose label="Assessment" text={record.assessment} />
        <Prose label="Treatment plan" text={record.treatmentPlan} />
        <Prose label="Advice and notes" text={record.notes} />
        {record.followUpDate ? (
          <Detail
            label="Follow-up"
            value={
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone={FOLLOW_UP_TONE[followUp.state]}>
                  {FOLLOW_UP_LABELS[followUp.state]}
                </Badge>
                <span>{formatCalendarDate(calendarDateFromDb(record.followUpDate))}</span>

                {record.followUpAppointment ? (
                  <Link
                    href={`/appointments/${record.followUpAppointment.id}`}
                    className="text-accent-ink hover:underline"
                  >
                    {formatDateTime(instantFromDb(record.followUpAppointment.scheduledAt))}
                  </Link>
                ) : null}

                {followUp.returnedBy ? (
                  <span className="text-warn-ink">
                    back in the queue — {RETURNED_BY_LABELS[followUp.returnedBy]}
                  </span>
                ) : null}

                {record.followUpClosedAt ? (
                  <>
                    <span className="text-ink-faint">
                      closed {formatDate(instantFromDb(record.followUpClosedAt))}
                      {record.followUpClosedReason ? ` — ${record.followUpClosedReason}` : ""}
                    </span>
                    <form action={reopenFollowUp.bind(null, record.id)}>
                      <button className={buttonClass("ghost")}>Reopen</button>
                    </form>
                  </>
                ) : needsAction(followUp.state) ? (
                  <>
                    <Link
                      href={`/appointments/new?patientId=${patient.id}&service=FOLLOW_UP_CHECKUP&date=${toDateInputValue(calendarDateFromDb(record.followUpDate))}&followUpFor=${record.id}`}
                      className={buttonClass("secondary")}
                    >
                      Book follow-up
                    </Link>
                    {/* The only way out of the queue without a completed visit. */}
                    <form action={closeFollowUp.bind(null, record.id)} className="flex flex-wrap gap-1.5">
                      <input
                        name="reason"
                        placeholder="Reason no longer needed"
                        className="min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm"
                      />
                      <button className={buttonClass("ghost")}>No longer required</button>
                    </form>
                  </>
                ) : null}
              </span>
            }
          />
        ) : null}
        {record.appointment ? (
          <Detail
            label="From appointment"
            value={
              <Link
                href={`/appointments/${record.appointment.id}`}
                className="text-accent-ink hover:underline"
              >
                {formatDateTime(instantFromDb(record.appointment.scheduledAt))} — {record.appointment.reason}
              </Link>
            }
          />
        ) : (
          <Detail label="From appointment" value="Walk-in" />
        )}
      </Card>

      {record.prescriptions.length > 0 ? (
        <Card>
          <CardHeader
            title="Prescriptions"
            subtitle={`${record.prescriptions.length} item(s)`}
            action={
              mine ? (
                <Link href={`/records/${record.id}/prescription`} className={buttonClass("secondary")}>
                  Print prescription
                </Link>
              ) : null
            }
          />
          <ul className="divide-y divide-border">
            {record.prescriptions.map((rx) => (
              <li key={rx.id} className="px-5 py-4">
                <p className="font-medium">{rx.drugName}</p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" · ")}
                </p>
                {rx.instructions ? (
                  <p className="mt-1 text-sm text-ink-faint">{rx.instructions}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {versions.length > 0 ? (
        <Card>
          <CardHeader
            title="History"
            subtitle={`${versions.length} ${versions.length === 1 ? "version" : "versions"}, newest first`}
          />
          <ol className="divide-y divide-border">
            {versions.map((v, i) => {
              // The list is newest first, so the state this one replaced is the
              // next element along.
              const previous = versions[i + 1];
              const changes =
                v.parsed && previous?.parsed ? changesBetween(previous.parsed, v.parsed) : [];

              return (
                <li key={v.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm font-medium">
                      {v.version === 1 ? "Signed" : `Amendment ${v.version - 1}`}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {formatDateTime(v.createdAt)} · {v.author.fullName}
                    </span>
                    {i === 0 ? <Badge tone="neutral">Current text</Badge> : null}
                  </div>

                  {v.reason ? (
                    <p className="mt-1 text-sm text-pretty">{v.reason}</p>
                  ) : null}

                  {changes.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {changes.map((c) => (
                        <li key={c.label} className="text-xs text-ink-muted">
                          <span className="font-medium text-ink">{c.label}</span>{" "}
                          <span className="text-ink-faint line-through">{brief(c.from)}</span>{" "}
                          <span aria-hidden="true">→</span> <span>{brief(c.to)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </Card>
      ) : null}

      {archived || !mine ? null : (
        <DangerZone
          action={archiveMedicalRecord}
          fieldName="recordId"
          fieldValue={record.id}
          variant="secondary"
          summary="Archive this note"
          warning="Takes this encounter out of the patient's chart. It stays readable and can be restored — a clinical record is evidence of what was decided, so nothing here is destroyed. Amending is usually the right answer for a note that is merely wrong."
          confirmLabel="Archive note"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Reason</span>
            <input
              name="archiveReason"
              maxLength={500}
              placeholder="Recorded against the wrong patient"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
            />
          </label>
        </DangerZone>
      )}
    </div>
  );
}
