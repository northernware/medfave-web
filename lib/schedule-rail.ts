import { orm } from "@/src/prisma/db";
import { idsOrNone } from "@/lib/care";
import { dayKey, instantFromDb, instantToDb, startOfClinicDay } from "@/lib/datetime";
import { ACTIVE_STATUSES } from "@/lib/domain";
import { addDays, weekdayOf } from "@/lib/scheduling";
import { appointmentListQuery, loadClinicHours, loadSchedule, toAppointmentListItem } from "@/lib/queries";

/**
 * What the schedule panel needs, for pages other than Today (the households
 * pages): the picked day's visits with this doctor, the week's busy days, and
 * the hours that set the timeline. `patientIds` narrows it to some patients
 * (one household's members).
 */
export async function loadScheduleRail(
  doctor: { id: string; clinicId: string },
  day: unknown,
  patientIds?: string[],
) {
  const now = new Date();
  const todayKey = dayKey(now);
  const selected = typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : todayKey;
  const monday = addDays(selected, -((weekdayOf(selected) + 6) % 7));
  const only = patientIds ? idsOrNone(patientIds) : null;

  let weekQuery = orm.Appointment
    .select("scheduledAt")
    .where((a) => a.doctorId.eq(doctor.id))
    .where((a) => a.status.in(ACTIVE_STATUSES))
    .where((a) => a.scheduledAt.gte(instantToDb(startOfClinicDay(monday))))
    .where((a) => a.scheduledAt.lt(instantToDb(startOfClinicDay(addDays(monday, 7)))));
  let dayQuery = appointmentListQuery()
    .where((a) => a.doctorId.eq(doctor.id))
    .where((a) => a.scheduledAt.gte(instantToDb(startOfClinicDay(selected))))
    .where((a) => a.scheduledAt.lt(instantToDb(startOfClinicDay(addDays(selected, 1)))))
    .orderBy((a) => a.scheduledAt.asc());
  if (only) {
    weekQuery = weekQuery.where((a) => a.patientId.in(only));
    dayQuery = dayQuery.where((a) => a.patientId.in(only));
  }

  const [week, items, clinicWeek] = await Promise.all([weekQuery.all(), dayQuery.all(), loadClinicHours(doctor.clinicId)]);
  return {
    items: items.map(toAppointmentListItem),
    dayKey: selected,
    busyDays: [...new Set(week.map((a) => dayKey(instantFromDb(a.scheduledAt))))],
    openingHours: clinicWeek.length > 0 ? clinicWeek : (await loadSchedule(doctor.id)).hours,
    todayKey,
    now,
  };
}
