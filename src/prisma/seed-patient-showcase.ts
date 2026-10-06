import "dotenv/config";
import { devOnly } from "./dev-only";
import bcrypt from "bcryptjs";
import { or } from "@prisma/orm-postgres/orm-client";
import { orm } from "./db";
import { MARK, seedId } from "./seed-ids";
import { addDays } from "../../lib/scheduling";
import { calendarDateToDb, dayKey, fromDateTimeLocalValue, instantToDb } from "../../lib/datetime";

devOnly("db:seed-patient-showcase");

/*
 * Fills in what the patient app only shows when there is data for it, for the
 * demo patient (patient@medfave.com, Ramon Dela Cruz, Northern Family Clinic):
 *
 *  - two documents shared with him (Documents, and "From your clinic" on Home)
 *  - a visit tomorrow, not yet said "I'll be there" to (the confirm buttons)
 *  - a visit booked but not yet confirmed ("Pending" badge)
 *  - a visit with a move he asked for ("Move requested")
 *  - a request the clinic declined, with a note ("From the clinic: …")
 *  - a carer who sees his records (Profile → people who see my records)
 *  - Dr. Ana Reyes in his faves ("Your doctors" on Home)
 *
 * Every row it makes has an id from `seedId(MARK.patient, …)` (./seed-ids.ts),
 * or an older "showcase-" one, so it is safe to run
 * again: those rows are removed first and nothing else is touched. Needs the
 * main seed. Never run against real data.
 *
 *   npm run db:seed-patient-showcase
 */

const PATIENT_EMAIL = "patient@medfave.com";
const CARER_EMAIL = "marilou@medfave.com";
const PASSWORD = "password";
const id = (name: string) => seedId(MARK.patient, name);

/** A clinic day `offset` days on, skipping Sundays, at hh:mm. */
function at(offset: number, hour: number, minute = 0) {
  let key = addDays(dayKey(new Date()), offset);
  if (new Date(`${key}T00:00:00Z`).getUTCDay() === 0) key = addDays(key, 1);
  return { key, at: instantToDb(fromDateTimeLocalValue(`${key}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`)!) };
}

async function main() {
  const account = await orm.Account.select("id").where((a) => a.email.eq(PATIENT_EMAIL)).first();
  if (!account) throw new Error(`No ${PATIENT_EMAIL}: run npm run db:seed first.`);
  const chart = await orm.Patient
    .select("id", "clinicId")
    .where((p) => p.accountId.eq(account.id))
    .first();
  if (!chart) throw new Error("The demo patient has no chart.");
  const doctor = await orm.Doctor.select("id", "accountId").where((d) => d.clinicId.eq(chart.clinicId)).where((d) => d.fullName.eq("Dr. Ana Reyes")).first();
  if (!doctor?.accountId) throw new Error("No Dr. Ana Reyes at the demo clinic.");

  // Out with the last run's rows. `deleteAndCount`, not `delete`: that removes one row.
  await orm.AppointmentRequest.where((r) => or(r.id.like(`${MARK.patient}-%`), r.id.like("showcase-%"))).deleteAndCount();
  await orm.Appointment.where((a) => or(a.id.like(`${MARK.patient}-%`), a.id.like("showcase-%"))).deleteAndCount();
  await orm.DocumentRequest.where((d) => or(d.id.like(`${MARK.patient}-%`), d.id.like("showcase-%"))).deleteAndCount();
  await orm.CareLink.where((c) => or(c.id.like(`${MARK.patient}-%`), c.id.like("showcase-%"))).deleteAndCount();
  await orm.Fave.where((f) => or(f.id.like(`${MARK.patient}-%`), f.id.like("showcase-%"))).deleteAndCount();

  const now = instantToDb(new Date());
  const base = { clinicId: chart.clinicId, patientId: chart.id, doctorId: doctor.id, createdAt: now, updatedAt: now };

  // Documents shared to his portal.
  await orm.DocumentRequest.create({
    ...base,
    id: id("doc-certificate"),
    type: "MEDICAL_CERTIFICATE",
    status: "RELEASED",
    purpose: "Leave from work",
    requesterName: "Ramon Dela Cruz",
    requesterRelation: "Self",
    details: JSON.stringify({
      admittedOn: at(-12, 9).key,
      dischargedOn: at(-10, 9).key,
      diagnosis: "Acute gastroenteritis",
      restFrom: at(-10, 9).key,
      restTo: at(-7, 9).key,
      remarks: "Fit to return to work.",
    }),
    sharedWithPatientAt: instantToDb(new Date(Date.now() - 6 * 86_400_000)),
    releasedAt: instantToDb(new Date(Date.now() - 6 * 86_400_000)),
    releasedById: doctor.id,
    releasedTo: "Ramon Dela Cruz",
  });
  await orm.DocumentRequest.create({
    ...base,
    id: id("doc-insurance"),
    type: "INSURANCE_CLAIM",
    status: "RELEASED",
    purpose: "HMO reimbursement",
    requesterName: "Ramon Dela Cruz",
    requesterRelation: "Self",
    details: JSON.stringify({
      insurer: "Maxicare",
      policyNumber: "MX-2041-7788",
      claimType: "Outpatient",
      diagnosis: "Essential hypertension",
      icdCode: "I10",
      treatmentFrom: at(-20, 9).key,
      totalCharges: "1500",
    }),
    sharedWithPatientAt: instantToDb(new Date(Date.now() - 2 * 86_400_000)),
    releasedAt: instantToDb(new Date(Date.now() - 2 * 86_400_000)),
    releasedById: doctor.id,
    releasedTo: "Ramon Dela Cruz",
  });

  // Tomorrow: inside the window to say "I'll be there" or ask to move it.
  await orm.Appointment.create({
    ...base,
    id: id("tomorrow-visit"),
    scheduledAt: at(1, 9, 30).at,
    durationMinutes: 30,
    service: "GENERAL_CONSULTATION",
    reason: "Cough for a week",
    status: "CONFIRMED",
  } as Parameters<typeof orm.Appointment.create>[0]);

  // Booked, not yet confirmed.
  await orm.Appointment.create({
    ...base,
    id: id("pending-visit"),
    scheduledAt: at(9, 10, 0).at,
    durationMinutes: 30,
    service: "LABORATORY_RESULT_REVIEW",
    reason: "Go over the blood test results",
    status: "PENDING",
  } as Parameters<typeof orm.Appointment.create>[0]);

  // Confirmed, with a move he has asked for.
  const moving = at(11, 15, 0);
  await orm.Appointment.create({
    ...base,
    id: id("moving-visit"),
    scheduledAt: moving.at,
    durationMinutes: 20,
    service: "FOLLOW_UP_CHECKUP",
    reason: "Blood pressure follow-up",
    status: "CONFIRMED",
  } as Parameters<typeof orm.Appointment.create>[0]);
  await orm.AppointmentRequest.create({
    ...base,
    id: id("move-request"),
    requestedById: account.id,
    preferredDate: calendarDateToDb(new Date(`${at(12, 9).key}T00:00:00Z`)),
    preferredTime: "09:30",
    service: "FOLLOW_UP_CHECKUP",
    reason: "Blood pressure follow-up",
    rescheduleOfId: id("moving-visit"),
    status: "PENDING",
  } as Parameters<typeof orm.AppointmentRequest.create>[0]);

  // Asked, and declined with a note.
  await orm.AppointmentRequest.create({
    ...base,
    id: id("declined-request"),
    requestedById: account.id,
    preferredDate: calendarDateToDb(new Date(`${at(-1, 9).key}T00:00:00Z`)),
    preferredTime: "16:30",
    service: "MEDICAL_CERTIFICATE_REQUEST",
    reason: "Certificate for the gym",
    status: "DECLINED",
    decisionNote: "We close at 4:30 on that day. Please pick a morning, or call the desk.",
    decidedById: doctor.accountId,
    decidedAt: now,
  } as Parameters<typeof orm.AppointmentRequest.create>[0]);

  // A carer: Marilou looks after his records too.
  let carer = await orm.Account.select("id").where((a) => a.email.eq(CARER_EMAIL)).first();
  if (!carer) {
    carer = await orm.Account.select("id").create({
      id: id("carer-account"),
      email: CARER_EMAIL,
      passwordHash: await bcrypt.hash(PASSWORD, 12),
      fullName: "Marilou Dela Cruz",
      firstName: "Marilou",
      lastName: "Dela Cruz",
      createdAt: now,
      updatedAt: now,
    });
  }
  await orm.CareLink.create({
    id: id("carer-link"),
    clinicId: chart.clinicId,
    patientId: chart.id,
    accountId: carer.id,
    grantedById: doctor.accountId,
    caregiverName: "Marilou Dela Cruz",
    createdAt: now,
  });

  // Dr. Reyes in his faves, unless he faved her already.
  const faved = await orm.Fave.select("id").where((f) => f.accountId.eq(account.id)).where((f) => f.doctorId.eq(doctor.id)).first();
  if (!faved) await orm.Fave.create({ id: id("fave"), accountId: account.id, doctorId: doctor.id, createdAt: now });

  console.log("Showcase data added for", PATIENT_EMAIL, "· carer login", CARER_EMAIL, "/", PASSWORD);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
