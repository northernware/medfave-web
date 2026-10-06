import { apiDoctor, apiError, readJson } from "@/lib/api";
import { writeConsultation } from "@/lib/consultation";
import { orm } from "@/src/prisma/db";
import { recordForApp } from "./shape";

/**
 * The app's consultation notes: the same rules as the web's form
 * (lib/consultation.ts) — drafts, signing, amendments with a reason, the
 * version trail, prescriptions, teleconsultation limits.
 */

/** `?appointmentId=` → the note this doctor already started for it, or `{ record: null }`. */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const appointmentId = new URL(request.url).searchParams.get("appointmentId");
  if (!appointmentId) return apiError(400, "Say which appointment: ?appointmentId=");
  const existing = await orm.MedicalRecord
    .select("id")
    .where((r) => r.appointmentId.eq(appointmentId))
    .where((r) => r.doctorId.eq(doctor.doctorId))
    .first();
  return Response.json({ record: existing ? await recordForApp(doctor, existing.id) : null });
}

const TEXT = [
  "patientId", "appointmentId", "visitDate", "chiefComplaint", "historyOfPresentIllness", "physicalExamination",
  "temperatureC", "heartRate", "respiratoryRate", "systolic", "diastolic", "weightKg", "heightCm",
  "oxygenSaturation", "assessment", "treatmentPlan", "followUpDate", "notes", "noteKind", "amendmentReason",
] as const;

/**
 * Saves a note. Body: `{ recordId?, intent: "draft" | "finish", patientId,
 * appointmentId?, visitDate: "YYYY-MM-DDTHH:MM", chiefComplaint, …vitals and
 * text fields, followUpDate?, amendmentReason?, prescriptions: [{ drugName,
 * dosage, frequency, duration?, instructions? }], diagnoses?: ["CA23.32", …] }`
 * → `{ record }`. `diagnoses` are ICD-11 codes, primary first; left out, the
 * note keeps the ones it has.
 * Leave out `recordId` for a new note; the response's `record.id` is the one
 * to send on every later save. A note for an appointment that already has one
 * of this doctor's continues it.
 */
export async function POST(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const body = await readJson(request);
  if (!body) return apiError(400, "Send the note as JSON.");

  let recordId = typeof body.recordId === "string" ? body.recordId : "";
  if (!recordId && typeof body.appointmentId === "string" && body.appointmentId) {
    const started = await orm.MedicalRecord
      .select("id")
      .where((r) => r.appointmentId.eq(body.appointmentId as string))
      .where((r) => r.doctorId.eq(doctor.doctorId))
      .first();
    if (started) recordId = started.id;
  }

  // The form's encoding, so the web's rules apply unchanged.
  const form = new FormData();
  if (recordId) form.set("recordId", recordId);
  // Every field, as the web form sends it: an empty one is "not recorded".
  for (const key of TEXT) {
    const v = body[key];
    form.set(key, v === undefined || v === null ? "" : String(v));
  }
  const rx = Array.isArray(body.prescriptions) ? body.prescriptions : [];
  for (const row of rx) {
    const r = (row ?? {}) as Record<string, unknown>;
    form.append("rx.drugName", String(r.drugName ?? ""));
    form.append("rx.dosage", String(r.dosage ?? ""));
    form.append("rx.frequency", String(r.frequency ?? ""));
    form.append("rx.duration", String(r.duration ?? ""));
    form.append("rx.instructions", String(r.instructions ?? ""));
  }

  // ICD-11 codes, primary first. Left out (an older app): the note keeps its diagnoses.
  if (Array.isArray(body.diagnoses)) {
    form.set("dx.present", "1");
    for (const code of body.diagnoses) form.append("dx.code", String(code ?? ""));
    // Those to add to the patient's ongoing conditions when the note is signed.
    if (Array.isArray(body.ongoing)) for (const code of body.ongoing) form.append("dx.ongoing", String(code ?? ""));
  }

  const intent = body.intent === "finish" ? "finish" : "draft";
  const outcome = await writeConsultation(doctor.clinicId, doctor.doctorId, form, intent);
  if ("error" in outcome) {
    return apiError(422, outcome.error.message ?? "Check the note.", outcome.error.fieldErrors);
  }
  return Response.json({ record: await recordForApp(doctor, outcome.recordId) });
}
