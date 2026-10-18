import { apiDoctor, apiError, readJson } from "@/lib/api";
import { caredForIds } from "@/lib/care";
import { fullName } from "@/lib/domain";
import { registerPatient } from "@/lib/patient-registration";
import { NEW_HOUSEHOLD } from "@/lib/validation";
import { orm } from "@/src/prisma/db";

/**
 * The clinic's patients, for looking one up or picking one to book.
 *
 * `?q=` matches any part of the name or the patient number; `?who=mine` keeps
 * only patients this doctor cares for (lib/care.ts). Each has `mine`. Archived
 * charts are left out, as in the web's pickers. Read whole and filtered here:
 * one clinic's list is small.
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const onlyMine = params.get("who") === "mine";
  const mine = await caredForIds({ id: doctor.doctorId, clinicId: doctor.clinicId });

  const patients = await orm.Patient
    .select("id", "firstName", "middleName", "lastName", "patientNumber")
    .include("household", (h) => h.select("name"))
    .where((p) => p.clinicId.eq(doctor.clinicId))
    .where((p) => p.archivedAt.isNull())
    .all();

  const matches = patients
    .map((p) => ({
      id: p.id,
      fullName: fullName(p),
      patientNumber: p.patientNumber,
      household: p.household.name,
      mine: mine.has(p.id),
    }))
    .filter((p) => !onlyMine || p.mine)
    .filter((p) => !q || p.fullName.toLowerCase().includes(q) || (p.patientNumber ?? "").toLowerCase().includes(q))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .slice(0, 50);

  return Response.json({ patients: matches });
}

/**
 * Registers a patient, as the web's Add patient (lib/patient-registration.ts):
 * the same checks, duplicate challenge and patient number.
 *
 * JSON: `firstName`, `middleName?`, `lastName`, `dateOfBirth` (YYYY-MM-DD),
 * `sex`, `contactNumber?`, `email?`. Without `householdId` they start a new
 * household, named `newHouseholdName` or their last name, as its head; with
 * one they join it as `relationship`. Possible duplicates come back as a 409
 * with `duplicates` and `confirmToken`: send that as `confirmDuplicate` to
 * register anyway. 201 with the new patient.
 */
export async function POST(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const body = await readJson(request);
  if (!body) return apiError(400, "Send the patient's details.");

  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");
  const joining = text("householdId");
  const form = new FormData();
  for (const key of ["firstName", "middleName", "lastName", "dateOfBirth", "sex", "contactNumber", "email", "confirmDuplicate"]) {
    form.set(key, text(key));
  }
  form.set("householdId", joining || NEW_HOUSEHOLD);
  form.set("newHouseholdName", joining ? "" : text("newHouseholdName").trim() || text("lastName").trim());
  form.set("relationship", joining ? text("relationship") : "HEAD");

  const result = await registerPatient(doctor, form);
  if (!result.ok) {
    const { message, fieldErrors, duplicates, confirmToken } = result.error;
    if (duplicates?.length) {
      return Response.json({ error: message ?? "Possible duplicates.", duplicates, confirmToken }, { status: 409 });
    }
    return apiError(422, message ?? "Check the details.", fieldErrors);
  }

  const patient = await orm.Patient
    .select("id", "firstName", "middleName", "lastName", "patientNumber")
    .where((p) => p.id.eq(result.id))
    .first();
  return Response.json(
    { patient: { id: result.id, fullName: patient ? fullName(patient) : "", patientNumber: patient?.patientNumber ?? null } },
    { status: 201 },
  );
}
