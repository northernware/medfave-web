import "server-only";
import { AppointmentStatus } from "@/lib/enums";
import { CONSULTED_STATUSES } from "@/lib/domain";
import { db, orm } from "@/src/prisma/db";
import { calendarDateFromDb, calendarDateToDb, instantFromDb, instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import type { RecordSnapshot } from "@/lib/record-versions";
import { readDiagnoses, writeDiagnoses } from "@/lib/diagnoses";
import { fromDateInputValue, fromDateTimeLocalValue } from "@/lib/datetime";
import {
  medicalRecordDraftSchema,
  medicalRecordSchema,
  prescriptionSchema,
  toFieldErrors,
  type FormState,
} from "@/lib/validation";

/*
 * Writing a consultation note: drafts, signing, amendments with a reason and
 * a version trail, prescriptions, and the teleconsultation rules. Shared by
 * the web's form (app/actions/records.ts) and the app's API
 * (app/api/v1/doctor/records), so both obey exactly the same rules. Input is
 * the form's fields as FormData; the API builds one from its JSON.
 */

export type PrescriptionInput = {
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string | null;
  instructions: string | null;
};

/**
 * Prescription rows arrive as parallel repeated fields. Rows with no drug name
 * are blank templates the doctor never filled in, so they are dropped.
 */
function readPrescriptions(formData: FormData): { rows: PrescriptionInput[]; error?: FormState } {
  const names = formData.getAll("rx.drugName").map(String);
  const rows: PrescriptionInput[] = [];

  for (let i = 0; i < names.length; i++) {
    const row = {
      drugName: names[i],
      dosage: String(formData.getAll("rx.dosage")[i] ?? ""),
      frequency: String(formData.getAll("rx.frequency")[i] ?? ""),
      duration: String(formData.getAll("rx.duration")[i] ?? ""),
      instructions: String(formData.getAll("rx.instructions")[i] ?? ""),
    };
    if (!row.drugName.trim()) continue;

    const parsed = prescriptionSchema.safeParse(row);
    if (!parsed.success) {
      const flat = toFieldErrors(parsed.error);
      return {
        rows: [],
        error: { message: `Prescription ${i + 1}: ${flat.message}`, fieldErrors: flat.fieldErrors },
      };
    }
    rows.push(parsed.data);
  }

  return { rows };
}

/**
 * Replaces a record's prescription rows. Prisma 8 has no nested or bulk create,
 * so they go in one at a time inside the caller's transaction.
 */
async function writePrescriptions(
  t: typeof orm,
  medicalRecordId: string,
  rows: PrescriptionInput[],
) {
  const now = instantToDb(new Date());
  for (const r of rows) {
    await t.Prescription.create({ ...r, id: newId(), medicalRecordId, createdAt: now });
  }
}

/**
 * The parts of a note that only exist because somebody was in the room.
 *
 * Everything here is either an examination or a measurement the clinic takes.
 * A reading the patient gives over the phone is not one of these — it is
 * something they said, and it belongs in the history with the rest of what
 * they said.
 */
const PHYSICAL_FIELDS: [string, string][] = [
  ["physicalExamination", "a physical examination"],
  ["temperatureC", "Temperature"],
  ["heartRate", "Pulse"],
  ["respiratoryRate", "Respiratory rate"],
  ["systolic", "Blood pressure"],
  ["diastolic", "Blood pressure"],
  ["weightKg", "Weight"],
  ["heightCm", "Height"],
  ["oxygenSaturation", "Oxygen saturation"],
];

/** What the doctor pressed: still writing, or done. */
export type Intent = "draft" | "finish";

/** A transaction context, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Makes sure a note has a version standing for the text it already held.
 *
 * Notes signed before this trail existed have no version rows, and neither
 * does a note whose baseline somehow went missing. Amending one of those would
 * write the new text as version 1 and leave nothing saying what it replaced —
 * exactly the loss the trail is here to prevent. So the state on the row is
 * captured first, attributed to whoever signed it and dated to when they did.
 */
async function ensureBaselineVersion(tx: Tx, recordId: string, fallbackAuthorId: string) {
  const t = tx.orm.public;

  const existing = await t.MedicalRecordVersion
    .select("id")
    .where((v) => v.medicalRecordId.eq(recordId))
    .first();
  if (existing) return;

  const record = await t.MedicalRecord
    .include("prescriptions", (p) =>
      p
        .select("drugName", "dosage", "frequency", "duration", "instructions")
        .orderBy((x) => x.createdAt.asc()),
    )
    .include("diagnoses", (d) => d.select("code", "title").orderBy((x) => x.position.asc()))
    .where((r) => r.id.eq(recordId))
    .first();
  if (!record) return;

  const snapshot: RecordSnapshot = {
    visitDate: instantFromDb(record.visitDate).toISOString(),
    chiefComplaint: record.chiefComplaint,
    historyOfPresentIllness: record.historyOfPresentIllness,
    physicalExamination: record.physicalExamination,
    temperatureC: record.temperatureC,
    heartRate: record.heartRate,
    respiratoryRate: record.respiratoryRate,
    systolic: record.systolic,
    diastolic: record.diastolic,
    weightKg: record.weightKg,
    heightCm: record.heightCm,
    oxygenSaturation: record.oxygenSaturation,
    assessment: record.assessment,
    treatmentPlan: record.treatmentPlan,
    followUpDate: record.followUpDate
      ? calendarDateFromDb(record.followUpDate).toISOString().slice(0, 10)
      : null,
    notes: record.notes,
    prescriptions: record.prescriptions.map((rx) => ({ ...rx })),
    diagnoses: record.diagnoses.map((d) => ({ ...d })),
  };

  await t.MedicalRecordVersion.create({
    id: newId(),
    medicalRecordId: recordId,
    version: 1,
    snapshot: JSON.stringify(snapshot),
    reason: null,
    authorId: record.finalizedById ?? fallbackAuthorId,
    createdAt: record.finalizedAt ?? record.updatedAt,
  });
}

/**
 * Holds one record still for the length of a transaction.
 *
 * Version numbers are read and then written, which two concurrent amendments
 * would both do against the same value; the second would lose to the unique
 * index on (record, version) and take the whole save down with it. The lock
 * makes the second wait and read the number the first just used.
 */
async function lockRecord(tx: Tx, recordId: string) {
  const plan = db.raw.sql`SELECT id FROM "MedicalRecord" WHERE id = ${recordId} FOR UPDATE`
    .affectedCount()
    .build();
  await tx.execute(plan as never);
}

type WriteOutcome =
  | { error: FormState }
  | { recordId: string; patientId: string; savedAt: Date };

/** Ways the record can move underneath a save that is already in flight. */
type SaveConflict = "gone" | "archived" | "moved";

const CONFLICT_MESSAGE: Record<SaveConflict, string> = {
  gone: "That record no longer exists.",
  archived:
    "This record was archived while you were writing. Restore it before making changes — nothing here has been saved.",
  moved:
    "This note was signed or amended while you were writing, so nothing here has been saved. Reload to see the current text before making changes.",
};

/**
 * Writes a consultation, whether it is being drafted or finished.
 *
 * Creating and updating used to be two functions that had drifted apart. They
 * are one path now, because autosave makes the difference invisible anyway: the
 * first save of a new note creates the row, every save after that updates it,
 * and the doctor never sees which happened.
 */
export async function writeConsultation(
  clinicId: string,
  doctorId: string,
  formData: FormData,
  intent: Intent,
): Promise<WriteOutcome> {
  // A draft is held to every rule except being complete. See the schemas.
  const schema = intent === "finish" ? medicalRecordSchema : medicalRecordDraftSchema;
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: toFieldErrors(parsed.error) };

  const recordId = String(formData.get("recordId") ?? "").trim();
  const { patientId, appointmentId, visitDate, followUpDate, ...rest } = parsed.data;

  const patient = await orm.Patient
    .select("id", "archivedAt")
    .where((p) => p.id.eq(patientId))
    // Any patient of the clinic: writing a note is part of caring for them.
    .where((p) => p.clinicId.eq(clinicId))
    .first();
  if (!patient) return { error: { message: "That patient is not on your list." } };
  // Writing into a chart that has been set aside is a sign it should not have
  // been; restoring it first makes that a decision rather than an accident.
  if (patient.archivedAt) {
    return { error: { message: "This chart is archived. Restore it before writing in it." } };
  }

  const existing = recordId
    ? await orm.MedicalRecord
        .select("id", "patientId", "status", "appointmentId", "archivedAt")
        .where((r) => r.id.eq(recordId))
        .where((r) => r.doctorId.eq(doctorId))
        .first()
    : null;
  if (recordId && !existing) return { error: { message: "That record no longer exists." } };

  // These three checks decide what kind of write this is. They read the row
  // before the lock, so they are a plan rather than a guarantee — the same
  // checks are made again under the lock below, where they can be trusted.
  //
  // A signed note is not something autosave may quietly rewrite. Changing one
  // is a deliberate act with its own trail; drafting is not it.
  if (existing && existing.status !== "DRAFT" && intent === "draft") {
    return { error: { message: "This note has been signed — it cannot be saved as a draft." } };
  }

  if (existing?.archivedAt) {
    return { error: { message: "This record is archived. Restore it before making changes." } };
  }

  // Changing a note that has been signed is an amendment, and an amendment
  // without a reason is indistinguishable from a note that was always this
  // way. The reason is the part that makes the trail worth keeping.
  const amending = Boolean(existing) && existing!.status !== "DRAFT" && intent === "finish";
  const amendmentReason = String(formData.get("amendmentReason") ?? "").trim();
  if (amending && !amendmentReason) {
    return {
      error: {
        message: "Say what is being corrected and why.",
        fieldErrors: { amendmentReason: ["A reason is required to amend a signed note"] },
      },
    };
  }
  if (amendmentReason.length > 500) {
    return {
      error: {
        message: "Keep the amendment reason under 500 characters.",
        fieldErrors: { amendmentReason: ["Too long"] },
      },
    };
  }

  const visitedAt = fromDateTimeLocalValue(visitDate);
  if (!visitedAt) {
    return { error: { message: "Check the visit date.", fieldErrors: { visitDate: ["Invalid date"] } } };
  }

  // The appointment a note documents is settled when the note is created and
  // not revisited: re-resolving it on every autosave would fight the
  // "already documented" rule against the record's own link.
  let linkedAppointmentId: string | null = existing?.appointmentId ?? null;
  if (!existing && appointmentId) {
    const appointment = await orm.Appointment
      .select("id", "status")
      .where((a) => a.id.eq(appointmentId))
      .where((a) => a.doctorId.eq(doctorId))
      .where((a) => a.patientId.eq(patientId))
      .where((a) => a.medicalRecord.none((r) => r.id.isNotNull()))
      .first();
    if (!appointment) {
      return { error: { message: "That appointment is unavailable or already has a record." } };
    }
    // A note is the account of a consultation, so there has to have been one.
    // Writing up a visit that is merely booked — or one that was cancelled or
    // missed — puts a consultation in the chart that never took place.
    if (!CONSULTED_STATUSES.includes(appointment.status)) {
      return {
        error: {
          message:
            "That visit has not been seen yet. Start the consultation from the appointment, then write it up.",
        },
      };
    }
    linkedAppointmentId = appointment.id;
  }

  // --- what a teleconsultation cannot contain -----------------------------
  // Nobody laid hands on this patient, so nothing that requires it can be
  // recorded as though they had. Anything the patient reported themselves
  // belongs in the history, where it reads as what it is.
  if (linkedAppointmentId) {
    const visit = await orm.Appointment
      .select("visitType")
      .where((a) => a.id.eq(linkedAppointmentId))
      .first();

    if (visit?.visitType === "TELECONSULTATION") {
      const offending = PHYSICAL_FIELDS.filter(
        ([key]) => rest[key as keyof typeof rest] !== null && rest[key as keyof typeof rest] !== undefined,
      );
      if (offending.length > 0) {
        return {
          error: {
            // Systolic and diastolic are one reading to a reader, so the
            // message names blood pressure once.
            message: `A teleconsultation cannot record ${[
              ...new Set(offending.map(([, label]) => label.toLowerCase())),
            ].join(", ")} — nobody was there to measure it. Put anything the patient reported in the history instead.`,
            fieldErrors: Object.fromEntries(
              offending.map(([key]) => [key, ["Not available in a teleconsultation"]]),
            ),
          },
        };
      }
    }
  }

  const { rows, error } = readPrescriptions(formData);
  if (error) return { error };
  const { rows: diagnoses, keep: keepDiagnoses, error: dxError } = await readDiagnoses(formData);
  if (dxError) return { error: dxError };

  const savedAt = new Date();
  const now = instantToDb(savedAt);
  const followUp = followUpDate ? fromDateInputValue(followUpDate) : null;

  const scalars = {
    ...rest,
    visitDate: instantToDb(visitedAt),
    followUpDate: followUp ? calendarDateToDb(followUp) : null,
    updatedAt: now,
  };

  const outcome = await db.transaction<{ conflict: SaveConflict } | { id: string }>(async (tx) => {
    const t = tx.orm.public;

    // Two amendments racing would otherwise compute the same next version
    // number and one would lose to the unique index. The row lock makes the
    // second wait and see the first.
    if (existing) {
      await lockRecord(tx, existing.id);

      // Everything above was decided against a read taken before the lock. In
      // between, someone may have signed this note, amended it, or archived
      // it — and an autosave still in flight from before that would land here
      // believing it was writing to a draft. It would then overwrite signed
      // text with no amendment and no version: the exact loss the trail is
      // meant to prevent. So the row is read again, now that it is held still,
      // and a save planned against a state that has moved is refused.
      const current = await t.MedicalRecord
        .select("id", "status", "archivedAt")
        .where((r) => r.id.eq(existing.id))
        .first();

      if (!current) return { conflict: "gone" as const };
      if (current.archivedAt) return { conflict: "archived" as const };
      if (current.status !== existing.status) return { conflict: "moved" as const };
    }

    // Before the new text lands, not after.
    if (amending) await ensureBaselineVersion(tx, existing!.id, doctorId);

    // Signing stamps who signed it and when, once. Re-saving a note that is
    // already signed leaves the original signature alone — it records when the
    // note was committed to, which a later edit does not change. An amendment
    // says so in the status instead.
    const signature =
      intent === "finish" && (!existing || existing.status === "DRAFT")
        ? { status: "FINALIZED" as const, finalizedAt: now, finalizedById: doctorId }
        : amending
          ? { status: "AMENDED" as const }
          : {};

    let targetId: string;
    if (existing) {
      await t.MedicalRecord.where((r) => r.id.eq(existing.id)).update({ ...scalars, ...signature });
      targetId = existing.id;

      // The prescription list is edited as a whole, so replace it wholesale.
      // `.delete()` on the ORM removes one row; prescriptions are matched by a
      // non-unique key, so this has to go through the SQL-builder lane or all
      // but one would survive the edit.
      const clear = tx.sql.public.Prescription
        .delete()
        .where((f, fns) => fns.eq(f.medicalRecordId, existing.id))
        .build();
      await tx.execute(clear as never);
      // The same for diagnoses: the list is edited as a whole, in order.
      if (!keepDiagnoses) {
        const clearDx = tx.sql.public.VisitDiagnosis
          .delete()
          .where((f, fns) => fns.eq(f.medicalRecordId, existing.id))
          .build();
        await tx.execute(clearDx as never);
      }
    } else {
      const created = await t.MedicalRecord.select("id").create({
        ...scalars,
        id: newId(),
        patientId,
        doctorId,
        // The clinic owns the note; the doctor authored it.
        clinicId,
        appointmentId: linkedAppointmentId,
        status: "DRAFT",
        createdAt: now,
        ...signature,
      });
      targetId = created.id;
    }

    await writePrescriptions(t, targetId, rows);
    if (!keepDiagnoses) await writeDiagnoses(t, targetId, diagnoses);

    // Finishing the consultation is what completes the visit — saving a draft
    // is not. The appointment used to be marked done the moment a record row
    // existed, which meant an unfinished note closed the visit behind the
    // doctor's back.
    if (intent === "finish" && linkedAppointmentId) {
      // Read first: amending a signed note finishes it again, and that is not a second completion.
      const before = await t.Appointment.select("status").where((a) => a.id.eq(linkedAppointmentId)).first();
      await t.Appointment
        .where((a) => a.id.eq(linkedAppointmentId))
        // A visit deliberately marked cancelled or missed stays that way; a
        // note written about it does not undo that decision.
        .where((a) => a.status.notIn(["CANCELLED", "NO_SHOW"]))
        .update({ status: AppointmentStatus.COMPLETED, updatedAt: now });
      const visit = await t.Appointment.select("status").where((a) => a.id.eq(linkedAppointmentId)).first();
      if (visit?.status === AppointmentStatus.COMPLETED && before?.status !== AppointmentStatus.COMPLETED) {
        const author = await t.Doctor.select("accountId").where((d) => d.id.eq(doctorId)).first();
        await t.AppointmentEvent.create({
          id: newId(),
          appointmentId: linkedAppointmentId,
          clinicId,
          status: AppointmentStatus.COMPLETED,
          byId: author?.accountId ?? null,
          at: now,
        });
      }
    }

    // Every signature and every amendment leaves a version behind. Nothing is
    // written on a draft save: a draft has not been committed to, so there is
    // no state anyone relied on to preserve.
    if (intent === "finish") {
      const snapshot: RecordSnapshot = {
        visitDate: visitedAt.toISOString(),
        chiefComplaint: scalars.chiefComplaint,
        historyOfPresentIllness: scalars.historyOfPresentIllness,
        physicalExamination: scalars.physicalExamination,
        temperatureC: scalars.temperatureC,
        heartRate: scalars.heartRate,
        respiratoryRate: scalars.respiratoryRate,
        systolic: scalars.systolic,
        diastolic: scalars.diastolic,
        weightKg: scalars.weightKg,
        heightCm: scalars.heightCm,
        oxygenSaturation: scalars.oxygenSaturation,
        assessment: scalars.assessment,
        treatmentPlan: scalars.treatmentPlan,
        followUpDate: followUp ? followUp.toISOString().slice(0, 10) : null,
        notes: scalars.notes,
        prescriptions: rows,
        // Kept as they were when this save didn't carry them.
        diagnoses: keepDiagnoses
          ? await t.VisitDiagnosis.select("code", "title")
              .where((d) => d.medicalRecordId.eq(targetId))
              .orderBy((d) => d.position.asc())
              .all()
          : diagnoses.map((d) => ({ code: d.code, title: d.title })),
      };

      const previous = await t.MedicalRecordVersion
        .select("version")
        .where((v) => v.medicalRecordId.eq(targetId))
        .orderBy((v) => v.version.desc())
        .first();

      await t.MedicalRecordVersion.create({
        id: newId(),
        medicalRecordId: targetId,
        version: (previous?.version ?? 0) + 1,
        snapshot: JSON.stringify(snapshot),
        // The first signature has no prior state to explain.
        reason: amending ? amendmentReason : null,
        authorId: doctorId,
        createdAt: now,
      });
    }

    return { id: targetId };
  });

  if ("conflict" in outcome) return { error: { message: CONFLICT_MESSAGE[outcome.conflict] } };
  return { recordId: outcome.id, patientId, savedAt };
}

