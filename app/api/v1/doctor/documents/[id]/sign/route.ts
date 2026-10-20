import { apiDoctor, apiError } from "@/lib/api";
import { loadDocument } from "@/lib/document-api";
import { checkDetails, parseDetails } from "@/lib/documents";
import { instantToDb } from "@/lib/datetime";
import { orm } from "@/src/prisma/db";

/**
 * → `{ document }`: the doctor signs a draft, which makes it a document (READY): it can be
 * shared and printed, and no longer changed. Everything the type requires must be filled.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/doctor/documents/[id]/sign">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;
  const existing = await orm.DocumentRequest
    .select("id", "type", "status", "details")
    .where((r) => r.id.eq(id))
    .where((r) => r.clinicId.eq(doctor.clinicId))
    .where((r) => r.doctorId.eq(doctor.doctorId))
    .first();
  if (!existing) return apiError(404, "No document with that id.");
  if (existing.status !== "REQUESTED") return apiError(409, "It's already signed.");
  const checked = checkDetails(existing.type, parseDetails(existing.details));
  if ("fieldErrors" in checked) return apiError(422, "Fill in everything the document has to state.", checked.fieldErrors);

  await orm.DocumentRequest.where((r) => r.id.eq(id)).update({ status: "READY", updatedAt: instantToDb(new Date()) });
  return Response.json({ document: await loadDocument(doctor, id) });
}
