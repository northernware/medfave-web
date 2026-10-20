import "server-only";
import { clinicLetterhead } from "@/lib/clinic";
import { calendarDateFromDb, formatDate, instantFromDb } from "@/lib/datetime";
import { DOCUMENT_FIELDS, DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS, parseDetails } from "@/lib/documents";
import { ageFrom, fullName, SEX_LABELS } from "@/lib/domain";
import type { DocumentRequestStatus, DocumentType } from "@/lib/enums";
import { orm } from "@/src/prisma/db";

/*
 * Documents for the doctor app (/api/v1/doctor/documents). A draft is a
 * request still REQUESTED; signing marks it READY (the doctor's signature is
 * what makes it a document); it can then be shared to the patient's app and
 * printed. The web's records desk reads the same rows.
 */

export const DOCUMENT_LIST_COLUMNS = ["id", "type", "status", "purpose", "details", "sharedWithPatientAt", "createdAt", "updatedAt"] as const;

type Row = {
  id: string;
  type: DocumentType;
  status: DocumentRequestStatus;
  purpose: string;
  details: string | null;
  sharedWithPatientAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** One line of a list: what, its state, when. */
export function shapeDocumentItem(r: Row) {
  return {
    id: r.id,
    type: r.type,
    typeLabel: DOCUMENT_TYPE_LABELS[r.type],
    status: r.status,
    statusLabel: DOCUMENT_STATUS_LABELS[r.status],
    /** Signed by the doctor: READY or RELEASED. */
    signed: r.status === "READY" || r.status === "RELEASED",
    shared: r.sharedWithPatientAt !== null,
    purpose: r.purpose,
    createdAt: instantFromDb(r.createdAt).toISOString(),
  };
}

/** The whole document, with what's needed to lay it out (letterhead, patient, signature). */
export async function loadDocument(doctor: { doctorId: string; clinicId: string }, id: string) {
  const row = await orm.DocumentRequest
    .select(...DOCUMENT_LIST_COLUMNS, "medicalRecordId", "patientId")
    .include("patient", (p) =>
      p
        .select("id", "firstName", "middleName", "lastName", "dateOfBirth", "sex", "patientNumber")
        .include("household", (h) => h.select("address")),
    )
    .where((r) => r.id.eq(id))
    .where((r) => r.clinicId.eq(doctor.clinicId))
    .where((r) => r.doctorId.eq(doctor.doctorId))
    .first();
  if (!row) return null;
  const [clinic, me] = await Promise.all([
    clinicLetterhead(doctor.clinicId),
    orm.Doctor.select("fullName", "specialty", "licenseNumber").where((d) => d.id.eq(doctor.doctorId)).first(),
  ]);
  const p = row.patient;
  const born = calendarDateFromDb(p.dateOfBirth);
  const details = parseDetails(row.details);
  return {
    ...shapeDocumentItem(row as Row),
    details,
    /** The type's fields in order, with labels: the app's form and its layout. */
    fields: DOCUMENT_FIELDS[row.type].map((f) => ({ ...f, value: details[f.name] ?? "" })),
    patient: {
      id: p.id,
      fullName: fullName(p),
      patientNumber: p.patientNumber,
      age: ageFrom(born),
      sexLabel: SEX_LABELS[p.sex],
      born: formatDate(born),
      address: p.household.address,
    },
    doctor: { fullName: me?.fullName ?? "", specialty: me?.specialty ?? null, licenseNumber: me?.licenseNumber ?? null },
    clinic,
    /** When it was signed (the last change once READY). */
    signedAt: row.status === "READY" || row.status === "RELEASED" ? instantFromDb(row.updatedAt).toISOString() : null,
  };
}
