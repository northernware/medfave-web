import Link from "next/link";
import { AltArrowLeftIcon } from "@solar-icons/react/linear/alt-arrow-left";
import { AltArrowRightIcon } from "@solar-icons/react/linear/alt-arrow-right";
import { Fragment } from "react";
import { CalendarIcon } from "@solar-icons/react/linear/calendar";
import { setAppointmentStatus, startConsultation } from "@/app/actions/appointments";
import { CLINIC_TIME_ZONE, dayKey, formatCalendarDate, formatTime } from "@/lib/datetime";
import { APPOINTMENT_STATUS_LABELS, fullName, SERVICE_LABELS } from "@/lib/domain";
import type { AppointmentListItem } from "@/components/appointment-list";
import { addDays, minuteOfDay, weekdayOf } from "@/lib/scheduling";
import { buttonClass, EmptyState } from "@/components/ui";

/*
 * The doctor's Today, laid out like the reference design: stat tiles, the
 * patients coming up with the selected one's last visit beside them, and the
 * day's schedule as a timeline on the right.
 */

export const PANEL = "rounded-xl border border-border bg-surface";

/** "Oct 2", in clinic time. */
const shortDay = (at: Date) =>
  at.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: CLINIC_TIME_ZONE });

const initials = (p: { firstName: string; lastName: string }) =>
  `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();

export function StatCard({
  value,
  label,
  hint,
  tone,
  href,
}: {
  value: number;
  label: string;
  hint: string;
  tone?: "warn" | "danger";
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="nums font-display text-[34px] leading-none font-semibold tracking-[-0.02em]">{value}</p>
        {tone && value > 0 ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone === "danger" ? "bg-danger-tint text-danger-ink" : "bg-warn-tint text-warn-ink"}`}
          >
            {tone === "danger" ? "Due" : "Now"}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-sm font-medium">{label}</p>
      <p className="text-xs text-ink-faint">{hint}</p>
    </>
  );
  const cls = `${PANEL} block p-5 transition-colors`;
  return href ? (
    <Link href={href} className={`${cls} hover:border-accent/40`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Who is coming, soonest first. The selected one (dark) is the one whose last visit shows beside. */
export function PatientsList({
  upcoming,
  selectedId,
  todayKey,
  day,
  moreFor = {},
  recent = [],
}: {
  upcoming: AppointmentListItem[];
  /** Patients seen lately (their last visit), filling the list when few are booked. */
  recent?: AppointmentListItem[];
  /** Other visits each patient has booked after the one shown. */
  moreFor?: Record<string, number>;
  selectedId: string | null;
  todayKey: string;
  /** The schedule panel's day, kept when another patient is picked. */
  day?: string;
}) {
  return (
    <section className={`${PANEL} flex flex-col p-5`}>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Patients list</h2>
        <span className="text-xs text-ink-faint">By next visit</span>
      </div>
      {upcoming.length === 0 && recent.length === 0 ? (
        <EmptyState title="Nobody yet" description="Upcoming visits appear here." />
      ) : (
        <ul className="space-y-2">
          {[...upcoming.map((a) => ({ a, past: false })), ...recent.map((a) => ({ a, past: true }))].map(({ a, past }, i) => {
            const on = a.id === selectedId;
            const sameDay = dayKey(a.scheduledAt) === todayKey;
            return (
              <Fragment key={a.id}>
              {past && i === upcoming.length ? (
                <li className="px-1 pt-2 text-[11px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Recent</li>
              ) : null}
              <li>
                <Link
                  href={`/dashboard?visit=${a.id}${day ? `&day=${day}` : ""}`}
                  scroll={false}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                    on ? "bg-accent text-on-accent" : "bg-surface-muted/70 hover:bg-surface-muted",
                  ].join(" ")}
                >
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-full font-display text-xs font-semibold ${on ? "bg-on-accent/15 text-on-accent" : "bg-accent-soft text-accent-ink"}`}
                  >
                    {initials(a.patient)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{fullName(a.patient)}</span>
                      {moreFor[a.patient.id] ? (
                        <span
                          title={`${moreFor[a.patient.id]} more visit${moreFor[a.patient.id] === 1 ? "" : "s"} booked`}
                          className={`shrink-0 rounded-full px-1.5 text-[11px] leading-[18px] font-semibold ${on ? "bg-on-accent/15 text-on-accent" : "bg-accent-soft text-accent-ink"}`}
                        >
                          +{moreFor[a.patient.id]}
                        </span>
                      ) : null}
                    </span>
                    <span className={`block truncate text-xs ${on ? "text-on-accent/75" : "text-ink-muted"}`}>
                      {SERVICE_LABELS[a.service]}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-right text-sm leading-tight font-medium">
                    {past ? (
                      <>
                        <span className={`block text-xs font-normal ${on ? "text-on-accent/75" : "text-ink-faint"}`}>Seen</span>
                        {shortDay(a.scheduledAt)}
                      </>
                    ) : (
                      <>
                        {sameDay ? "Today" : shortDay(a.scheduledAt)}
                        <span className={`block text-xs font-normal ${on ? "text-on-accent/75" : "text-ink-faint"}`}>
                          {formatTime(a.scheduledAt)}
                        </span>
                      </>
                    )}
                  </span>
                </Link>
              </li>
              </Fragment>
            );
          })}
        </ul>
      )}
      <Link href="/appointments" className="mt-4 text-sm font-medium text-accent-ink hover:underline">
        All appointments
      </Link>
    </section>
  );
}

export type LastVisit = {
  patient: { id: string; firstName: string; middleName: string | null; lastName: string; sexLabel: string; age: string; patientNumber: string | null };
  record: {
    id: string;
    visitDate: Date;
    chiefComplaint: string;
    assessment: string | null;
    treatmentPlan: string | null;
    notes: string | null;
    followUpDate: Date | null;
    prescriptions: { drugName: string; dosage: string; frequency: string }[];
  } | null;
  allergies: string[];
};

/** The selected patient's most recent visit with this doctor. */
export function LastVisitDetails({ visit, doctorName }: { visit: LastVisit | null; doctorName: string }) {
  if (!visit) {
    return (
      <section className={`${PANEL} p-5`}>
        <h2 className="font-display text-lg font-semibold">Last visit details</h2>
        <EmptyState title="Choose a patient" description="Their most recent visit with you shows here." />
      </section>
    );
  }
  const { patient, record } = visit;
  const row = (label: string, value: React.ReactNode) =>
    value ? (
      <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-4">
        <dt className="text-sm text-ink-muted">{label}</dt>
        <dd className="text-sm leading-6 font-medium whitespace-pre-line">{value}</dd>
      </div>
    ) : null;
  return (
    <section className={`${PANEL} p-5`}>
      <h2 className="font-display text-lg font-semibold">Last visit details</h2>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href={`/patients/${patient.id}`} className="font-display text-lg font-semibold hover:underline">
            {fullName(patient)}
          </Link>
          <p className="text-sm text-ink-muted">
            {patient.sexLabel}, {patient.age}
          </p>
        </div>
        {patient.patientNumber ? <span className="tabular text-sm text-ink-faint">{patient.patientNumber}</span> : null}
      </div>
      {visit.allergies.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visit.allergies.map((a) => (
            <span key={a} className="rounded-full bg-danger-tint px-2.5 py-1 text-xs font-semibold text-danger-ink">
              Allergy: {a}
            </span>
          ))}
        </div>
      ) : null}
      {record ? (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {record.chiefComplaint
              .split(/,|;| and /)
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 4)
              .map((c) => (
                <span key={c} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium">
                  {c}
                </span>
              ))}
          </div>
          <dl className="mt-5 space-y-4">
            {row("Last checked", `${doctorName} on ${formatCalendarDate(record.visitDate)}`)}
            {row("Assessment", record.assessment)}
            {row("Plan", record.treatmentPlan)}
            {row(
              "Prescription",
              record.prescriptions.length > 0
                ? record.prescriptions.map((p) => `${p.drugName} ${p.dosage} — ${p.frequency}`).join("\n")
                : null,
            )}
            {row("Follow-up", record.followUpDate ? formatCalendarDate(record.followUpDate) : null)}
            {row("Notes", record.notes)}
          </dl>
          <Link href={`/records/${record.id}`} className={`${buttonClass("secondary")} mt-5`}>
            Open the note
          </Link>
        </>
      ) : (
        <p className="mt-5 text-sm text-ink-muted">No visit notes with you yet.</p>
      )}
    </section>
  );
}

/** What the schedule panel needs of a visit. */
type RailItem = Pick<AppointmentListItem, "id" | "scheduledAt" | "durationMinutes" | "service" | "status"> & {
  patient: { firstName: string; middleName: string | null; lastName: string };
  reason?: string | null;
  /** The patient said "I'll be there" from the app. */
  patientConfirmedAt?: Date | null;
  /** Shown on the desk, where the day has every doctor's visits. */
  doctor?: { fullName: string };
};

/** A dot per status, in the status colours. */
const STATUS_DOT: Record<AppointmentListItem["status"], string> = {
  PENDING: "bg-warn",
  CONFIRMED: "bg-accent",
  CHECKED_IN: "bg-warn",
  IN_CONSULTATION: "bg-accent",
  COMPLETED: "bg-ok",
  NO_SHOW: "bg-danger",
  CANCELLED: "bg-border-strong",
};

const HOUR = 160; // px per hour on the timeline: about five hours in view

/** The week as a strip, then today as a timeline with a line at the current time. */
export function ScheduleRail({
  items: todays,
  dayKey: selected,
  busyDays = [],
  todayKey,
  now,
  keep,
  hrefFor,
  itemHref = (id) => `/appointments/${id}`,
  canStart = true,
  calendarHref = (key) => `/calendar?day=${key}`,
  openingHours,
}: {
  /** The opening hours by weekday (0 = Sunday) that set the timeline's span; left out, 8–5. A day missing is closed. */
  openingHours?: { weekday: number; openMinute: number; closeMinute: number }[];
  /** The full calendar for a day, if this person has one; null hides the icon. */
  calendarHref?: ((key: string) => string) | null;
  /** Where a visit card leads (the desk has its own appointment pages). */
  itemHref?: (id: string) => string;
  /** The doctor starts a consultation from here; the desk only checks people in. */
  canStart?: boolean;
  /** Days this week with visits booked: a dot under each. */
  busyDays?: string[];
  /** The chosen day's visits. */
  items: RailItem[];
  /** The chosen day (YYYY-MM-DD); today unless picked from the strip. */
  dayKey: string;
  todayKey: string;
  now: Date;
  /** Other dashboard state to keep in links (the selected patient). */
  keep: string;
  /** Where a day in the strip leads; the dashboard by default. */
  hrefFor?: (key: string) => string;
}) {
  const href = hrefFor ?? ((key: string) => `/dashboard?${[keep, key === todayKey ? "" : `day=${key}`].filter(Boolean).join("&")}`);
  const monday = addDays(selected, -((weekdayOf(selected) + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const [y, m] = selected.split("-").map(Number);
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
  const weekdayLabel = (key: string) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString("en-PH", { weekday: "short", timeZone: "UTC" });

  const starts = todays.map((a) => minuteOfDay(a.scheduledAt));
  const ends = todays.map((a) => minuteOfDay(a.scheduledAt) + a.durationMinutes);
  // The day's opening hours set the span; a visit outside them widens it. Closed and empty: no timeline.
  const open = openingHours ? openingHours.find((h) => h.weekday === weekdayOf(selected)) ?? null : { openMinute: 8 * 60, closeMinute: 17 * 60 };
  const closed = open === null;
  const firstHour = Math.min(open ? Math.floor(open.openMinute / 60) : 24, ...starts.map((s) => Math.floor(s / 60)));
  const lastHour = Math.max(open ? Math.ceil(open.closeMinute / 60) : 0, ...ends.map((e) => Math.ceil(e / 60)));
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
  const nowMinute = minuteOfDay(now);
  const top = (minute: number) => ((minute - firstHour * 60) / 60) * HOUR;

  // Side-by-side lanes for visits whose cards overlap (a card is at least its
  // minimum height, so two short visits back to back can overlap too).
  const cardMinutes = (104 / HOUR) * 60;
  const spans = todays.map((a, i) => {
    const start = minuteOfDay(a.scheduledAt);
    return { i, start, end: start + Math.max(a.durationMinutes, cardMinutes) };
  });
  const lanes: { lane: number; of: number }[] = todays.map(() => ({ lane: 0, of: 1 }));
  let group: typeof spans = [];
  let groupEnd = -1;
  let laneEnds: number[] = [];
  const close = () => group.forEach((g) => (lanes[g.i].of = laneEnds.length));
  for (const sp of [...spans].sort((x, y) => x.start - y.start || x.end - y.end)) {
    if (sp.start >= groupEnd && group.length > 0) {
      close();
      group = [];
      laneEnds = [];
    }
    let lane = laneEnds.findIndex((end) => end <= sp.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(sp.end);
    } else laneEnds[lane] = sp.end;
    lanes[sp.i].lane = lane;
    group.push(sp);
    groupEnd = Math.max(groupEnd, sp.end);
  }
  close();
  const label = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`;

  return (
    <section className={`${PANEL} flex h-full flex-col overflow-hidden`}>
      <div className="shrink-0 border-b border-border p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <Link href={href(addDays(selected, -7))} scroll={false} aria-label="Previous week" className="grid size-8 place-items-center rounded-full hover:bg-surface-muted">
              <AltArrowLeftIcon className="size-4" aria-hidden />
            </Link>
            <Link href={href(addDays(selected, 7))} scroll={false} aria-label="Next week" className="grid size-8 place-items-center rounded-full hover:bg-surface-muted">
              <AltArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 text-center">
          {week.map((key) => {
            const on = key === selected;
            const today = key === todayKey;
            return (
              <Link key={key} href={href(key)} scroll={false} aria-current={on ? "date" : undefined} className="group space-y-2">
                <span className="block text-xs text-ink-faint">{weekdayLabel(key)}</span>
                <span
                  className={`relative mx-auto grid size-9 place-items-center rounded-full text-sm font-semibold transition-colors ${on ? "bg-accent text-on-accent" : today ? "text-accent-ink ring-1 ring-accent/50" : "group-hover:bg-surface-muted"}`}
                >
                  {Number(key.slice(8))}
                  {/* Visits that day: a dot tucked under the number, hidden by the filled circle when chosen. */}
                  {busyDays.includes(key) && !on ? (
                    <span aria-label="Has visits" className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between px-5 pt-5 pb-3">
          <h3 className="font-semibold">
            {selected === todayKey
              ? "Today"
              : new Date(`${selected}T00:00:00Z`).toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}
          </h3>
          <span className="flex items-center gap-2 text-xs text-ink-faint">
            {todays.length} visit{todays.length === 1 ? "" : "s"}
{calendarHref ? (
            <Link
              href={calendarHref(selected)}
              aria-label="Open in calendar"
              title="Open in calendar"
              className="grid size-8 place-items-center rounded-full text-accent-ink hover:bg-surface-muted"
            >
              <CalendarIcon className="size-[18px]" aria-hidden />
            </Link>
            ) : null}
          </span>
      </div>

      {/* Only the hours scroll; no scrollbar showing. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {closed && todays.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">Closed this day.</p>
        ) : (
        <div className="relative" style={{ height: (hours.length - 1) * HOUR + 8 }}>
          {/* The time column: one vertical line through every hour, the labels sitting on it. */}
          <span aria-hidden className="absolute top-0 bottom-0 left-8 w-px -translate-x-1/2 bg-border-strong" />
          {hours.map((h) => (
            <div key={h} className="absolute inset-x-0 flex items-center" style={{ top: top(h * 60) - 8 }}>
              <span className="w-16 shrink-0 text-center">
                <span className="tabular bg-surface px-1 py-0.5 text-[11px] text-ink-faint">{label(h)}</span>
              </span>
              <span className="ml-2 h-px flex-1 bg-border/70" />
            </div>
          ))}
          {todays.map((a, idx) => {
            const start = minuteOfDay(a.scheduledAt);
            // Tall enough for its details even when short; a long visit grows with its length.
            const height = Math.max(104, (a.durationMinutes / 60) * HOUR - 4);
            const done = a.status === "COMPLETED" || a.status === "CANCELLED" || a.status === "NO_SHOW";
            const end = new Date(a.scheduledAt.getTime() + a.durationMinutes * 60_000);
            const action =
              (a.status === "PENDING" || a.status === "CONFIRMED") ? (
                <form action={setAppointmentStatus}>
                  <input type="hidden" name="appointmentId" value={a.id} />
                  <input type="hidden" name="status" value="CHECKED_IN" />
                  <button className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap hover:bg-accent-soft">Check in</button>
                </form>
              ) : a.status === "CHECKED_IN" && canStart ? (
                <form action={startConsultation}>
                  <input type="hidden" name="appointmentId" value={a.id} />
                  <button className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-on-accent">Start</button>
                </form>
              ) : selected === todayKey && a.status === "CHECKED_IN" ? (
                // The desk can take back a check-in made by mistake.
                <form action={setAppointmentStatus}>
                  <input type="hidden" name="appointmentId" value={a.id} />
                  <input type="hidden" name="status" value="CONFIRMED" />
                  <button className="rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-ink-muted hover:bg-surface hover:text-ink">Undo check-in</button>
                </form>
              ) : null;
            return (
              <div
                key={a.id}
                className={`absolute z-[1] flex flex-col gap-1.5 overflow-hidden rounded-xl border px-4 py-3 ${lanes[idx].of > 1 ? "px-3" : ""} ${done ? "border-border bg-surface [&>*]:opacity-60" : "border-border-strong bg-surface-muted"}`}
                style={{
                  top: top(start) + 2,
                  height,
                  // Visits that overlap on screen sit side by side.
                  left: `calc(76px + (100% - 76px) * ${lanes[idx].lane} / ${lanes[idx].of})`,
                  width: `calc((100% - 76px) / ${lanes[idx].of} - ${lanes[idx].of > 1 ? 4 : 0}px)`,
                }}
              >
                {/* Status, name, what for, time — nothing else. */}
                <div className="flex items-center justify-between gap-2">
                  {/* The status as a quiet line with a coloured dot, like the rest of the card. */}
                  <span className="flex items-center gap-1.5 text-[11px] leading-4 font-medium text-ink-muted">
                    <span aria-hidden className={`size-1.5 rounded-full ${STATUS_DOT[a.status]}`} />
                    {APPOINTMENT_STATUS_LABELS[a.status]}
                    {a.patientConfirmedAt && (a.status === "PENDING" || a.status === "CONFIRMED") ? (
                      <span className="text-ok-ink" title="The patient said they'll be there">· Coming</span>
                    ) : null}
                  </span>
                  {action}
                </div>
                <Link href={itemHref(a.id)} className="min-w-0">
                  <span className="block truncate text-[13px] leading-5 font-semibold hover:underline">{fullName(a.patient)}</span>
                  {/* What the visit is for (the service); the booking's own words on hover. */}
                  <span title={a.reason ?? undefined} className="block truncate text-[11px] leading-4 text-ink-muted">
                    {SERVICE_LABELS[a.service]}
                  </span>
                  <span className="tabular block truncate text-[11px] leading-4 text-ink-faint">
                    {formatTime(a.scheduledAt)} – {formatTime(end)}
                  </span>
                </Link>
              </div>
            );
          })}
          {selected === todayKey && nowMinute >= firstHour * 60 && nowMinute <= lastHour * 60 ? (
            <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: top(nowMinute) }}>
              {/* The line runs the full width, under the pill. */}
              <span aria-hidden className="absolute -right-5 -left-5 top-0 h-px bg-accent" />
              <span className="absolute top-0 left-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-on-accent tabular">
                {formatTime(now)}
              </span>
            </div>
          ) : null}
        </div>
        )}
        {todays.length === 0 && !closed ? <p className="mt-4 text-center text-sm text-ink-muted">Nothing booked.</p> : null}
      </div>
    </section>
  );
}
