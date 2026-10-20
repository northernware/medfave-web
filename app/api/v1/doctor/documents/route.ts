import { apiDoctor, apiError } from "@/lib/api";
import { DOCUMENT_LIST_COLUMNS, loadDocument, shapeDocumentItem } from "@/lib/document-api";
import { checkDetails } from "@/lib/documents";
import { instantToDb } from "@/lib/datetime";
import { fullName } from "@/lib/domain";
import { DocumentType } from "@/lib/enums";
import { newId } from "@/lib/ids";
import { orm } from "@/src/prisma/db";

/** `?patientId=` → `{ documents[] }`: this doctor's documents for the patient, newest first. */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const patientId = new URL(request.url).searchParams.get("patientId");
  if (!patientId) return apiError(400, "Say whose: ?patientId=");
  const rows = await orm.DocumentRequest
    .select(...DOCUMENT_LIST_COLUMNS)
    .where((r) => r.patientId.eq(patientId))
    .where((r) => r.clinicId.eq(doctor.clinicId))
    .where((r) => r.doctorId.eq(doctor.doctorId))
    .orderBy((r) => r.createdAt.desc())
    .limit(50)
    .all();
  return Response.json({ documents: rows.map(shapeDocumentItem) });
}

/**
 * `{ patientId, appointmentId?, type?, purpose, details }` → `201 { document }`: a draft.
 * Type defaults to the outpatient medical certificate. Details may be partial (a draft);
 * signing checks them whole. The patient is taken as the one asking.
 */
export async function POST(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return apiError(400, "Send JSON.");

  const type = String(body.type ?? DocumentType.OUTPATIENT_CERTIFICATE) as DocumentType;
  if (!(type in DocumentType)) return apiError(422, "Choose a document.");
  const purpose = String(body.purpose ?? "").trim();
  if (!purpose) return apiError(422, "Say what it's for.", { purpose: ["Say what it's for"] });

  const patient = await orm.Patient
    .select("id", "firstName", "middleName", "lastName")
    .where((p) => p.id.eq(String(body.patientId ?? "")))
    .where((p) => p.clinicId.eq(doctor.clinicId))
    .first();
  if (!patient) return apiError(404, "No patient with that id.");

  // The visit it's written from: its note, when this doctor wrote one.
  let medicalRecordId: string | null = null;
  if (body.appointmentId) {
    const record = await orm.MedicalRecord
      .select("id")
      .where((r) => r.appointmentId.eq(String(body.appointmentId)))
      .where((r) => r.doctorId.eq(doctor.doctorId))
      .where((r) => r.patientId.eq(patient.id))
      .where((r) => r.archivedAt.isNull())
      .first();
    medicalRecordId = record?.id ?? null;
  }

  const checked = checkDetails(type, body.details, true);
  if ("fieldErrors" in checked) return apiError(422, "Check the details.", checked.fieldErrors);

  const now = instantToDb(new Date());
  const id = newId();
  await orm.DocumentRequest.create({
    id,
    doctorId: doctor.doctorId,
    clinicId: doctor.clinicId,
    patientId: patient.id,
    medicalRecordId,
    type,
    status: "REQUESTED",
    purpose,
    requesterName: String(body.requesterName ?? "").trim() || fullName(patient),
    requesterRelation: String(body.requesterRelation ?? "").trim() || "Patient",
    details: JSON.stringify(checked.details),
    notes: null,
    createdAt: now,
    updatedAt: now,
  });
  return Response.json({ document: await loadDocument(doctor, id) }, { status: 201 });
}
