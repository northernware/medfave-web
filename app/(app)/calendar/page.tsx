import type { Metadata } from "next";
import Link from "next/link";
import { AltArrowLeftIcon } from "@solar-icons/react/linear/alt-arrow-left";
import { AltArrowRightIcon } from "@solar-icons/react/linear/alt-arrow-right";
import type { AppointmentStatus } from "@/lib/enums";
import { requireDoctor } from "@/lib/auth";
import { ScheduleRail } from "@/app/(app)/dashboard/panels";
import { loadClinicHours, loadSchedule } from "@/lib/queries";
import { orm } from "@/src/prisma/db";
import {
  clinicMonthRange,
  dayKey,
  formatMonthHeading,
  formatTimeCompact,
  monthGrid,
  parseMonthKey,
  shiftMonth,
  WEEKDAY_LABELS,
  instantFromDb,
  instantToDb,
} from "@/lib/datetime";
import {
} from "@/lib/domain";
import { occupiesSlot } from "@/lib/scheduling";
import { buttonClass, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Calendar" };

const DOT_TONE: Record<AppointmentStatus, string> = {
  PENDING: "bg-warn",
  CONFIRMED: "bg-accent",
  CHECKED_IN: "bg-accent",
  IN_CONSULTATION: "bg-accent",
  COMPLETED: "bg-ok",
  NO_SHOW: "bg-warn",
  CANCELLED: "bg-border-strong",
};

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const doctor = await requireDoctor();
  const { month, day } = await searchParams;

  const now = new Date();
  const { year, month: monthNumber } = parseMonthKey(month, now);
  const range = clinicMonthRange(year, monthNumber);

  const rows = await orm.Appointment
    .select("id", "scheduledAt", "durationMinutes", "service", "reason", "status")
    .include("patient", (p) =>
      p
        .select("id", "firstName", "middleName", "lastName")
        .include("household", (h) => h.select("name")),
    )
    .where((a) => a.doctorId.eq(doctor.id))
    .where((a) => a.scheduledAt.gte(instantToDb(range.start)))
    .where((a) => a.scheduledAt.lt(instantToDb(range.end)))
    .orderBy((a) => a.scheduledAt.asc())
    .all();

  // The grid works in `Date`; the column reads as text, so convert once here.
  const appointments = rows.map((a) => ({ ...a, scheduledAt: instantFromDb(a.scheduledAt) }));

  // One pass into day buckets — the grid then reads each cell in O(1).
  const byDay = new Map<string, typeof appointments>();
  for (const appointment of appointments) {
    const key = dayKey(appointment.scheduledAt);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(appointment);
    else byDay.set(key, [appointment]);
  }

  const weeks = monthGrid(year, monthNumber);
  const todayKey = dayKey(now);
  const monthPrefix = `${year}-${String(monthNumber).padStart(2, "0")}`;

  // Default the panel to today when today is in view, else the first day that
  // actually has something booked.
  const requestedDay = typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;
  const selectedDay =
    requestedDay ??
    (todayKey.startsWith(monthPrefix) ? todayKey : undefined) ??
    [...byDay.keys()].sort()[0];

  const selected = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const clinicWeek = await loadClinicHours(doctor.clinicId);
  const railWeek = clinicWeek.length > 0 ? clinicWeek : (await loadSchedule(doctor.id)).hours;

  const bookedDays = [...byDay.values()].filter((list) =>
    list.some((a) => occupiesSlot(a.status)),
  ).length;

  return (
    // On wide screens the month fills the window down to the bottom edge.
    <div className="space-y-3 xl:flex xl:h-[calc(100dvh-1.5rem)] xl:flex-col xl:space-y-0 xl:gap-3 xl:pr-[352px]">
      <PageHeader
        title="Calendar"
        subtitle={`${appointments.length} booked across ${bookedDays} ${bookedDays === 1 ? "day" : "days"} this month`}
        actions={
          <Link
            href={selectedDay ? `/appointments/new?date=${selectedDay}` : "/appointments/new"}
            className={buttonClass("primary")}
          >
            Book appointment
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 xl:min-h-0 xl:flex-1">
        <Card className="overflow-hidden xl:flex xl:min-h-0 xl:flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
            <Link
              href={`/calendar?month=${shiftMonth(year, monthNumber, -1)}`}
              aria-label="Previous month"
              className={buttonClass("ghost", "px-2.5")}
            >
              <AltArrowLeftIcon className="size-4" aria-hidden />
            </Link>
            <div className="flex items-baseline gap-3">
              <h2 className="text-sm font-semibold">{formatMonthHeading(year, monthNumber)}</h2>
              {!todayKey.startsWith(monthPrefix) ? (
                <Link href="/calendar" className="text-xs font-medium text-accent-ink hover:underline">
                  Today
                </Link>
              ) : null}
            </div>
            <Link
              href={`/calendar?month=${shiftMonth(year, monthNumber, 1)}`}
              aria-label="Next month"
              className={buttonClass("ghost", "px-2.5")}
            >
              <AltArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </div>

          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="px-1 py-2 text-center text-xs font-semibold text-ink-muted"
              >
                <span className="sm:hidden">{label[0]}</span>
                <span className="hidden sm:inline">{label}</span>
              </div>
            ))}
          </div>

          <div
            className="grid grid-cols-7 xl:min-h-0 xl:flex-1"
            style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}
          >
            {weeks.flat().map((cell) => {
              const items = byDay.get(cell.key) ?? [];
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selectedDay;

              return (
                <Link
                  key={cell.key}
                  // A leading or trailing cell belongs to the neighbouring
                  // month, so selecting it moves the grid there too — otherwise
                  // the panel would ask for a day the month query never loaded.
                  href={`/calendar?month=${cell.inMonth ? monthPrefix : cell.key.slice(0, 7)}&day=${cell.key}`}
                  aria-current={isSelected ? "date" : undefined}
                  className={[
                    "min-h-22 overflow-hidden border-r border-b border-border p-2 text-left transition-colors sm:min-h-34 xl:min-h-0",
                    // No double line where the last week meets the card's own border.
                    "[&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0 hover:bg-surface-muted",
                    cell.inMonth ? "" : "bg-surface-muted/40 text-ink-faint",
                    isSelected ? "ring-2 ring-accent ring-inset" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "tabular inline-grid size-7 place-items-center rounded-full text-sm font-medium",
                      isToday ? "bg-accent text-on-accent" : cell.inMonth ? "text-ink" : "",
                    ].join(" ")}
                  >
                    {cell.day}
                  </span>

                  {items.length > 0 ? (
                    <>
                      {/* Phones get density dots; there is no room for times. */}
                      <span className="mt-1 flex flex-wrap gap-1 sm:hidden">
                        {items.slice(0, 6).map((a) => (
                          <span key={a.id} className={`size-1.5 rounded-full ${DOT_TONE[a.status]}`} />
                        ))}
                      </span>

                      <span className="mt-1 hidden flex-col gap-0.5 sm:flex">
                        {items.slice(0, 5).map((a) => (
                          <span
                            key={a.id}
                            className="flex items-center gap-1.5 overflow-hidden text-xs leading-snug"
                          >
                            <span className={`size-1.5 shrink-0 rounded-full ${DOT_TONE[a.status]}`} />
                            <span className="tabular shrink-0 font-medium">
                              {formatTimeCompact(a.scheduledAt)}
                            </span>
                            {/* The person, not the family: a household's members share a surname. */}
                            <span title={`${a.patient.firstName} ${a.patient.lastName}`} className="truncate text-ink-muted">
                              {a.patient.firstName} {a.patient.lastName.charAt(0)}.
                            </span>
                          </span>
                        ))}
                        {items.length > 5 ? (
                          <span className="text-xs leading-snug text-ink-faint">
                            +{items.length - 5} more
                          </span>
                        ) : null}
                      </span>
                    </>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </Card>

        {/* Beside the grid on large screens, stacked underneath on small ones.
            Sticky so it stays put while a long month scrolls past. */}
        {/* The same schedule panel as Today, pinned right, showing the chosen day. */}
        <div className="xl:fixed xl:top-3 xl:right-3 xl:bottom-3 xl:z-10 xl:w-[340px]">
          <ScheduleRail
            items={selected}
            dayKey={selectedDay ?? todayKey}
            openingHours={railWeek}
            busyDays={[...byDay.entries()].filter(([, list]) => list.some((x) => occupiesSlot(x.status))).map(([k]) => k)}
            todayKey={todayKey}
            now={now}
            keep=""
            hrefFor={(key) => `/calendar?month=${key.slice(0, 7)}&day=${key}`}
            // The month grid beside it is the day picker here.
            weekStrip={false}
          />
        </div>
      </div>
    </div>
  );
}
