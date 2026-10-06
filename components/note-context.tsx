import type { ReactNode } from "react";
import { sharesCharts } from "@/lib/care";
import { formatDate, instantFromDb } from "@/lib/datetime";
import { orm } from "@/src/prisma/db";
import { AlertBanner, AllergyBanner } from "@/components/allergy-banner";
import { ChartForm } from "@/components/chart-form";

/**
 * What a doctor checks while writing a note, beside the form: allergies and
 * alerts, the conditions and medicines on the chart, and the last visit's
 * diagnoses, medicines and advice. On a wide screen it stays in view while the
 * form scrolls; on a narrow one it sits above the form.
 */
export async function NoteContext({
  doctor,
  patientId,
  excludeRecordId,
  reason,
}: {
  doctor: { id: string; clinicId: string };
  patientId: string;
  /** The note being written, so "last visit" means the one before it. */
  excludeRecordId?: string;
  /** Why they booked, when the note is for an appointment. */
  reason?: string | null;
}) {
  const shared = await sharesCharts(doctor.clinicId);
  const [patient, last] = await Promise.all([
    orm.Patient
      .select("allergyStatus", "conditionStatus", "medicationStatus")
      .include("allergies", (a) => a.select("id", "label", "reaction", "severity", "notes"))
      .include("alerts", (x) => x.select("id", "label", "notes").orderBy((y) => y.label.asc()))
      .include("conditions", (c) => c.select("id", "label").where((y) => y.resolvedAt.isNull()).orderBy((y) => y.label.asc()))
      .include("medications", (m) => m.select("id", "label", "dosage", "frequency").where((y) => y.stoppedAt.isNull()).orderBy((y) => y.label.asc()))
      .where((p) => p.id.eq(patientId))
      .where((p) => p.clinicId.eq(doctor.clinicId))
      .first(),
    // The latest signed note this doctor may read (lib/care.ts), not the one open.
    orm.MedicalRecord
      .select("id", "visitDate", "chiefComplaint", "assessment", "treatmentPlan", "notes")
      .include("diagnoses", (d) => d.select("code", "title").orderBy((x) => x.position.asc()))
      .include("prescriptions", (rx) => rx.select("id", "drugName", "dosage", "frequency").orderBy((x) => x.createdAt.asc()))
      .where((r) => r.patientId.eq(patientId))
      .where((r) => r.clinicId.eq(doctor.clinicId))
      .where((r) => r.status.neq("DRAFT"))
      .where((r) => r.archivedAt.isNull())
      .where((r) => (excludeRecordId ? r.id.neq(excludeRecordId) : r.id.isNotNull()))
      .where((r) => (shared ? r.id.isNotNull() : r.doctorId.eq(doctor.id)))
      .orderBy((r) => r.visitDate.desc())
      .first(),
  ]);
  if (!patient) return null;

  const listOr = (status: string, empty: string) =>
    status === "UNKNOWN" ? "Not asked yet" : status === "NONE_KNOWN" ? empty : "None recorded";
  const advice = last?.notes?.trim() || last?.treatmentPlan?.trim();

  const more = (
    <>
      {reason ? (
        <Box title="Reason for visit">
          <p>{reason}</p>
        </Box>
      ) : null}

      <Box title="Ongoing conditions" hint="On the chart">
        {patient.conditions.length ? (
          <ul className="space-y-0.5">
            {patient.conditions.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-2">
                <span>{c.label}</span>
                <ChartForm patientId={patientId} action="condition.resolve" id={c.id}>
                  <button className="text-xs text-ink-muted hover:text-ink hover:underline" aria-label={`Mark ${c.label} resolved`}>
                    Resolve
                  </button>
                </ChartForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">{listOr(patient.conditionStatus, "None known")}</p>
        )}
        <Add label="Add condition">
          <ChartForm patientId={patientId} action="condition.add" className="grid gap-1.5">
            <input name="label" required placeholder="Condition (e.g. Hypertension)" className={input} />
            <button className={saveButton}>Save condition</button>
          </ChartForm>
        </Add>
      </Box>

      <Box title="Current medicines">
        {patient.medications.length ? (
          <ul className="space-y-0.5">
            {patient.medications.map((m) => (
              <li key={m.id} className="flex items-baseline justify-between gap-2">
                <span>
                  {[m.label, m.dosage].filter(Boolean).join(" ")}
                  {m.frequency ? <span className="text-ink-muted"> · {m.frequency}</span> : null}
                </span>
                <ChartForm patientId={patientId} action="medication.stop" id={m.id}>
                  <button className="text-xs text-ink-muted hover:text-ink hover:underline" aria-label={`${m.label}: no longer taken`}>
                    Stop
                  </button>
                </ChartForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">{listOr(patient.medicationStatus, "None")}</p>
        )}
        <Add label="Add medicine">
          <ChartForm patientId={patientId} action="medication.add" className="grid gap-1.5">
            <input name="label" required placeholder="Medicine (e.g. Amlodipine)" className={input} />
            <div className="flex gap-1.5">
              <input name="dosage" placeholder="Dose (5 mg)" className={input} />
              <input name="frequency" placeholder="How often" className={input} />
            </div>
            <button className={saveButton}>Save medicine</button>
          </ChartForm>
        </Add>
      </Box>

      <Box title={last ? `Last visit · ${formatDate(instantFromDb(last.visitDate))}` : "Last visit"}>
        {last ? (
          <div className="space-y-2">
            <p className="font-medium">{last.chiefComplaint}</p>
            {last.diagnoses.length ? (
              <ul className="space-y-0.5">
                {last.diagnoses.map((d) => (
                  <li key={d.code}>
                    <span className="font-mono text-xs font-semibold">{d.code}</span> {d.title}
                  </li>
                ))}
              </ul>
            ) : last.assessment ? (
              <p className="text-ink-muted">{last.assessment}</p>
            ) : null}
            {last.prescriptions.length ? (
              <ul className="space-y-0.5 text-ink-muted">
                {last.prescriptions.map((rx) => (
                  <li key={rx.id}>
                    {rx.drugName} {rx.dosage} · {rx.frequency}
                  </li>
                ))}
              </ul>
            ) : null}
            {advice ? <p className="whitespace-pre-line text-ink-muted">{advice}</p> : null}
          </div>
        ) : (
          <p className="text-ink-muted">First visit with you.</p>
        )}
      </Box>
    </>
  );

  return (
    <div className="space-y-3">
      {/* Changed in place: what the doctor learns at the visit goes straight on the chart. */}
      <AlertBanner alerts={patient.alerts} patientId={patientId} />
      <AllergyBanner status={patient.allergyStatus} allergies={patient.allergies} patientId={patientId} />

      {/* Safety first everywhere; the rest beside the form when wide, folded away above it when narrow. */}
      <div className="hidden space-y-3 lg:block">{more}</div>
      <details className="group rounded-md border border-border bg-surface lg:hidden">
        <summary className="cursor-pointer px-3.5 py-2.5 text-sm font-semibold">More about this patient</summary>
        <div className="space-y-3 px-3.5 pb-3.5">{more}</div>
      </details>
    </div>
  );
}

const input = "w-full rounded-md border border-border bg-surface px-2 py-1 text-sm";
const saveButton = "justify-self-start rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent";

/** "+ Add …" folded open under a list. */
function Add({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer list-none text-xs font-semibold text-accent-ink hover:underline">+ {label}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function Box({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-surface px-3.5 py-3 text-sm">
      <h2 className="mb-1.5 font-display text-sm font-semibold">
        {title}
        {hint ? <span className="ml-1.5 text-xs font-normal text-ink-faint">{hint}</span> : null}
      </h2>
      {children}
    </section>
  );
}

/**
 * The note page's two columns: the form at a comfortable reading width, and
 * the patient's context beside it, staying in view (above it when narrow).
 */
export function NoteLayout({ form, context }: { form: ReactNode; context: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,46rem)_minmax(17rem,22rem)] lg:items-start">
      <aside aria-label="About this patient" className="lg:sticky lg:top-4 lg:order-2 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        {context}
      </aside>
      <div className="min-w-0 space-y-3 lg:order-1">{form}</div>
    </div>
  );
}
