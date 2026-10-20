import { apiDoctor, apiError } from "@/lib/api";
import { calendarDateFromDb } from "@/lib/datetime";
import { ageFrom, fullName, RELATIONSHIP_LABELS, SEX_LABELS } from "@/lib/domain";
import { isAdult } from "@/lib/households";
import { orm } from "@/src/prisma/db";

/**
 * One of the clinic's households, for the app's Household sheet: its name,
 * address and number, and who lives there (eldest first, as the web), each
 * with how they're related to the head, age and sex. Households are the
 * clinic's, like its patients, so any doctor of the clinic may see one;
 * charts stay behind `GET /doctor/patients/:id`. Archived members are left out.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/doctor/households/[id]">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;

  const household = await orm.Household
    .select("id", "name", "address", "contactNumber", "primaryContactId", "archivedAt")
    .include("patients", (p) =>
      p
        .select("id", "firstName", "middleName", "lastName", "patientNumber", "dateOfBirth", "sex", "relationship", "archivedAt")
        .orderBy((x) => x.dateOfBirth.asc()),
    )
    .where((h) => h.id.eq(id))
    .where((h) => h.clinicId.eq(doctor.clinicId))
    .first();
  if (!household) return apiError(404, "No household with that id.");

  return Response.json({
    household: {
      id: household.id,
      name: household.name,
      address: household.address,
      contactNumber: household.contactNumber,
      archived: household.archivedAt !== null,
    },
    members: household.patients
      .filter((p) => p.archivedAt === null)
      .map((p) => {
        return {
          id: p.id,
          fullName: fullName(p),
          patientNumber: p.patientNumber,
          relationship: p.relationship,
          relationshipLabel: RELATIONSHIP_LABELS[p.relationship],
          age: p.dateOfBirth ? ageFrom(calendarDateFromDb(p.dateOfBirth)) : null,
          adult: p.dateOfBirth ? isAdult(String(p.dateOfBirth)) : false,
          sexLabel: p.sex ? SEX_LABELS[p.sex] : null,
          /** Who to call for the household (and guardian of its children). */
          primaryContact: p.id === household.primaryContactId,
        };
      }),
  });
}
