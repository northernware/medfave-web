import "server-only";
import { instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { orm } from "@/src/prisma/db";

/** Who is waiting for the apps. Doctors and clinics first: they are who the apps are for at launch. */
export const WAITLIST_ROLES = [
  { value: "DOCTOR", label: "I’m a doctor" },
  { value: "CLINIC", label: "I run or work at a clinic" },
  { value: "PATIENT", label: "I’m a patient" },
] as const;
export type WaitlistRole = (typeof WAITLIST_ROLES)[number]["value"];

export type WaitlistResult = { ok: true } | { ok: false; field?: "email" | "role"; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Adds an email to the app waitlist. Signing up twice is not an error: the
 * person sees the same confirmation and the first entry stays (no way to learn
 * who else is on the list).
 */
export async function joinWaitlist(input: { email: unknown; role: unknown; organization: unknown }): Promise<WaitlistResult> {
  const email = String(input.email ?? "").trim().toLowerCase();
  const role = String(input.role ?? "");
  const organization = String(input.organization ?? "").trim().slice(0, 120) || null;

  if (!EMAIL.test(email) || email.length > 254) return { ok: false, field: "email", message: "Enter an email address, like name@example.com." };
  if (!WAITLIST_ROLES.some((r) => r.value === role)) return { ok: false, field: "role", message: "Choose who you are." };

  const existing = await orm.WaitlistEntry.select("id").where((w) => w.email.eq(email)).first();
  if (!existing) {
    try {
      await orm.WaitlistEntry.create({ id: newId(), email, role, organization, createdAt: instantToDb(new Date()) });
    } catch {
      // A second submit raced the first: the unique email already holds it.
    }
  }
  return { ok: true };
}
