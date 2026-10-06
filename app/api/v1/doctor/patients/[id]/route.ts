import { apiDoctor, apiError } from "@/lib/api";
import { APPOINTMENT_COLUMNS, shapeAppointment } from "@/lib/api-shapes";
import { caresFor, logChartAccess, sharesCharts } from "@/lib/care";
import { calendarDateFromDb, instantFromDb, instantToDb, toDateInputValue } from "@/lib/datetime";
import { fullName, SEX_LABELS } from "@/lib/domain";
import { orm } from "@/src/prisma/db";
import { isAdult } from "@/lib/households";

/**
 * One of the clinic's patients, in the three layers (lib/care.ts):
 *   - details, for any doctor of the clinic;
 *   - `chart` (allergies, alerts, conditions, medications) and `visits`, only
 *     when `caresFor` — otherwise null, and the app offers to book them;
 *   - `upcoming` / `past`: this doctor's own appointments with them.
 * Opening the chart is logged, as on the web.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/doctor/patients/[id]">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;
  const now = instantToDb(new Date());
  const me = { id: doctor.doctorId, clinicId: doctor.clinicId };

  const patient = await orm.Patient
    .select(
      "id", "firstName", "middleName", "lastName", "patientNumber", "dateOfBirth", "sex", "contactNumber", "email",
      "archivedAt", "allergyStatus", "medicationStatus", "conditionStatus",
    )
    .include("household", (h) => h.select("id", "name"))
    .where((p) => p.id.eq(id))
    .where((p) => p.clinicId.eq(doctor.clinicId))
    .first();
  if (!patient) return apiError(404, "No patient with that id.");

  const cares = await caresFor(me, id);
  const shared = cares ? await sharesCharts(doctor.clinicId) : false;

  // This doctor's own appointments with them; colleagues' stay theirs.
  const [upcoming, past, chart, visits] = await Promise.all([
    orm.Appointment
      .select(...APPOINTMENT_COLUMNS)
      .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
      .where((a) => a.patientId.eq(id))
      .where((a) => a.doctorId.eq(doctor.doctorId))
      .where((a) => a.scheduledAt.gte(now))
      .orderBy((a) => a.scheduledAt.asc())
      .limit(10)
      .all(),
    orm.Appointment
      .select(...APPOINTMENT_COLUMNS)
      .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
      .where((a) => a.patientId.eq(id))
      .where((a) => a.doctorId.eq(doctor.doctorId))
      .where((a) => a.scheduledAt.lt(now))
      .orderBy((a) => a.scheduledAt.desc())
      .limit(10)
      .all(),
    cares
      ? Promise.all([
          orm.PatientAllergy.select("id", "label", "reaction", "severity", "notes").where((x) => x.patientId.eq(id)).all(),
          orm.PatientAlert.select("id", "label", "notes").where((x) => x.patientId.eq(id)).all(),
          orm.PatientCondition.select("id", "label", "notes").where((x) => x.patientId.eq(id)).all(),
          orm.PatientMedication.select("id", "label", "dosage", "frequency", "notes").where((x) => x.patientId.eq(id)).all(),
        ])
      : null,
    cares
      ? orm.MedicalRecord
          .select("id", "doctorId", "status", "visitDate", "chiefComplaint", "assessment")
          .include("diagnoses", (d) => d.select("code", "title").orderBy((x) => x.position.asc()))
          .where((r) => r.patientId.eq(id))
          .where((r) => r.archivedAt.isNull())
          .where((r) => (shared ? r.clinicId.eq(doctor.clinicId) : r.doctorId.eq(doctor.doctorId)))
          .orderBy((r) => r.visitDate.desc())
          .limit(20)
          .all()
      : null,
  ]);

  // The rest of their household, for "Start their own household" (adults only).
  const housemates = await orm.Patient
    .select("id", "firstName", "middleName", "lastName", "relationship")
    .where((p) => p.householdId.eq(patient.household.id))
    .where((p) => p.clinicId.eq(doctor.clinicId))
    .where((p) => p.id.neq(patient.id))
    .where((p) => p.archivedAt.isNull())
    .all();

  let authors: Map<string, string> = new Map();
  if (cares) {
    await logChartAccess({ clinicId: doctor.clinicId, patientId: id, accountId: doctor.accountId });
    const docs = await orm.Doctor.select("id", "fullName").where((d) => d.clinicId.eq(doctor.clinicId)).all();
    authors = new Map(docs.map((d) => [d.id, d.fullName]));
  }

  return Response.json({
    patient: {
      id: patient.id,
      fullName: fullName(patient),
      patientNumber: patient.patientNumber,
      dateOfBirth: patient.dateOfBirth ? toDateInputValue(calendarDateFromDb(patient.dateOfBirth)) : null,
      sex: patient.sex,
      sexLabel: patient.sex ? SEX_LABELS[patient.sex] : null,
      contactNumber: patient.contactNumber,
      email: patient.email,
      household: {
        id: patient.household.id,
        name: patient.household.name,
        /** Who else lives there: those who can move with them to a household of their own. */
        housemates: housemates.map((h) => ({ id: h.id, fullName: fullName(h), relationship: h.relationship })),
        /** An adult, not archived, with somebody to leave: `POST …/household` may start one. */
        canStartOwn: !patient.archivedAt && housemates.length > 0 && isAdult(String(patient.dateOfBirth)),
      },
      archived: patient.archivedAt !== null,
    },
    /** Whether this doctor cares for them: may read the chart and visits. */
    caresFor: cares,
    chart: chart
      ? {
          allergyStatus: patient.allergyStatus,
          medicationStatus: patient.medicationStatus,
          conditionStatus: patient.conditionStatus,
          allergies: chart[0],
          alerts: chart[1],
          conditions: chart[2],
          medications: chart[3],
        }
      : null,
    visits: visits
      ? visits.map((v) => ({
          id: v.id,
          status: v.status,
          visitDate: v.visitDate ? instantFromDb(v.visitDate).toISOString() : null,
          chiefComplaint: v.chiefComplaint,
          assessment: v.assessment,
          /** ICD-11, primary first. */
          diagnoses: v.diagnoses,
          mine: v.doctorId === doctor.doctorId,
          author: authors.get(v.doctorId) ?? null,
        }))
      : null,
    upcoming: upcoming.map(shapeAppointment),
    past: past.map(shapeAppointment),
  });
}
