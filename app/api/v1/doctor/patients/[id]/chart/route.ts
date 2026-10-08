import { apiDoctor, apiError, readJson } from "@/lib/api";
import { editChart } from "@/lib/chart-edits";

/** The fields a chart change may carry; anything else is ignored. */
const FIELDS = ["action", "id", "label", "severity", "reaction", "notes", "dosage", "frequency"] as const;

/**
 * One change to a patient's chart, as the web's side column makes it
 * (lib/chart-edits.ts): `{ action, id?, label?, severity?, reaction?, notes?,
 * dosage?, frequency? }` → `200 { ok: true }`, or `422` with why. Actions:
 * `allergy.add|remove|none`, `alert.add|remove`, `condition.add|resolve`,
 * `medication.add|stop|restart`. Only a doctor who cares for the patient.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/doctor/patients/[id]/chart">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;
  const body = (await readJson(request)) ?? {};
  const form = new FormData();
  form.set("patientId", id);
  for (const f of FIELDS) if (body[f] != null) form.set(f, String(body[f]));
  const result = await editChart({ id: doctor.doctorId, clinicId: doctor.clinicId, accountId: doctor.accountId }, form);
  if (!result.ok) return apiError(422, result.message);
  return Response.json({ ok: true });
}
