import { apiError, apiPatient } from "@/lib/api";
import { confirmByPatient } from "@/lib/patient-visits";

/**
 * The patient saying "I'll be there", from the day before the visit until its
 * time (`canConfirm` on GET /patient/appointments). → `{ id, confirmedAt }`;
 * `409` outside that window or once the visit is settled.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/patient/appointments/[id]/confirm">) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  const { id } = await ctx.params;
  const result = await confirmByPatient(me, id);
  if (!result.ok) return apiError(result.status, result.message);
  return Response.json({ id, confirmedAt: result.confirmedAt.toISOString() });
}
