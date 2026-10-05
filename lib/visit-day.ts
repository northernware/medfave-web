import { clinicDayRange, instantFromDb } from "@/lib/datetime";

/*
 * The visit day's rules that decide things without asking the database, kept
 * here so they can be tested on their own. The routes and lib/held-slots.ts,
 * lib/patient-visits.ts call these.
 */

/** Statuses a patient may still cancel, move or confirm. */
export const CHANGEABLE = ["PENDING", "CONFIRMED"] as const;

/** A visit not yet over: booked, or at the clinic now. */
export const UNDERWAY = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_CONSULTATION"] as const;

/**
 * When the patient may say "I'll be there": from the start of the clinic day
 * before the visit until its time. Earlier, the answer means little; later,
 * they are either here or late. The clinic's zone has no daylight saving, so
 * a day is 24 hours.
 */
export function confirmWindow(scheduledAt: Date) {
  return { from: new Date(clinicDayRange(scheduledAt).start.getTime() - 86_400_000), until: scheduledAt };
}

export function canConfirm(visit: { status: string; scheduledAt: Date; patientConfirmedAt: Date | null }, now = new Date()) {
  if (visit.patientConfirmedAt || !(CHANGEABLE as readonly string[]).includes(visit.status)) return false;
  const { from, until } = confirmWindow(visit.scheduledAt);
  return now >= from && now < until;
}

/**
 * The patient's visits split into upcoming and past. `ahead` are from now on
 * (soonest first), `before` are earlier (latest first). Today's visit stays
 * upcoming past its start time until it's over: the patient may still be in
 * the waiting room, or with the doctor.
 */
export function splitVisits<T extends { status: string; scheduledAt: string }>(ahead: T[], before: T[], now = new Date()) {
  const today = clinicDayRange(now).start;
  const underway = (a: T) => (UNDERWAY as readonly string[]).includes(a.status) && instantFromDb(a.scheduledAt) >= today;
  return { upcoming: [...before.filter(underway).reverse(), ...ahead], past: before.filter((a) => !underway(a)) };
}

/**
 * The old times still held by early check-ins, from the checked-in visits and
 * their CHECKED_IN events (latest first). Only the latest check-in of each
 * visit counts, since an earlier one may have been undone; a check-in that
 * didn't move the visit holds nothing. Times outside [from, to) are left out.
 */
export function heldFrom<V extends { id: string; durationMinutes: number }>(
  visits: V[],
  events: { appointmentId: string; previousScheduledAt: string | null }[],
  from: Date,
  to: Date,
) {
  const held: (V & { scheduledAt: Date })[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (seen.has(e.appointmentId)) continue;
    seen.add(e.appointmentId);
    if (!e.previousScheduledAt) continue;
    const at = instantFromDb(e.previousScheduledAt);
    if (at < from || at >= to) continue;
    const visit = visits.find((a) => a.id === e.appointmentId);
    if (visit) held.push({ ...visit, scheduledAt: at });
  }
  return held;
}

/**
 * The doctor's queue: whoever is with the doctor first, then the waiting room
 * by arrival, longest wait first. Arrival, not slot: a walk-in has no
 * meaningful slot. The same order as the patient's "ahead of you".
 */
export function queueOrder(a: { status: string; arrivedAt: string | null }, b: { status: string; arrivedAt: string | null }) {
  const arrived = (x: { arrivedAt: string | null }) => (x.arrivedAt ? instantFromDb(x.arrivedAt).getTime() : 0);
  return Number(b.status === "IN_CONSULTATION") - Number(a.status === "IN_CONSULTATION") || arrived(a) - arrived(b);
}
