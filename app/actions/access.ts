"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { orm } from "@/src/prisma/db";
import { requireClinicManager, requireStaff } from "@/lib/auth";
import { instantToDb } from "@/lib/datetime";
import { issueActivation } from "@/lib/activation";
import type { FormState } from "@/lib/validation";
import { createStaffInvite } from "@/lib/staff";
import { grantCareByStaff } from "@/lib/caregivers";

/**
 * Issues the one-time code that lets a patient connect a login to their chart,
 * from the desk's patient page (lib/activation.ts).
 */
export async function issuePatientActivation(formData: FormData) {
  const staff = await requireStaff();
  const patientId = String(formData.get("patientId") ?? "");
  if (!patientId) return;
  // For a parent or guardian the desk has identified, not the patient: the
  // code lets their login look after this chart (see `CareLink`).
  const forCaregiver = formData.get("for") === "caregiver";
  const caregiverName = forCaregiver ? String(formData.get("caregiverName") ?? "").trim().slice(0, 120) || null : null;

  const issued = await issueActivation(staff, patientId, { forCaregiver, caregiverName });
  if (!issued) return;
  const { token, pin, mail } = issued;

  revalidatePath(`/desk/patients/${patientId}`);
  // The code travels in the URL exactly once, to be read off the screen.
  const who = forCaregiver ? `&for=caregiver${caregiverName ? `&to=${encodeURIComponent(caregiverName)}` : ""}` : "";
  redirect(`/desk/patients/${patientId}?code=${encodeURIComponent(token)}&pin=${pin}&mail=${mail}${who}`);
}

export async function revokePatientActivation(formData: FormData) {
  const staff = await requireStaff();
  const patientId = String(formData.get("patientId") ?? "");
  if (!patientId) return;

  const owned = await orm.Patient
    .select("id")
    .where((p) => p.id.eq(patientId))
    .where((p) => p.clinicId.eq(staff.clinicId))
    .first();
  if (!owned) return;

  const now = instantToDb(new Date());
  const forCaregiver = formData.get("for") === "caregiver";
  // One caregiver's code, when named; otherwise every live code of the kind.
  const activationId = String(formData.get("activationId") ?? "");
  for (;;) {
    const live = await orm.PatientActivation
      .select("id")
      .where((a) => a.patientId.eq(patientId))
      .where((a) => (activationId ? a.id.eq(activationId) : a.forCaregiver.eq(forCaregiver)))
      .where((a) => a.usedAt.isNull())
      .where((a) => a.revokedAt.isNull())
      .first();
    if (!live) break;
    await orm.PatientActivation.where((a) => a.id.eq(live.id)).update({ revokedAt: now });
  }

  revalidatePath(`/desk/patients/${patientId}`);
  redirect(`/desk/patients/${patientId}`);
}

/**
 * Gives somebody already on Medfave access to a chart they look after — picked
 * from the household, or found by their email. No code: it is in their family
 * list straight away (`grantCareByStaff`).
 */
export async function giveCareAccess(formData: FormData) {
  const staff = await requireStaff();
  const patientId = String(formData.get("patientId") ?? "");
  const result = await grantCareByStaff(staff, patientId, {
    accountId: String(formData.get("accountId") ?? "") || undefined,
    email: String(formData.get("email") ?? "") || undefined,
  });
  revalidatePath(`/desk/patients/${patientId}`);
  redirect(
    `/desk/patients/${patientId}?care=${result.ok ? `given&to=${encodeURIComponent(result.name ?? "")}` : `refused&why=${encodeURIComponent(result.message)}`}`,
  );
}

/**
 * Ends a caregiver's access to a chart. Kept, not deleted, so who could see
 * the chart and when stays answerable.
 */
export async function revokeCareLink(formData: FormData) {
  const staff = await requireStaff();
  const linkId = String(formData.get("linkId") ?? "");
  const link = await orm.CareLink
    .select("id", "patientId", "revokedAt")
    .where((l) => l.id.eq(linkId))
    .where((l) => l.clinicId.eq(staff.clinicId))
    .first();
  if (!link) return;
  if (!link.revokedAt) {
    await orm.CareLink.where((l) => l.id.eq(link.id)).update({ revokedAt: instantToDb(new Date()), revokedById: staff.accountId });
  }
  revalidatePath(`/desk/patients/${link.patientId}`);
  redirect(`/desk/patients/${link.patientId}`);
}

/**
 * Invites somebody to work at the clinic.
 *
 * A manager's decision, not the desk's: staff should not be able to appoint
 * more staff. The role is fixed on the invitation, so accepting it cannot grant
 * anything that was not chosen here.
 *
 * A doctor can be invited too, but joins pending: they add their PRC license
 * and a Medfave admin verifies it before they see any patient, exactly as a
 * doctor who signs up alone (lib/practice.ts). An administrator invitation
 * names this clinic and nothing else: it appoints somebody to run this
 * practice, not to reach past it.
 */
export async function inviteStaff(_prev: FormState, formData: FormData): Promise<FormState> {
  const manager = await requireClinicManager();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const result = await createStaffInvite(manager, { email, role: formData.get("role") });
  if (!result.ok) return result;

  revalidatePath("/manage/staff");
  // Shown on screen either way. Mail is a convenience here, not the record of
  // what was issued.
  redirect(
    `/manage/staff?code=${encodeURIComponent(result.code)}&to=${encodeURIComponent(email)}&mail=${result.mail}`,
  );
}

export async function revokeStaffInvite(formData: FormData) {
  const manager = await requireClinicManager();
  const inviteId = String(formData.get("inviteId") ?? "");
  if (!inviteId) return;

  const invite = await orm.StaffInvite
    .select("id")
    .where((i) => i.id.eq(inviteId))
    .where((i) => i.clinicId.eq(manager.clinicId))
    .first();
  if (!invite) return;

  await orm.StaffInvite.where((i) => i.id.eq(inviteId)).update({
    revokedAt: instantToDb(new Date()),
  });
  revalidatePath("/manage/staff");
}

/** Removes somebody's standing in this clinic. Their account is left alone. */
export async function removeClinicMember(formData: FormData) {
  const manager = await requireClinicManager();
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return;

  const member = await orm.ClinicMember
    .select("id", "accountId", "role")
    .where((m) => m.id.eq(memberId))
    .where((m) => m.clinicId.eq(manager.clinicId))
    .first();
  if (!member) return;

  // A clinic that can be left with nobody clinical in it is a clinic whose
  // records nobody can reach.
  if (member.role === "DOCTOR") return;

  // And one left with nobody able to administer it is a clinic nobody can
  // appoint staff to again, including the person who would have to undo this.
  // Counted rather than assumed: whoever is doing this may be the last one, and
  // removing yourself is the easiest way to do it by accident.
  if (member.role === "ADMIN") {
    const members = await orm.ClinicMember
      .select("id", "role")
      .where((m) => m.clinicId.eq(manager.clinicId))
      .all();
    const remaining = members.filter(
      (m) => m.id !== memberId && (m.role === "DOCTOR" || m.role === "ADMIN"),
    );
    if (remaining.length === 0) return;
  }

  await orm.ClinicMember.where((m) => m.id.eq(memberId)).delete();
  revalidatePath("/manage/staff");
}
