import "dotenv/config";
import { devOnly } from "./dev-only";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { db, orm } from "./db";
import { calendarDateToDb, instantToDb } from "../../lib/datetime";
import { newId } from "../../lib/ids";
import { ClinicalListStatus, Relationship, Sex } from "../../lib/enums";

devOnly("db:seed-second-clinic");

/*
 * A second clinic, for trying "one login, many clinics" in development.
 *
 * Riverside Health Center, with its own doctor, and a chart there for Ramon
 * Dela Cruz — the same person the main seed makes a patient of Northern Family
 * Clinic, whose login is patient@medfave.com. Prints an activation code for
 * that chart: sign in as Ramon, choose "Add a clinic", and enter it.
 *
 * Safe to run again: it removes an earlier Riverside first (its charts go with
 * it) and issues a fresh code. Never run against real data.
 *
 *   npm run db:seed-second-clinic
 */

const CLINIC_NAME = "Riverside Health Center";
const DOCTOR_EMAIL = "doctor2@medfave.com";
const PASSWORD = "password";

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

async function main() {
  const now = instantToDb(new Date());

  const old = await orm.Clinic.select("id").where((c) => c.name.eq(CLINIC_NAME)).first();
  if (old) await orm.Clinic.where((c) => c.id.eq(old.id)).delete();
  await orm.Account.where((a) => a.email.eq(DOCTOR_EMAIL)).delete();

  const clinic = await orm.Clinic.select("id").create({
    id: newId(),
    name: CLINIC_NAME,
    address: "12 Rizal Ave., Ilagan, Isabela",
    contactNumber: "(078) 622 0417",
    createdAt: now,
    updatedAt: now,
  });

  const account = await orm.Account.select("id").create({
    id: newId(),
    email: DOCTOR_EMAIL,
    passwordHash: await bcrypt.hash(PASSWORD, 12),
    fullName: "Dr. Paolo Mendoza",
    createdAt: now,
    updatedAt: now,
  });
  await orm.ClinicMember.create({
    id: newId(),
    clinicId: clinic.id,
    accountId: account.id,
    role: "DOCTOR",
    createdAt: now,
    updatedAt: now,
  });
  const doctor = await orm.Doctor.create({
    id: newId(),
    clinicId: clinic.id,
    accountId: account.id,
    fullName: "Dr. Paolo Mendoza",
    specialty: "Internal Medicine",
    clinicName: CLINIC_NAME,
    licenseNumber: "PRC-0203871",
    // A demo clinic that works straight away: skip the license check.
    verificationStatus: "VERIFIED",
    verifiedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  const household = await orm.Household.select("id").create({
    id: newId(),
    clinicId: clinic.id,
    doctorId: doctor.id,
    name: "Dela Cruz",
    address: "24 Mabini St., Barangay San Roque, Tuguegarao",
    contactNumber: "0917 442 1180",
    createdAt: now,
    updatedAt: now,
  } as Parameters<typeof orm.Household.create>[0]);

  const patient = await orm.Patient.select("id").create({
    id: newId(),
    clinicId: clinic.id,
    householdId: household.id,
    patientNumber: await nextPatientNumber(),
    firstName: "Ramon",
    middleName: "Santos",
    lastName: "Dela Cruz",
    dateOfBirth: calendarDateToDb(new Date(Date.UTC(1979, 3, 12))),
    sex: Sex.MALE,
    relationship: Relationship.HEAD,
    contactNumber: "0917 442 1180",
    allergyStatus: ClinicalListStatus.NONE_KNOWN,
    medicationStatus: ClinicalListStatus.UNKNOWN,
    conditionStatus: ClinicalListStatus.UNKNOWN,
    createdAt: now,
    updatedAt: now,
  } as Parameters<typeof orm.Patient.create>[0]);

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

  console.log(`${CLINIC_NAME} is ready.`);
  console.log(`  Doctor:          ${DOCTOR_EMAIL} / ${PASSWORD}`);
  console.log(`  Activation code: ${token}  (Ramon Dela Cruz's chart here)`);
  console.log(`Sign in as patient@medfave.com, choose "Add a clinic", and enter the code.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
