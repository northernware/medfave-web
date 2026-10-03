import type { Metadata } from "next";
import Link from "next/link";
import { setAppointmentStatus } from "@/app/actions/appointments";
import { requireStaff } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { sweepNoShows } from "@/lib/no-show";
import { sendDueReminders } from "@/lib/reminders";
import { clinicDoctors } from "@/lib/clinic";
import {
  calendarDateFromDb,
  clinicDayRange,
  dayKey,
  formatCalendarDate,
  formatDayHeading,
  formatTime,
  instantFromDb,
  instantToDb,
  startOfClinicDay,
} from "@/lib/datetime";
import {
  ACTIVE_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  fullName,
  QUEUE_STATUSES,
  SERVICE_LABELS,
} from "@/lib/domain";
import { addDays, weekdayOf } from "@/lib/scheduling";
import { greetingFor } from "@/lib/greeting";
import { loadClinicHours } from "@/lib/queries";
import { Badge, buttonClass, EmptyState, PageHeader } from "@/components/ui";
import { PANEL, ScheduleRail, StatCard } from "@/app/(app)/dashboard/panels";

export const metadata: Metadata = { title: "Front desk" };

/** Whole minutes between two moments — the number the desk is asked for. */
function minutesBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
}


/**
 * The front desk's day, laid out like the doctor's: what needs the desk now on
 * the left (who is here, who is asking, who is coming), and the clinic's
 * schedule pinned on the right.
 */
export default async function DeskPage({ searchParams }: PageProps<"/desk">) {
  const staff = await requireStaff();
  const { day } = await searchParams;
  const now = new Date();
  const today = clinicDayRange(now);

  // Same assumption the clinical dashboard makes, for the same reason: a
  // booking nobody has spoken for long past its time is not still to come.
  for (const doctor of await clinicDoctors(staff.clinicId)) {
    await sweepNoShows(doctor.id, now);
  }
  await sendDueReminders(staff.clinicId, now);

  const todayKey = dayKey(now);
  const railDay = typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : todayKey;
  const railMonday = addDays(railDay, -((weekdayOf(railDay) + 6) % 7));

  const visitsBetween = (from: Date, to: Date) =>
    orm.Appointment
      .select("id", "scheduledAt", "durationMinutes", "service", "reason", "status", "patientConfirmedAt")
      .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName", "contactNumber"))
      .include("doctor", (d) => d.select("id", "fullName"))
      .where((a) => a.clinicId.eq(staff.clinicId))
      .where((a) => a.scheduledAt.gte(instantToDb(from)))
      .where((a) => a.scheduledAt.lt(instantToDb(to)))
      .orderBy((a) => a.scheduledAt.asc())
      .all();

  const [todaysRows, railRows, weekRows, queueRows, requestRows, requestCount] = await Promise.all([
    visitsBetween(today.start, today.end),
    railDay === todayKey ? Promise.resolve(null) : visitsBetween(startOfClinicDay(railDay), startOfClinicDay(addDays(railDay, 1))),
    orm.Appointment
      .select("scheduledAt")
      .where((a) => a.clinicId.eq(staff.clinicId))
      .where((a) => a.status.in(ACTIVE_STATUSES))
      .where((a) => a.scheduledAt.gte(instantToDb(startOfClinicDay(railMonday))))
      .where((a) => a.scheduledAt.lt(instantToDb(startOfClinicDay(addDays(railMonday, 7)))))
      .all(),
    orm.Appointment
      .select("id", "scheduledAt", "service", "reason", "arrivedAt", "consultationStartedAt", "status")
      .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
      .include("doctor", (d) => d.select("fullName"))
      .where((a) => a.clinicId.eq(staff.clinicId))
      .where((a) => a.status.in(QUEUE_STATUSES))
      .all(),
    orm.AppointmentRequest
      .select("id", "preferredDate", "preferredTime", "service", "createdAt", "newFirstName", "newMiddleName", "newLastName", "rescheduleOfId")
      .include("patient", (p) => p.select("firstName", "middleName", "lastName"))
      .where((r) => r.clinicId.eq(staff.clinicId))
      .where((r) => r.status.eq("PENDING"))
      .orderBy((r) => r.createdAt.asc())
      .limit(5)
      .all(),
    orm.AppointmentRequest
      .where((r) => r.clinicId.eq(staff.clinicId))
      .where((r) => r.status.eq("PENDING"))
      .aggregate((agg) => ({ n: agg.count() })),
  ]);

  const toItem = (a: (typeof todaysRows)[number]) => ({
    ...a,
    scheduledAt: instantFromDb(a.scheduledAt),
    patientConfirmedAt: a.patientConfirmedAt ? instantFromDb(a.patientConfirmedAt) : null,
  });
  const todays = todaysRows.map(toItem);
  const railItems = railRows ? railRows.map(toItem) : todays;
  const busyDays = [...new Set(weekRows.map((a) => dayKey(instantFromDb(a.scheduledAt))))];
  const queue = queueRows
    .map((a) => ({
      ...a,
      scheduledAt: instantFromDb(a.scheduledAt),
      arrivedAt: a.arrivedAt ? instantFromDb(a.arrivedAt) : null,
      consultationStartedAt: a.consultationStartedAt ? instantFromDb(a.consultationStartedAt) : null,
    }))
    .sort((a, b) => (a.arrivedAt?.getTime() ?? 0) - (b.arrivedAt?.getTime() ?? 0));

  const waiting = queue.filter((a) => a.status === "CHECKED_IN");
  const seeing = queue.filter((a) => a.status === "IN_CONSULTATION");
  const remaining = todays.filter((a) => ACTIVE_STATUSES.includes(a.status) && a.scheduledAt >= now);
  const requestName = (r: (typeof requestRows)[number]) =>
    r.patient ? fullName(r.patient) : fullName({ firstName: r.newFirstName ?? "", middleName: r.newMiddleName, lastName: r.newLastName ?? "" });

  const clinicWeek = await loadClinicHours(staff.clinicId);
  const me = await orm.Account.select("firstName").where((a) => a.id.eq(staff.accountId)).first();

  return (
    <div className="space-y-3 xl:pr-[352px]">
      <PageHeader
        title={greetingFor(staff.fullName, staff.role === "DOCTOR", now, me?.firstName)}
        subtitle={formatDayHeading(now)}
        actions={
          <>
            <Link href="/desk/appointments/new?source=WALK_IN" className={buttonClass("primary")}>
              Register walk-in
            </Link>
            <Link href="/desk/appointments/new" className={buttonClass("secondary")}>
              Book appointment
            </Link>
            <Link href="/desk/patients/new" className={buttonClass("secondary")}>
              Add patient
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard value={todays.length} label="Today" hint={remaining.length > 0 ? `${remaining.length} still to come` : "Nothing left today"} />
        <StatCard value={waiting.length} label="Waiting" tone="warn" hint={seeing.length > 0 ? `${seeing.length} with the doctor` : "Nobody waiting"} />
        <StatCard value={requestCount.n} label="Requests" tone="danger" hint={requestCount.n > 0 ? "To answer" : "None outstanding"} href="/desk/requests" />
        <StatCard value={seeing.length} label="With the doctor" hint="In consultation now" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Who is here: waiting or with the doctor, in the order they arrived. */}
        <section className={`${PANEL} p-5`}>
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Waiting room</h2>
            <span className="text-xs text-ink-faint">By arrival</span>
          </div>
          {queue.length === 0 ? (
            <EmptyState title="Nobody here yet" description="Check people in from the schedule as they arrive." />
          ) : (
            <ul className="space-y-2">
              {queue.map((a) => {
                const withDoctor = a.status === "IN_CONSULTATION";
                return (
                  <li key={a.id}>
                    <Link href={`/desk/appointments/${a.id}`} className="flex items-center gap-3 rounded-xl bg-surface-muted/70 px-3 py-2.5 hover:bg-surface-muted">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{fullName(a.patient)}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          {a.doctor.fullName} · {SERVICE_LABELS[a.service]}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <Badge dot tone={withDoctor ? "accent" : "warn"}>{withDoctor ? "With the doctor" : "Waiting"}</Badge>
                        {a.arrivedAt ? (
                          <span className="tabular mt-1 block text-xs text-ink-faint">
                            {withDoctor
                              ? `waited ${minutesBetween(a.arrivedAt, a.consultationStartedAt ?? now)}m`
                              : `${minutesBetween(a.arrivedAt, now)}m · since ${formatTime(a.arrivedAt)}`}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Who is asking: requests from the app, oldest first. */}
        <section className={`${PANEL} p-5`}>
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Requests</h2>
            <Link href="/desk/requests" className="text-sm font-medium text-accent-ink hover:underline">
              Answer {requestCount.n > 0 ? `(${requestCount.n})` : ""}
            </Link>
          </div>
          {requestRows.length === 0 ? (
            <EmptyState title="Nothing to answer" description="Requests patients send from the app appear here." />
          ) : (
            <ul className="space-y-2">
              {requestRows.map((r) => (
                <li key={r.id}>
                  <Link href="/desk/requests" className="flex items-center gap-3 rounded-xl bg-surface-muted/70 px-3 py-2.5 hover:bg-surface-muted">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {requestName(r)}
                        {!r.patient ? <span className="ml-1.5 text-xs font-normal text-accent-ink">New</span> : null}
                        {r.rescheduleOfId ? <span className="ml-1.5 text-xs font-normal text-warn-ink">Move</span> : null}
                      </span>
                      <span className="block truncate text-xs text-ink-muted">{SERVICE_LABELS[r.service]}</span>
                    </span>
                    <span className="tabular shrink-0 text-right text-sm leading-tight font-medium">
                      {formatCalendarDate(calendarDateFromDb(r.preferredDate)).replace(/, \d{4}$/, "")}
                      <span className="block text-xs font-normal text-ink-faint">{r.preferredTime ?? "Any time"}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Who is coming today, with the numbers the desk rings. */}
      <section className={`${PANEL} p-5`}>
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Coming today</h2>
          <Link href="/desk/appointments" className="text-sm font-medium text-accent-ink hover:underline">
            All appointments
          </Link>
        </div>
        {todays.length === 0 ? (
          <EmptyState title="A clear day" description="Nothing booked for today." />
        ) : (
          <ul className="divide-y divide-border">
            {todays.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="tabular w-16 shrink-0 text-sm font-medium">{formatTime(a.scheduledAt)}</span>
                <Link href={`/desk/appointments/${a.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {fullName(a.patient)}
                    {/* Said "I'll be there" in the app: one less number to ring. */}
                    {a.patientConfirmedAt && (a.status === "PENDING" || a.status === "CONFIRMED") ? (
                      <span className="ml-1.5 text-xs font-normal text-ok-ink">Coming</span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {a.doctor.fullName} · {a.reason}
                    {a.patient.contactNumber ? ` · ${a.patient.contactNumber}` : ""}
                  </span>
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge dot tone={APPOINTMENT_STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
                  {a.status === "PENDING" || a.status === "CONFIRMED" ? (
                    <form action={setAppointmentStatus}>
                      <input type="hidden" name="appointmentId" value={a.id} />
                      <input type="hidden" name="status" value="CHECKED_IN" />
                      <button className={buttonClass("secondary")}>Check in</button>
                    </form>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The clinic's schedule, pinned right like Today's. The desk checks people in; it doesn't start consultations. */}
      <div className="xl:fixed xl:top-3 xl:right-3 xl:bottom-3 xl:z-10 xl:w-[340px]">
        <ScheduleRail
          items={railItems}
          dayKey={railDay}
          busyDays={busyDays}
          openingHours={clinicWeek.length > 0 ? clinicWeek : undefined}
          todayKey={todayKey}
          now={now}
          keep=""
          hrefFor={(key) => (key === todayKey ? "/desk" : `/desk?day=${key}`)}
          itemHref={(id) => `/desk/appointments/${id}`}
          canStart={false}
          calendarHref={null}
        />
      </div>
    </div>
  );
}
