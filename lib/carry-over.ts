import "server-only";
import { orm } from "@/src/prisma/db";
import { sharesCharts } from "@/lib/care";
import { formatDateTime, instantFromDb } from "@/lib/datetime";
import type { PrescriptionRow } from "@/lib/form-defaults";

/**
 * What a return visit's note starts from: the patient's latest finalized note
 * this doctor may read (their own, or any in a shared-chart clinic). Its
 * diagnoses, advice and medicines, for the doctor to keep, edit or clear; and
 * the height, which rarely changes. Nothing measured today is
 * carried — a copied blood pressure would look like today's reading.
 */
export type CarryOver = {
  /** "October 1, 2026 at 10:00 AM": which visit it came from. */
  from: string;
  heightCm: string;
  /** Always empty now: diagnoses are coded. Kept for apps that still read it. */
  assessment: string;
  /** ICD-11, primary first: the working diagnoses to keep or change. */
  diagnoses: { code: string; title: string }[];
  /** Always empty now: plans are prescriptions plus advice. Kept for apps that still read it. */
  treatmentPlan: string;
  /** "Advice and notes", or an older note's treatment plan, which held the advice then. */
  notes: string;
  prescriptions: PrescriptionRow[];
};

export async function carryOverFor(doctor: { id: string; clinicId: string }, patientId: string): Promise<CarryOver | null> {
  const shared = await sharesCharts(doctor.clinicId);
  const last = await orm.MedicalRecord
    .select("id", "visitDate", "heightCm", "assessment", "treatmentPlan", "notes")
    .include("prescriptions", (rx) => rx.select("drugName", "dosage", "frequency", "duration", "instructions"))
    .include("diagnoses", (d) => d.select("code", "title").orderBy((x) => x.position.asc()))
    .where((r) => r.patientId.eq(patientId))
    .where((r) => r.clinicId.eq(doctor.clinicId))
    .where((r) => r.status.eq("FINALIZED"))
    .where((r) => r.archivedAt.isNull())
    .where((r) => (shared ? r.id.isNotNull() : r.doctorId.eq(doctor.id)))
    .orderBy((r) => r.visitDate.desc())
    .first();
  if (!last) return null;
  return {
    from: formatDateTime(instantFromDb(last.visitDate)),
    heightCm: last.heightCm != null ? String(last.heightCm) : "",
    assessment: "",
    diagnoses: last.diagnoses,
    treatmentPlan: "",
    notes: last.notes?.trim() || last.treatmentPlan || "",
    prescriptions: last.prescriptions.map((rx) => ({
      drugName: rx.drugName,
      dosage: rx.dosage,
      frequency: rx.frequency,
      duration: rx.duration ?? "",
      instructions: rx.instructions ?? "",
    })),
  };
}
