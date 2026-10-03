import Link from "next/link";
import type {
  AppointmentStatus,
  AppointmentType,
  ServiceType,
  VisitPriority,
} from "@/lib/enums";
import { dayKey, formatTime } from "@/lib/datetime";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  APPOINTMENT_TYPE_LABELS,
  fullName,
  SERVICE_LABELS,
  VISIT_PRIORITY_LABELS,
  VISIT_PRIORITY_TONE,
} from "@/lib/domain";
import { Badge, EmptyState } from "@/components/ui";

export type AppointmentListItem = {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  service: ServiceType;
  reason: string;
  status: AppointmentStatus;
  priority: VisitPriority;
  visitType: AppointmentType;
  /** When the patient said "I'll be there" from the app. */
  patientConfirmedAt?: Date | null;
  patient: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    household: { id: string; name: string };
  };
  medicalRecord: { id: string } | null;
};

/** A visit that will not happen no longer competes for attention. */
function isDropped(status: AppointmentStatus) {
  return status === "CANCELLED" || status === "NO_SHOW";
}

/**
 * The status stripe down the left of each row.
 *
 * Status is on the row twice on purpose: as a word, for certainty, and as a
 * colour, so a day can be read at a glance without reading any of it.
 */
const STRIPE_CLASS: Record<AppointmentStatus, string> = {
  PENDING: "bg-warn",
  CONFIRMED: "bg-accent",
  CHECKED_IN: "bg-accent",
  IN_CONSULTATION: "bg-accent",
  COMPLETED: "bg-ok",
  CANCELLED: "bg-border-strong",
  NO_SHOW: "bg-warn",
};

/** Prisma hands back a flat ordered list; the UI reads better cut into days. */
function groupByDay(items: AppointmentListItem[]) {
  const groups: { key: string; items: AppointmentListItem[] }[] = [];
  for (const item of items) {
    const key = dayKey(item.scheduledAt);
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * A day heading built from the key rather than the instant.
 *
 * The key is already in clinic time, so this cannot drift into the previous day
 * the way re-deriving it from a `Date` in another zone would.
 */
function describeDay(key: string, todayKey: string) {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const date = `${d} ${MONTHS[m - 1]} ${y}`;

  const diff = Math.round(
    (Date.UTC(y, m - 1, d) -
      Date.UTC(
        Number(todayKey.slice(0, 4)),
        Number(todayKey.slice(5, 7)) - 1,
        Number(todayKey.slice(8, 10)),
      )) /
      86_400_000,
  );
  const relative =
    diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : null;

  return { weekday, date, relative, isToday: diff === 0 };
}

export function AppointmentList({
  appointments,
  emptyTitle = "Nothing scheduled",
  emptyDescription,
  showDayHeadings = true,
  hrefFor = (id) => `/appointments/${id}`,
}: {
  appointments: AppointmentListItem[];
  emptyTitle?: string;
  emptyDescription?: string;
  showDayHeadings?: boolean;
  /** Where a row leads. The desk has its own pages for the same visits. */
  hrefFor?: (id: string) => string;
}) {
  if (appointments.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  if (!showDayHeadings) {
    return (
      <ul className="divide-y divide-border">
        {appointments.map((a) => (
          <AppointmentRow key={a.id} appointment={a} hrefFor={hrefFor} />
        ))}
      </ul>
    );
  }

  const todayKey = dayKey(new Date());

  return (
    <div>
      {groupByDay(appointments).map((group) => {
        const day = describeDay(group.key, todayKey);
        const live = group.items.filter((a) => !isDropped(a.status)).length;
        const dropped = group.items.length - live;

        return (
          <section key={group.key}>
            {/* The day's own summary sits in its heading, so scrolling past a
                day still tells you what was in it. */}
            <h3
              className={[
                "flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-border px-4 py-2",
                day.isToday ? "bg-accent-tint" : "bg-surface-muted",
              ].join(" ")}
            >
              <span className="text-sm font-semibold tracking-tight">{day.weekday}</span>
              <span className="text-xs text-ink-muted">{day.date}</span>
              {day.relative ? (
                <Badge tone={day.isToday ? "accent" : "neutral"}>{day.relative}</Badge>
              ) : null}
              <span className="tabular ml-auto text-xs text-ink-muted">
                {/* A day whose visits all fell through is described by what
                    happened to it, not as "0 visits" with a footnote. */}
                {live === 0
                  ? `${dropped} cancelled`
                  : `${live} ${live === 1 ? "visit" : "visits"}${dropped > 0 ? ` · ${dropped} cancelled` : ""}`}
              </span>
            </h3>
            <ul className="divide-y divide-border">
              {group.items.map((a) => (
                <AppointmentRow key={a.id} appointment={a} hrefFor={hrefFor} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function AppointmentRow({
  appointment,
  hrefFor,
}: {
  appointment: AppointmentListItem;
  hrefFor: (id: string) => string;
}) {
  const { patient } = appointment;
  const dropped = isDropped(appointment.status);
  const urgent = appointment.priority !== "ROUTINE";
  const remote = appointment.visitType !== "IN_PERSON";

  return (
    <li className="transition-colors hover:bg-surface-muted">
      <Link
        href={hrefFor(appointment.id)}
        className={[
          "flex items-stretch gap-3 px-4 py-3",
          // A cancelled visit stays on the list — it is part of the record — but
          // it stops competing with the ones that are still going to happen.
          dropped ? "opacity-55" : "",
        ].join(" ")}
      >
        <span
          aria-hidden
          className={`w-0.5 shrink-0 rounded-full ${STRIPE_CLASS[appointment.status]}`}
        />

        {/* When it starts and how long it runs — the second of those was on the
            row's data all along and never shown, so every list read as though
            every visit were the same length. */}
        <span className="w-[4.5rem] shrink-0">
          <span
            className={[
              "tabular block text-sm font-medium",
              dropped ? "line-through decoration-1" : "",
            ].join(" ")}
          >
            {formatTime(appointment.scheduledAt)}
          </span>
          <span className="tabular block text-xs text-ink-faint">
            {appointment.durationMinutes} min
          </span>
        </span>

        {/* On a phone the badges go under the name, so the name gets the width. */}
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium sm:truncate">{fullName(patient)}</span>
          <span className="line-clamp-2 block text-sm text-ink-muted sm:line-clamp-none sm:truncate">
            {SERVICE_LABELS[appointment.service]} · {appointment.reason}
          </span>
          <span className="block truncate text-xs text-ink-faint">
            {patient.household.name} household
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-1 sm:shrink-0 sm:flex-col sm:items-end sm:justify-center">
          <Badge dot tone={APPOINTMENT_STATUS_TONE[appointment.status]}>
            {APPOINTMENT_STATUS_LABELS[appointment.status]}
          </Badge>
          {/* Only the exceptions are labelled. A badge on every row for the
              ordinary case is a badge nobody reads. */}
          {urgent || remote || appointment.medicalRecord ? (
            <span className="flex flex-wrap gap-1 sm:justify-end">
              {urgent ? (
                <Badge tone={VISIT_PRIORITY_TONE[appointment.priority]}>
                  {VISIT_PRIORITY_LABELS[appointment.priority]}
                </Badge>
              ) : null}
              {remote ? (
                <Badge tone="neutral">{APPOINTMENT_TYPE_LABELS[appointment.visitType]}</Badge>
              ) : null}
              {appointment.medicalRecord ? <Badge tone="neutral">Documented</Badge> : null}
            </span>
          ) : null}
        </span>
        </span>
      </Link>
    </li>
  );
}
