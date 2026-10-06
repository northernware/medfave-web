import "dotenv/config";
import { devOnly } from "./dev-only";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { db, orm } from "./db";
import { calendarDateToDb, instantToDb } from "../../lib/datetime";
import { newId } from "../../lib/ids";
import { ClinicalListStatus, Relationship, Sex } from "../../lib/enums";

devOnly("db:seed-group-practice");

/*
 * A test group practice: two doctors and one desk in one clinic.
 *
 * Built to find what breaks before group practices are built properly
 * (plans/registration.md, phase 5). Most of the code still assumes one doctor
 * per clinic; this clinic is where that shows. Findings go in
 * medfave-design's plans/group-practice-findings.md.
 *
 *   Dr. Bea Ramos (Family Medicine)   group.doctor1@medfave.com   Mon–Fri 8–12
 *   Dr. Carlo Lim (Pediatrics)        group.doctor2@medfave.com   Mon–Fri 1–5, Sat 9–12
 *   Clinic opening hours: Mon–Fri 8–5, Sat 9–12
 *   Desk: Joy Santos                  group.desk@medfave.com
 *   Password for all three: password
 *
 * Each doctor has one patient with a visit booked for tomorrow. Safe to run
 * again: it removes the earlier clinic and accounts first. Never run against
 * real data.
 *
 *   npm run db:seed-group-practice
 */

const CLINIC_NAME = "Magsaysay Group Clinic";
const PASSWORD = "password";
const DOCTORS = [
  {
    email: "group.doctor1@medfave.com",
    name: "Dr. Bea Ramos",
    specialty: "Family Medicine",
    license: "0412210",
    hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, openMinute: 8 * 60, closeMinute: 12 * 60 })),
    patient: { firstName: "Teresa", lastName: "Gomez", sex: Sex.FEMALE, born: [1968, 7, 3], phone: "0918 300 1122" },
  },
  {
    email: "group.doctor2@medfave.com",
    name: "Dr. Carlo Lim",
    specialty: "Pediatrics",
    license: "0515320",
    hours: [
      ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, openMinute: 13 * 60, closeMinute: 17 * 60 })),
      { weekday: 6, openMinute: 9 * 60, closeMinute: 12 * 60 },
    ],
    patient: { firstName: "Miguel", lastName: "Reyes", sex: Sex.MALE, born: [2019, 1, 22], phone: "0919 400 3344" },
  },
] as const;
const DESK = { email: "group.desk@medfave.com", name: "Joy Santos" };

/** As in seed-second-clinic.ts (lib/tokens.ts is server-only). Keep them alike. */
/** As lib/tokens.ts, which is server-only and cannot be imported from a script. Keep the two alike. */
function issueToken() {
  const raw = randomBytes(10).toString("base64url").replace(/[-_]/g, "").toUpperCase();
  const padded = (raw + randomBytes(6).toString("hex").toUpperCase()).slice(0, 16);
  const token = padded.match(/.{1,4}/g)!.join("-");
  const hash = createHash("sha256").update(token.trim().toUpperCase().replace(/\s+/g, "")).digest("hex");
  return { token, hash };
}

async function nextPatientNumber() {
  const year = new Date().getUTCFullYear();
  await db.transaction(async (tx) => {
    await tx.execute(
      db.raw.sql`INSERT INTO "PatientNumberCounter" ("year","lastUsed") VALUES (${year},0) ON CONFLICT ("year") DO NOTHING`
        .affectedCount().build() as never,
    );
    await tx.execute(
      db.raw.sql`UPDATE "PatientNumberCounter" SET "lastUsed"="lastUsed"+1 WHERE "year"=${year}`
        .affectedCount().build() as never,
    );
  });
  const counter = await orm.PatientNumberCounter.select("lastUsed").where((c) => c.year.eq(year)).first();
  return `MK-${year}-${String(counter!.lastUsed).padStart(6, "0")}`;
}

/** Tomorrow at `minute` past midnight, Manila time, as a UTC instant. */
function tomorrowAt(minute: number) {
  const manilaToday = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const day = Date.UTC(manilaToday.getUTCFullYear(), manilaToday.getUTCMonth(), manilaToday.getUTCDate() + 1);
  return new Date(day + minute * 60 * 1000 - 8 * 60 * 60 * 1000);
}

async function main() {
  const now = instantToDb(new Date());

  const old = await orm.Clinic.select("id").where((c) => c.name.eq(CLINIC_NAME)).first();
  if (old) await orm.Clinic.where((c) => c.id.eq(old.id)).delete();
  for (const email of [...DOCTORS.map((d) => d.email), DESK.email]) {
    await orm.Account.where((a) => a.email.eq(email)).delete();
  }

  const clinic = await orm.Clinic.select("id").create({
    id: newId(),
    name: CLINIC_NAME,
    address: "88 Magsaysay Ave., Baguio City",
    slug: "magsaysay-group-clinic",
    // Listed, so "Find a doctor" has somebody to find in development.
    listed: true,
    contactNumber: "(074) 442 7788",
    createdAt: now,
    updatedAt: now,
  });
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  // The clinic is open 8–5 on weekdays and Saturday morning; each doctor's hours sit inside.
  for (const weekday of [1, 2, 3, 4, 5]) {
    await orm.ClinicOpeningHours.create({ id: newId(), clinicId: clinic.id, weekday, openMinute: 8 * 60, closeMinute: 17 * 60 });
  }
  await orm.ClinicOpeningHours.create({ id: newId(), clinicId: clinic.id, weekday: 6, openMinute: 9 * 60, closeMinute: 12 * 60 });

  const lines: string[] = [];
  for (const [i, d] of DOCTORS.entries()) {
    // A second apart, so "the clinic's first doctor" (lib/clinic.ts) is always
    // Dr. Ramos. With equal times the pick is arbitrary: that was a finding.
    const created = instantToDb(new Date(Date.now() - (DOCTORS.length - i) * 1000));
    const account = await orm.Account.select("id").create({
      id: newId(),
      email: d.email,
      passwordHash,
      fullName: d.name,
      emailVerifiedAt: now,
      signupRole: "DOCTOR",
      createdAt: now,
      updatedAt: now,
    });
    await orm.ClinicMember.create({ id: newId(), clinicId: clinic.id, accountId: account.id, role: "DOCTOR", createdAt: now, updatedAt: now });
    const doctor = await orm.Doctor.create({
      id: newId(),
      clinicId: clinic.id,
      accountId: account.id,
      fullName: d.name,
      specialty: d.specialty,
      licenseNumber: d.license,
      verificationStatus: "VERIFIED",
      verifiedAt: now,
      createdAt: created,
      updatedAt: now,
    });
    for (const h of d.hours) await orm.ClinicHours.create({ id: newId(), doctorId: doctor.id, ...h });

    const household = await orm.Household.select("id").create({
      id: newId(),
      clinicId: clinic.id,
      doctorId: doctor.id,
      name: d.patient.lastName,
      address: "Baguio City",
      contactNumber: d.patient.phone,
      createdAt: now,
      updatedAt: now,
    } as Parameters<typeof orm.Household.create>[0]);
    const [y, m, day] = d.patient.born;
    const patient = await orm.Patient.select("id").create({
      id: newId(),
      clinicId: clinic.id,
      householdId: household.id,
      patientNumber: await nextPatientNumber(),
      firstName: d.patient.firstName,
      lastName: d.patient.lastName,
      dateOfBirth: calendarDateToDb(new Date(Date.UTC(y, m - 1, day))),
      sex: d.patient.sex,
      relationship: Relationship.HEAD,
      contactNumber: d.patient.phone,
      allergyStatus: ClinicalListStatus.NONE_KNOWN,
      medicationStatus: ClinicalListStatus.UNKNOWN,
      conditionStatus: ClinicalListStatus.UNKNOWN,
      createdAt: now,
      updatedAt: now,
    } as Parameters<typeof orm.Patient.create>[0]);
    await orm.Appointment.create({
      id: newId(),
      clinicId: clinic.id,
      patientId: patient.id,
      doctorId: doctor.id,
      bookedById: account.id,
      scheduledAt: instantToDb(tomorrowAt(d.hours[0].openMinute + 60)),
      durationMinutes: 30,
      reason: "Check-up",
      status: "CONFIRMED",
      createdAt: now,
      updatedAt: now,
    } as Parameters<typeof orm.Appointment.create>[0]);

    const { token, hash } = issueToken();
    await orm.PatientActivation.create({
      id: newId(),
      clinicId: clinic.id,
      patientId: patient.id,
      tokenHash: hash,
      issuedById: account.id,
      expiresAt: instantToDb(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
      createdAt: now,
    });
    lines.push(`  ${d.name.padEnd(14)} ${d.email} · patient ${d.patient.firstName} ${d.patient.lastName}, code ${token}`);
  }

  const desk = await orm.Account.select("id").create({
    id: newId(),
    email: DESK.email,
    passwordHash,
    fullName: DESK.name,
    emailVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await orm.ClinicMember.create({ id: newId(), clinicId: clinic.id, accountId: desk.id, role: "SECRETARY", createdAt: now, updatedAt: now });

  console.log(`${CLINIC_NAME} is ready. Password for everyone: ${PASSWORD}`);
  lines.forEach((l) => console.log(l));
  console.log(`  Desk           ${DESK.email}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
