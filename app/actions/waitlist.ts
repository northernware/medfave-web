"use server";

import { clientAddress, hit, LIMITS, TOO_MANY } from "@/lib/rate-limit";
import { joinWaitlist } from "@/lib/waitlist";

export type WaitlistState = { ok?: boolean; message?: string; field?: "email" | "role"; values?: Record<string, string> };

/** The landing page's app waitlist. */
export async function waitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const values = { email: String(formData.get("email") ?? ""), role: String(formData.get("role") ?? ""), organization: String(formData.get("organization") ?? "") };
  if (!(await hit(`waitlist:address:${await clientAddress()}`, LIMITS.waitlistAddress))) return { message: TOO_MANY, values };
  const result = await joinWaitlist(values);
  if (!result.ok) return { message: result.message, field: result.field, values };
  return { ok: true, message: "You’re on the list. We’ll email you when the apps are in the stores." };
}
