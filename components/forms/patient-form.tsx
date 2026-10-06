"use client";

import { useActionState, useState } from "react";
import { Field, FieldGrid, FormError, Select, SubmitButton, TextInput } from "@/components/form";
import { buttonClass } from "@/components/ui";
import { BLOOD_TYPE_LABELS, RELATIONSHIP_LABELS, SEX_LABELS } from "@/lib/domain";
import { ALERT_GROUPS, ALLERGY_GROUPS, CONDITION_GROUPS, MEDICATION_GROUPS } from "@/lib/clinical";
import { ClinicalPicker } from "@/components/clinical-picker";
import type { PatientDefaults } from "@/lib/form-defaults";
import { EMPTY_FORM_STATE, NEW_HOUSEHOLD, type FormState } from "@/lib/validation";
import Link from "next/link";

export function PatientForm({
  action,
  defaults,
  households,
  submitLabel,
  cancelHref,
  clinical = true,
  doctors = [],
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: PatientDefaults;
  households: { id: string; name: string }[];
  submitLabel: string;
  cancelHref: string;
  /** False at the desk: registration is not the place for clinical findings. */
  clinical?: boolean;
  /** At the desk of a clinic with several doctors: whose a new household is. */
  doctors?: { id: string; fullName: string }[];
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const err = state.fieldErrors;
  const [householdId, setHouseholdId] = useState(defaults.householdId);
  const creatingHousehold = householdId === NEW_HOUSEHOLD;

  // The tick starts off, and clears the moment any identifying field is edited:
  // an approval should only ever apply to the details that were actually
  // reviewed. The server enforces the same rule against the token.
  const [confirmed, setConfirmed] = useState(false);
  const clearConfirmation = () => setConfirmed(false);

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.message} />

      {state.duplicates && state.duplicates.length > 0 ? (
        <div className="rounded-lg border border-warn/50 bg-warn-tint px-4 py-3">
          <p className="text-sm font-medium text-warn-ink">
            Check these before registering — they may be the same person.
          </p>
          <ul className="mt-2 space-y-1.5">
            {state.duplicates.map((d) => (
              <li key={d.id} className="text-sm">
                <Link href={`/patients/${d.id}`} className="font-medium underline">
                  {d.name}
                </Link>
                <span className="text-ink-muted">
                  {d.patientNumber ? ` · ${d.patientNumber}` : ""} · born {d.dateOfBirth} ·{" "}
                  {d.householdName} household
                </span>
                {d.matchedOn.length > 0 ? (
                  <span className="block text-xs text-warn-ink">
                    same {d.matchedOn.join(" and ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {/* Nothing is merged automatically — a person decides, deliberately.
              The value is the fingerprint of the details shown above, so editing
              any of them invalidates this approval on the server too. */}
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="confirmDuplicate"
              value={state.confirmToken ?? ""}
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I have checked these — this is a different person
          </label>
        </div>
      ) : null}

      <section className="space-y-4">
        <FieldGrid>
          <Field
            label="Household"
            htmlFor="householdId"
            error={err?.householdId}
            hint={creatingHousehold ? undefined : "Or create one without leaving this form."}
            required
          >
            <Select
              id="householdId"
              name="householdId"
              value={householdId}
              onChange={(e) => setHouseholdId(e.target.value)}
              required
            >
              <option value="" disabled>
                Select a household…
              </option>
              {households.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
              <option value={NEW_HOUSEHOLD}>＋ New household…</option>
            </Select>
          </Field>
          {creatingHousehold ? (
            <Field
              label="New household name"
              htmlFor="newHouseholdName"
              error={err?.newHouseholdName}
              hint="Usually the surname."
              required
            >
              <TextInput
                id="newHouseholdName"
                name="newHouseholdName"
                placeholder="Dela Cruz"
                required
                invalid={Boolean(err?.newHouseholdName)}
              />
            </Field>
          ) : null}
          {creatingHousehold && doctors.length > 1 ? (
            <Field
              label="Doctor"
              htmlFor="doctorId"
              error={err?.doctorId}
              hint="Whose patient this is. That doctor sees them."
              required
            >
              <Select id="doctorId" name="doctorId" defaultValue="" required invalid={Boolean(err?.doctorId)}>
                <option value="" disabled>
                  Choose a doctor…
                </option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Relationship" htmlFor="relationship" error={err?.relationship} required>
            <Select id="relationship" name="relationship" defaultValue={defaults.relationship} required>
              {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </FieldGrid>

        <FieldGrid className="sm:grid-cols-3">
          <Field label="First name" htmlFor="firstName" error={err?.firstName} required>
            <TextInput
              id="firstName"
              name="firstName"
              onChange={clearConfirmation}
              defaultValue={defaults.firstName}
              required
              invalid={Boolean(err?.firstName)}
            />
          </Field>
          <Field label="Middle name" htmlFor="middleName" error={err?.middleName}>
            <TextInput id="middleName" name="middleName" defaultValue={defaults.middleName} />
          </Field>
          <Field label="Last name" htmlFor="lastName" error={err?.lastName} required>
            <TextInput
              id="lastName"
              name="lastName"
              onChange={clearConfirmation}
              defaultValue={defaults.lastName}
              required
              invalid={Boolean(err?.lastName)}
            />
          </Field>
        </FieldGrid>

        <FieldGrid className="sm:grid-cols-3">
          <Field label="Date of birth" htmlFor="dateOfBirth" error={err?.dateOfBirth} required>
            <TextInput
              id="dateOfBirth"
              name="dateOfBirth"
              onChange={clearConfirmation}
              type="date"
              defaultValue={defaults.dateOfBirth}
              required
              invalid={Boolean(err?.dateOfBirth)}
            />
          </Field>
          <Field label="Sex" htmlFor="sex" error={err?.sex} required>
            <Select id="sex" name="sex" defaultValue={defaults.sex} required invalid={Boolean(err?.sex)}>
              <option value="" disabled>
                Select…
              </option>
              {Object.entries(SEX_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Blood type" htmlFor="bloodType" error={err?.bloodType}>
            <Select id="bloodType" name="bloodType" defaultValue={defaults.bloodType}>
              {Object.entries(BLOOD_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </FieldGrid>
      </section>

      <section className="space-y-5 border-t border-border pt-5">
        {/* Allergies, conditions, medications and alerts are clinical findings,
            not registration details. The desk does not see them, and the action
            ignores them if they are posted anyway. */}
        {clinical ? (
          <>
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg leading-6 font-semibold tracking-[-0.01em] before:h-5 before:w-1 before:rounded-full before:bg-accent">Standing clinical notes</h2>
            <p className="text-sm text-ink-muted">
              Allergies show at the top of this patient&rsquo;s chart on every visit.
            </p>
          </div>

          <ClinicalPicker
            legend="Allergies"
            fieldName="allergy"
            statusName="allergyStatus"
            groups={ALLERGY_GROUPS}
            placeholder="Search or select allergies…"
            noneLabel="No known allergies"
            defaultStatus={defaults.allergyStatus as "RECORDED" | "NONE_KNOWN" | "UNKNOWN"}
            defaultItems={defaults.allergies}
            detailFields={["reaction", "severity", "notes"]}
            error={err?.allergyStatus}
          />

          <ClinicalPicker
            legend="Ongoing conditions"
            fieldName="condition"
            statusName="conditionStatus"
            groups={CONDITION_GROUPS}
            placeholder="Search or select conditions…"
            noneLabel="No known ongoing conditions"
            defaultStatus={defaults.conditionStatus as "RECORDED" | "NONE_KNOWN" | "UNKNOWN"}
            defaultItems={defaults.conditions}
            detailFields={["notes"]}
            error={err?.conditionStatus}
          />

          <ClinicalPicker
            legend="Current medications"
            fieldName="medication"
            statusName="medicationStatus"
            groups={MEDICATION_GROUPS}
            placeholder="Search or select medicines…"
            noneLabel="No current medications"
            defaultStatus={defaults.medicationStatus as "RECORDED" | "NONE_KNOWN" | "UNKNOWN"}
            defaultItems={defaults.medications}
            detailFields={["dosage", "frequency", "notes"]}
            error={err?.medicationStatus}
          />

          <ClinicalPicker
            legend="Medical alerts"
            fieldName="alert"
            groups={ALERT_GROUPS}
            placeholder="Search or add an alert…"
            noneLabel="No alerts"
            defaultStatus={defaults.alerts.length > 0 ? "RECORDED" : "UNKNOWN"}
            defaultItems={defaults.alerts}
            detailFields={["notes"]}
          />
          </>
        ) : null}

        <FieldGrid>
          <Field label="Contact number" htmlFor="contactNumber" error={err?.contactNumber}>
            <TextInput
              id="contactNumber"
              name="contactNumber"
              defaultValue={defaults.contactNumber}
              onChange={clearConfirmation}
            />
          </Field>
          <Field label="Email" htmlFor="email" error={err?.email}>
            <TextInput
              id="email"
              name="email"
              onChange={clearConfirmation}
              type="email"
              defaultValue={defaults.email}
              invalid={Boolean(err?.email)}
            />
          </Field>
        </FieldGrid>
      </section>

      <section className="space-y-4 border-t border-border pt-5">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg leading-6 font-semibold tracking-[-0.01em] before:h-5 before:w-1 before:rounded-full before:bg-accent">Emergency contacts</h2>
          <p className="text-sm text-ink-muted">
            Who to ring about this patient: primary, then secondary. On their emergency card in the app.
          </p>
        </div>
        <FieldGrid className="sm:grid-cols-3">
          <Field label="Primary contact" htmlFor="emergencyContactName" error={err?.emergencyContactName}>
            <TextInput
              id="emergencyContactName"
              name="emergencyContactName"
              defaultValue={defaults.emergencyContactName}
              placeholder="Marilou Dela Cruz"
            />
          </Field>
          <Field
            label="Relationship"
            htmlFor="emergencyContactRelationship"
            error={err?.emergencyContactRelationship}
          >
            <TextInput
              id="emergencyContactRelationship"
              name="emergencyContactRelationship"
              defaultValue={defaults.emergencyContactRelationship}
              placeholder="Spouse"
            />
          </Field>
          <Field
            label="Contact number"
            htmlFor="emergencyContactNumber"
            error={err?.emergencyContactNumber}
          >
            <TextInput
              id="emergencyContactNumber"
              name="emergencyContactNumber"
              defaultValue={defaults.emergencyContactNumber}
              placeholder="0917 000 0000"
            />
          </Field>
        </FieldGrid>
        <FieldGrid className="sm:grid-cols-3">
          <Field label="Secondary contact (optional)" htmlFor="emergencyContact2Name" error={err?.emergencyContact2Name}>
            <TextInput
              id="emergencyContact2Name"
              name="emergencyContact2Name"
              defaultValue={defaults.emergencyContact2Name}
              placeholder="Corazon Dela Cruz"
            />
          </Field>
          <Field
            label="Relationship"
            htmlFor="emergencyContact2Relationship"
            error={err?.emergencyContact2Relationship}
          >
            <TextInput
              id="emergencyContact2Relationship"
              name="emergencyContact2Relationship"
              defaultValue={defaults.emergencyContact2Relationship}
              placeholder="Mother"
            />
          </Field>
          <Field
            label="Contact number"
            htmlFor="emergencyContact2Number"
            error={err?.emergencyContact2Number}
          >
            <TextInput
              id="emergencyContact2Number"
              name="emergencyContact2Number"
              defaultValue={defaults.emergencyContact2Number}
              placeholder="0917 000 0000"
            />
          </Field>
        </FieldGrid>
      </section>

      <div className="flex gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href={cancelHref} className={buttonClass("secondary")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
