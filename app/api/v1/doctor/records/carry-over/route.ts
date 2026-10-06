import { apiDoctor, apiError } from "@/lib/api";
import { caresFor } from "@/lib/care";
import { carryOverFor } from "@/lib/carry-over";

/**
 * What a new note for `?patientId=` starts from → `{ carryOver: { from,
 * heightCm, diagnoses[], notes, prescriptions[], assessment, treatmentPlan }
 * | null }`: the latest finalized note this doctor may read. `assessment` and
 * `treatmentPlan` are always empty now. Never today's measurements.
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const patientId = new URL(request.url).searchParams.get("patientId") ?? "";
  const me = { id: doctor.doctorId, clinicId: doctor.clinicId };
  if (!patientId || !(await caresFor(me, patientId))) return apiError(404, "No chart you can write in.");
  return Response.json({ carryOver: await carryOverFor(me, patientId) });
}
