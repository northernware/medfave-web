import "server-only";
import { caresFor } from "@/lib/care";
import { instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { likeSafe } from "@/lib/diagnosis-rank";
import { orm } from "@/src/prisma/db";

/*
 * Small changes to a patient's chart made while writing a note (the side
 * column): an allergy, an alert, a condition or a medicine added, or one
 * resolved, stopped or removed. Each is its own write, apart from the note,
 * and only by a doctor caring for the patient. Conditions and medicines keep
 * their history (resolved / stopped with a date); an allergy or alert removed
 * here was recorded by mistake, so it goes.
 */

type Doctor = { id: string; clinicId: string; accountId: string };
export type ChartEdit = { ok: true } | { ok: false; message: string };

const SEVERITIES = ["MILD", "MODERATE", "SEVERE"] as const;
const text = (v: FormDataEntryValue | null, max = 200) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

/** The patient, if this doctor may change their chart. */
async function chartOf(doctor: Doctor, patientId: string) {
  const patient = await orm.Patient.select("id", "archivedAt")
    .where((p) => p.id.eq(patientId))
    .where((p) => p.clinicId.eq(doctor.clinicId))
    .first();
  if (!patient || patient.archivedAt || !(await caresFor(doctor, patientId))) return null;
  return patient;
}

const refused: ChartEdit = { ok: false, message: "You can't change this patient's chart." };
const now = () => instantToDb(new Date());

/** Which row a remove/resolve/stop refers to, checked against the patient. */
async function owned<T extends { patientId: string }>(row: T | null, patientId: string) {
  return row && row.patientId === patientId ? row : null;
}

export async function editChart(doctor: Doctor, form: FormData): Promise<ChartEdit> {
  const patientId = String(form.get("patientId") ?? "");
  const action = String(form.get("action") ?? "");
  const id = String(form.get("id") ?? "");
  if (!(await chartOf(doctor, patientId))) return refused;

  switch (action) {
    case "allergy.add": {
      const label = text(form.get("label"));
      if (!label) return { ok: false, message: "Name the allergy." };
      const severity = SEVERITIES.find((s) => s === form.get("severity")) ?? null;
      const exists = await orm.PatientAllergy.select("id").where((a) => a.patientId.eq(patientId)).where((a) => a.label.ilike(likeSafe(label))).first();
      if (exists) return { ok: false, message: `${label} is already recorded.` };
      await orm.PatientAllergy.create({ id: newId(), patientId, label, severity, reaction: text(form.get("reaction")), notes: null, createdAt: now() });
      await orm.Patient.where((p) => p.id.eq(patientId)).update({ allergyStatus: "RECORDED" });
      return { ok: true };
    }
    case "allergy.remove": {
      if (!(await owned(await orm.PatientAllergy.select("id", "patientId").where((a) => a.id.eq(id)).first(), patientId))) return refused;
      await orm.PatientAllergy.where((a) => a.id.eq(id)).delete();
      const left = await orm.PatientAllergy.select("id").where((a) => a.patientId.eq(patientId)).first();
      // None left: back to "not asked", until someone records "none known".
      if (!left) await orm.Patient.where((p) => p.id.eq(patientId)).update({ allergyStatus: "UNKNOWN" });
      return { ok: true };
    }
    case "allergy.none": {
      const any = await orm.PatientAllergy.select("id").where((a) => a.patientId.eq(patientId)).first();
      if (any) return { ok: false, message: "Remove the recorded allergies first." };
      await orm.Patient.where((p) => p.id.eq(patientId)).update({ allergyStatus: "NONE_KNOWN" });
      return { ok: true };
    }
    case "alert.add": {
      const label = text(form.get("label"));
      if (!label) return { ok: false, message: "Say what to watch for." };
      const exists = await orm.PatientAlert.select("id").where((a) => a.patientId.eq(patientId)).where((a) => a.label.ilike(likeSafe(label))).first();
      if (exists) return { ok: false, message: "That alert is already there." };
      await orm.PatientAlert.create({ id: newId(), patientId, label, notes: text(form.get("notes"), 500), createdAt: now() });
      return { ok: true };
    }
    case "alert.remove": {
      if (!(await owned(await orm.PatientAlert.select("id", "patientId").where((a) => a.id.eq(id)).first(), patientId))) return refused;
      await orm.PatientAlert.where((a) => a.id.eq(id)).delete();
      return { ok: true };
    }
    case "condition.add": {
      const label = text(form.get("label"));
      if (!label) return { ok: false, message: "Name the condition." };
      const same = await orm.PatientCondition.select("id", "resolvedAt").where((c) => c.patientId.eq(patientId)).where((c) => c.label.ilike(likeSafe(label))).first();
      if (same && !same.resolvedAt) return { ok: false, message: `${label} is already on the chart.` };
      if (same) await orm.PatientCondition.where((c) => c.id.eq(same.id)).update({ resolvedAt: null, resolvedById: null });
      else await orm.PatientCondition.create({ id: newId(), patientId, label, notes: null, createdAt: now() });
      await orm.Patient.where((p) => p.id.eq(patientId)).update({ conditionStatus: "RECORDED" });
      return { ok: true };
    }
    case "condition.resolve": {
      if (!(await owned(await orm.PatientCondition.select("id", "patientId").where((c) => c.id.eq(id)).first(), patientId))) return refused;
      await orm.PatientCondition.where((c) => c.id.eq(id)).update({ resolvedAt: now(), resolvedById: doctor.accountId });
      return { ok: true };
    }
    case "medication.add": {
      const label = text(form.get("label"));
      if (!label) return { ok: false, message: "Name the medicine." };
      const dosage = text(form.get("dosage"), 100);
      const frequency = text(form.get("frequency"), 100);
      const same = await orm.PatientMedication.select("id", "stoppedAt").where((m) => m.patientId.eq(patientId)).where((m) => m.label.ilike(likeSafe(label))).first();
      if (same && !same.stoppedAt) return { ok: false, message: `${label} is already on the list.` };
      // Taken again: the stopped row comes back with today's dose (one row per name).
      if (same) await orm.PatientMedication.where((m) => m.id.eq(same.id)).update({ dosage, frequency, stoppedAt: null, stoppedById: null });
      else await orm.PatientMedication.create({ id: newId(), patientId, label, dosage, frequency, notes: null, createdAt: now() });
      await orm.Patient.where((p) => p.id.eq(patientId)).update({ medicationStatus: "RECORDED" });
      return { ok: true };
    }
    case "medication.stop": {
      if (!(await owned(await orm.PatientMedication.select("id", "patientId").where((m) => m.id.eq(id)).first(), patientId))) return refused;
      await orm.PatientMedication.where((m) => m.id.eq(id)).update({ stoppedAt: now(), stoppedById: doctor.accountId });
      return { ok: true };
    }
    case "medication.restart": {
      if (!(await owned(await orm.PatientMedication.select("id", "patientId").where((m) => m.id.eq(id)).first(), patientId))) return refused;
      await orm.PatientMedication.where((m) => m.id.eq(id)).update({ stoppedAt: null, stoppedById: null });
      return { ok: true };
    }
    default:
      return { ok: false, message: "Unknown change." };
  }
}
