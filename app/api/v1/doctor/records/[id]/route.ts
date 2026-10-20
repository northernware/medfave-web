import { apiDoctor, apiError } from "@/lib/api";
import { canReadNote, logChartAccess } from "@/lib/care";
import { orm } from "@/src/prisma/db";
import { recordForApp } from "../shape";

/**
 * One note, to read or carry on writing. Readable when it's this doctor's, or
 * any at a clinic that shares charts (`mine` says whether it can be changed).
 * Opening it is logged.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/doctor/records/[id]">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;
  const note = await orm.MedicalRecord.select("id", "doctorId", "clinicId", "patientId").where((r) => r.id.eq(id)).first();
  if (!note || !(await canReadNote({ id: doctor.doctorId, clinicId: doctor.clinicId }, note))) {
    return apiError(404, "No note with that id.");
  }
  await logChartAccess({ clinicId: doctor.clinicId, patientId: note.patientId, accountId: doctor.accountId, recordId: id });
  return Response.json({ record: await recordForApp(doctor, id) });
}

/**
 * → `204`: a draft note thrown away, as a mail draft is. Only this doctor's own
 * and only while it's a draft that was never signed: a signed note is part of
 * the chart and is archived, never deleted (`409`). Its prescriptions and
 * diagnoses go with it; a document drawn from it keeps standing, unlinked.
 */
export async function DELETE(request: Request, ctx: RouteContext<"/api/v1/doctor/records/[id]">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;
  const note = await orm.MedicalRecord
    .select("id", "status", "finalizedAt")
    .where((r) => r.id.eq(id))
    .where((r) => r.clinicId.eq(doctor.clinicId))
    .where((r) => r.doctorId.eq(doctor.doctorId))
    .first();
  if (!note) return apiError(404, "No note with that id.");
  if (note.status !== "DRAFT" || note.finalizedAt !== null) {
    return apiError(409, "It's signed: it stays in the chart. Archive it on the web instead.");
  }
  await orm.MedicalRecord.where((r) => r.id.eq(id)).delete();
  return new Response(null, { status: 204 });
}
