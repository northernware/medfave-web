"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Field, FieldGrid, FormError, Select, SubmitButton, TextArea, TextInput } from "@/components/form";
import { buttonClass } from "@/components/ui";
import { formatTime } from "@/lib/datetime";
import { BLANK_PRESCRIPTION, type PrescriptionRow, type RecordDefaults } from "@/lib/form-defaults";
import { searchDiagnoses, type AutosaveResult } from "@/app/actions/records";
import { DiagnosisPicker } from "@/components/forms/diagnosis-picker";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation";

/**
 * How often the open note is written back.
 *
 * Long enough that ordinary typing does not generate a request per word, short
 * enough that a browser closing mid-consultation costs a sentence rather than
 * the visit. It only fires when something has actually changed.
 */
const AUTOSAVE_INTERVAL_MS = 10_000;

/** As lib/diagnoses.ts; kept here so this client file doesn't import server code. */
const ICD11_CREDIT = "ICD-11 MMS © World Health Organization, CC BY-ND 3.0 IGO";

const VITALS = [
  { name: "temperatureC", label: "Temp", unit: "°C", step: "0.1", placeholder: "36.8" },
  { name: "heartRate", label: "Pulse", unit: "bpm", step: "1", placeholder: "72" },
  { name: "respiratoryRate", label: "Resp", unit: "/min", step: "1", placeholder: "16" },
  { name: "systolic", label: "Systolic", unit: "mmHg", step: "1", placeholder: "120" },
  { name: "diastolic", label: "Diastolic", unit: "mmHg", step: "1", placeholder: "80" },
  { name: "oxygenSaturation", label: "SpO₂", unit: "%", step: "1", placeholder: "98" },
  { name: "weightKg", label: "Weight", unit: "kg", step: "0.1", placeholder: "62.5" },
  { name: "heightCm", label: "Height", unit: "cm", step: "0.1", placeholder: "165" },
] as const;

export function RecordForm({
  action,
  autosave,
  defaults,
  patientId,
  openAppointments,
  cancelHref,
  lockedAppointment,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Writes the open note in the background; returns the id it was written to. */
  autosave: (formData: FormData) => Promise<AutosaveResult>;
  defaults: RecordDefaults;
  patientId: string;
  openAppointments: { id: string; label: string; remote: boolean }[];
  cancelHref: string;
  /** Set when documenting a specific booking — the link is fixed, not chosen. */
  lockedAppointment?: { id: string; label: string; remote: boolean };
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const [rx, setRx] = useState<PrescriptionRow[]>(defaults.prescriptions);
  const err = state.fieldErrors;
  const rxId = useId();

  // A note that has been signed is changed deliberately, with a reason — never
  // by a timer. Autosave belongs to drafts only.
  const drafting = defaults.status === "DRAFT";

  // Which visit this documents decides what can honestly be written in it, and
  // the visit can still be chosen here, so it is state rather than a prop.
  const [appointmentId, setAppointmentId] = useState(
    lockedAppointment?.id ?? defaults.appointmentId,
  );
  const remote = lockedAppointment
    ? lockedAppointment.remote
    : (openAppointments.find((a) => a.id === appointmentId)?.remote ?? false);

  const formRef = useRef<HTMLFormElement>(null);
  const [recordId, setRecordId] = useState(defaults.recordId);
  const [savedAt, setSavedAt] = useState<Date | null>(
    defaults.savedAt ? new Date(defaults.savedAt) : null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  // Refs, not state: these coordinate the timer and must not re-render the form
  // under the doctor's cursor.
  const unsaved = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!drafting) return;
    const timer = setInterval(async () => {
      if (!unsaved.current || inFlight.current || !formRef.current) return;
      inFlight.current = true;
      unsaved.current = false;
      try {
        const body = new FormData(formRef.current);
        // The first save of a new note is what gives it an id; every save after
        // that has to land on the same row.
        body.set("recordId", recordId);
        const result = await autosave(body);
        if (result.ok) {
          setRecordId(result.recordId);
          setSavedAt(new Date(result.savedAt));
          setSaveError(null);
        } else {
          setSaveError(result.message);
          unsaved.current = true;
        }
      } catch {
        setSaveError("Could not reach the server — your last edits are not saved yet.");
        unsaved.current = true;
      } finally {
        inFlight.current = false;
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [drafting, recordId, autosave]);

  function updateRx(index: number, patch: Partial<PrescriptionRow>) {
    unsaved.current = true;
    setRx((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onInput={() => {
        unsaved.current = true;
      }}
      className="space-y-7"
    >
      <FormError message={state.message} />
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="recordId" value={recordId} />

      <section className="space-y-4">
        <FieldGrid>
          <Field label="Visit date and time" htmlFor="visitDate" error={err?.visitDate} required>
            <TextInput
              id="visitDate"
              name="visitDate"
              type="datetime-local"
              defaultValue={defaults.visitDate}
              required
              invalid={Boolean(err?.visitDate)}
            />
          </Field>

          {lockedAppointment ? (
            <Field label="Documenting appointment" htmlFor="appointmentLabel">
              <input type="hidden" name="appointmentId" value={lockedAppointment.id} />
              <TextInput id="appointmentLabel" defaultValue={lockedAppointment.label} disabled />
            </Field>
          ) : openAppointments.length > 0 ? (
            <Field
              label="Link to appointment"
              htmlFor="appointmentId"
              error={err?.appointmentId}
              hint="Linking marks that appointment completed."
            >
              <Select
                id="appointmentId"
                name="appointmentId"
                value={appointmentId}
                onChange={(e) => setAppointmentId(e.target.value)}
              >
                <option value="">Walk-in — no appointment</option>
                {openAppointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="appointmentId" value="" />
          )}
        </FieldGrid>

        <Field label="Chief complaint" htmlFor="chiefComplaint" error={err?.chiefComplaint} required>
          <TextInput
            id="chiefComplaint"
            name="chiefComplaint"
            defaultValue={defaults.chiefComplaint}
            required
            placeholder="Cough and fever, 3 days"
            invalid={Boolean(err?.chiefComplaint)}
          />
        </Field>

        <Field
          label="History of present illness"
          htmlFor="historyOfPresentIllness"
          error={err?.historyOfPresentIllness}
        >
          <TextArea
            id="historyOfPresentIllness"
            name="historyOfPresentIllness"
            rows={4}
            defaultValue={defaults.historyOfPresentIllness}
          />
        </Field>

        {/* Nobody was in the room for a teleconsultation, so there is nothing
            to examine and nothing to measure. The fields are not merely
            disabled — an empty box invites a guess, and a guessed vital in a
            chart is worse than an absent one. */}
        {remote ? null : (
          <Field
            label="Physical examination"
            htmlFor="physicalExamination"
            error={err?.physicalExamination}
            hint="Findings on examination — the vitals below are recorded separately."
          >
            <TextArea
              id="physicalExamination"
              name="physicalExamination"
              rows={4}
              defaultValue={defaults.physicalExamination}
            />
          </Field>
        )}
      </section>

      {remote ? (
        <section className="border-t border-border pt-6">
          <h2 className="flex items-center gap-2 font-display text-lg leading-6 font-semibold tracking-[-0.01em] before:h-5 before:w-1 before:rounded-full before:bg-accent">Examination and vitals</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Not recorded for a teleconsultation — nobody was there to take them. Anything the
            patient reported themselves belongs in the history above, where it reads as what it
            is.
          </p>
        </section>
      ) : (
        <section className="space-y-4 border-t border-border pt-6">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg leading-6 font-semibold tracking-[-0.01em] before:h-5 before:w-1 before:rounded-full before:bg-accent">Vitals</h2>
            <p className="text-sm text-ink-muted">Leave blank anything you did not take.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {VITALS.map((v) => (
              <Field key={v.name} label={`${v.label} (${v.unit})`} htmlFor={v.name} error={err?.[v.name]}>
                <TextInput
                  id={v.name}
                  name={v.name}
                  type="number"
                  step={v.step}
                  inputMode="decimal"
                  placeholder={v.placeholder}
                  defaultValue={defaults[v.name]}
                  invalid={Boolean(err?.[v.name])}
                  className="tabular"
                />
              </Field>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4 border-t border-border pt-6">
        <h2 className="flex items-center gap-2 font-display text-lg leading-6 font-semibold tracking-[-0.01em] before:h-5 before:w-1 before:rounded-full before:bg-accent">Assessment and plan</h2>
        <div>
          <p className="mb-1.5 block text-sm leading-5 font-semibold">Diagnoses (ICD-11)</p>
          <DiagnosisPicker
            initial={defaults.diagnoses}
            search={searchDiagnoses}
            credit={ICD11_CREDIT}
            error={err?.diagnoses}
            onChange={() => {
              unsaved.current = true;
            }}
          />
        </div>
        <Field label="Assessment" htmlFor="assessment" hint="Your reasoning. The coded diagnoses are above." error={err?.assessment}>
          <TextArea id="assessment" name="assessment" rows={3} defaultValue={defaults.assessment} />
        </Field>
        {/* Treatment plans are now the prescriptions plus "Advice and notes". A
            note written with a plan keeps showing it, so saving can't erase it. */}
        {defaults.treatmentPlan ? (
          <Field label="Treatment plan" htmlFor="treatmentPlan" hint="From before plans moved to prescriptions and advice." error={err?.treatmentPlan}>
            <TextArea id="treatmentPlan" name="treatmentPlan" rows={4} defaultValue={defaults.treatmentPlan} />
          </Field>
        ) : null}
        <FieldGrid>
          <Field label="Follow-up date" htmlFor="followUpDate" error={err?.followUpDate}>
            <TextInput
              id="followUpDate"
              name="followUpDate"
              type="date"
              defaultValue={defaults.followUpDate}
              invalid={Boolean(err?.followUpDate)}
            />
          </Field>
        </FieldGrid>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg leading-6 font-semibold tracking-[-0.01em] before:h-5 before:w-1 before:rounded-full before:bg-accent">Prescriptions</h2>
            <p className="text-sm text-ink-muted">
              {rx.length === 0 ? "None yet." : `${rx.length} item${rx.length === 1 ? "" : "s"}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRx((rows) => [...rows, { ...BLANK_PRESCRIPTION }])}
            className={buttonClass("secondary")}
          >
            Add drug
          </button>
        </div>

        {rx.map((row, i) => (
          <fieldset key={`${rxId}-${i}`} className="rounded-xl border border-border bg-surface-muted p-4">
            <legend className="px-1 text-xs font-medium text-ink-faint">Drug {i + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Drug" htmlFor={`${rxId}-drug-${i}`} className="sm:col-span-2">
                <TextInput
                  id={`${rxId}-drug-${i}`}
                  name="rx.drugName"
                  value={row.drugName}
                  onChange={(e) => updateRx(i, { drugName: e.target.value })}
                  placeholder="Amoxicillin 500 mg"
                />
              </Field>
              <Field label="Dosage" htmlFor={`${rxId}-dose-${i}`}>
                <TextInput
                  id={`${rxId}-dose-${i}`}
                  name="rx.dosage"
                  value={row.dosage}
                  onChange={(e) => updateRx(i, { dosage: e.target.value })}
                  placeholder="1 capsule"
                />
              </Field>
              <Field label="Frequency" htmlFor={`${rxId}-freq-${i}`}>
                <TextInput
                  id={`${rxId}-freq-${i}`}
                  name="rx.frequency"
                  value={row.frequency}
                  onChange={(e) => updateRx(i, { frequency: e.target.value })}
                  placeholder="3× daily"
                />
              </Field>
              <Field label="Duration" htmlFor={`${rxId}-dur-${i}`}>
                <TextInput
                  id={`${rxId}-dur-${i}`}
                  name="rx.duration"
                  value={row.duration}
                  onChange={(e) => updateRx(i, { duration: e.target.value })}
                  placeholder="7 days"
                />
              </Field>
              <Field label="Instructions" htmlFor={`${rxId}-inst-${i}`} className="sm:col-span-3">
                <TextInput
                  id={`${rxId}-inst-${i}`}
                  name="rx.instructions"
                  value={row.instructions}
                  onChange={(e) => updateRx(i, { instructions: e.target.value })}
                  placeholder="After meals"
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={() => setRx((rows) => rows.filter((_, index) => index !== i))}
              className="mt-3 text-sm font-medium text-danger-ink hover:underline"
            >
              Remove
            </button>
          </fieldset>
        ))}
      </section>

      <section className="border-t border-border pt-6">
        <Field label="Advice and notes" htmlFor="notes" hint="Lifestyle advice, handouts, labs to get, referrals: anything that isn't a medicine." error={err?.notes}>
          <TextArea id="notes" name="notes" rows={3} defaultValue={defaults.notes} />
        </Field>
      </section>

      {/* Amending a signed note is a different act from writing one, and the
          reason is what makes the trail worth keeping — so it is asked for
          here, next to the button that commits the change. */}
      {drafting ? null : (
        <section className="border-t border-border pt-6">
          <Field
            label="Reason for this amendment"
            htmlFor="amendmentReason"
            error={err?.amendmentReason}
            hint="Kept with the previous text, so the note shows what changed and why."
            required
          >
            <TextArea
              id="amendmentReason"
              name="amendmentReason"
              rows={2}
              required
              placeholder="Blood pressure transcribed from the wrong chart"
            />
          </Field>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-6">
        {drafting ? (
          <>
            {/* Two buttons, because they are two different decisions. Saving
                keeps the note open and the visit open with it; finishing is
                what signs the note and completes the appointment. */}
            <SubmitButton name="intent" value="finish">
              Finish consultation
            </SubmitButton>
            <button name="intent" value="draft" className={buttonClass("secondary")}>
              Save draft
            </button>
          </>
        ) : (
          <SubmitButton name="intent" value="finish">
            Save amendment
          </SubmitButton>
        )}
        <Link href={cancelHref} className={buttonClass("secondary")}>
          Cancel
        </Link>

        {drafting ? (
          <span className="ml-auto text-xs" aria-live="polite">
            {saveError ? (
              <span className="text-danger-ink">{saveError}</span>
            ) : savedAt ? (
              <span className="text-ink-faint">Draft saved {formatTime(savedAt)}</span>
            ) : (
              <span className="text-ink-faint">Not saved yet — saves as you write</span>
            )}
          </span>
        ) : null}
      </div>
    </form>
  );
}
