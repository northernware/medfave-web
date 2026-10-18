import { apiDoctor, apiError, readJson } from "@/lib/api";
import { issueActivation } from "@/lib/activation";
import { activationLink, qrSvg } from "@/lib/activation-link";

/**
 * Issues an activation code for a chart, as the web desk's "Issue code"
 * (lib/activation.ts): the long code for the QR and messages, the 6-digit
 * code for there and then, and the QR as SVG. Shown once; only hashes are kept.
 *
 * JSON (optional): `for: "caregiver"` and `caregiverName` for a parent or
 * guardian's code. A chart that already has a login gets no code of its own.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/doctor/patients/[id]/activation">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;
  const body = (await readJson(request)) ?? {};
  const forCaregiver = body.for === "caregiver";
  const caregiverName =
    forCaregiver && typeof body.caregiverName === "string" ? body.caregiverName.trim().slice(0, 120) || null : null;

  const issued = await issueActivation(doctor, id, { forCaregiver, caregiverName });
  if (!issued) return apiError(404, "No code for this patient: they may already have a Medfave login.");

  const link = await activationLink(issued.token);
  return Response.json({ code: issued.token, pin: issued.pin, link, qrSvg: await qrSvg(link), mail: issued.mail }, { status: 201 });
}
