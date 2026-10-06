import "server-only";
import { caresFor } from "@/lib/care";
import { instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { orm } from "@/src/prisma/db";
export { looksLongTerm } from "@/lib/diagnosis-rank";

/*
 * A patient's ongoing conditions keep their history: one that is no longer
 * current is marked resolved, with when and by whom, rather than deleted. And
 * a long-term diagnosis made at a visit can join the list from the note.
 */


type Doctor = { id: string; clinicId: string; accountId: string };

/** Marks a condition resolved (or current again). Refused unless the doctor cares for the patient. */
export async function setConditionResolved(doctor: Doctor, conditionId: string, resolved: boolean) {
  const condition = await orm.PatientCondition.select("id", "patientId")
    .include("patient", (p) => p.select("clinicId"))
    .where((c) => c.id.eq(conditionId))
    .first();
  if (!condition || condition.patient.clinicId !== doctor.clinicId) return { ok: false as const, reason: "not-found" as const };
  if (!(await caresFor(doctor, condition.patientId))) return { ok: false as const, reason: "not-found" as const };
  await orm.PatientCondition.where((c) => c.id.eq(conditionId)).update(
    resolved
      ? { resolvedAt: instantToDb(new Date()), resolvedById: doctor.accountId }
      : { resolvedAt: null, resolvedById: null },
  );
  return { ok: true as const, patientId: condition.patientId };
}

/**
 * Adds diagnoses from a signed note to the chart's ongoing conditions, unless
 * the chart already has them current (by code or name). A resolved one with
 * the same code or name becomes current again rather than a duplicate.
 */
export async function addConditionsFromDiagnoses(t: typeof orm, patientId: string, diagnoses: { code: string; title: string }[]) {
  if (diagnoses.length === 0) return;
  const now = instantToDb(new Date());
  const existing = await t.PatientCondition.select("id", "label", "code", "resolvedAt").where((c) => c.patientId.eq(patientId)).all();
  for (const d of diagnoses) {
    const same = existing.find((c) => c.code === d.code || c.label.toLowerCase() === d.title.toLowerCase());
    if (same) {
      if (same.resolvedAt) await t.PatientCondition.where((c) => c.id.eq(same.id)).update({ resolvedAt: null, resolvedById: null, code: d.code });
      continue;
    }
    await t.PatientCondition.create({ id: newId(), patientId, label: d.title, code: d.code, notes: null, createdAt: now });
  }
  // Something is recorded now, whatever the list said before.
  await t.Patient.where((p) => p.id.eq(patientId)).update({ conditionStatus: "RECORDED" });
}
