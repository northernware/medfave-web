import { or } from "@prisma/orm-postgres/orm-client";
import { apiDoctor, apiError } from "@/lib/api";
import { likeSafe } from "@/lib/diagnosis-rank";
import { DOCUMENT_LIST_COLUMNS, loadDocument, shapeDocumentItem } from "@/lib/document-api";
import { checkDetails } from "@/lib/documents";
import { instantToDb } from "@/lib/datetime";
import { fullName } from "@/lib/domain";
import { DocumentType } from "@/lib/enums";
import { newId } from "@/lib/ids";
import { orm } from "@/src/prisma/db";

/**
 * → `{ documents[] }`, newest first: this doctor's documents, each with its `patient`
 * (`{ id, fullName }`). `?patientId=` keeps one patient's (at most 50); otherwise all of them
 * (the app's Documents directory, at most 200), narrowed by `?q=` (the patient's name) and
 * `?show=drafts|signed|shared`.
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const url = new URL(request.url);
  const patientId = url.searchParams.get("patientId");
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const show = url.searchParams.get("show");

  let query = orm.DocumentRequest
    .select(...DOCUMENT_LIST_COLUMNS)
    .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
    .where((r) => r.clinicId.eq(doctor.clinicId))
    .where((r) => r.doctorId.eq(doctor.doctorId));
  if (patientId) query = query.where((r) => r.patientId.eq(patientId));
  if (q) {
    const like = `%${likeSafe(q)}%`;
    query = query.where((r) => r.patient.some((p) => or(p.firstName.ilike(like), p.lastName.ilike(like))));
  }
  if (show === "drafts") query = query.where((r) => r.status.eq("REQUESTED"));
  else if (show === "signed") query = query.where((r) => r.status.in(["READY", "RELEASED"]));
  else if (show === "shared") query = query.where((r) => r.sharedWithPatientAt.isNotNull());

  const rows = await query.orderBy((r) => r.createdAt.desc()).limit(patientId ? 50 : 200).all();
  return Response.json({
    documents: rows.map((r) => ({ ...shapeDocumentItem(r), patient: { id: r.patient.id, fullName: fullName(r.patient) } })),
  });
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
