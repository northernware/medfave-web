"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AllergySeverity } from "@/lib/enums";
import { requireDoctor, requireStaff } from "@/lib/auth";
import { setConditionResolved } from "@/lib/conditions";
import { caresFor } from "@/lib/care";
import { pickDoctor } from "@/lib/clinic";
import { db, orm } from "@/src/prisma/db";
import { calendarDateToDb, instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { allocatePatientNumber } from "@/lib/patient-number";
import { fromDateInputValue } from "@/lib/datetime";
import {
  clinicalItemSchema,
  patientSchema,
  toFieldErrors,
  identityFingerprint,
  NEW_HOUSEHOLD,
  type FormState,
} from "@/lib/validation";
import { findPossibleDuplicates } from "@/lib/queries";
import { DELETE_PHRASES, phraseTyped } from "@/lib/confirm-phrase";
import { startOwnHouseholdFor } from "@/lib/households";
import { ACTIVE_STATUSES } from "@/lib/domain";

/** Confirms the household belongs to this clinic before anything is written. */
async function assertClinicHousehold(clinicId: string, householdId: string) {
  const household = await orm.Household
    .select("id")
    .where((h) => h.id.eq(householdId))
    .where((h) => h.clinicId.eq(clinicId))
    // Nobody is registered into, or moved into, a household set aside.
    .where((h) => h.archivedAt.isNull())
    .first();
  return household !== null;
}

/**
 * The clinical lists are a doctor's to keep.
 *
 * Registration is desk work — a name, a birthday, a phone number — but
 * allergies, conditions, medications and alerts are clinical findings. A
 * secretary's form does not show them, and this is what makes that true rather
 * than merely displayed: their submissions are ignored, and on an edit the
 * lists already recorded are left exactly as they are.
 */
const EMPTY_LISTS: ClinicalLists = {
  allergies: [],
  conditions: [],
  medications: [],
  alerts: [],
};

type ClinicalRow = {
  label: string;
  reaction: string | null;
  severity: AllergySeverity | null;
  dosage: string | null;
  frequency: string | null;
  notes: string | null;
};

type ClinicalLists = {
  allergies: ClinicalRow[];
  conditions: ClinicalRow[];
  medications: ClinicalRow[];
  alerts: ClinicalRow[];
};

/**
 * Allergy and condition rows arrive as parallel repeated fields, the same shape
 * the prescription list uses. Blank labels are rows the picker never filled in.
 * Duplicates are dropped rather than rejected — the table's unique constraint
 * would otherwise fail the whole save over a harmless double-click.
 */
function readClinicalList(
  formData: FormData,
  prefix: string,
  label: string,
): { rows: ClinicalRow[]; error?: FormState } {
  const labels = formData.getAll(`${prefix}.label`).map(String);
  const reactions = formData.getAll(`${prefix}.reaction`).map(String);
  const severities = formData.getAll(`${prefix}.severity`).map(String);
  const dosages = formData.getAll(`${prefix}.dosage`).map(String);
  const frequencies = formData.getAll(`${prefix}.frequency`).map(String);
  const notes = formData.getAll(`${prefix}.notes`).map(String);

  const rows: ClinicalRow[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < labels.length; i++) {
    if (!labels[i].trim()) continue;

    const parsed = clinicalItemSchema.safeParse({
      label: labels[i],
      reaction: reactions[i] ?? "",
      severity: severities[i] ?? "",
      dosage: dosages[i] ?? "",
      frequency: frequencies[i] ?? "",
      notes: notes[i] ?? "",
    });
    if (!parsed.success) {
      const flat = toFieldErrors(parsed.error);
      return { rows: [], error: { message: `${label}: ${flat.message}` } };
    }

    const key = parsed.data.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      label: parsed.data.label,
      reaction: parsed.data.reaction,
      severity: parsed.data.severity as AllergySeverity | null,
      dosage: parsed.data.dosage,
      frequency: parsed.data.frequency,
      notes: parsed.data.notes,
    });
  }

  return { rows };
}

/** A list with entries is RECORDED whatever the chips said; an empty one keeps its answer. */
function reconcileStatus(declared: string, count: number) {
  if (count > 0) return "RECORDED" as const;
  return declared === "NONE_KNOWN" ? ("NONE_KNOWN" as const) : ("UNKNOWN" as const);
}

/**
 * Empties every clinical list for a patient.
 *
 * The ORM's `.delete()` removes a single row — it is built for a unique
 * predicate — so deleting by `patientId`, which matches many, has to go through
 * the SQL-builder lane. Using the ORM here silently left every row but one
 * behind, and the next insert then collided with the (patientId, label) unique
 * index.
 */
async function clearClinicalLists(
  tx: { sql: typeof db.sql; execute: (plan: never) => Promise<unknown> },
  patientId: string,
) {
  // Conditions and medicines are not here: they keep their history (syncConditions, syncMedications).
  const tables = [
    tx.sql.public.PatientAllergy,
    tx.sql.public.PatientAlert,
  ];
  for (const table of tables) {
    const plan = table.delete().where((f, fns) => fns.eq(f.patientId, patientId)).build();
    await tx.execute(plan as never);
  }
}

/**
 * The chart's ongoing conditions as the edit form lists them. Unlike the other
 * lists they are not wiped and rewritten: a condition marked resolved stays as
 * history, and one added from a visit keeps its ICD-11 code. So: keep the
 * active ones still listed (updating notes), delete active ones taken off the
 * list (a slip, not a recovery), add new ones, and bring back a resolved one
 * listed again under the same name.
 */
async function syncConditions(t: typeof orm, patientId: string, listed: ClinicalLists["conditions"]) {
  const now = instantToDb(new Date());
  const existing = await t.PatientCondition.select("id", "label", "resolvedAt").where((c) => c.patientId.eq(patientId)).all();
  const byLabel = new Map(existing.map((c) => [c.label.toLowerCase(), c]));
  const keep = new Set<string>();
  for (const c of listed) {
    const found = byLabel.get(c.label.toLowerCase());
    if (found) {
      keep.add(found.id);
      await t.PatientCondition.where((x) => x.id.eq(found.id)).update({ notes: c.notes, resolvedAt: null, resolvedById: null });
    } else {
      await t.PatientCondition.create({ id: newId(), patientId, label: c.label, notes: c.notes, createdAt: now });
    }
  }
  for (const c of existing) {
    if (!c.resolvedAt && !keep.has(c.id)) await t.PatientCondition.where((x) => x.id.eq(c.id)).delete();
  }
}

/** The chart's current medicines as the edit form lists them, kept like conditions: stopped ones stay as history. */
async function syncMedications(t: typeof orm, patientId: string, listed: ClinicalLists["medications"]) {
  const now = instantToDb(new Date());
  const existing = await t.PatientMedication.select("id", "label", "stoppedAt").where((m) => m.patientId.eq(patientId)).all();
  const byLabel = new Map(existing.map((m) => [m.label.toLowerCase(), m]));
  const keep = new Set<string>();
  for (const m of listed) {
    const found = byLabel.get(m.label.toLowerCase());
    if (found) {
      keep.add(found.id);
      await t.PatientMedication.where((x) => x.id.eq(found.id)).update({ dosage: m.dosage, frequency: m.frequency, notes: m.notes, stoppedAt: null, stoppedById: null });
    } else {
      await t.PatientMedication.create({ id: newId(), patientId, label: m.label, dosage: m.dosage, frequency: m.frequency, notes: m.notes, createdAt: now });
    }
  }
  for (const m of existing) {
    if (!m.stoppedAt && !keep.has(m.id)) await t.PatientMedication.where((x) => x.id.eq(m.id)).delete();
  }
}

/**
 * Writes every clinical list for a patient. Prisma 8 has no nested create, so the
 * rows go in one at a time; callers run this inside the same transaction as the
 * patient write so a list is never half-applied.
 */
async function writeClinicalLists(t: typeof orm, patientId: string, lists: ClinicalLists) {
  const now = instantToDb(new Date());
  for (const a of lists.allergies) {
    await t.PatientAllergy.create({
      id: newId(),
      patientId,
      label: a.label,
      reaction: a.reaction,
      severity: a.severity,
      notes: a.notes,
      createdAt: now,
    });
  }
  for (const c of lists.conditions) {
    await t.PatientCondition.create({
      id: newId(),
      patientId,
      label: c.label,
      notes: c.notes,
      createdAt: now,
    });
  }
  for (const m of lists.medications) {
    await t.PatientMedication.create({
      id: newId(),
      patientId,
      label: m.label,
      dosage: m.dosage,
      frequency: m.frequency,
      notes: m.notes,
      createdAt: now,
    });
  }
  for (const a of lists.alerts) {
    await t.PatientAlert.create({
      id: newId(),
      patientId,
      label: a.label,
      notes: a.notes,
      createdAt: now,
    });
  }
}

/**
 * The columns the form owns: the ORM's create input minus the keys the action
 * supplies itself, and minus the relation slots — the same object is spread into
 * both a create and an update, and update takes columns only.
 */
type PatientScalars = Omit<
  Parameters<typeof orm.Patient.create>[0],
  | "id"
  | "householdId"
  | "createdAt"
  | "updatedAt"
  | "household"
  | "appointments"
  | "medicalRecords"
  | "allergies"
  | "conditions"
  | "medications"
  | "alerts"
  | "primaryContactFor"
  | "chartAccesses"
  | "documentRequests"
  | "clinic"
  | "account"
  | "activations"
  | "caredForBy"
  | "primaryDoctor"
  | "appointmentRequests"
>;

type ParsedPatient =
  | { ok: false; error: FormState }
  | {
      ok: true;
      householdId: string;
      scalars: PatientScalars;
      lists: ClinicalLists;
    };

function parsePatientForm(formData: FormData): ParsedPatient {
  const parsed = patientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: toFieldErrors(parsed.error) };

  const allergies = readClinicalList(formData, "allergy", "Allergy");
  if (allergies.error) return { ok: false, error: allergies.error };
  const conditions = readClinicalList(formData, "condition", "Condition");
  if (conditions.error) return { ok: false, error: conditions.error };
  const medications = readClinicalList(formData, "medication", "Medication");
  if (medications.error) return { ok: false, error: medications.error };
  const alerts = readClinicalList(formData, "alert", "Medical alert");
  if (alerts.error) return { ok: false, error: alerts.error };

  const dob = fromDateInputValue(parsed.data.dateOfBirth);
  if (!dob || dob > new Date()) {
    return {
      ok: false,
      error: { message: "Check the date of birth.", fieldErrors: { dateOfBirth: ["Must be in the past"] } },
    };
  }

  const {
    householdId,
    newHouseholdName: _newHousehold,
    confirmDuplicate: _confirm,
    dateOfBirth: _dob,
    allergyStatus,
    conditionStatus,
    medicationStatus,
    ...rest
  } = parsed.data;

  return {
    ok: true,
    householdId,
    scalars: {
      ...rest,
      dateOfBirth: calendarDateToDb(dob),
      allergyStatus: reconcileStatus(allergyStatus, allergies.rows.length),
      conditionStatus: reconcileStatus(conditionStatus, conditions.rows.length),
      medicationStatus: reconcileStatus(medicationStatus, medications.rows.length),
    },
    lists: {
      allergies: allergies.rows,
      conditions: conditions.rows,
      medications: medications.rows,
      alerts: alerts.rows,
    },
  };
}

/**
 * The duplicate challenge, or null when the save may go ahead.
 *
 * Possible duplicates are shown, never merged. The confirmation carries a
 * fingerprint of the details it was given for, so an approval of one person's
 * details cannot be replayed against edited ones — change the name or the date
 * of birth after ticking and this no longer matches, so we ask again.
 */
async function duplicateChallenge(
  clinicId: string,
  formData: FormData,
  scalars: Record<string, unknown>,
  excludePatientId?: string,
): Promise<FormState | null> {
  const identity = {
    firstName: scalars.firstName as string,
    lastName: scalars.lastName as string,
    dateOfBirth: scalars.dateOfBirth as string,
    contactNumber: (scalars.contactNumber as string | null) ?? null,
    email: (scalars.email as string | null) ?? null,
  };

  const fingerprint = identityFingerprint(identity);
  if (String(formData.get("confirmDuplicate") ?? "") === fingerprint) return null;

  const duplicates = await findPossibleDuplicates(clinicId, identity, excludePatientId);
  if (duplicates.length === 0) return null;

  return {
    message:
      duplicates.length === 1
        ? "Someone matching this person is already registered."
        : `${duplicates.length} people matching this person are already registered.`,
    duplicates,
    confirmToken: fingerprint,
  };
}

export async function createPatient(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = parsePatientForm(formData);
  if (!parsed.ok) return parsed.error;

  const creatingHousehold = parsed.householdId === NEW_HOUSEHOLD;
  const newHouseholdName = String(formData.get("newHouseholdName") ?? "").trim();

  if (creatingHousehold) {
    if (!newHouseholdName) {
      return {
        message: "Name the new household.",
        fieldErrors: { newHouseholdName: ["Required when creating a household"] },
      };
    }
  } else if (!(await assertClinicHousehold(staff.clinicId, parsed.householdId))) {
    return { message: "That household is not on your list." };
  }

  // A new household is somebody's: the doctor's own, or the one the desk
  // chose. An existing household already has its doctor.
  const attributedTo = staff.doctorId ?? (await pickDoctor(staff.clinicId, formData.get("doctorId"))).doctorId;
  if (creatingHousehold && !attributedTo) {
    return { message: "Choose which doctor this patient is for.", fieldErrors: { doctorId: ["Required"] } };
  }

  const clinical = staff.role === "SECRETARY" ? EMPTY_LISTS : parsed.lists;

  const challenge = await duplicateChallenge(staff.clinicId, formData, parsed.scalars);
  if (challenge) return challenge;

  // The patient and its clinical lists are written together: a half-created
  // patient with no allergies would read as "none known" rather than "not asked".
  const patient = await db.transaction(async (tx) => {
    const now = instantToDb(new Date());

    // A household typed into the form is created here, in the same unit of work
    // as the patient — so a failed registration never leaves an empty household
    // behind.
    const householdId = creatingHousehold
      ? (
          await tx.orm.public.Household.select("id").create({
            id: newId(),
            doctorId: attributedTo!,
            clinicId: staff.clinicId,
            name: newHouseholdName,
            createdAt: now,
            updatedAt: now,
          })
        ).id
      : parsed.householdId;
    // Claimed in the same transaction as the row, so two registrations racing
    // each other cannot be handed the same number.
    const patientNumber = await allocatePatientNumber(tx);

    const created = await tx.orm.public.Patient.select("id").create({
      ...parsed.scalars,
      id: newId(),
      patientNumber,
      householdId,
      clinicId: staff.clinicId,
      createdAt: now,
      updatedAt: now,
    });
    await writeClinicalLists(tx.orm.public, created.id, clinical);

    // The first member of a household created here becomes its point of
    // contact. Nobody else can be — the household has exactly this one person —
    // and a household with no contact is not something staff would ever choose.
    if (creatingHousehold) {
      await tx.orm.public.Household
        .where((h) => h.id.eq(householdId))
        .update({ primaryContactId: created.id, updatedAt: now });
    }

    return { ...created, householdId };
  });

  revalidatePath(`/households/${patient.householdId}`);
  revalidatePath("/households");
  revalidatePath("/patients");
  redirect(`/patients/${patient.id}`);
}

export async function updatePatient(
  patientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = parsePatientForm(formData);
  if (!parsed.ok) return parsed.error;

  // The form offers "＋ New household…" here too, so moving a patient into one
  // typed on the spot has to work the same way it does on registration.
  const creatingHousehold = parsed.householdId === NEW_HOUSEHOLD;
  const newHouseholdName = String(formData.get("newHouseholdName") ?? "").trim();

  if (creatingHousehold) {
    if (!newHouseholdName) {
      return {
        message: "Name the new household.",
        fieldErrors: { newHouseholdName: ["Required when creating a household"] },
      };
    }
  } else if (!(await assertClinicHousehold(staff.clinicId, parsed.householdId))) {
    return { message: "That household is not on your list." };
  }

  const owned = await orm.Patient
    .select("id", "householdId", "archivedAt")
    .where((p) => p.id.eq(patientId))
    .where((p) => p.clinicId.eq(staff.clinicId))
    .first();
  if (!owned) return { message: "That patient no longer exists." };
  if (owned.archivedAt) {
    return { message: "This chart is archived. It has to be restored before its details change." };
  }
  // The chart is for doctors caring for this patient; the desk edits details only.
  if (staff.doctorId && !(await caresFor({ id: staff.doctorId, clinicId: staff.clinicId }, patientId))) {
    return { message: "Book this patient with you first; then you can edit their chart." };
  }

  // A new household is somebody's: the doctor's own, or the one the desk
  // chose. An existing household already has its doctor.
  const attributedTo = staff.doctorId ?? (await pickDoctor(staff.clinicId, formData.get("doctorId"))).doctorId;
  if (creatingHousehold && !attributedTo) {
    return { message: "Choose which doctor this patient is for.", fieldErrors: { doctorId: ["Required"] } };
  }

  // Excluding this patient stops it matching itself.
  const challenge = await duplicateChallenge(staff.clinicId, formData, parsed.scalars, patientId);
  if (challenge) return challenge;

  // The lists are edited as a whole, so they are replaced wholesale — the same
  // way prescriptions are handled on a record.
  const householdId = await db.transaction(async (tx) => {
    const t = tx.orm.public;
    const t2 = tx.sql.public;
    const now = instantToDb(new Date());

    const target = creatingHousehold
      ? (
          await t.Household.select("id").create({
            id: newId(),
            doctorId: attributedTo!,
            clinicId: staff.clinicId,
            name: newHouseholdName,
            createdAt: now,
            updatedAt: now,
          })
        ).id
      : parsed.householdId;

    // Somebody can be the point of contact only for the household they are in,
    // and only for one — the column is uniquely indexed. Moving them out has to
    // release that first, or the old household is left pointing at a person who
    // has left and the index refuses the new link.
    if (target !== owned.householdId) {
      // Through the SQL lane, as the clinical lists are: the ORM's update is
      // shaped for a predicate on the primary key, and this one is not.
      const release = t2.Household
        .update({ primaryContactId: null, updatedAt: now })
        .where((f, fns) => fns.eq(f.primaryContactId, patientId))
        .build();
      await tx.execute(release as never);
    }

    await t.Patient.where((p) => p.id.eq(patientId)).update({
      ...parsed.scalars,
      householdId: target,
      updatedAt: now,
    });
    // A secretary's edit never reaches the clinical lists, so they are left
    // exactly as the doctor last recorded them rather than replaced by an
    // empty set from a form that did not show them.
    if (staff.role !== "SECRETARY") {
      await clearClinicalLists(tx, patientId);
      await writeClinicalLists(t, patientId, { ...parsed.lists, conditions: [], medications: [] });
      await syncConditions(t, patientId, parsed.lists.conditions);
      await syncMedications(t, patientId, parsed.lists.medications);
    }

    // Same reasoning as on registration: the only member of a household made
    // here is its point of contact.
    if (creatingHousehold) {
      await t.Household
        .where((h) => h.id.eq(target))
        .update({ primaryContactId: patientId, updatedAt: now });
    }

    return target;
  });

  revalidatePath("/patients");
  revalidatePath("/households");
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/households/${householdId}`);
  revalidatePath(`/households/${owned.householdId}`);
  redirect(`/patients/${patientId}`);
}

/**
 * Everything that makes a chart more than a registration.
 *
 * Deletion cascades through all of it — notes, their version history,
 * prescriptions, issued certificates, the visit diary — so a chart holding any
 * of it is archived, never deleted. What is left for deletion is the genuine
 * "registered by mistake" case: a name and a date of birth with nothing
 * attached. A portal login counts too, because deleting the chart would leave
 * somebody's account pointing at nothing.
 */
async function clinicalHistory(clinicId: string, patientId: string) {
  const patient = await orm.Patient
    .select("id", "householdId", "accountId", "archivedAt")
    .include("medicalRecords", (r) => r.count())
    .include("appointments", (a) => a.count())
    .include("documentRequests", (d) => d.count())
    .include("appointmentRequests", (r) => r.count())
    .include("allergies", (a) => a.count())
    .include("conditions", (c) => c.count())
    .include("medications", (m) => m.count())
    .include("alerts", (a) => a.count())
    .where((p) => p.id.eq(patientId))
    .where((p) => p.clinicId.eq(clinicId))
    .first();
  if (!patient) return null;

  const held = [
    [patient.medicalRecords, "visit note"],
    [patient.appointments, "appointment"],
    [patient.documentRequests, "records request"],
    [patient.appointmentRequests, "appointment request"],
    [patient.allergies + patient.conditions + patient.medications + patient.alerts, "clinical list entry"],
  ] as const;
  const reasons = held
    .filter(([n]) => n > 0)
    .map(([n, what]) => `${n} ${what}${n === 1 ? "" : "s"}`);
  if (patient.accountId) reasons.push("a portal login");

  return { patient, reasons };
}

const blocked = (patientId: string, why: string) =>
  redirect(`/patients/${patientId}?blocked=${encodeURIComponent(why)}`);

/**
 * Takes a chart out of the working lists without destroying anything in it.
 *
 * A clinician's decision. Setting a person aside hides their whole history from
 * the desk and the consulting room, and that is not desk work.
 *
 * Refused while they still have a visit ahead or a request waiting: those sit
 * in the diary and the desk's queue, and archiving the chart underneath them
 * would leave bookings for somebody nobody can find. Cancelling them first is
 * also what frees the slots.
 */
export async function archivePatient(formData: FormData) {
  const doctor = await requireDoctor();
  const patientId = String(formData.get("patientId") ?? "");
  const reason = String(formData.get("archiveReason") ?? "").trim().slice(0, 300);
  if (!patientId) return;
  // Only a doctor caring for this patient decides about their chart.
  if (!(await caresFor(doctor, patientId))) return;

  const patient = await orm.Patient
    .select("id", "householdId", "archivedAt")
    .where((p) => p.id.eq(patientId))
    .where((p) => p.clinicId.eq(doctor.clinicId))
    .first();
  if (!patient || patient.archivedAt) return;
  if (!reason) blocked(patientId, "Say why this chart is being archived.");

  const now = instantToDb(new Date());
  const [ahead, waiting] = await Promise.all([
    orm.Appointment
      .select("id")
      .where((a) => a.patientId.eq(patientId))
      .where((a) => a.clinicId.eq(doctor.clinicId))
      .where((a) => a.scheduledAt.gte(now))
      .where((a) => a.status.in(ACTIVE_STATUSES))
      .all(),
    orm.AppointmentRequest
      .select("id")
      .where((r) => r.patientId.eq(patientId))
      .where((r) => r.status.eq("PENDING"))
      .all(),
  ]);
  if (ahead.length > 0 || waiting.length > 0) {
    const parts = [
      ahead.length ? `${ahead.length} upcoming appointment${ahead.length === 1 ? "" : "s"}` : "",
      waiting.length ? `${waiting.length} pending request${waiting.length === 1 ? "" : "s"}` : "",
    ].filter(Boolean);
    blocked(patientId, `This patient still has ${parts.join(" and ")}. Cancel or decline them first.`);
  }

  await orm.Patient.where((p) => p.id.eq(patientId)).update({
    archivedAt: now,
    archivedById: doctor.accountId,
    archiveReason: reason,
    updatedAt: now,
  });

  revalidatePath("/patients");
  revalidatePath("/desk/patients");
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/households/${patient.householdId}`);
  redirect(`/patients/${patientId}`);
}

/**
 * Puts an archived chart back into the lists, exactly as it was left.
 *
 * If the household it belongs to was archived as well, that comes back too: a
 * restored person in a hidden household would still be nowhere to be found.
 */
export async function restorePatient(formData: FormData) {
  const doctor = await requireDoctor();
  const patientId = String(formData.get("patientId") ?? "");
  if (!patientId) return;
  // Only a doctor caring for this patient decides about their chart.
  if (!(await caresFor(doctor, patientId))) return;

  const patient = await orm.Patient
    .select("id", "householdId", "archivedAt")
    .include("household", (h) => h.select("id", "archivedAt"))
    .where((p) => p.id.eq(patientId))
    .where((p) => p.clinicId.eq(doctor.clinicId))
    .first();
  if (!patient || !patient.archivedAt) return;

  const now = instantToDb(new Date());
  await db.transaction(async (tx) => {
    const t = tx.orm.public;
    await t.Patient.where((p) => p.id.eq(patientId)).update({
      archivedAt: null,
      archivedById: null,
      archiveReason: null,
      updatedAt: now,
    });
    if (patient.household.archivedAt) {
      await t.Household.where((h) => h.id.eq(patient.householdId)).update({
        archivedAt: null,
        archivedById: null,
        archiveReason: null,
        updatedAt: now,
      });
    }
  });

  revalidatePath("/patients");
  revalidatePath("/desk/patients");
  revalidatePath("/households");
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/households/${patient.householdId}`);
  redirect(`/patients/${patientId}`);
}

/**
 * Deletes a chart that was registered by mistake, and nothing else.
 *
 * Anything with a history is refused and pointed at archiving instead; the
 * list of what it holds is given, so the refusal explains itself.
 */
export async function deletePatient(formData: FormData) {
  const doctor = await requireDoctor();
  const patientId = String(formData.get("patientId") ?? "");
  if (!patientId) return;
  // Only a doctor caring for this patient decides about their chart.
  if (!(await caresFor(doctor, patientId))) return;

  // Permanent: the phrase has to have been typed, whatever the page showed.
  if (!phraseTyped(formData, DELETE_PHRASES.registration)) {
    blocked(patientId, "Nothing was deleted: the confirmation phrase wasn't typed.");
  }

  const found = await clinicalHistory(doctor.clinicId, patientId);
  if (!found) return;
  if (found.reasons.length > 0) {
    blocked(
      patientId,
      `This chart holds ${found.reasons.join(", ")}, so it can be archived but not deleted.`,
    );
  }

  const { householdId } = found.patient;
  // A household naming this person as its contact is released by the
  // database (SetNull); nothing else can hang off a chart with no history.
  await orm.Patient.where((p) => p.id.eq(patientId)).delete();

  revalidatePath("/patients");
  revalidatePath("/desk/patients");
  revalidatePath(`/households/${householdId}`);
  redirect(`/households/${householdId}`);
}

/** Somebody starting their own household (lib/households.ts), from a chart's Household card. */
export async function startOwnHousehold(formData: FormData) {
  const staff = await requireStaff();
  const patientId = String(formData.get("patientId") ?? "");
  const result = await startOwnHouseholdFor(staff, patientId, formData.getAll("memberId").map(String));
  if (!result.ok) return;

  revalidatePath(`/desk/patients/${patientId}`);
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/households/${result.householdId}`);
  // Back to the chart it was started from: the desk's or the doctor's.
  const back = String(formData.get("back") ?? "");
  redirect(`${back === `/patients/${patientId}` ? back : `/desk/patients/${patientId}`}?household=new`);
}


/** "Reopen" on a past condition: current again. */
export async function reopenCondition(formData: FormData) {
  const doctor = await requireDoctor();
  const result = await setConditionResolved(doctor, String(formData.get("conditionId") ?? ""), false);
  if (result.ok) revalidatePath(`/patients/${result.patientId}`);
}
