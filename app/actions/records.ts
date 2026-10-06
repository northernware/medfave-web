"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { instantToDb } from "@/lib/datetime";
import type { FormState } from "@/lib/validation";
import { writeConsultation, type Intent } from "@/lib/consultation";
import { searchIcd11 } from "@/lib/diagnoses";

export type DiagnosisHit = { code: string; title: string };

/** The note form's ICD-11 search. */
export async function searchDiagnoses(q: string): Promise<DiagnosisHit[]> {
  await requireDoctor();
  return (await searchIcd11(String(q))).map(({ code, title }) => ({ code, title }));
}

function revalidateRecord(recordId: string, patientId: string) {
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/records/${recordId}`);
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

/**
 * The form's two buttons. "Save draft" keeps the note open; "Finish
 * consultation" validates it in full, signs it, and closes the visit.
 */
export async function saveMedicalRecord(_prev: FormState, formData: FormData): Promise<FormState> {
  const doctor = await requireDoctor();
  const intent: Intent = formData.get("intent") === "finish" ? "finish" : "draft";

  const outcome = await writeConsultation(doctor.clinicId, doctor.id, formData, intent);
  if ("error" in outcome) return outcome.error;

  revalidateRecord(outcome.recordId, outcome.patientId);
  // A finished note is read; an unfinished one is carried on with.
  redirect(
    intent === "finish" ? `/records/${outcome.recordId}` : `/records/${outcome.recordId}/edit`,
  );
}

export type AutosaveResult =
  | { ok: true; recordId: string; savedAt: string }
  | { ok: false; message: string };

/**
 * The background save, called from the open form while the doctor types.
 *
 * It returns the record's id rather than redirecting, because the first
 * autosave of a new note is what gives that note an id at all — the form keeps
 * it so every later save, and the eventual signature, land on the same row
 * instead of scattering half-written duplicates across the chart.
 */
export async function autosaveConsultation(formData: FormData): Promise<AutosaveResult> {
  const doctor = await requireDoctor();
  const outcome = await writeConsultation(doctor.clinicId, doctor.id, formData, "draft");
  if ("error" in outcome) {
    return { ok: false, message: outcome.error.message ?? "Could not save." };
  }

  revalidateRecord(outcome.recordId, outcome.patientId);
  return { ok: true, recordId: outcome.recordId, savedAt: outcome.savedAt.toISOString() };
}

/**
 * Takes a record out of the working chart without destroying it.
 *
 * A clinical record is evidence of what was decided and when. Deleting one
 * removes the evidence and leaves nothing to say it ever existed, which is the
 * opposite of what a record is for — so this hides it from the ordinary lists
 * and keeps it readable, restorable, and attributed to whoever set it aside.
 */
export async function archiveMedicalRecord(formData: FormData) {
  const doctor = await requireDoctor();
  const recordId = String(formData.get("recordId") ?? "");
  const reason = String(formData.get("archiveReason") ?? "").trim();
  if (!recordId) return;

  const record = await orm.MedicalRecord
    .select("patientId", "archivedAt")
    .where((r) => r.id.eq(recordId))
    .where((r) => r.doctorId.eq(doctor.id))
    .first();
  if (!record || record.archivedAt) return;

  const now = instantToDb(new Date());
  await orm.MedicalRecord.where((r) => r.id.eq(recordId)).update({
    archivedAt: now,
    archivedById: doctor.id,
    archiveReason: reason || null,
    updatedAt: now,
  });

  revalidateRecord(recordId, record.patientId);
  redirect(`/patients/${record.patientId}`);
}

/** Puts an archived record back into the chart. */
export async function restoreMedicalRecord(formData: FormData) {
  const doctor = await requireDoctor();
  const recordId = String(formData.get("recordId") ?? "");
  if (!recordId) return;

  const record = await orm.MedicalRecord
    .select("patientId", "archivedAt")
    .where((r) => r.id.eq(recordId))
    .where((r) => r.doctorId.eq(doctor.id))
    .first();
  if (!record || !record.archivedAt) return;

  const now = instantToDb(new Date());
  await orm.MedicalRecord.where((r) => r.id.eq(recordId)).update({
    archivedAt: null,
    archivedById: null,
    archiveReason: null,
    updatedAt: now,
  });

  revalidateRecord(recordId, record.patientId);
  redirect(`/records/${recordId}`);
}

/**
 * Records that a follow-up is no longer needed.
 *
 * This is the only way a live follow-up leaves the queue without a completed
 * visit, and it is a decision rather than an inference — hence the reason, and
 * hence storing who made it.
 */
export async function closeFollowUp(recordId: string, formData: FormData): Promise<void> {
  const doctor = await requireDoctor();
  const reason = String(formData.get("reason") ?? "").trim();

  const owned = await orm.MedicalRecord
    .select("id", "patientId")
    .where((r) => r.id.eq(recordId))
    .where((r) => r.doctorId.eq(doctor.id))
    .where((r) => r.followUpDate.isNotNull())
    .first();
  if (!owned) return;

  const now = instantToDb(new Date());
  await orm.MedicalRecord.where((r) => r.id.eq(recordId)).update({
    followUpClosedAt: now,
    followUpClosedReason: reason || null,
    followUpClosedById: doctor.id,
    updatedAt: now,
  });

  revalidatePath(`/records/${recordId}`);
  revalidatePath(`/patients/${owned.patientId}`);
  revalidatePath("/dashboard");
}

/** Puts a closed follow-up back into the queue. */
export async function reopenFollowUp(recordId: string): Promise<void> {
  const doctor = await requireDoctor();
  const owned = await orm.MedicalRecord
    .select("id", "patientId")
    .where((r) => r.id.eq(recordId))
    .where((r) => r.doctorId.eq(doctor.id))
    .first();
  if (!owned) return;

  const now = instantToDb(new Date());
  await orm.MedicalRecord.where((r) => r.id.eq(recordId)).update({
    followUpClosedAt: null,
    followUpClosedReason: null,
    followUpClosedById: null,
    updatedAt: now,
  });

  revalidatePath(`/records/${recordId}`);
  revalidatePath(`/patients/${owned.patientId}`);
  revalidatePath("/dashboard");
}
