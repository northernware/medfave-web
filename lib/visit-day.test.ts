import { describe, expect, it } from "vitest";
import { canConfirm, confirmWindow, heldFrom, queueOrder, splitVisits } from "@/lib/visit-day";

// Clinic time is Manila, UTC+8. Database text is UTC wall-clock, "YYYY-MM-DD HH:MM:SS".
const utc = (iso: string) => new Date(`${iso}Z`);

describe("confirmWindow / canConfirm", () => {
  // Wed 7 Oct 2026, 9:30 Manila.
  const at = utc("2026-10-07T01:30:00");
  const visit = { status: "CONFIRMED", scheduledAt: at, patientConfirmedAt: null };

  it("opens at the start of the clinic day before and closes at the visit's time", () => {
    const { from, until } = confirmWindow(at);
    expect(from.toISOString()).toBe("2026-10-05T16:00:00.000Z"); // Tue 6 Oct, 00:00 Manila
    expect(until).toEqual(at);
  });

  it("is open inside the window only", () => {
    expect(canConfirm(visit, utc("2026-10-05T15:59:00"))).toBe(false); // two days before
    expect(canConfirm(visit, utc("2026-10-05T16:00:00"))).toBe(true);
    expect(canConfirm(visit, utc("2026-10-07T01:29:00"))).toBe(true);
    expect(canConfirm(visit, utc("2026-10-07T01:30:00"))).toBe(false); // its time has come
  });

  it("is closed once said, or once the visit has moved on", () => {
    const now = utc("2026-10-06T08:00:00");
    expect(canConfirm({ ...visit, patientConfirmedAt: utc("2026-10-06T07:00:00") }, now)).toBe(false);
    expect(canConfirm({ ...visit, status: "PENDING" }, now)).toBe(true);
    for (const status of ["CHECKED_IN", "IN_CONSULTATION", "COMPLETED", "CANCELLED", "NO_SHOW"]) {
      expect(canConfirm({ ...visit, status }, now)).toBe(false);
    }
  });
});

describe("splitVisits", () => {
  // Mon 5 Oct 2026, 14:00 Manila; the clinic day began at 2026-10-04 16:00 UTC.
  const now = utc("2026-10-05T06:00:00");
  const v = (id: string, status: string, scheduledAt: string) => ({ id, status, scheduledAt });

  it("keeps today's visit upcoming until it's over, and sends the rest to past", () => {
    const ahead = [v("later-today", "CONFIRMED", "2026-10-05 08:00:00"), v("tomorrow", "CONFIRMED", "2026-10-06 01:00:00")];
    // Latest first, as the route reads them.
    const before = [
      v("with-doctor", "IN_CONSULTATION", "2026-10-05 05:00:00"),
      v("done", "COMPLETED", "2026-10-05 03:00:00"),
      v("late", "CONFIRMED", "2026-10-05 01:00:00"),
      v("yesterday", "CONFIRMED", "2026-10-04 07:00:00"),
      v("cancelled", "CANCELLED", "2026-10-03 01:00:00"),
    ];
    const { upcoming, past } = splitVisits(ahead, before, now);
    expect(upcoming.map((a) => a.id)).toEqual(["late", "with-doctor", "later-today", "tomorrow"]);
    expect(past.map((a) => a.id)).toEqual(["done", "yesterday", "cancelled"]);
  });

  it("counts a visit at the very start of the clinic day as today's", () => {
    const { upcoming } = splitVisits([], [v("midnight", "CHECKED_IN", "2026-10-04 16:00:00")], now);
    expect(upcoming.map((a) => a.id)).toEqual(["midnight"]);
  });
});

describe("heldFrom", () => {
  const from = utc("2026-10-05T00:00:00");
  const to = utc("2026-10-06T00:00:00");
  const visits = [
    { id: "a", durationMinutes: 30 },
    { id: "b", durationMinutes: 20 },
    { id: "c", durationMinutes: 15 },
  ];

  it("holds each visit's old time from its latest check-in only", () => {
    const held = heldFrom(
      visits,
      [
        // Latest first: "a" was checked in twice; only the newest counts.
        { appointmentId: "a", previousScheduledAt: "2026-10-05 02:00:00" },
        { appointmentId: "a", previousScheduledAt: "2026-10-05 09:00:00" },
        { appointmentId: "b", previousScheduledAt: "2026-10-05 04:30:00" },
      ],
      from,
      to,
    );
    expect(held.map((h) => [h.id, h.scheduledAt.toISOString(), h.durationMinutes])).toEqual([
      ["a", "2026-10-05T02:00:00.000Z", 30],
      ["b", "2026-10-05T04:30:00.000Z", 20],
    ]);
  });

  it("holds nothing for a check-in that didn't move the visit, or outside the range", () => {
    const held = heldFrom(
      visits,
      [
        { appointmentId: "a", previousScheduledAt: null },
        { appointmentId: "b", previousScheduledAt: "2026-10-06 00:00:00" }, // `to` is exclusive
        { appointmentId: "c", previousScheduledAt: "2026-10-04 23:59:00" },
        { appointmentId: "gone", previousScheduledAt: "2026-10-05 03:00:00" }, // no longer checked in
      ],
      from,
      to,
    );
    expect(held).toEqual([]);
  });
});

describe("queueOrder", () => {
  it("puts whoever is with the doctor first, then the waiting room longest wait first", () => {
    const queue = [
      { id: "joaquin", status: "CHECKED_IN", arrivedAt: "2026-10-05 06:36:00" },
      { id: "ramon", status: "IN_CONSULTATION", arrivedAt: "2026-10-05 06:35:00" },
      { id: "marilou", status: "CHECKED_IN", arrivedAt: "2026-10-05 06:56:00" },
      { id: "elena", status: "IN_CONSULTATION", arrivedAt: "2026-10-05 06:28:00" },
      { id: "walk-in", status: "CHECKED_IN", arrivedAt: "2026-10-05 06:20:00" },
    ];
    expect([...queue].sort(queueOrder).map((a) => a.id)).toEqual(["elena", "ramon", "walk-in", "joaquin", "marilou"]);
  });
});
