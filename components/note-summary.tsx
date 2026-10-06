import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDoctor } from "@/lib/auth";
import { canReadNote, logChartAccess } from "@/lib/care";
import { calendarDateFromDb, formatCalendarDate, formatDateTime, instantFromDb } from "@/lib/datetime";
import { ICD11_CREDIT } from "@/lib/diagnoses";
import { bloodPressure, bmi, fullName, NOTE_KIND_LABELS, RECORD_STATUS_LABELS, RECORD_STATUS_TONE } from "@/lib/domain";
import { orm } from "@/src/prisma/db";
import { AlertBanner, AllergyBanner } from "@/components/allergy-banner";
import { Badge, Prose, buttonClass } from "@/components/ui";

/**
 * A visit note at a glance, for the side panel: what was found, what was
 * given, what was advised. The same access rule and chart-access log as the
 * note's own page; printing, history, follow-up and amending stay there.
 */
export async function NoteSummary({ id }: { id: string }) {
  const doctor = await requireDoctor();
  const record = await orm.MedicalRecord
    .include("patient", (p) =>
      p
        .select("id", "firstName", "middleName", "lastName", "allergyStatus")
        .include("allergies", (a) => a.select("id", "label", "reaction", "severity", "notes"))
        .include("alerts", (x) => x.select("id", "label", "notes").orderBy((y) => y.label.asc())),
    )
    .include("diagnoses", (d) => d.select("code", "title").orderBy((x) => x.position.asc()))
    .include("prescriptions", (rx) =>
      rx.select("id", "drugName", "dosage", "frequency", "duration", "instructions").orderBy((x) => x.createdAt.asc()),
    )
    .where((r) => r.id.eq(id))
    .where((r) => r.clinicId.eq(doctor.clinicId))
    .first();
  if (!record || !(await canReadNote(doctor, record))) notFound();
  await logChartAccess({ clinicId: doctor.clinicId, patientId: record.patientId, accountId: doctor.accountId, recordId: record.id });

  const mine = record.doctorId === doctor.id;
  const author = mine ? null : await orm.Doctor.select("fullName").where((d) => d.id.eq(record.doctorId)).first();
  const draft = record.status === "DRAFT";
  const vitals = [
    { label: "Temp", value: record.temperatureC, unit: "°C" },
    { label: "Pulse", value: record.heartRate, unit: "bpm" },
    { label: "Resp", value: record.respiratoryRate, unit: "/min" },
    { label: "BP", value: bloodPressure(record.systolic, record.diastolic), unit: "mmHg" },
    { label: "SpO₂", value: record.oxygenSaturation, unit: "%" },
    { label: "Weight", value: record.weightKg, unit: "kg" },
    { label: "BMI", value: bmi(record.weightKg, record.heightCm), unit: "" },
  ].filter((v) => v.value != null);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={RECORD_STATUS_TONE[record.status]}>{RECORD_STATUS_LABELS[record.status]}</Badge>
          {record.noteKind ? <Badge>{NOTE_KIND_LABELS[record.noteKind] ?? record.noteKind}</Badge> : null}
          {record.archivedAt ? <Badge>Archived</Badge> : null}
        </div>
        <h2 className="font-display text-xl font-semibold text-pretty">{record.chiefComplaint || "Untitled draft"}</h2>
        <p className="text-sm text-ink-muted">
          <Link href={`/patients/${record.patient.id}`} className="text-accent-ink hover:underline">
            {fullName(record.patient)}
          </Link>
          {" · "}
          {formatDateTime(instantFromDb(record.visitDate))}
          {author ? ` · by ${author.fullName}` : ""}
        </p>
      </div>

      <AllergyBanner status={record.patient.allergyStatus} allergies={record.patient.allergies} />
      <AlertBanner alerts={record.patient.alerts} />

      {record.diagnoses.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-ink-muted">Diagnoses (ICD-11)</h3>
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

      {vitals.length > 0 ? (
        <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {vitals.map((v) => (
            <div key={v.label}>
              <dt className="text-xs text-ink-faint">{v.label}</dt>
              <dd className="tabular font-medium">
                {v.value} {v.unit}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <Prose label="History of present illness" text={record.historyOfPresentIllness} />
      <Prose label="Physical examination" text={record.physicalExamination} />
      <Prose label="Assessment" text={record.assessment} />
      <Prose label="Treatment plan" text={record.treatmentPlan} />

      {record.prescriptions.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-ink-muted">Prescriptions</h3>
          <ul className="mt-1.5 divide-y divide-border rounded-xl border border-border text-sm">
            {record.prescriptions.map((rx) => (
              <li key={rx.id} className="px-3 py-2">
                <p className="font-medium">
                  {rx.drugName} {rx.dosage}
                </p>
                <p className="text-ink-muted">
                  {[rx.frequency, rx.duration, rx.instructions].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Prose label="Advice and notes" text={record.notes} />
      {record.followUpDate ? (
        <p className="text-sm">
          <span className="font-semibold text-ink-muted">Follow-up</span>{" "}
          {formatCalendarDate(calendarDateFromDb(record.followUpDate))}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {/* A plain anchor: a full load leaves the panel behind for the page itself. */}
        <a href={`/records/${record.id}`} className={buttonClass("secondary")}>
          Open full note
        </a>
        {mine && !record.archivedAt ? (
          <a href={`/records/${record.id}/edit`} className={buttonClass(draft ? "primary" : "secondary")}>
            {draft ? "Continue note" : "Amend note"}
          </a>
        ) : null}
      </div>
    </div>
  );
}
