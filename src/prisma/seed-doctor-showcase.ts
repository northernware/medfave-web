import "dotenv/config";
import { devOnly } from "./dev-only";
import { or } from "@prisma/orm-postgres/orm-client";
import bcrypt from "bcryptjs";
import { db, orm } from "./db";
import { MARK, seedId } from "./seed-ids";
import { calendarDateToDb, dayKey, instantToDb } from "../../lib/datetime";
import { addDays } from "../../lib/scheduling";

devOnly("db:seed-doctor-showcase");

/*
 * Fills in what the doctor's app shows when there is data for it, for Dr. Ana
 * Reyes (doctor@medfave.com, Northern Family Clinic), timed from now:
 *
 *  - Today: one patient with the doctor, three of one household waiting
 *    (Joaquin for a while, Ramon, Marilou), two still to come (one said "I'll be there")
 *  - the rest of the week with visits on most days
 *  - three requests waiting (the inbox count), one from a new patient
 *  - charts: allergies (one severe), an alert, conditions, medicines, a
 *    "No known allergies", and one chart nobody has asked about yet
 *  - visit notes from past visits (the last note in a card)
 *  - patient feedback with good and low ratings, tags and notes, and faves
 *
 * Every row it makes has an id from `seedId(MARK.doctor, …)` (./seed-ids.ts),
 * so it is safe to run again: those rows, and any from before with ids starting
 * "drshow-", are removed first. It also sets the allergy / condition /
 * medication status of the charts it fills, which stays. Needs the main seed.
 * Never run against real data. Patients and logins it needs beyond the main
 * seed are made once if missing (see ensureCast).
 *
 *   npm run db:seed-doctor-showcase
 */

const id = (name: string) => seedId(MARK.doctor, name);
const MIN = 60_000;
/** An instant `minutes` from now, for the database. */
const fromNow = (minutes: number) => instantToDb(new Date(Date.now() + minutes * MIN));
/** A clinic day `days` from today at hh:mm Manila time. */
const dayAt = (days: number, hour: number, minute = 0) =>
  new Date(`${addDays(dayKey(new Date()), days)}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`);
const onDay = (days: number, hour: number, minute = 0) => instantToDb(dayAt(days, hour, minute));

type NewAppointment = Parameters<typeof orm.Appointment.create>[0];

async function main() {
  const doctor = await orm.Doctor.select("id", "clinicId", "accountId").where((d) => d.fullName.eq("Dr. Ana Reyes")).first();
  if (!doctor?.clinicId || !doctor.accountId) throw new Error("No Dr. Ana Reyes: run npm run db:seed first.");
  const clinicId = doctor.clinicId;

  await ensureCast(clinicId, doctor.id);
  const patients = await orm.Patient.select("id", "firstName", "lastName", "accountId").where((p) => p.clinicId.eq(clinicId)).all();
  const who = (first: string) => {
    const p = patients.find((x) => x.firstName === first);
    if (!p) throw new Error(`No patient ${first} at the demo clinic.`);
    return p.id;
  };
  const accountOf = (first: string) => patients.find((x) => x.firstName === first)?.accountId ?? null;
  const ramon = accountOf("Ramon");
  const paula = accountOf("Paula");
  const corazon = accountOf("Corazon");
  if (!ramon || !paula || !corazon) throw new Error("Ramon, Paula and Corazon need their logins.");

  // Out with the last run's rows, children first. `deleteAndCount`: `delete` removes one row.
  await orm.VisitFeedback.where((f) => or(f.id.like(`${MARK.doctor}-%`), f.id.like("drshow-%"))).deleteAndCount();
  await orm.Fave.where((f) => or(f.id.like(`${MARK.doctor}-%`), f.id.like("drshow-%"))).deleteAndCount();
  await orm.MedicalRecord.where((r) => or(r.id.like(`${MARK.doctor}-%`), r.id.like("drshow-%"))).deleteAndCount();
  await orm.AppointmentRequest.where((r) => or(r.id.like(`${MARK.doctor}-%`), r.id.like("drshow-%"))).deleteAndCount();
  await orm.Appointment.where((a) => or(a.id.like(`${MARK.doctor}-%`), a.id.like("drshow-%"))).deleteAndCount();
  await orm.PatientAllergy.where((x) => or(x.id.like(`${MARK.doctor}-%`), x.id.like("drshow-%"))).deleteAndCount();
  await orm.PatientAlert.where((x) => or(x.id.like(`${MARK.doctor}-%`), x.id.like("drshow-%"))).deleteAndCount();
  await orm.PatientCondition.where((x) => or(x.id.like(`${MARK.doctor}-%`), x.id.like("drshow-%"))).deleteAndCount();
  await orm.PatientMedication.where((x) => or(x.id.like(`${MARK.doctor}-%`), x.id.like("drshow-%"))).deleteAndCount();

  const now = instantToDb(new Date());
  const base = { clinicId, doctorId: doctor.id, createdAt: now, updatedAt: now, bookedById: doctor.accountId };
  const visit = (row: Partial<NewAppointment> & { id: string; patientId: string; scheduledAt: string }) =>
    orm.Appointment.create({
      ...base,
      durationMinutes: 30,
      service: "GENERAL_CONSULTATION",
      status: "CONFIRMED",
      source: "STAFF",
      ...row,
    } as NewAppointment);

  // Today, from now. Half-hour slots so nothing overlaps.
  await visit({
    id: id("today-with-doctor"),
    patientId: who("Elena"),
    scheduledAt: fromNow(-20),
    service: "PRENATAL_POSTNATAL_CONSULTATION",
    reason: "20-week check",
    status: "IN_CONSULTATION",
    arrivedAt: fromNow(-34),
    consultationStartedAt: fromNow(-9),
  });
  await visit({
    id: id("today-waiting-long"),
    patientId: who("Joaquin"),
    scheduledAt: fromNow(10),
    service: "PEDIATRIC_CONSULTATION",
    reason: "Wheezing at night",
    status: "CHECKED_IN",
    arrivedAt: fromNow(-26),
  });
  await visit({
    id: id("today-waiting"),
    patientId: who("Marilou"),
    scheduledAt: fromNow(40),
    service: "CHRONIC_DISEASE_MANAGEMENT",
    reason: "Sugar log review",
    status: "CHECKED_IN",
    arrivedAt: fromNow(-6),
  });
  // Ramon waits too: three of the Dela Cruz household, to see a family together.
  await visit({
    id: id("today-waiting-ramon"),
    patientId: who("Ramon"),
    scheduledAt: fromNow(130),
    service: "FOLLOW_UP_CHECKUP",
    reason: "Blood pressure check",
    status: "CHECKED_IN",
    arrivedAt: fromNow(-12),
  });
  await visit({
    id: id("today-coming"),
    patientId: who("Paula"),
    scheduledAt: fromNow(70),
    service: "FOLLOW_UP_CHECKUP",
    reason: "Rash follow-up",
    patientConfirmedAt: fromNow(-300),
  });
  await visit({
    id: id("today-later"),
    patientId: who("Jnmark Friedrich"),
    scheduledAt: fromNow(100),
    service: "MEDICAL_CERTIFICATE_REQUEST",
    reason: "Fit-to-work certificate",
  });

  // The rest of the week.
  const week: [number, number, number, string, NewAppointment["service"], string][] = [
    [1, 9, 0, "Corazon", "SENIOR_CITIZEN_CONSULTATION", "Blood pressure check"],
    [1, 10, 30, "Sofia", "VACCINATION_CONSULTATION", "Flu shot"],
    [2, 14, 0, "Miguel", "PEDIATRIC_CONSULTATION", "Fever for two days"],
    [3, 9, 30, "Elena", "LABORATORY_RESULT_REVIEW", "OGTT results"],
    [3, 11, 0, "Ramon", "FOLLOW_UP_CHECKUP", "Blood pressure follow-up"],
    [4, 15, 0, "Lia", "PEDIATRIC_CONSULTATION", "Ear pain"],
    [5, 10, 0, "Marilou", "PRESCRIPTION_RENEWAL", "Metformin refill"],
  ];
  for (const [d, h, m, first, service, reason] of week) {
    await visit({ id: id(`week-${d}-${h}${m}`), patientId: who(first), scheduledAt: onDay(d, h, m), service, reason, status: d === 2 ? "PENDING" : "CONFIRMED" });
  }

  // Requests waiting: two from patients, one from somebody new.
  const request = (row: Record<string, unknown>) =>
    orm.AppointmentRequest.create({ clinicId, doctorId: doctor.id, status: "PENDING", createdAt: now, updatedAt: now, ...row } as Parameters<
      typeof orm.AppointmentRequest.create
    >[0]);
  await request({
    id: id("request-corazon"),
    patientId: who("Corazon"),
    requestedById: corazon,
    preferredDate: calendarDateToDb(new Date(`${addDays(dayKey(new Date()), 6)}T00:00:00Z`)),
    preferredTime: "09:00",
    service: "SENIOR_CITIZEN_CONSULTATION",
    reason: "Dizzy in the mornings",
  });
  await request({
    id: id("request-paula"),
    patientId: who("Paula"),
    requestedById: paula,
    preferredDate: calendarDateToDb(new Date(`${addDays(dayKey(new Date()), 8)}T00:00:00Z`)),
    preferredTime: null,
    service: "ROUTINE_PHYSICAL_EXAM",
    reason: "Annual physical for work",
  });
  await request({
    id: id("request-new"),
    patientId: null,
    requestedById: ramon,
    forOther: true,
    newRelationship: "PARENT",
    newFirstName: "Teodoro",
    newLastName: "Dela Cruz",
    newDateOfBirth: calendarDateToDb(new Date("1950-03-02T00:00:00Z")),
    newSex: "MALE",
    newContactNumber: "0917 555 0142",
    preferredDate: calendarDateToDb(new Date(`${addDays(dayKey(new Date()), 4)}T00:00:00Z`)),
    preferredTime: "10:00",
    service: "SENIOR_CITIZEN_CONSULTATION",
    reason: "New patient: knee pain when walking",
  });

  // Charts.
  const add = {
    allergy: (key: string, patientId: string, label: string, severity: "MILD" | "MODERATE" | "SEVERE", reaction: string) =>
      orm.PatientAllergy.create({ id: id(`allergy-${key}`), patientId, label, severity, reaction, createdAt: now }),
    alert: (key: string, patientId: string, label: string, notes: string | null = null) =>
      orm.PatientAlert.create({ id: id(`alert-${key}`), patientId, label, notes, createdAt: now }),
    condition: (key: string, patientId: string, label: string, notes: string | null = null) =>
      orm.PatientCondition.create({ id: id(`condition-${key}`), patientId, label, notes, createdAt: now }),
    medication: (key: string, patientId: string, label: string, dosage: string, frequency: string) =>
      orm.PatientMedication.create({ id: id(`med-${key}`), patientId, label, dosage, frequency, createdAt: now }),
  };
  const has = async (patientId: string, label: string) =>
    Boolean(await orm.PatientAllergy.select("id").where((a) => a.patientId.eq(patientId)).where((a) => a.label.eq(label)).first());

  if (!(await has(who("Elena"), "Penicillin"))) await add.allergy("elena", who("Elena"), "Penicillin", "SEVERE", "Hives and throat swelling");
  await add.alert("elena", who("Elena"), "Pregnant, 20 weeks", "Check before prescribing");
  await add.condition("elena", who("Elena"), "Gestational diabetes, being ruled out");
  await add.medication("elena-folate", who("Elena"), "Folic acid", "400 mcg", "Once a day");
  await add.medication("elena-iron", who("Elena"), "Ferrous sulfate", "325 mg", "Once a day");

  await add.condition("marilou", who("Marilou"), "Type 2 diabetes", "Since 2019");
  await add.medication("marilou", who("Marilou"), "Metformin", "500 mg", "Twice a day");

  if (!(await has(who("Paula"), "Ibuprofen"))) await add.allergy("paula", who("Paula"), "Ibuprofen", "MODERATE", "Rash");
  await add.condition("paula", who("Paula"), "Contact dermatitis");

  await orm.Patient.where((p) => p.id.eq(who("Elena"))).update({ allergyStatus: "RECORDED", conditionStatus: "RECORDED", medicationStatus: "RECORDED" });
  await orm.Patient.where((p) => p.id.eq(who("Marilou"))).update({ allergyStatus: "NONE_KNOWN", conditionStatus: "RECORDED", medicationStatus: "RECORDED" });
  await orm.Patient.where((p) => p.id.eq(who("Paula"))).update({ allergyStatus: "RECORDED", conditionStatus: "RECORDED", medicationStatus: "NONE_KNOWN" });
  // Jnmark's chart is left as it is: "Not asked yet".

  // Past visits: completed, each with a note, most with the patient's rating.
  const past: {
    key: string;
    first: string;
    rater: string | null;
    days: number;
    service: NewAppointment["service"];
    complaint: string;
    assessment: string;
    score?: number;
    tags?: string;
    note?: string;
  }[] = [
    { key: "elena", first: "Elena", rater: null, days: 28, service: "PRENATAL_POSTNATAL_CONSULTATION", complaint: "16-week check", assessment: "Normal pregnancy. OGTT ordered." },
    { key: "marilou", first: "Marilou", rater: null, days: 21, service: "CHRONIC_DISEASE_MANAGEMENT", complaint: "Sugar control", assessment: "HbA1c 7.4%. Continue metformin, walk daily." },
    { key: "paula", first: "Paula", rater: "Paula", days: 9, service: "GENERAL_CONSULTATION", complaint: "Itchy rash on both hands", assessment: "Contact dermatitis, likely from a new detergent.", score: 5, tags: "LISTENED,EXPLAINED", note: "She explained what caused it. Rash is almost gone!" },
    { key: "corazon", first: "Corazon", rater: "Corazon", days: 6, service: "SENIOR_CITIZEN_CONSULTATION", complaint: "Headaches", assessment: "BP 150/95. Started amlodipine.", score: 2, tags: "LONG_WAIT,RUSHED", note: "Waited over an hour, then it was over in five minutes." },
    { key: "joaquin", first: "Joaquin", rater: "Ramon", days: 4, service: "PEDIATRIC_CONSULTATION", complaint: "Cough and wheeze", assessment: "Mild asthma flare. Salbutamol as needed.", score: 4, tags: "FRIENDLY,ON_TIME" },
    { key: "lia", first: "Lia", rater: "Ramon", days: 3, service: "PEDIATRIC_CONSULTATION", complaint: "Fever", assessment: "Viral illness. Fluids and paracetamol.", score: 3, tags: "COST", note: "Good doctor but the bill was more than we expected." },
    { key: "sofia", first: "Sofia", rater: "Ramon", days: 2, service: "VACCINATION_CONSULTATION", complaint: "Flu vaccine", assessment: "Given. No reaction after 15 minutes.", score: 5, tags: "FRIENDLY,CLEAN" },
  ];
  for (const v of past) {
    const when = dayAt(-v.days, 10);
    const at = instantToDb(when);
    await visit({
      id: id(`past-${v.key}`),
      patientId: who(v.first),
      scheduledAt: at,
      service: v.service,
      reason: v.complaint,
      status: "COMPLETED",
      arrivedAt: at,
      consultationStartedAt: at,
    });
    await orm.MedicalRecord.create({
      id: id(`note-${v.key}`),
      clinicId,
      patientId: who(v.first),
      doctorId: doctor.id,
      appointmentId: id(`past-${v.key}`),
      visitDate: at,
      chiefComplaint: v.complaint,
      assessment: v.assessment,
      status: "FINALIZED",
      finalizedAt: at,
      finalizedById: doctor.id,
      createdAt: at,
      updatedAt: at,
    } as Parameters<typeof orm.MedicalRecord.create>[0]);
    if (v.score && v.rater) {
      await orm.VisitFeedback.create({
        id: id(`feedback-${v.key}`),
        appointmentId: id(`past-${v.key}`),
        accountId: accountOf(v.rater)!,
        clinicId,
        doctorId: doctor.id,
        score: v.score,
        rating: v.score >= 4 ? "GOOD" : "NOT_GREAT",
        tags: v.tags ?? null,
        note: v.note ?? null,
        // Rated that evening.
        createdAt: instantToDb(new Date(when.getTime() + 8 * 3_600_000)),
      });
    }
  }

  // Faves from Paula and Corazon, unless they have one already.
  for (const [key, account] of [["paula", paula], ["corazon", corazon]] as const) {
    const faved = await orm.Fave.select("id").where((f) => f.accountId.eq(account)).where((f) => f.doctorId.eq(doctor.id)).first();
    if (!faved) await orm.Fave.create({ id: id(`fave-${key}`), accountId: account, doctorId: doctor.id, createdAt: now });
  }

  console.log("Doctor showcase added for doctor@medfave.com: today's queue, the week, 3 requests, charts, notes and feedback.");
}

/** The same per-year counter the app allocates from (lib/patient-number.ts, which is server-only). */
async function nextPatientNumber() {
  const year = new Date().getUTCFullYear();
  await db.transaction(async (tx) => {
    await tx.execute(
      db.raw.sql`INSERT INTO "PatientNumberCounter" ("year","lastUsed") VALUES (${year},0) ON CONFLICT ("year") DO NOTHING`.affectedCount().build() as never,
    );
    await tx.execute(db.raw.sql`UPDATE "PatientNumberCounter" SET "lastUsed"="lastUsed"+1 WHERE "year"=${year}`.affectedCount().build() as never);
  });
  const counter = await orm.PatientNumberCounter.select("lastUsed").where((c) => c.year.eq(year)).first();
  return `MK-${year}-${String(counter!.lastUsed).padStart(6, "0")}`;
}

/**
 * The patients and logins this showcase uses beyond the main seed, made if
 * they're missing, so it works on a fresh database: Lia (Ramon's daughter),
 * Paula Santos and Jnmark Agustin with their own households, and patient
 * logins for Paula (patient2@medfave.com) and Corazon (corazon@medfave.com),
 * who rate visits. Password `password`. Kept between runs.
 */
async function ensureCast(clinicId: string, doctorId: string) {
  const now = instantToDb(new Date());
  const find = (first: string) =>
    orm.Patient.select("id", "householdId", "accountId").where((p) => p.clinicId.eq(clinicId)).where((p) => p.firstName.eq(first)).first();
  const ramon = await find("Ramon");
  if (!ramon) throw new Error("No Ramon Dela Cruz: run npm run db:seed first.");

  const household = async (key: string, name: string) => {
    const hid = seedId(MARK.doctor, `household-${key}`);
    if (!(await orm.Household.select("id").where((h) => h.id.eq(hid)).first())) {
      await orm.Household.create({ id: hid, clinicId, doctorId, name, createdAt: now, updatedAt: now } as Parameters<typeof orm.Household.create>[0]);
    }
    return hid;
  };
  const patient = async (first: string, row: Record<string, unknown>) => {
    if (await find(first)) return;
    await orm.Patient.create({
      id: seedId(MARK.doctor, `patient-${first}`),
      clinicId,
      firstName: first,
      patientNumber: await nextPatientNumber(),
      createdAt: now,
      updatedAt: now,
      ...row,
    } as Parameters<typeof orm.Patient.create>[0]);
  };
  await patient("Lia", { lastName: "Dela Cruz", middleName: "F.", householdId: ramon.householdId, dateOfBirth: calendarDateToDb(new Date("2020-06-15T00:00:00Z")), sex: "FEMALE", relationship: "CHILD" });
  await patient("Paula", { lastName: "Santos", householdId: await household("santos", "Santos"), dateOfBirth: calendarDateToDb(new Date("1992-07-03T00:00:00Z")), sex: "FEMALE", relationship: "HEAD", contactNumber: "0917 555 0177" });
  await patient("Jnmark Friedrich", { lastName: "Agustin", householdId: await household("agustin", "Agustin"), dateOfBirth: calendarDateToDb(new Date("2003-01-17T00:00:00Z")), sex: "MALE", relationship: "HEAD" });

  const login = async (first: string, email: string, fullName: string) => {
    const chart = await find(first);
    if (!chart || chart.accountId) return;
    let account = await orm.Account.select("id").where((a) => a.email.eq(email)).first();
    if (!account) {
      account = await orm.Account.select("id").create({
        id: seedId(MARK.doctor, `account-${first}`),
        email,
        passwordHash: await bcrypt.hash("password", 12),
        fullName,
        createdAt: now,
        updatedAt: now,
      } as Parameters<typeof orm.Account.create>[0]);
    }
    await orm.Patient.where((p) => p.id.eq(chart.id)).update({ accountId: account.id });
  };
  await login("Paula", "patient2@medfave.com", "Paula Santos");
  await login("Corazon", "corazon@medfave.com", "Corazon Dela Cruz");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
