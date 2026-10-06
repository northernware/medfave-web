import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { autosaveConsultation, saveMedicalRecord } from "@/app/actions/records";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, instantFromDb } from "@/lib/datetime";
import { formatDateTime, toDateInputValue, toDateTimeLocalValue } from "@/lib/datetime";
import { fullName } from "@/lib/domain";
import { RecordForm } from "@/components/forms/record-form";
import { Card, PageHeader } from "@/components/ui";
import { NoteContext, NoteLayout } from "@/components/note-context";

export const metadata: Metadata = { title: "Visit note" };

/** Prisma nulls become the empty strings the form's inputs expect. */
const text = (v: string | null) => v ?? "";
const num = (v: number | null) => (v == null ? "" : String(v));

export default async function EditRecordPage({ params }: PageProps<"/records/[id]/edit">) {
  const doctor = await requireDoctor();
  const { id } = await params;

  const record = await orm.MedicalRecord
    .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
    .include("appointment", (a) => a.select("id", "scheduledAt", "reason", "visitType"))
    .include("diagnoses", (d) => d.select("code", "title").orderBy((x) => x.position.asc()))
    .include("prescriptions", (p) =>
      p
        .select("id", "drugName", "dosage", "frequency", "duration", "instructions")
        .orderBy((x) => x.createdAt.asc()),
    )
    .where((r) => r.id.eq(id))
    .where((r) => r.doctorId.eq(doctor.id))
    .first();
  if (!record) notFound();
  // An archived record is out of the chart; the record page is where it says so
  // and offers to put it back.
  if (record.archivedAt) redirect(`/records/${record.id}`);

  const onChart = await orm.PatientCondition.select("code", "label")
    .where((c) => c.patientId.eq(record.patientId))
    .where((c) => c.resolvedAt.isNull())
    .all();

  return (
    <div className="space-y-3">
      <PageHeader
        title={record.status === "DRAFT" ? "Visit note (draft)" : "Amend note"}
        subtitle={
          record.status === "DRAFT"
            ? fullName(record.patient)
            : `${fullName(record.patient)} · the previous text is kept`
        }
      />
      <NoteLayout
        context={
          <NoteContext
            doctor={{ id: doctor.id, clinicId: doctor.clinicId }}
            patientId={record.patientId}
            excludeRecordId={record.id}
            reason={record.appointment?.reason}
          />
        }
        form={
            <Card className="p-5 sm:p-6">
              <RecordForm
                onChart={onChart}
                action={saveMedicalRecord}
                autosave={autosaveConsultation}
                patientId={record.patientId}
                openAppointments={[]}
                lockedAppointment={
                  record.appointment
                    ? {
                        id: record.appointment.id,
                        label: `${formatDateTime(instantFromDb(record.appointment.scheduledAt))} — ${record.appointment.reason}`,
                        remote: record.appointment.visitType === "TELECONSULTATION",
                      }
                    : undefined
                }
                defaults={{
                  recordId: record.id,
                  status: record.status,
                  savedAt: instantFromDb(record.updatedAt).toISOString(),
                  visitDate: toDateTimeLocalValue(instantFromDb(record.visitDate)),
                  appointmentId: record.appointmentId ?? "",
                  chiefComplaint: record.chiefComplaint,
                  historyOfPresentIllness: text(record.historyOfPresentIllness),
                  physicalExamination: text(record.physicalExamination),
                  temperatureC: num(record.temperatureC),
                  heartRate: num(record.heartRate),
                  respiratoryRate: num(record.respiratoryRate),
                  systolic: num(record.systolic),
                  diastolic: num(record.diastolic),
                  weightKg: num(record.weightKg),
                  heightCm: num(record.heightCm),
                  oxygenSaturation: num(record.oxygenSaturation),
                  assessment: text(record.assessment),
                  treatmentPlan: text(record.treatmentPlan),
                  followUpDate: record.followUpDate ? toDateInputValue(calendarDateFromDb(record.followUpDate)) : "",
                  notes: text(record.notes),
                  prescriptions: record.prescriptions.map((rx) => ({
                    drugName: rx.drugName,
                    dosage: rx.dosage,
                    frequency: rx.frequency,
                    duration: text(rx.duration),
                    instructions: text(rx.instructions),
                  })),
                  diagnoses: record.diagnoses,
                }}
                cancelHref={`/records/${record.id}`}
              />
            </Card>
        }
      />
    </div>
  );
}
