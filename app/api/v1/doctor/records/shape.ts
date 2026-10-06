import "server-only";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, instantFromDb, toDateInputValue } from "@/lib/datetime";

/** A note as the app edits or reads it. Null when it's gone. */
export async function recordForApp(doctor: { doctorId: string; clinicId: string }, recordId: string) {
  const r = await orm.MedicalRecord
    .include("prescriptions", (rx) =>
      rx.select("id", "drugName", "dosage", "frequency", "duration", "instructions").orderBy((x) => x.createdAt.asc()),
    )
    .include("diagnoses", (d) => d.select("code", "title", "uri").orderBy((x) => x.position.asc()))
    .where((x) => x.id.eq(recordId))
    .where((x) => x.clinicId.eq(doctor.clinicId))
    .first();
  if (!r) return null;
  const author = await orm.Doctor.select("fullName").where((d) => d.id.eq(r.doctorId)).first();
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  // "YYYY-MM-DDTHH:MM" in clinic time, the form's own encoding.
  const local = r.visitDate
    ? new Date(instantFromDb(r.visitDate).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16)
    : null;
  return {
    id: r.id,
    patientId: r.patientId,
    appointmentId: r.appointmentId,
    status: r.status,
    mine: r.doctorId === doctor.doctorId,
    author: author?.fullName ?? null,
    archived: r.archivedAt !== null,
    visitDate: local,
    chiefComplaint: r.chiefComplaint,
    historyOfPresentIllness: r.historyOfPresentIllness,
    physicalExamination: r.physicalExamination,
    temperatureC: num(r.temperatureC),
    heartRate: num(r.heartRate),
    respiratoryRate: num(r.respiratoryRate),
    systolic: num(r.systolic),
    diastolic: num(r.diastolic),
    weightKg: num(r.weightKg),
    heightCm: num(r.heightCm),
    oxygenSaturation: num(r.oxygenSaturation),
    assessment: r.assessment,
    treatmentPlan: r.treatmentPlan,
    followUpDate: r.followUpDate ? toDateInputValue(calendarDateFromDb(r.followUpDate)) : null,
    notes: r.notes,
    prescriptions: r.prescriptions,
    /** ICD-11, primary first. */
    diagnoses: r.diagnoses,
    updatedAt: instantFromDb(r.updatedAt).toISOString(),
  };
}
