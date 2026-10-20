import "server-only";
import type { AllergySeverity, ClinicRole } from "@/lib/enums";
import { pickDoctor } from "@/lib/clinic";
import { db, orm } from "@/src/prisma/db";
import { calendarDateToDb, fromDateInputValue, instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { allocatePatientNumber } from "@/lib/patient-number";
import {
  clinicalItemSchema,
  patientSchema,
  toFieldErrors,
  identityFingerprint,
  NEW_HOUSEHOLD,
  type FormState,
} from "@/lib/validation";
import { findPossibleDuplicates } from "@/lib/queries";

/*
 * Registering a patient, and the patient form's parsing and checks: shared by
 * the web's actions (app/actions/patients.ts) and the app's API
 * (POST /api/v1/doctor/patients), so both hold to the same rules.
 */

/** Confirms the household belongs to this clinic before anything is written. */
export async function assertClinicHousehold(clinicId: string, householdId: string) {
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
export const EMPTY_LISTS: ClinicalLists = {
  allergies: [],
  conditions: [],
  medications: [],
  alerts: [],
};

export type ClinicalRow = {
  label: string;
  reaction: string | null;
  severity: AllergySeverity | null;
  dosage: string | null;
  frequency: string | null;
  notes: string | null;
};

export type ClinicalLists = {
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
export function readClinicalList(
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
export function reconcileStatus(declared: string, count: number) {
  if (count > 0) return "RECORDED" as const;
  return declared === "NONE_KNOWN" ? ("NONE_KNOWN" as const) : ("UNKNOWN" as const);
}

/**
 * Writes every clinical list for a patient. Prisma 8 has no nested create, so the
 * rows go in one at a time; callers run this inside the same transaction as the
 * patient write so a list is never half-applied.
 */
export async function writeClinicalLists(t: typeof orm, patientId: string, lists: ClinicalLists) {
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
export type PatientScalars = Omit<
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
  | "familyHistory"
  | "pastHistory"
  | "immunizations"
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

export type ParsedPatient =
  | { ok: false; error: FormState }
  | {
      ok: true;
      householdId: string;
      scalars: PatientScalars;
      lists: ClinicalLists;
    };

export function parsePatientForm(formData: FormData): ParsedPatient {
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
export async function duplicateChallenge(
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

/** Who is registering: the desk or a doctor, at their clinic. */
export type Registrar = { clinicId: string; role: ClinicRole; doctorId: string | null };

/**
 * Registers a patient from the patient form's fields: into a household of the
 * clinic's or a new one, after the duplicate check, with a patient number. A
 * secretary's clinical lists are ignored (see EMPTY_LISTS).
 */
export async function registerPatient(
  staff: Registrar,
  formData: FormData,
): Promise<{ ok: true; id: string; householdId: string } | { ok: false; error: FormState }> {
  const parsed = parsePatientForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const creatingHousehold = parsed.householdId === NEW_HOUSEHOLD;
  const newHouseholdName = String(formData.get("newHouseholdName") ?? "").trim();

  if (creatingHousehold) {
    if (!newHouseholdName) {
      return {
        ok: false,
        error: { message: "Name the new household.", fieldErrors: { newHouseholdName: ["Required when creating a household"] } },
      };
    }
  } else if (!(await assertClinicHousehold(staff.clinicId, parsed.householdId))) {
    return { ok: false, error: { message: "That household is not on your list." } };
  }

  // A new household is somebody's: the doctor's own, or the one the desk
  // chose. An existing household already has its doctor.
  const attributedTo = staff.doctorId ?? (await pickDoctor(staff.clinicId, formData.get("doctorId"))).doctorId;
  if (creatingHousehold && !attributedTo) {
    return { ok: false, error: { message: "Choose which doctor this patient is for.", fieldErrors: { doctorId: ["Required"] } } };
  }

  const clinical = staff.role === "SECRETARY" ? EMPTY_LISTS : parsed.lists;

  const challenge = await duplicateChallenge(staff.clinicId, formData, parsed.scalars);
  if (challenge) return { ok: false, error: challenge };

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

  return { ok: true, id: patient.id, householdId: patient.householdId };
}
