/**
 * All appointment times are rendered in the clinic's timezone rather than the
 * viewer's, so a server-rendered schedule and a doctor's wall clock agree — and
 * so server and client markup never disagree during hydration.
 */
export const CLINIC_TIME_ZONE = process.env.NEXT_PUBLIC_CLINIC_TIMEZONE || "Asia/Manila";

const LOCALE = "en-PH";

function parts(at: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map = Object.fromEntries(dtf.formatToParts(at).map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function zoneOffsetMs(at: Date, timeZone: string) {
  const p = parts(at, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - at.getTime();
}

import type { TimestampString } from "@prisma/orm-postgres/target/codec-types";

// --- Database boundary ------------------------------------------------------
// Prisma 8 reads and writes temporal columns as PostgreSQL's own text rather than
// as `Date`. The columns are `timestamp(3)` and `date`, neither of which carries a
// zone, and the instants in them have always been UTC. These four functions are
// the only places that know that, so the rest of the app keeps working in `Date`.

/** A `timestamp(3)` value ("2026-09-02 00:30:00") as the UTC instant it records. */
export function instantFromDb(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

/**
 * An instant as the UTC wall-clock text a `timestamp(3)` column stores. The
 * column's type is branded, so the cast is what lets a plain string satisfy it.
 */
export function instantToDb(at: Date): TimestampString<3> {
  return at.toISOString().slice(0, 23) as TimestampString<3>;
}

/**
 * Whether a stored `timestamp(3)` is in the past.
 *
 * Use this rather than comparing a stored value against `instantToDb(new Date())`
 * as text. Postgres hands the column back with a space between the date and the
 * time ("2026-09-26 20:00:16.918") while `instantToDb` writes an ISO "T"; the two
 * only sort correctly while the dates differ, so the naive comparison quietly
 * declares anything expiring later today already expired. That is invisible on a
 * fourteen-day code and fatal on a one-hour one.
 */
export function hasPassed(value: string, now: Date = new Date()) {
  return instantFromDb(value).getTime() <= now.getTime();
}

/** A `date` value ("1990-05-04") as the UTC-midnight `Date` the app formats. */
export function calendarDateFromDb(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** A UTC-midnight `Date` as the text a `date` column stores. */
export function calendarDateToDb(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// --- Instants (appointments, visit timestamps) ------------------------------

/** `<input type="datetime-local">` value for an instant, in clinic time. */
export function toDateTimeLocalValue(at: Date) {
  const p = parts(at, CLINIC_TIME_ZONE);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Read a `datetime-local` value as clinic wall time and return the instant. */
export function fromDateTimeLocalValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  return new Date(naive - zoneOffsetMs(new Date(naive), CLINIC_TIME_ZONE));
}

// Dates always spell the month out. "03/09/2026" reads as 3 September to half
// the world and March 9 to the other half; "March 9, 2026" reads one way only.
const LONG_DATE = { year: "numeric", month: "long", day: "numeric" } as const;

export function formatDateTime(at: Date) {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: CLINIC_TIME_ZONE,
    ...LONG_DATE,
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

export function formatTime(at: Date) {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: CLINIC_TIME_ZONE,
    timeStyle: "short",
  }).format(at);
}

/** "9:00a" — for calendar cells, where "9:00 AM" costs too much width. */
export function formatTimeCompact(at: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(at)
    .replace(/\s?AM$/, "a")
    .replace(/\s?PM$/, "p");
}

export function formatDate(at: Date) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: CLINIC_TIME_ZONE, ...LONG_DATE }).format(at);
}

/** "Sep 30", with the year only when it isn't this year — for dates in a list. */
export function formatShortDate(at: Date, now = new Date()) {
  const year = (d: Date) => new Intl.DateTimeFormat(LOCALE, { timeZone: CLINIC_TIME_ZONE, year: "numeric" }).format(d);
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: CLINIC_TIME_ZONE,
    month: "short",
    day: "numeric",
    ...(year(at) === year(now) ? {} : { year: "numeric" }),
  }).format(at);
}

/** "Wednesday, 2 September 2026" — for day headings. */
export function formatDayHeading(at: Date) {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: CLINIC_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(at);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Midnight-to-midnight bounds of a clinic day containing `at`. */
export function clinicDayRange(at: Date) {
  const start = startOfClinicDay(dayKey(at));
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

// --- Calendar ---------------------------------------------------------------
// Days are addressed by a "YYYY-MM-DD" key in clinic time. Bucketing instants by
// that key is what lets a month grid be built without a timezone library.

/** The clinic calendar day an instant falls on. */
export function dayKey(at: Date) {
  const p = parts(at, CLINIC_TIME_ZONE);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function startOfClinicDay(key: string) {
  return fromDateTimeLocalValue(`${key}T00:00`)!;
}

/** "YYYY-MM" for the month an instant falls in. */
export function monthKey(at: Date) {
  return dayKey(at).slice(0, 7);
}

/** Parses "YYYY-MM", falling back to the current clinic month. */
export function parseMonthKey(value: unknown, fallbackNow = new Date()) {
  if (typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) };
  }
  const now = monthKey(fallbackNow);
  return { year: Number(now.slice(0, 4)), month: Number(now.slice(5, 7)) };
}

export function shiftMonth(year: number, month: number, by: number) {
  const zeroBased = year * 12 + (month - 1) + by;
  return `${Math.floor(zeroBased / 12)}-${pad2((zeroBased % 12) + 1)}`;
}

/** Instant bounds of a clinic month, for a single indexed range query. */
export function clinicMonthRange(year: number, month: number) {
  return {
    start: startOfClinicDay(`${year}-${pad2(month)}-01`),
    end: startOfClinicDay(`${shiftMonth(year, month, 1)}-01`),
  };
}

export type CalendarCell = { key: string; day: number; inMonth: boolean };

/**
 * Whole weeks (Sunday-first) covering the month, stopping before the first week
 * that lies entirely outside it — a 28-day February beginning on a Sunday needs
 * four rows, not six. Built from UTC arithmetic on calendar dates, which carries
 * no timezone risk. The first week always contains day 1, so this never trims
 * everything.
 */
export function monthGrid(year: number, month: number): CalendarCell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = Date.UTC(year, month - 1, 1 - first.getUTCDay());

  const weeks: CalendarCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start + (w * 7 + d) * 86_400_000);
      week.push({
        key: `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`,
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() === month - 1 && date.getUTCFullYear() === year,
      });
    }
    if (week.every((c) => !c.inMonth)) break;
    weeks.push(week);
  }
  return weeks;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatMonthHeading(year: number, month: number) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

/**
 * "Wednesday, September 2" from a day key — no instant conversion needed. The
 * year is omitted because this always sits beside the month heading.
 */
export function formatDayKeyHeading(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

// --- Calendar dates (date of birth, follow-up) ------------------------------
// Stored as Postgres `date`, which Prisma hands back as UTC midnight. Formatting
// those in a local zone would shift them a day, so they stay in UTC throughout.

/** `<input type="date">` value for a stored calendar date. */
export function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function fromDateInputValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatCalendarDate(d: Date) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", ...LONG_DATE }).format(d);
}

/** "March 9, 2026" from a "YYYY-MM-DD" key — for echoing a date input back. */
export function formatDayKeyLong(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", ...LONG_DATE }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** "Monday, March 9, 2026" — the same, with the weekday, for booking forms. */
export function formatDayKeyFull(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: "UTC",
    weekday: "long",
    ...LONG_DATE,
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
