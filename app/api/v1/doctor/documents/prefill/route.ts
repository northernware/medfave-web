import { apiDoctor, apiError } from "@/lib/api";
import { dayKey, instantFromDb } from "@/lib/datetime";
import { fullName } from "@/lib/domain";
import { orm } from "@/src/prisma/db";

/**
 * A medical certificate's starting point, for the doctor to check before signing:
 * `{ patientId, patientName, appointmentId, details: { seenOn, diagnosis } }`.
 *
 * - `?appointmentId=`: from that visit — the day seen, and the diagnosis from this
 *   doctor's note for it (its coded diagnoses, else its assessment).
 * - `?patientId=`: from the patient (their page, or the Documents list) — their latest
 *   note by this doctor, if any (its day and diagnosis); else today, and no diagnosis.
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const url = new URL(request.url);
  const appointmentId = url.searchParams.get("appointmentId");
  const patientId = url.searchParams.get("patientId");
  if (!appointmentId && !patientId) return apiError(400, "Say which visit or patient: ?appointmentId= or ?patientId=");

  const notes = () =>
    orm.MedicalRecord
      .select("id", "visitDate", "assessment", "appointmentId")
      .include("diagnoses", (d) => d.select("title").orderBy((x) => x.position.asc()))
      .where((r) => r.doctorId.eq(doctor.doctorId))
      .where((r) => r.clinicId.eq(doctor.clinicId))
      .where((r) => r.archivedAt.isNull());

  let patient: { id: string; firstName: string; middleName: string | null; lastName: string };
  let record: Awaited<ReturnType<ReturnType<typeof notes>["first"]>>;
  let fallback: Date;
  if (appointmentId) {
    const appointment = await orm.Appointment
      .select("id", "scheduledAt", "patientId")
      .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
      .where((a) => a.id.eq(appointmentId))
      .where((a) => a.clinicId.eq(doctor.clinicId))
      .first();
    if (!appointment) return apiError(404, "No visit with that id.");
    patient = appointment.patient;
    record = await notes().where((r) => r.appointmentId.eq(appointmentId)).first();
    fallback = instantFromDb(appointment.scheduledAt);
  } else {
    const found = await orm.Patient
      .select("id", "firstName", "middleName", "lastName")
      .where((p) => p.id.eq(patientId!))
      .where((p) => p.clinicId.eq(doctor.clinicId))
      .first();
    if (!found) return apiError(404, "No patient with that id.");
    patient = found;
    record = await notes().where((r) => r.patientId.eq(found.id)).orderBy((r) => r.visitDate.desc()).first();
    fallback = new Date();
  }

  // The clinic's day (Manila), not UTC's: an 8 AM visit is that day's.
  const seen = record?.visitDate ? instantFromDb(record.visitDate) : fallback;
  const diagnosis = record?.diagnoses.length ? record.diagnoses.map((d) => d.title).join("; ") : (record?.assessment ?? "");
  return Response.json({
    patientId: patient.id,
    patientName: fullName(patient),
    /** The visit it's drawn from, when there is one (links the certificate to its note). */
    appointmentId: appointmentId ?? record?.appointmentId ?? null,
    details: { seenOn: dayKey(seen), diagnosis },
  });
}
