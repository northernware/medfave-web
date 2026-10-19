import { apiDoctor, apiError } from "@/lib/api";
import { dayKey, instantFromDb, instantToDb, startOfClinicDay } from "@/lib/datetime";
import { ACTIVE_STATUSES, fullName } from "@/lib/domain";
import { orm } from "@/src/prisma/db";

/**
 * How many visits are still expected on each of the next days — what the
 * app's day strip marks. `?from=YYYY-MM-DD` (today by default), `&days=` up to 31.
 * `&count=any`: every visit not cancelled, past ones too (the calendar's dots), not
 * only those still expected. `&names=1`: each day's visits too, `visits: [{ id,
 * patientId, time, minutes, name, status }]` by time (the calendar's Details and List).
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;

  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? dayKey(new Date());
  const days = Math.min(31, Math.max(1, Number(params.get("days") ?? 7) || 7));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return apiError(422, "Use a date like 2026-10-01.", { from: ["Invalid date"] });

  const any = params.get("count") === "any";
  const names = params.get("names") === "1";
  const start = startOfClinicDay(from);
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

  const rows = await orm.Appointment
    .select("id", "scheduledAt", "durationMinutes", "status")
    .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
    .where((a) => a.doctorId.eq(doctor.doctorId))
    .where((a) => (any ? a.status.notIn(["CANCELLED"]) : a.status.in(ACTIVE_STATUSES)))
    .where((a) => a.scheduledAt.gte(instantToDb(start)))
    .where((a) => a.scheduledAt.lt(instantToDb(end)))
    .all();

  const counts = new Map<string, number>();
  const visits = new Map<string, { id: string; patientId: string; time: string; minutes: number; name: string; status: string }[]>();
  for (const r of [...rows].sort((x, y) => String(x.scheduledAt).localeCompare(String(y.scheduledAt)))) {
    const at = instantFromDb(r.scheduledAt);
    const key = dayKey(at);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (names) {
      const list = visits.get(key) ?? [];
      list.push({ id: r.id, patientId: r.patient.id, time: at.toISOString(), minutes: r.durationMinutes, name: fullName(r.patient), status: r.status });
      visits.set(key, list);
    }
  }

  const result = Array.from({ length: days }, (_, i) => {
    const date = dayKey(new Date(start.getTime() + (i * 24 + 12) * 60 * 60 * 1000));
    return names ? { date, count: counts.get(date) ?? 0, visits: visits.get(date) ?? [] } : { date, count: counts.get(date) ?? 0 };
  });

  return Response.json({ days: result });
}
