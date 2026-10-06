import type { AllergySeverity, ClinicalListStatus } from "@/lib/enums";
import { ALLERGY_SEVERITY_LABELS, sortAllergies } from "@/lib/clinical";
import { AddDisclosure } from "./add-disclosure";
import { ChartForm } from "./chart-form";
import { buttonClass } from "./ui";

export type AllergyEntry = {
  id: string;
  label: string;
  reaction: string | null;
  severity: AllergySeverity | null;
  notes: string | null;
};

/** With a patient id, the boxes can be changed in place (the note's side column). */
type Editable = { patientId?: string };

/** A small × at the end of an entry: remove it, after asking. */
function RemoveButton({ patientId, action, id, label }: { patientId: string; action: string; id: string; label: string }) {
  return (
    <ChartForm
      patientId={patientId}
      action={action}
      id={id}
      confirm={`Remove ${label}? Only if it was recorded by mistake.`}
      className="ml-auto shrink-0"
    >
      <button
        className="grid size-5 place-items-center rounded-full text-sm leading-none opacity-70 hover:bg-black/10 hover:opacity-100"
        aria-label={`Remove ${label}: recorded by mistake`}
        title="Remove (recorded by mistake)"
      >
        ×
      </button>
    </ChartForm>
  );
}

const field = "w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink";

/**
 * Save inside a box: on the red and amber boxes a solid capsule in the box's
 * own text colour (pink would clash); on a plain box the app's primary.
 */
type Tone = "danger" | "warn" | "ok" | "plain";
const saveClass = (tone: Tone) =>
  tone === "plain"
    ? buttonClass("primary", "justify-self-start")
    : // The same capsule and size as buttonClass, in the box's own text colour.
      `inline-flex items-center justify-center justify-self-start rounded-full bg-on-alert px-4 py-2 text-sm leading-5 font-semibold hover:opacity-90 ${
        tone === "danger" ? "text-alert-danger" : tone === "ok" ? "text-alert-ok" : "text-alert-warn"
      }`;

function AddAllergy({ patientId, tone }: { patientId: string; tone: Tone }) {
  return (
    <AddDisclosure label="Add allergy" summaryClassName={tone === "plain" ? "text-accent-ink" : ""}>
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
        <button className={saveClass(tone)}>Save allergy</button>
      </ChartForm>
    </AddDisclosure>
  );
}

/** Standing warnings, under the allergies — things to act on before touching the patient. */
export function AlertBanner({ alerts, patientId }: { alerts: { id: string; label: string; notes: string | null }[] } & Editable) {
  if (alerts.length === 0) {
    // Nothing to warn about: beside a note, a plain box like its neighbours
    // (conditions, medicines) saying so, with the way to add one.
    if (!patientId) return null;
    return (
      <section className="rounded-md border border-border bg-surface px-3.5 py-3 text-sm">
        <h2 className="mb-1.5 font-display text-sm font-semibold">Medical alerts</h2>
        <p className="text-ink-muted">None</p>
        <AddAlert patientId={patientId} tone="plain" />
      </section>
    );
  }
  return (
    // Solid, not tinted: an alert has to stand out from everything else on the page.
    <div className="rounded-md bg-alert-warn px-3.5 py-3 text-on-alert shadow-sm">
      <p className="font-display text-sm font-semibold">Medical alerts</p>
      <ul className="mt-1.5 space-y-1">
        {alerts.map((a) => (
          <li key={a.id} className="flex items-start gap-2 text-sm">
            <span>
              <span className="font-medium">{a.label}</span>
              {a.notes ? <span className="opacity-90"> — {a.notes}</span> : null}
            </span>
            {patientId ? <RemoveButton patientId={patientId} action="alert.remove" id={a.id} label={a.label} /> : null}
          </li>
        ))}
      </ul>
      {patientId ? <AddAlert patientId={patientId} tone="warn" /> : null}
    </div>
  );
}

function AddAlert({ patientId, tone }: { patientId: string; tone: Tone }) {
  return (
    <AddDisclosure label="Add medical alert" summaryClassName={tone === "plain" ? "text-accent-ink" : ""}>
      <ChartForm patientId={patientId} action="alert.add" className="grid gap-1.5">
        <input name="label" required placeholder="What to watch for (e.g. On warfarin)" className={field} />
        <input name="notes" placeholder="Details" className={field} />
        <button className={saveClass(tone)}>Save alert</button>
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
      // The same solid box as the red and amber ones, in green: asked, and none.
      <div className="rounded-md bg-alert-ok px-3.5 py-3 text-sm text-on-alert shadow-sm">
        <p className="font-display text-sm font-semibold">Allergies</p>
        <p className="mt-1.5">None known — asked and recorded.</p>
        {patientId ? <AddAllergy patientId={patientId} tone="ok" /> : null}
      </div>
    );
  }

  if (allergies.length === 0) {
    return (
      <div className="rounded-md bg-alert-warn px-3.5 py-3 text-sm text-on-alert shadow-sm">
        <p className="font-display text-sm font-semibold">Allergies</p>
        <p className="mt-1.5">Not recorded: nobody has taken an allergy history for this patient yet.</p>
        {patientId ? (
          <div className="mt-2 flex flex-wrap items-start gap-3">
            <ChartForm patientId={patientId} action="allergy.none">
              <button className={saveClass("warn")}>No known allergies</button>
            </ChartForm>
          </div>
        ) : null}
        {patientId ? <AddAllergy patientId={patientId} tone="warn" /> : null}
      </div>
    );
  }

  return (
    <div className="rounded-md bg-alert-danger px-3.5 py-3 text-on-alert shadow-sm">
      <p className="font-display text-sm font-semibold">Allergies</p>
      <ul className="mt-1.5 space-y-1.5">
        {sortAllergies(allergies).map((a) => (
          <li key={a.id} className="flex items-start gap-2 text-sm">
            <span className="min-w-0">
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
            </span>
            {patientId ? <RemoveButton patientId={patientId} action="allergy.remove" id={a.id} label={a.label} /> : null}
          </li>
        ))}
      </ul>
      {patientId ? <AddAllergy patientId={patientId} tone="danger" /> : null}
    </div>
  );
}
