import "dotenv/config";
import { devOnly } from "./dev-only";
import bcrypt from "bcryptjs";
import { backfillAccountsAndClinics } from "./backfill-accounts";
import { db, orm } from "./db";
import {
  calendarDateToDb,
  dayKey,
  fromDateTimeLocalValue,
  instantToDb,
  startOfClinicDay,
} from "../../lib/datetime";
import { newId } from "../../lib/ids";
import {
  AllergySeverity,
  AppointmentStatus,
  AppointmentType,
  BookingSource,
  BloodType,
  ClinicalListStatus,
  Relationship,
  ServiceType,
  Sex,
  VisitPriority,
} from "../../lib/enums";

devOnly("db:seed");

const DEMO_EMAIL = "doctor@medfave.com";
const DEMO_PASSWORD = "password";
const SECRETARY_EMAIL = "desk@medfave.com";
const PATIENT_EMAIL = "patient@medfave.com";
const CLINIC_NAME = "Northern Family Clinic";

const DAY_MS = 86_400_000;

/** The clinic-day key `offset` days from today. Manila keeps no DST, so a flat
 *  24-hour step is exact and the key is re-derived in clinic time either way. */
function clinicDay(offset: number) {
  const today = startOfClinicDay(dayKey(new Date()));
  return dayKey(new Date(today.getTime() + offset * DAY_MS));
}

/** The weekday of a "YYYY-MM-DD" key, read as a plain calendar date. */
function weekdayOf(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Days from today at a given clinic hour, so the seed always looks current.
 * Sundays are nudged to the Monday after — the clinic is closed, and demo data
 * that breaks the app's own booking rules is just confusing.
 *
 * The hours below are clinic hours, and they are built through the clinic-day
 * key rather than `setHours`, which would read whichever timezone the machine
 * running the seed happens to be in. On a UTC container that put every 9 AM slot
 * at 5 PM in Manila and filled the demo schedule with evening appointments.
 */
function at(dayOffset: number, hour: number, minute = 0) {
  let key = clinicDay(dayOffset);
  if (weekdayOf(key) === 0) key = clinicDay(dayOffset + 1);
  return instantToDb(fromDateTimeLocalValue(`${key}T${pad2(hour)}:${pad2(minute)}`)!);
}

function born(year: number, month: number, day: number) {
  return calendarDateToDb(new Date(Date.UTC(year, month - 1, day)));
}

type ClinicalSeed = {
  label: string;
  reaction?: string;
  severity?: AllergySeverity;
  dosage?: string;
  frequency?: string;
  notes?: string;
};
type PatientSeed = Record<string, unknown> & {
  allergies?: ClinicalSeed[];
  conditions?: ClinicalSeed[];
  medications?: ClinicalSeed[];
  alerts?: ClinicalSeed[];
};

/**
 * Prisma 8 has no nested create, so these helpers keep the seed's data readable
 * as one literal per household and do the flattening themselves. Ids and audit
 * timestamps are the application's job now, so they are filled in here too.
 */
/** The same per-year counter the app allocates from, so seeded numbers match. */
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

/**
 * Every clinical row belongs to exactly one clinic, and the database enforces
 * it. The seed builds one clinic, so the helpers stamp its id on each row
 * rather than every literal below repeating it.
 */
let seedClinicId = "";

async function seedHousehold(
  data: Record<string, unknown> & { patients: PatientSeed[] },
) {
  const now = instantToDb(new Date());
  const { patients, ...household } = data;
  const created = await orm.Household.create({
    ...household,
    clinicId: seedClinicId,
    id: newId(),
    createdAt: now,
    updatedAt: now,
  } as Parameters<typeof orm.Household.create>[0]);

  const rows: { id: string; firstName: string }[] = [];
  for (const patient of patients) {
    const { allergies = [], conditions = [], medications = [], alerts = [], ...scalars } = patient;
    const row = await orm.Patient.create({
      ...scalars,
      clinicId: seedClinicId,
      id: newId(),
      patientNumber: await nextPatientNumber(),
      householdId: created.id,
      createdAt: now,
      updatedAt: now,
    } as Parameters<typeof orm.Patient.create>[0]);
    for (const a of allergies) {
      await orm.PatientAllergy.create({
        ...a,
        id: newId(),
        patientId: row.id,
        createdAt: now,
      } as Parameters<typeof orm.PatientAllergy.create>[0]);
    }
    for (const c of conditions) {
      await orm.PatientCondition.create({
        id: newId(),
        patientId: row.id,
        label: c.label,
        notes: c.notes ?? null,
        createdAt: now,
      });
    }
    for (const m of medications) {
      await orm.PatientMedication.create({
        id: newId(),
        patientId: row.id,
        label: m.label,
        dosage: m.dosage ?? null,
        frequency: m.frequency ?? null,
        notes: m.notes ?? null,
        createdAt: now,
      });
    }
    for (const a of alerts) {
      await orm.PatientAlert.create({
        id: newId(),
        patientId: row.id,
        label: a.label,
        notes: a.notes ?? null,
        createdAt: now,
      });
    }
    rows.push({ id: row.id, firstName: row.firstName });
  }

  return { ...created, patients: rows };
}

async function seedAppointments(rows: Record<string, unknown>[]) {
  const now = instantToDb(new Date());
  for (const row of rows) {
    await orm.Appointment.create({
      ...row,
      clinicId: seedClinicId,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    } as Parameters<typeof orm.Appointment.create>[0]);
  }
}

async function seedRecord(
  data: Record<string, unknown> & { prescriptions?: Record<string, unknown>[] },
) {
  const now = instantToDb(new Date());
  const { prescriptions = [], ...record } = data;
  const created = await orm.MedicalRecord.create({
    ...record,
    clinicId: seedClinicId,
    id: newId(),
    createdAt: now,
    updatedAt: now,
  } as Parameters<typeof orm.MedicalRecord.create>[0]);
  for (const rx of prescriptions) {
    await orm.Prescription.create({
      ...rx,
      id: newId(),
      medicalRecordId: created.id,
      createdAt: now,
    } as Parameters<typeof orm.Prescription.create>[0]);
  }
  return created;
}

async function main() {
  // Re-runnable: wipe the demo clinic and everything cascading from it, then
  // the accounts that belonged to it.
  // Clinicians first. Deleting the clinic would only orphan them — a doctor's
  // clinic link is SetNull so that losing a practice never silently destroys
  // charts — and everything clinical cascades from the doctor row, so this is
  // what actually clears the previous run.
  for (;;) {
    const stale = await orm.Doctor
      .select("id")
      .where((d) => d.clinicName.eq(CLINIC_NAME))
      .first();
    if (!stale) break;
    await orm.Doctor.where((d) => d.id.eq(stale.id)).delete();
  }
  for (;;) {
    const stale = await orm.Clinic.select("id").where((c) => c.name.eq(CLINIC_NAME)).first();
    if (!stale) break;
    await orm.Clinic.where((c) => c.id.eq(stale.id)).delete();
  }
  for (const email of [DEMO_EMAIL, SECRETARY_EMAIL, PATIENT_EMAIL]) {
    await orm.Account.where((a) => a.email.eq(email)).delete();
  }

  const seededAt = instantToDb(new Date());

  // The practice owns the records; people are members of it.
  const clinic = await orm.Clinic.select("id").create({
    id: newId(),
    name: CLINIC_NAME,
    address: "2F Northgate Arcade, Tuguegarao",
    contactNumber: "(078) 844 1180",
    createdAt: seededAt,
    updatedAt: seededAt,
  });
  seedClinicId = clinic.id;

  const doctorAccount = await orm.Account.select("id").create({
    id: newId(),
    email: DEMO_EMAIL,
    passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
    fullName: "Dr. Ana Reyes",
    createdAt: seededAt,
    updatedAt: seededAt,
  });
  await orm.ClinicMember.create({
    id: newId(),
    clinicId: clinic.id,
    accountId: doctorAccount.id,
    role: "DOCTOR",
    createdAt: seededAt,
    updatedAt: seededAt,
  });

  // A secretary, so the desk can be looked at without inventing one first.
  const secretaryAccount = await orm.Account.select("id").create({
    id: newId(),
    email: SECRETARY_EMAIL,
    passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
    fullName: "Maria Santos",
    createdAt: seededAt,
    updatedAt: seededAt,
  });
  await orm.ClinicMember.create({
    id: newId(),
    clinicId: clinic.id,
    accountId: secretaryAccount.id,
    role: "SECRETARY",
    createdAt: seededAt,
    updatedAt: seededAt,
  });

  const doctor = await orm.Doctor.create({
      id: newId(),
      createdAt: seededAt,
      updatedAt: seededAt,
      clinicId: clinic.id,
      accountId: doctorAccount.id,
      fullName: "Dr. Ana Reyes",
      specialty: "Family Medicine",
      clinicName: CLINIC_NAME,
      licenseNumber: "PRC-0114532",
      // A demo clinic that works straight away: skip the license check.
      verificationStatus: "VERIFIED",
      verifiedAt: seededAt,
  });

  const delaCruz = await seedHousehold({
      doctorId: doctor.id,
      name: "Dela Cruz",
      address: "24 Mabini St., Barangay San Roque, Tuguegarao",
      contactNumber: "0917 442 1180",
      notes:
        "Hypertension on the father's side. Household of five, grandmother lives with them. Prefers Saturday morning slots.",
      patients: [
          {
            firstName: "Ramon",
            middleName: "Santos",
            lastName: "Dela Cruz",
            dateOfBirth: born(1979, 4, 12),
            sex: Sex.MALE,
            relationship: Relationship.HEAD,
            bloodType: BloodType.O_POS,
            contactNumber: "0917 442 1180",
            allergyStatus: ClinicalListStatus.NONE_KNOWN,
            medicationStatus: ClinicalListStatus.RECORDED,
            medications: [{ label: "Amlodipine", dosage: "10 mg", frequency: "Once daily" }],
            emergencyContactName: "Marilou Dela Cruz",
            emergencyContactRelationship: "Spouse",
            emergencyContactNumber: "0917 442 1180",
            conditionStatus: ClinicalListStatus.RECORDED,
            conditions: [{ label: "Hypertension", notes: "Diagnosed 2021. On amlodipine 5 mg." }],
          },
          {
            firstName: "Marilou",
            middleName: "Bautista",
            lastName: "Dela Cruz",
            dateOfBirth: born(1983, 9, 3),
            sex: Sex.FEMALE,
            relationship: Relationship.SPOUSE,
            bloodType: BloodType.A_POS,
            allergyStatus: ClinicalListStatus.RECORDED,
            allergies: [
                {
                  label: "Penicillin",
                  reaction: "Urticaria and facial swelling",
                  severity: AllergySeverity.SEVERE,
                  notes: "First noted 2015.",
                },
              ],
          },
          {
            firstName: "Joaquin",
            lastName: "Dela Cruz",
            dateOfBirth: born(2014, 1, 27),
            sex: Sex.MALE,
            relationship: Relationship.CHILD,
            bloodType: BloodType.O_POS,
            allergyStatus: ClinicalListStatus.RECORDED,
            allergies: [
                { label: "Dust", reaction: "Sneezing, worse at night", severity: AllergySeverity.MILD },
                { label: "Pollen", severity: AllergySeverity.MILD },
              ],
            conditionStatus: ClinicalListStatus.RECORDED,
            conditions: [{ label: "Asthma", notes: "Mild intermittent. Salbutamol inhaler as needed." }],
          },
          {
            firstName: "Sofia",
            lastName: "Dela Cruz",
            dateOfBirth: born(2021, 11, 8),
            sex: Sex.FEMALE,
            relationship: Relationship.CHILD,
            bloodType: BloodType.UNKNOWN,
            allergyStatus: ClinicalListStatus.NONE_KNOWN,
            conditionStatus: ClinicalListStatus.NONE_KNOWN,
          },
          {
            firstName: "Corazon",
            lastName: "Dela Cruz",
            dateOfBirth: born(1952, 6, 19),
            sex: Sex.FEMALE,
            relationship: Relationship.GRANDPARENT,
            bloodType: BloodType.B_POS,
            allergyStatus: ClinicalListStatus.RECORDED,
            allergies: [
                { label: "Sulfa drugs", reaction: "Rash", severity: AllergySeverity.MODERATE },
                { label: "Shellfish", reaction: "Lip swelling", severity: AllergySeverity.MILD },
              ],
            conditionStatus: ClinicalListStatus.RECORDED,
            medicationStatus: ClinicalListStatus.RECORDED,
            medications: [
              { label: "Metformin", dosage: "500 mg", frequency: "Twice daily", notes: "With meals." },
              { label: "Paracetamol", dosage: "500 mg", frequency: "As needed" },
            ],
            alerts: [
              { label: "Falls risk", notes: "Unsteady on stairs; came with a cane." },
              { label: "On anticoagulants", notes: "Warfarin — check INR before any procedure." },
            ],
            emergencyContactName: "Ramon Dela Cruz",
            emergencyContactRelationship: "Son",
            emergencyContactNumber: "0917 442 1180",
            conditions: [
                { label: "Diabetes", notes: "Type 2." },
                { label: "Arthritis", notes: "Osteoarthritis of both knees." },
              ],
          },
        ],
    
  });

  const villanueva = await seedHousehold({
      doctorId: doctor.id,
      name: "Villanueva",
      address: "Blk 7 Lot 12, Carig Sur, Tuguegarao",
      contactNumber: "0918 220 7741",
      notes: "New to the practice, transferred from a clinic in Manila.",
      patients: [
          {
            firstName: "Elena",
            middleName: "Cruz",
            lastName: "Villanueva",
            dateOfBirth: born(1990, 2, 14),
            sex: Sex.FEMALE,
            relationship: Relationship.HEAD,
            bloodType: BloodType.AB_NEG,
            contactNumber: "0918 220 7741",
            allergyStatus: ClinicalListStatus.RECORDED,
            allergies: [{ label: "Latex", reaction: "Contact dermatitis", severity: AllergySeverity.MILD }],
            conditionStatus: ClinicalListStatus.RECORDED,
            conditions: [{ label: "Iron-deficiency anaemia", notes: "Typed in — not in the suggestion list." }],
          },
          {
            firstName: "Miguel",
            lastName: "Villanueva",
            dateOfBirth: born(2019, 7, 30),
            sex: Sex.MALE,
            relationship: Relationship.CHILD,
            bloodType: BloodType.O_NEG,
          },
        ],
    
  });

  const byName = (household: { patients: { id: string; firstName: string }[] }, first: string) =>
    household.patients.find((p) => p.firstName === first)!.id;

  const ramon = byName(delaCruz, "Ramon");
  const marilou = byName(delaCruz, "Marilou");
  const joaquin = byName(delaCruz, "Joaquin");
  const corazon = byName(delaCruz, "Corazon");
  const sofia = byName(delaCruz, "Sofia");
  const elena = byName(villanueva, "Elena");
  const miguel = byName(villanueva, "Miguel");

  // Primary contacts, now that the members they name exist.
  for (const [householdId, contactId] of [
    [delaCruz.id, marilou],
    [villanueva.id, elena],
  ] as const) {
    await orm.Household
      .where((h) => h.id.eq(householdId))
      .update({ primaryContactId: contactId, updatedAt: instantToDb(new Date()) });
  }

  // Today's clinic.
  await seedAppointments([
      {
        patientId: ramon,
        doctorId: doctor.id,
        scheduledAt: at(0, 9, 0),
        durationMinutes: 20,
        service: ServiceType.CHRONIC_DISEASE_MANAGEMENT,
        reason: "BP check and refill",
        status: AppointmentStatus.CONFIRMED,
      },
      {
        patientId: sofia,
        doctorId: doctor.id,
        scheduledAt: at(0, 9, 30),
        durationMinutes: 30,
        service: ServiceType.PEDIATRIC_CONSULTATION,
        reason: "Well-child visit, 4 years",
        status: AppointmentStatus.CONFIRMED,
      },
      {
        patientId: miguel,
        doctorId: doctor.id,
        scheduledAt: at(0, 10, 30),
        durationMinutes: 30,
        service: ServiceType.GENERAL_CONSULTATION,
        reason: "Rash on both forearms",
        status: AppointmentStatus.CONFIRMED,
      },
      {
        patientId: corazon,
        doctorId: doctor.id,
        scheduledAt: at(2, 8, 30),
        durationMinutes: 30,
        service: ServiceType.SENIOR_CITIZEN_CONSULTATION,
        reason: "Diabetes follow-up, HbA1c review",
        status: AppointmentStatus.CONFIRMED,
      },
      {
        patientId: elena,
        doctorId: doctor.id,
        scheduledAt: at(5, 14, 0),
        durationMinutes: 45,
        service: ServiceType.ROUTINE_PHYSICAL_EXAM,
        reason: "New patient consultation",
        status: AppointmentStatus.PENDING,
        source: BookingSource.PHONE,
      },
      {
        patientId: joaquin,
        doctorId: doctor.id,
        scheduledAt: at(-3, 11, 0),
        durationMinutes: 30,
        service: ServiceType.PEDIATRIC_CONSULTATION,
        reason: "Cough and wheezing",
        status: AppointmentStatus.COMPLETED,
      },
    
  ]);

  // Spread across the surrounding weeks so the month calendar has real shape.
  await seedAppointments([
      {
        patientId: marilou,
        doctorId: doctor.id,
        scheduledAt: at(1, 10, 0),
        durationMinutes: 20,
        service: ServiceType.LABORATORY_RESULT_REVIEW,
        reason: "Thyroid panel results",
      },
      {
        patientId: ramon,
        doctorId: doctor.id,
        scheduledAt: at(1, 15, 0),
        durationMinutes: 20,
        service: ServiceType.TELECONSULTATION,
        type: AppointmentType.TELECONSULTATION,
        reason: "Home BP log review",
      },
      {
        patientId: joaquin,
        doctorId: doctor.id,
        scheduledAt: at(4, 9, 0),
        durationMinutes: 20,
        service: ServiceType.FOLLOW_UP_CHECKUP,
        priority: VisitPriority.FOLLOW_UP,
        reason: "Post-exacerbation review",
      },
      {
        patientId: elena,
        doctorId: doctor.id,
        scheduledAt: at(4, 9, 30),
        durationMinutes: 20,
        service: ServiceType.MEDICAL_CERTIFICATE_REQUEST,
        reason: "Fitness to work clearance",
      },
      {
        patientId: miguel,
        doctorId: doctor.id,
        scheduledAt: at(4, 10, 30),
        durationMinutes: 20,
        service: ServiceType.VACCINATION_CONSULTATION,
        reason: "Catch-up immunisation schedule",
      },
      {
        patientId: corazon,
        doctorId: doctor.id,
        scheduledAt: at(9, 8, 30),
        durationMinutes: 15,
        service: ServiceType.PRESCRIPTION_RENEWAL,
        reason: "Metformin refill",
      },
      {
        patientId: sofia,
        doctorId: doctor.id,
        scheduledAt: at(12, 11, 0),
        durationMinutes: 30,
        service: ServiceType.MINOR_INJURY_WOUND_CARE,
        priority: VisitPriority.URGENT,
        reason: "Dressing change, grazed knee",
      },
      {
        patientId: marilou,
        doctorId: doctor.id,
        scheduledAt: at(16, 14, 0),
        durationMinutes: 60,
        service: ServiceType.FAMILY_CHECKUP,
        reason: "Whole household annual review",
      },
      {
        patientId: elena,
        doctorId: doctor.id,
        scheduledAt: at(-8, 13, 0),
        durationMinutes: 20,
        service: ServiceType.REFERRAL_CONSULTATION,
        reason: "Dermatology referral",
        status: AppointmentStatus.COMPLETED,
      },
      {
        patientId: ramon,
        doctorId: doctor.id,
        scheduledAt: at(-12, 9, 0),
        durationMinutes: 20,
        service: ServiceType.GENERAL_CONSULTATION,
        reason: "Sore throat",
        status: AppointmentStatus.NO_SHOW,
      },
      {
        patientId: marilou,
        doctorId: doctor.id,
        scheduledAt: at(-15, 10, 0),
        durationMinutes: 45,
        service: ServiceType.PRENATAL_POSTNATAL_CONSULTATION,
        reason: "Postnatal review",
        status: AppointmentStatus.CANCELLED,
      },
    
  ]);

  const asthmaVisit = await orm.Appointment
    .select("id")
    .where((a) => a.patientId.eq(joaquin))
    .where((a) => a.status.eq(AppointmentStatus.COMPLETED))
    .first();

  await seedRecord({
      patientId: joaquin,
      doctorId: doctor.id,
      appointmentId: asthmaVisit?.id ?? null,
      visitDate: at(-3, 11, 5),
      chiefComplaint: "Cough and wheezing for 4 days",
      historyOfPresentIllness:
        "Dry cough starting after a school field trip, worse at night. Two rescue inhaler uses per day. No fever. Younger sister had a cold the week before.",
      temperatureC: 37.1,
      heartRate: 96,
      respiratoryRate: 24,
      oxygenSaturation: 96,
      weightKg: 34.2,
      heightCm: 138,
      assessment: "Mild intermittent asthma with viral-triggered exacerbation.",
      treatmentPlan:
        "Salbutamol MDI with spacer, 2 puffs every 4–6 hours as needed. Short course of oral prednisolone. Review in one week, sooner if work of breathing increases.",
      followUpDate: calendarDateToDb(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 4))),
      prescriptions: [
          {
            drugName: "Salbutamol MDI 100 mcg",
            dosage: "2 puffs",
            frequency: "Every 4–6 hours as needed",
            duration: "2 weeks",
            instructions: "Use with spacer. Rinse mouth after.",
          },
          {
            drugName: "Prednisolone 15 mg/5 mL",
            dosage: "10 mL",
            frequency: "Once daily",
            duration: "3 days",
            instructions: "After breakfast.",
          },
        ],
    
  });

  await seedRecord({
      patientId: ramon,
      doctorId: doctor.id,
      visitDate: at(-40, 9, 15),
      chiefComplaint: "Routine hypertension follow-up",
      temperatureC: 36.6,
      heartRate: 78,
      systolic: 146,
      diastolic: 92,
      weightKg: 84.5,
      heightCm: 171,
      assessment: "Hypertension, above target on current dose.",
      treatmentPlan:
        "Increase amlodipine to 10 mg daily. Reduce added salt; discussed home BP logging twice weekly. Recheck in six weeks.",
      prescriptions: [
          {
            drugName: "Amlodipine 10 mg",
            dosage: "1 tablet",
            frequency: "Once daily",
            duration: "60 days",
            instructions: "Morning, with or without food.",
          },
        ],
    
  });

  await seedRecord({
      patientId: corazon,
      doctorId: doctor.id,
      visitDate: at(-92, 10, 0),
      chiefComplaint: "Knee pain, both sides, worse on stairs",
      historyOfPresentIllness:
        "Gradual over two years. Morning stiffness under 20 minutes. No swelling or redness. Paracetamol gives partial relief.",
      temperatureC: 36.4,
      heartRate: 84,
      systolic: 138,
      diastolic: 84,
      weightKg: 71.0,
      heightCm: 152,
      assessment: "Bilateral knee osteoarthritis. Diabetes reasonably controlled on metformin.",
      treatmentPlan:
        "Quadriceps strengthening handout given. Paracetamol as needed; avoid NSAIDs given renal function. Continue metformin, repeat HbA1c before next visit.",
      prescriptions: [
          {
            drugName: "Metformin 500 mg",
            dosage: "1 tablet",
            frequency: "Twice daily",
            duration: "90 days",
            instructions: "With meals.",
          },
        ],
    
  });

  // Everything above is created with a doctorId, as it always was. The same
  // step the migration uses then gives each row its clinic, which keeps one
  // rule about ownership rather than two that could drift apart.
  await backfillAccountsAndClinics();

  // One patient with a login, so the portal has somebody to be. Linked here
  // directly because the seed is not a public path; outside it, the only way a
  // login reaches a chart is an activation code issued at the desk.
  const portalPatient = await orm.Patient
    .select("id")
    .where((p) => p.lastName.eq("Dela Cruz"))
    .where((p) => p.firstName.eq("Ramon"))
    .first();
  if (portalPatient) {
    const patientAccount = await orm.Account.select("id").create({
      id: newId(),
      email: PATIENT_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      fullName: "Ramon Dela Cruz",
      createdAt: seededAt,
      updatedAt: seededAt,
    });
    await orm.Patient.where((p) => p.id.eq(portalPatient.id)).update({
      accountId: patientAccount.id,
      updatedAt: seededAt,
    });
  }

  console.log(
    [
      "Seeded demo practice. Password for all three: " + DEMO_PASSWORD,
      "  doctor:    " + DEMO_EMAIL,
      "  secretary: " + SECRETARY_EMAIL,
      "  patient:   " + PATIENT_EMAIL,
    ].join("\n"),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.close());
