import type { AllergySeverity, ClinicalListStatus } from "@/lib/enums";
import { ALLERGY_SEVERITY_LABELS, sortAllergies } from "@/lib/clinical";
import { ChartForm } from "./chart-form";

export type AllergyEntry = {
  id: string;
  label: string;
  reaction: string | null;
  severity: AllergySeverity | null;
  notes: string | null;
};

/** With a patient id, the boxes can be changed in place (the note's side column). */
type Editable = { patientId?: string };

/** A small inline button on a coloured box: remove one entry. */
function RemoveButton({ patientId, action, id, label }: { patientId: string; action: string; id: string; label: string }) {
  return (
    <ChartForm patientId={patientId} action={action} id={id} className="inline">
      <button className="ml-1 rounded px-1 text-xs underline-offset-2 opacity-75 hover:underline hover:opacity-100" aria-label={`Remove ${label}: recorded by mistake`}>
        Remove
      </button>
    </ChartForm>
  );
}

/** "+ Add …" folded open under a box. */
function AddDisclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group mt-2 text-sm">
      <summary className="cursor-pointer list-none text-xs font-semibold underline-offset-2 hover:underline">+ {label}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

const field = "w-full rounded-md border border-current/30 bg-surface px-2 py-1 text-sm text-ink";

function AddAllergy({ patientId }: { patientId: string }) {
  return (
    <AddDisclosure label="Add allergy">
      <ChartForm patientId={patientId} action="allergy.add" className="grid gap-1.5">
        <input name="label" required placeholder="Allergy (e.g. Sulfa drugs)" className={field} />
        <div className="flex gap-1.5">
          <select name="severity" defaultValue="" className={field} aria-label="Severity">
            <option value="">Severity</option>
            <option value="MILD">Mild</option>
            <option value="MODERATE">Moderate</option>
            <option value="SEVERE">Severe</option>
          </select>
          <input name="reaction" placeholder="Reaction" className={field} />
        </div>
        <button className="justify-self-start rounded-md bg-on-alert px-2.5 py-1 text-xs font-semibold text-alert-danger">Save allergy</button>
      </ChartForm>
    </AddDisclosure>
  );
}

/** Standing warnings, above the allergies — things to act on before touching the patient. */
export function AlertBanner({ alerts, patientId }: { alerts: { id: string; label: string; notes: string | null }[] } & Editable) {
  if (alerts.length === 0) {
    // Nothing to warn about: beside a note, just the way to add one.
    if (!patientId) return null;
    return (
      <div className="rounded-md border border-border bg-surface px-3.5 py-2 text-ink-muted">
        <AddAlert patientId={patientId} />
      </div>
    );
  }
  return (
    // Solid, not tinted: an alert has to stand out from everything else on the page.
    <div className="rounded-md bg-alert-warn px-3.5 py-3 text-on-alert shadow-sm">
      <p className="font-display text-sm font-semibold">Medical alerts</p>
      <ul className="mt-1.5 space-y-1">
        {alerts.map((a) => (
          <li key={a.id} className="text-sm">
            <span className="font-medium">{a.label}</span>
            {a.notes ? <span className="opacity-90"> — {a.notes}</span> : null}
            {patientId ? <RemoveButton patientId={patientId} action="alert.remove" id={a.id} label={a.label} /> : null}
          </li>
        ))}
      </ul>
      {patientId ? <AddAlert patientId={patientId} /> : null}
    </div>
  );
}

function AddAlert({ patientId }: { patientId: string }) {
  return (
    <AddDisclosure label="Add medical alert">
      <ChartForm patientId={patientId} action="alert.add" className="grid gap-1.5">
        <input name="label" required placeholder="What to watch for (e.g. On warfarin)" className={field} />
        <input name="notes" placeholder="Details" className={field} />
        <button className="justify-self-start rounded-md bg-on-alert px-2.5 py-1 text-xs font-semibold text-alert-warn">Save alert</button>
      </ChartForm>
    </AddDisclosure>
  );
}

/**
 * Allergies at the top of a chart, in one of three states — and all three say
 * something. An empty list is not "safe": a patient nobody has asked reads as
 * unrecorded, in amber, rather than silently as none.
 */
export function AllergyBanner({
  status,
  allergies,
  patientId,
}: {
  status: ClinicalListStatus;
  allergies: AllergyEntry[];
} & Editable) {
  if (status === "NONE_KNOWN" && allergies.length === 0) {
    return (
      <div className="rounded-md border border-border border-l-[3px] border-l-ok bg-surface px-3.5 py-2.5 text-sm text-ink-muted">
        <span className="font-medium text-ink">No known allergies</span> — asked and recorded.
        {patientId ? <AddAllergy patientId={patientId} /> : null}
      </div>
    );
  }

  if (allergies.length === 0) {
    return (
      <div className="rounded-md bg-alert-warn px-3.5 py-2.5 text-sm text-on-alert shadow-sm">
        <span className="font-medium">Allergies not recorded.</span> Nobody has taken an allergy
        history for this patient yet.
        {patientId ? (
          <div className="mt-2 flex flex-wrap items-start gap-3">
            <ChartForm patientId={patientId} action="allergy.none">
              <button className="rounded-md bg-on-alert px-2.5 py-1 text-xs font-semibold text-alert-warn">No known allergies</button>
            </ChartForm>
          </div>
        ) : null}
        {patientId ? <AddAllergy patientId={patientId} /> : null}
      </div>
    );
  }

  return (
    <div className="rounded-md bg-alert-danger px-3.5 py-3 text-on-alert shadow-sm">
      <p className="font-display text-sm font-semibold">Allergies</p>
      <ul className="mt-1.5 space-y-1.5">
        {sortAllergies(allergies).map((a) => (
          <li key={a.id} className="text-sm">
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-medium">{a.label}</span>
              {a.severity ? (
                // Coloured badges clash with the box: severe is filled, the rest outlined.
                <span
                  className={`rounded-full px-2 py-px text-xs font-semibold ${
                    a.severity === "SEVERE" ? "bg-on-alert text-alert-danger" : "border border-current/40"
                  }`}
                >
                  {ALLERGY_SEVERITY_LABELS[a.severity]}
                </span>
              ) : null}
              {a.reaction ? <span className="opacity-90">{a.reaction}</span> : null}
            </span>
            {a.notes ? <span className="mt-0.5 block text-xs opacity-75">{a.notes}</span> : null}
            {patientId ? <RemoveButton patientId={patientId} action="allergy.remove" id={a.id} label={a.label} /> : null}
          </li>
        ))}
      </ul>
      {patientId ? <AddAllergy patientId={patientId} /> : null}
    </div>
  );
}
