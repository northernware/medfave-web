import { or } from "@prisma/orm-postgres/orm-client";
import { apiDoctor } from "@/lib/api";
import { likeSafe } from "@/lib/diagnosis-rank";
import { orm } from "@/src/prisma/db";

/**
 * The clinic's households, for the app's Households view on Patients: each
 * with its members' first names (eldest first) and how many there are, by
 * name. `?q=` matches the household's name or any member's first or last
 * name, as the web's list. Archived households and members left out; at most 100.
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);

  let query = orm.Household
    .select("id", "name", "address")
    .include("patients", (p) =>
      p
        .select("firstName", "lastName")
        .where((x) => x.archivedAt.isNull())
        .orderBy((x) => x.dateOfBirth.asc()),
    )
    .where((h) => h.clinicId.eq(doctor.clinicId))
    .where((h) => h.archivedAt.isNull())
    .orderBy((h) => h.name.asc())
    .limit(100);
  if (q) {
    const like = `%${likeSafe(q)}%`;
    query = query.where((h) =>
      or(h.name.ilike(like), h.patients.some((p) => p.lastName.ilike(like)), h.patients.some((p) => p.firstName.ilike(like))),
    );
  }

  const households = await query.all();
  return Response.json({
    households: households.map((h) => ({
      id: h.id,
      name: h.name,
      address: h.address,
      members: h.patients.map((p) => p.firstName),
    })),
  });
}
