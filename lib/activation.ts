import "server-only";
import { orm } from "@/src/prisma/db";
import { instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { hashPin, issuePin, issueToken } from "@/lib/tokens";
import { appUrl, sendPatientActivation } from "@/lib/email";

/** Long enough to hand over and be typed in later; short enough to expire. */
const ACTIVATION_DAYS = 14;

/** The 6-digit code is for the desk, there and then: minutes, not days. */
const PIN_MINUTES = 30;

const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

/**
 * Issues the one-time code that lets a patient connect a login to their chart.
 *
 * Desk work: the person is standing there, and identifying them is exactly
 * what a records desk does. The code is shown once, on the page that asked for
 * it, and only its hash is kept — so it cannot be read back out of the system
 * afterwards, by staff or by anybody who reaches the database.
 *
 * Shared by the desk's action (app/actions/access.ts) and the doctor app's API.
 * Null when the chart isn't this clinic's, or already has a login (for the
 * patient's own code).
 */
export async function issueActivation(
  staff: { clinicId: string; accountId: string },
  patientId: string,
  { forCaregiver = false, caregiverName = null }: { forCaregiver?: boolean; caregiverName?: string | null } = {},
) {
  const patient = await orm.Patient
    .select("id", "accountId", "firstName", "lastName", "email")
    .include("clinic", (c) => c.select("name"))
    .where((p) => p.id.eq(patientId))
    .where((p) => p.clinicId.eq(staff.clinicId))
    .first();
  if (!patient || (!forCaregiver && patient.accountId)) return null;

  const now = instantToDb(new Date());

  // Any code of the patient's own already out stops working: one live code
  // at a time means a reissue is a replacement, not an addition. Caregiver
  // codes are each for a different person (mom, dad), so they sit side by side.
  for (;;) {
    if (forCaregiver) break;
    const live = await orm.PatientActivation
      .select("id")
      .where((a) => a.patientId.eq(patientId))
      .where((a) => a.forCaregiver.eq(forCaregiver))
      .where((a) => a.usedAt.isNull())
      .where((a) => a.revokedAt.isNull())
      .first();
    if (!live) break;
    await orm.PatientActivation.where((a) => a.id.eq(live.id)).update({ revokedAt: now });
  }

  const { token, hash } = issueToken();
  const pin = await unusedPin();
  await orm.PatientActivation.create({
    id: newId(),
    clinicId: staff.clinicId,
    patientId,
    tokenHash: hash,
    pinHash: pin.hash,
    pinExpiresAt: instantToDb(new Date(Date.now() + PIN_MINUTES * 60 * 1000)),
    issuedById: staff.accountId,
    forCaregiver,
    caregiverName,
    expiresAt: instantToDb(days(ACTIVATION_DAYS)),
    createdAt: now,
  });

  // Posted as well, when the patient has an address on file and the clinic
  // has mail configured. Never instead: the code is still shown on screen, so
  // a mistyped address or a provider having a bad afternoon does not send
  // somebody home empty-handed.
  // A caregiver's code is never mailed to the patient's address: it is for somebody else.
  let mail: "sent" | "failed" | "no-address" | "off" = "off";
  if (forCaregiver) {
    mail = "off";
  } else if (patient.email) {
    const outcome = await sendPatientActivation({
      to: patient.email,
      patientName: `${patient.firstName} ${patient.lastName}`,
      clinicName: patient.clinic.name,
      code: token,
      link: appUrl(`/register?code=${encodeURIComponent(token)}`),
    });
    mail = outcome.sent ? "sent" : outcome.reason === "not-configured" ? "off" : "failed";
  } else {
    mail = "no-address";
  }

  return { token, pin: pin.pin, mail };
}

/** A 6-digit code no other activation is using right now, so one PIN names one chart. */
async function unusedPin() {
  const now = instantToDb(new Date());
  for (;;) {
    const candidate = issuePin();
    const clash = await orm.PatientActivation
      .select("id")
      .where((a) => a.pinHash.eq(hashPin(candidate.pin)))
      .where((a) => a.pinExpiresAt.gt(now))
      .where((a) => a.usedAt.isNull())
      .where((a) => a.revokedAt.isNull())
      .first();
    if (!clash) return candidate;
  }
}

