import { apiDoctor, apiError } from "@/lib/api";
import { loadDocument } from "@/lib/document-api";
import { checkDetails } from "@/lib/documents";
import { instantToDb } from "@/lib/datetime";
import { orm } from "@/src/prisma/db";

/** → `{ document }`: one of this doctor's documents, whole, with what lays it out. */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/doctor/documents/[id]">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;
  const document = await loadDocument(doctor, id);
  if (!document) return apiError(404, "No document with that id.");
  return Response.json({ document });
}

/** `{ purpose?, details }` → `{ document }`: a draft's details, while it's unsigned. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/doctor/documents/[id]">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;
  const existing = await orm.DocumentRequest
    .select("id", "type", "status", "purpose")
    .where((r) => r.id.eq(id))
    .where((r) => r.clinicId.eq(doctor.clinicId))
    .where((r) => r.doctorId.eq(doctor.doctorId))
    .first();
  if (!existing) return apiError(404, "No document with that id.");
  if (existing.status !== "REQUESTED") return apiError(409, "It's signed: it can't be changed now.");

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return apiError(400, "Send JSON.");
  const checked = checkDetails(existing.type, body.details, true);
  if ("fieldErrors" in checked) return apiError(422, "Check the details.", checked.fieldErrors);
  const purpose = body.purpose === undefined ? existing.purpose : String(body.purpose).trim();
  if (!purpose) return apiError(422, "Say what it's for.", { purpose: ["Say what it's for"] });

  await orm.DocumentRequest.where((r) => r.id.eq(id)).update({
    purpose,
    details: JSON.stringify(checked.details),
    updatedAt: instantToDb(new Date()),
  });
  return Response.json({ document: await loadDocument(doctor, id) });
}

/** → `204`: a draft thrown away. Signed documents stay. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/v1/doctor/documents/[id]">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;
  const existing = await orm.DocumentRequest
    .select("id", "status")
    .where((r) => r.id.eq(id))
    .where((r) => r.clinicId.eq(doctor.clinicId))
    .where((r) => r.doctorId.eq(doctor.doctorId))
    .first();
  if (!existing) return apiError(404, "No document with that id.");
  if (existing.status !== "REQUESTED") return apiError(409, "It's signed: it stays on record.");
  await orm.DocumentRequest.where((r) => r.id.eq(id)).delete();
  return new Response(null, { status: 204 });
}
