"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { ServiceType } from "@/lib/enums";
import { Field, FieldGrid, FormError, Select, SubmitButton, TextArea, TextInput } from "@/components/form";
import { buttonClass } from "@/components/ui";
import { formatDayKeyFull } from "@/lib/datetime";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
  BOOKING_SOURCE_LABELS,
  REMINDER_LABELS,
  SERVICES,
  SERVICE_DESCRIPTIONS,
  SERVICE_MINUTES,
  VISIT_PRIORITY_LABELS,
} from "@/lib/domain";
import type {
  AppointmentDefaults,
  BusyByDay,
  FollowUpOptions,
  PatientOption,
} from "@/lib/form-defaults";
import { slotsForDay } from "@/lib/scheduling";
import { describeWeek, durationFor } from "@/lib/availability";
import { fullDayClosure, hoursFor, type Schedule } from "@/lib/availability";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation";

export function AppointmentForm({
  action,
  defaults,
  patients,
  busyByDay,
  followUps,
  schedule,
  window: bookingWindow,
  walkInWindow,
  now,
  submitLabel,
  cancelHref,
  staffFields = false,
  doctorId,
  followUpForRecordId,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: AppointmentDefaults;
  patients: PatientOption[];
  busyByDay: BusyByDay;
  followUps: FollowUpOptions;
  /** The clinic's own week, breaks and closures. */
  schedule: Schedule;
  /** Bookable date range, decided by the server so both clocks agree. */
  window: { earliest: string; latest: string };
  /** The same range with the lead time lifted, for walk-ins. */
  walkInWindow: { earliest: string; latest: string };
  /** The clinic's current day and minute, so today's gone slots are not offered. */
  now: { key: string; minute: number };
  submitLabel: string;
  cancelHref: string;
  /** Reveals status, source, room and internal notes. */
  staffFields?: boolean;
  /** Whose diary, when the desk chose one; the server checks it. */
  doctorId?: string;
  /** Set when booking to satisfy a record's follow-up, so it can be linked back. */
  followUpForRecordId?: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  const [patientId, setPatientId] = useState(defaults.patientId);
  const [service, setService] = useState(defaults.service);
  const [source, setSource] = useState(defaults.source);

  // Choosing "Walk-in" moves the form onto today's rules: the date input opens
  // up to today and the slot list is built from today's bookings. The server
  // applies the same exemption, keyed on the same field, so the form cannot
  // offer a slot the action would then refuse.
  const isWalkIn = source === "WALK_IN";
  const activeWindow = isWalkIn ? walkInWindow : bookingWindow;
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);

  // Duration is the service's, not a question — the slot picker needs to know
  // how much of the day each visit consumes. It comes from the clinic's own
  // settings first: reading the built-in length here while the server read the
  // clinic's override drew a slot grid the server would then reject.
  const lengthOf = (s: string) =>
    durationFor(
      schedule,
      s as ServiceType,
      SERVICE_MINUTES[s as ServiceType] ?? schedule.defaultDurationMinutes,
    );
  const duration = lengthOf(service);

  const slots = useMemo(
    () => slotsForDay(date, duration, busyByDay[date] ?? [], activeWindow, schedule, now),
    [date, duration, busyByDay, activeWindow, schedule, now],
  );

  const freeSlots = slots.filter((s) => s.free).length;

  // When editing a visit that already sits outside the bookable window, its own
  // time still has to be selectable or the form could not be saved at all.
  const keepsOriginalSlot =
    date === defaults.date && defaults.time !== "" && !slots.some((s) => s.value === defaults.time);

  // Shut for the week's shape, or shut for a holiday — the form says which.
  const dayClosure = date !== "" ? fullDayClosure(schedule, date) : null;
  const closed = date !== "" && (dayClosure !== null || hoursFor(schedule, date) === null);
  const closedReason = dayClosure
    ? `The clinic is closed that day — ${dayClosure.reason}.`
    : "The clinic does not open on that day. Choose another date.";
  const selectedPatient = patients.find((p) => p.id === patientId);
  const patientFollowUps = followUps[patientId] ?? [];

  function chooseDate(next: string) {
    setDate(next);
    // A time from another day means nothing — make them pick again.
    setTime(next === defaults.date ? defaults.time : "");
  }

  function chooseService(next: string) {
    setService(next);
    // A longer service may no longer fit where the old one did.
    setTime("");
  }

  const byHousehold = patients.reduce<Record<string, PatientOption[]>>((acc, p) => {
    (acc[p.householdName] ??= []).push(p);
    return acc;
  }, {});

  return (
    <form action={formAction} className="space-y-7">
      {doctorId ? <input type="hidden" name="doctorId" value={doctorId} /> : null}
      <FormError message={state.message} />
      {/* Already a visit open that day: say so, and let a genuine second one through (back the same evening). */}
      {state.fieldErrors?.allowSecond ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowSecond" value="1" />
          {state.fieldErrors.allowSecond[0]}
        </label>
      ) : null}
      {followUpForRecordId ? (
        <input type="hidden" name="followUpFor" value={followUpForRecordId} />
      ) : null}

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 font-display text-lg leading-6 font-semibold tracking-[-0.01em] before:h-5 before:w-1 before:rounded-full before:bg-accent">Visit</h2>

        <Field
          label="Patient"
          htmlFor="patientId"
          error={err?.patientId}
          hint={selectedPatient ? `${selectedPatient.householdName} household` : undefined}
          required
        >
          <Select
            id="patientId"
            name="patientId"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            required
          >
            <option value="" disabled>
              Select a patient…
            </option>
            {Object.entries(byHousehold).map(([household, members]) => (
              <optgroup key={household} label={household}>
                {members.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>

        <Field
          label="Service"
          htmlFor="service"
          error={err?.service}
          hint={SERVICE_DESCRIPTIONS[service as ServiceType]}
          required
        >
          <Select
            id="service"
            name="service"
            value={service}
            onChange={(e) => chooseService(e.target.value)}
            required
            invalid={Boolean(err?.service)}
          >
            <option value="" disabled>
              Choose a service…
            </option>
            {SERVICES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} · {lengthOf(s.value)} min
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Reason for visit"
          htmlFor="reason"
          error={err?.reason}
          hint="The specifics — what the service field cannot say on its own."
          required
        >
          <TextInput
            id="reason"
            name="reason"
            defaultValue={defaults.reason}
            required
            placeholder="BP above target since last refill"
            invalid={Boolean(err?.reason)}
          />
        </Field>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg leading-6 font-semibold tracking-[-0.01em] before:h-5 before:w-1 before:rounded-full before:bg-accent">Schedule</h2>
          <p className="text-sm text-ink-muted">
            {describeWeek(schedule)}.{" "}
            {isWalkIn
              ? "Walk-ins may be booked today."
              : `Bookings open from ${formatDayKeyFull(bookingWindow.earliest)}.`}
          </p>
        </div>

        <FieldGrid>
          <Field
            label="Appointment date"
            htmlFor="date"
            error={err?.date}
            hint={date ? formatDayKeyFull(date) : undefined}
            required
          >
            <TextInput
              id="date"
              name="date"
              type="date"
              value={date}
              min={activeWindow.earliest}
              max={activeWindow.latest}
              onChange={(e) => chooseDate(e.target.value)}
              required
              invalid={Boolean(err?.date)}
            />
          </Field>

          <Field label="Duration" htmlFor="durationDisplay" hint="Set by the service.">
            <TextInput id="durationDisplay" value={`${duration} minutes`} disabled readOnly />
          </Field>
        </FieldGrid>

        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium">
            Available time slot<span className="ml-0.5 text-danger">*</span>
          </legend>
          {/* The chosen slot travels as a plain field so the server sees the
              same name whether or not a radio was clicked. */}
          <input type="hidden" name="time" value={time} />

          {closed ? (
            <p className="rounded-lg border border-border bg-surface-muted px-3 py-3 text-sm text-ink-muted">
              {closedReason}
            </p>
          ) : !date ? (
            <p className="rounded-lg border border-border bg-surface-muted px-3 py-3 text-sm text-ink-muted">
              Pick a date to see open slots.
            </p>
          ) : slots.length === 0 && !keepsOriginalSlot ? (
            <p className="rounded-lg border border-border bg-surface-muted px-3 py-3 text-sm text-ink-muted">
              That date is outside the booking window.
            </p>
          ) : freeSlots === 0 && !keepsOriginalSlot ? (
            /* A grid of struck-through times says "nothing here" only if you
               read all of it. Say it once, in words, and say which of the two
               reasons it is. */
            <p className="rounded-lg border border-border bg-surface-muted px-3 py-3 text-sm text-ink-muted">
              {date === now.key
                ? "Nothing left today — every remaining time is taken or has already passed."
                : "That day is fully booked. Choose another date."}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-6">
                {keepsOriginalSlot ? (
                  <SlotChip
                    value={defaults.time}
                    label={`${defaults.time} (current)`}
                    free
                    selected={time === defaults.time}
                    onSelect={setTime}
                  />
                ) : null}
                {slots.map((slot) => (
                  <SlotChip
                    key={slot.value}
                    value={slot.value}
                    label={slot.label}
                    free={slot.free}
                    selected={time === slot.value}
                    onSelect={setTime}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-faint">
                Greyed-out times are already booked or would overlap a {duration}-minute visit
                {date === now.key ? ", or have already passed today" : ""}.
              </p>
            </>
          )}
          {err?.time ? <p className="mt-1 text-xs text-danger-ink">{err.time[0]}</p> : null}
        </fieldset>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <h2 className="flex items-center gap-2 font-display text-lg leading-6 font-semibold tracking-[-0.01em] before:h-5 before:w-1 before:rounded-full before:bg-accent">Details</h2>

        <FieldGrid>
          <Field label="Appointment type" htmlFor="type" error={err?.type}>
            <Select id="type" name="type" defaultValue={defaults.type}>
              {Object.entries(APPOINTMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Visit priority" htmlFor="priority" error={err?.priority}>
            <Select id="priority" name="priority" defaultValue={defaults.priority}>
              {Object.entries(VISIT_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </FieldGrid>

        <FieldGrid>
          <Field
            label="Reminder preference"
            htmlFor="reminderPreference"
            error={err?.reminderPreference}
            hint="Recorded only — nothing sends reminders yet."
          >
            <Select
              id="reminderPreference"
              name="reminderPreference"
              defaultValue={defaults.reminderPreference}
            >
              {Object.entries(REMINDER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Follows on from"
            htmlFor="previousAppointmentId"
            error={err?.previousAppointmentId}
            hint={
              patientId && patientFollowUps.length === 0
                ? "This patient has no earlier visits to link."
                : undefined
            }
          >
            <Select
              id="previousAppointmentId"
              name="previousAppointmentId"
              defaultValue={defaults.previousAppointmentId}
              disabled={patientFollowUps.length === 0}
            >
              <option value="">Not a follow-up</option>
              {patientFollowUps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
        </FieldGrid>

        <Field
          label="Scheduling notes"
          htmlFor="notes"
          error={err?.notes}
          hint="Accessibility needs, preferred arrangements, anything the patient asked for."
        >
          <TextArea id="notes" name="notes" rows={3} defaultValue={defaults.notes} />
        </Field>
      </section>

      {staffFields ? (
        <section className="space-y-4 border-t border-border pt-6">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg leading-6 font-semibold tracking-[-0.01em] before:h-5 before:w-1 before:rounded-full before:bg-accent">Clinic use</h2>
            <p className="text-sm text-ink-muted">Never shown to the patient.</p>
          </div>

          <FieldGrid className="sm:grid-cols-3">
            <Field label="Status" htmlFor="status" error={err?.status}>
              <Select id="status" name="status" defaultValue={defaults.status}>
                {Object.entries(APPOINTMENT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Booking source" htmlFor="source" error={err?.source}>
              <Select
                id="source"
                name="source"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  // A date that was legal for a scheduled booking may not be for
                  // a walk-in, and the reverse; make them choose again.
                  setDate("");
                  setTime("");
                }}
              >
                {Object.entries(BOOKING_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Room" htmlFor="room" error={err?.room}>
              <TextInput id="room" name="room" defaultValue={defaults.room} placeholder="Room 2" />
            </Field>
          </FieldGrid>

          <Field label="Internal notes" htmlFor="internalNotes" error={err?.internalNotes}>
            <TextArea
              id="internalNotes"
              name="internalNotes"
              rows={3}
              defaultValue={defaults.internalNotes}
            />
          </Field>
        </section>
      ) : (
        <>
          <input type="hidden" name="status" value={defaults.status} />
          <input type="hidden" name="source" value={source} />
        </>
      )}

      <div className="flex gap-2 border-t border-border pt-6">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href={cancelHref} className={buttonClass("secondary")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

function SlotChip({
  value,
  label,
  free,
  selected,
  onSelect,
}: {
  value: string;
  label: string;
  free: boolean;
  selected: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={!free}
      aria-pressed={selected}
      onClick={() => onSelect(value)}
      className={[
        "tabular rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
        selected
          ? "border-accent bg-accent text-on-accent"
          : free
            ? "border-border bg-surface text-ink hover:border-accent hover:bg-accent-soft"
            : "cursor-not-allowed border-border bg-surface-muted text-ink-faint line-through",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
