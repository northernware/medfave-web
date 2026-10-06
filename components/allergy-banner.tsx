import type { AllergySeverity, ClinicalListStatus } from "@/lib/enums";
import { ALLERGY_SEVERITY_LABELS, sortAllergies } from "@/lib/clinical";

export type AllergyEntry = {
  id: string;
  label: string;
  reaction: string | null;
  severity: AllergySeverity | null;
  notes: string | null;
};

/** Standing warnings, above the allergies — things to act on before touching the patient. */
export function AlertBanner({ alerts }: { alerts: { id: string; label: string; notes: string | null }[] }) {
  if (alerts.length === 0) return null;
  return (
    // Solid, not tinted: an alert has to stand out from everything else on the page.
    <div className="rounded-md bg-warn px-3.5 py-3 text-on-warn shadow-sm">
      <p className="font-display text-sm font-semibold">Medical alerts</p>
      <ul className="mt-1.5 space-y-1">
        {alerts.map((a) => (
          <li key={a.id} className="text-sm">
            <span className="font-medium">{a.label}</span>
            {a.notes ? <span className="opacity-90"> — {a.notes}</span> : null}
          </li>
        ))}
      </ul>
    </div>
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
}: {
  status: ClinicalListStatus;
  allergies: AllergyEntry[];
}) {
  if (status === "NONE_KNOWN" && allergies.length === 0) {
    return (
      <p className="rounded-md border border-border border-l-[3px] border-l-ok bg-surface px-3.5 py-2.5 text-sm text-ink-muted">
        <span className="font-medium text-ink">No known allergies</span> — asked and recorded.
      </p>
    );
  }

  if (allergies.length === 0) {
    return (
      <p className="rounded-md bg-warn px-3.5 py-2.5 text-sm text-on-warn shadow-sm">
        <span className="font-medium">Allergies not recorded.</span> Nobody has taken an allergy
        history for this patient yet.
      </p>
    );
  }

  return (
    <div className="rounded-md bg-danger px-3.5 py-3 text-on-danger shadow-sm">
      <p className="font-display text-sm font-semibold">Allergies</p>
      <ul className="mt-1.5 space-y-1.5">
        {sortAllergies(allergies).map((a) => (
          <li key={a.id} className="text-sm">
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-medium">{a.label}</span>
              {a.severity ? (
                // On the solid red, coloured badges clash: severe is filled, the rest outlined.
                <span
                  className={`rounded-full px-2 py-px text-xs font-semibold ${
                    a.severity === "SEVERE" ? "bg-on-danger text-danger" : "border border-current/40"
                  }`}
                >
                  {ALLERGY_SEVERITY_LABELS[a.severity]}
                </span>
              ) : null}
              {a.reaction ? <span className="opacity-90">{a.reaction}</span> : null}
            </span>
            {a.notes ? <span className="mt-0.5 block text-xs opacity-75">{a.notes}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
