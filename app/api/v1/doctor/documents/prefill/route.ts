import { apiDoctor, apiError } from "@/lib/api";
import { dayKey, instantFromDb } from "@/lib/datetime";
import { fullName } from "@/lib/domain";
import { orm } from "@/src/prisma/db";

/**
 * `?appointmentId=` → `{ patientId, patientName, details }`: a medical certificate's starting
 * point from a visit — the day seen, and the diagnosis from this doctor's note for it (its
 * coded diagnoses, else its assessment), for the doctor to check before signing.
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const appointmentId = new URL(request.url).searchParams.get("appointmentId");
  if (!appointmentId) return apiError(400, "Say which visit: ?appointmentId=");

  const appointment = await orm.Appointment
    .select("id", "scheduledAt", "patientId")
    .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
    .where((a) => a.id.eq(appointmentId))
    .where((a) => a.clinicId.eq(doctor.clinicId))
    .first();
  if (!appointment) return apiError(404, "No visit with that id.");

  const record = await orm.MedicalRecord
    .select("id", "visitDate", "assessment")
    .include("diagnoses", (d) => d.select("title").orderBy((x) => x.position.asc()))
    .where((r) => r.appointmentId.eq(appointmentId))
    .where((r) => r.doctorId.eq(doctor.doctorId))
    .where((r) => r.archivedAt.isNull())
    .first();

  // The clinic's day (Manila), not UTC's: an 8 AM visit is that day's.
  const seen = instantFromDb(record?.visitDate ?? appointment.scheduledAt);
  const diagnosis = record?.diagnoses.length ? record.diagnoses.map((d) => d.title).join("; ") : (record?.assessment ?? "");
  return Response.json({
    patientId: appointment.patient.id,
    patientName: fullName(appointment.patient),
    details: { seenOn: dayKey(seen), diagnosis },
  });
}
