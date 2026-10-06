import type { Metadata } from "next";
import { NoteContext, NoteLayout } from "@/components/note-context";
import { NoteHeader } from "@/components/note-header";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { autosaveConsultation, saveMedicalRecord } from "@/app/actions/records";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { clinicDayRange, instantFromDb } from "@/lib/datetime";
import { formatDateTime, toDateTimeLocalValue } from "@/lib/datetime";
import { CONSULTED_STATUSES } from "@/lib/domain";
import { RecordForm } from "@/components/forms/record-form";
import { blankRecord } from "@/lib/form-defaults";
import { buttonClass, Card } from "@/components/ui";
import { carryOverFor } from "@/lib/carry-over";

export const metadata: Metadata = { title: "New visit note" };

export default async function NewRecordPage({ searchParams }: PageProps<"/records/new">) {
  const doctor = await requireDoctor();
  const { patientId, appointmentId, fresh } = await searchParams;

  if (typeof patientId !== "string") notFound();

  const patient = await orm.Patient
    .select("id", "firstName", "middleName", "lastName", "dateOfBirth", "sex", "allergyStatus", "archivedAt")
    .include("allergies", (a) => a.select("id", "label", "reaction", "severity", "notes"))
    .include("alerts", (x) => x.select("id", "label", "notes").orderBy((y) => y.label.asc()))
    .include("household", (h) => h.select("id", "name"))
    .where((p) => p.id.eq(patientId))
    .where((p) => p.clinicId.eq(doctor.clinicId))
    .first();
  if (!patient) notFound();
  // Saving would be refused; better not to let a note be written first.
  if (patient.archivedAt) redirect(`/patients/${patient.id}`);

  // Only visits that actually happened can be written up, so only those are
  // offered. A booking still to come has nothing to say yet.
  const undocumented = await orm.Appointment
    .select("id", "scheduledAt", "reason", "visitType", "status")
    .where((a) => a.patientId.eq(patient.id))
    .where((a) => a.doctorId.eq(doctor.id))
    .where((a) => a.status.in(CONSULTED_STATUSES))
    .where((a) => a.medicalRecord.none((r) => r.id.isNotNull()))
    .orderBy((a) => a.scheduledAt.desc())
    .limit(20)
    .all();

  const options = undocumented.map((a) => ({
    id: a.id,
    label: `${formatDateTime(instantFromDb(a.scheduledAt))} — ${a.reason}`,
    remote: a.visitType === "TELECONSULTATION",
  }));

  const locked =
    typeof appointmentId === "string" ? options.find((o) => o.id === appointmentId) : undefined;

  const defaults = blankRecord(toDateTimeLocalValue(new Date()));
  if (locked) defaults.appointmentId = locked.id;
  // Opened from the patient's page: if they're with the doctor today (or were
  // seen today and it isn't written up), this note is most likely for that
  // visit. Still changeable. Only visits that took place can be linked.
  else {
    const todayStart = clinicDayRange(new Date()).start;
    const today = undocumented.filter((a) => instantFromDb(a.scheduledAt) >= todayStart);
    const here = today.find((a) => a.status === "IN_CONSULTATION") ?? today.find((a) => a.status === "COMPLETED");
    if (here) defaults.appointmentId = here.id;
  }

  // A return visit picks up where the last one left off (lib/carry-over.ts).
  const last = fresh === "1" ? null : await carryOverFor(doctor, patient.id);
  const carriedFrom = last?.from ?? null;
  if (last) {
    if (last.heightCm) defaults.heightCm = last.heightCm;
    defaults.diagnoses = last.diagnoses;
    defaults.notes = last.notes;
    defaults.prescriptions = last.prescriptions;
  }

  const onChart = await orm.PatientCondition.select("code", "label")
    .where((c) => c.patientId.eq(patient.id))
    .where((c) => c.resolvedAt.isNull())
    .all();

  return (
    <div className="space-y-3">
      <NoteHeader title="New visit note" patient={patient} />

      <NoteLayout
        context={
          <NoteContext
            doctor={{ id: doctor.id, clinicId: doctor.clinicId }}
            patientId={patient.id}
            reason={locked ? undocumented.find((a) => a.id === locked.id)?.reason : null}
          />
        }
        form={
          <>
            {carriedFrom ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent-tint px-4 py-3 text-sm">
                <p>
                  <span className="font-medium">Filled from the visit on {carriedFrom}:</span>{" "}
                  <span className="text-ink-muted">diagnoses, advice, medicines and height. Today&rsquo;s complaint, vitals and examination start blank.</span>
                </p>
                <Link
                  href={`/records/new?patientId=${patient.id}${locked ? `&appointmentId=${locked.id}` : ""}&fresh=1`}
                  className={buttonClass("secondary")}
                >
                  Start blank
                </Link>
              </div>
            ) : null}

            <Card className="p-5 sm:p-6">
              <RecordForm
                onChart={onChart}
                action={saveMedicalRecord}
                autosave={autosaveConsultation}
                patientId={patient.id}
                defaults={defaults}
                openAppointments={options}
                lockedAppointment={locked}
                cancelHref={`/patients/${patient.id}`}
              />
            </Card>
          </>
        }
      />
    </div>
  );
}
