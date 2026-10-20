import { apiDoctor, apiError } from "@/lib/api";
import { loadDocument } from "@/lib/document-api";
import { instantToDb } from "@/lib/datetime";
import { orm } from "@/src/prisma/db";

/**
 * `{ share: boolean }` → `{ document }`: show a signed document in the patient's own app, or
 * stop showing it. Nothing unsigned is shared (a draft is a statement not made yet).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/doctor/documents/[id]/share">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { share?: unknown };
  const share = body.share !== false;
  const existing = await orm.DocumentRequest
    .select("id", "status")
    .where((r) => r.id.eq(id))
    .where((r) => r.clinicId.eq(doctor.clinicId))
    .where((r) => r.doctorId.eq(doctor.doctorId))
    .first();
  if (!existing) return apiError(404, "No document with that id.");
  if (share && existing.status !== "READY" && existing.status !== "RELEASED") return apiError(409, "Sign it first.");

  // updatedAt stays: it's when the document was signed (lib/document-api.ts).
  await orm.DocumentRequest.where((r) => r.id.eq(id)).update({ sharedWithPatientAt: share ? instantToDb(new Date()) : null });
  return Response.json({ document: await loadDocument(doctor, id) });
}
