import { startOwnHousehold } from "@/app/actions/patients";
import { ActionDialog } from "@/components/action-dialog";
import { fullName, RELATIONSHIP_LABELS } from "@/lib/domain";
import type { Relationship } from "@/lib/enums";

/**
 * Somebody starting a family of their own: a new household with them at its
 * head, and whichever housemates go with them. A move, not a copy — one
 * household per person. Shared by the desk's chart and the doctor's.
 */
export function StartHousehold({
  patient,
  others,
  back,
}: {
  patient: { id: string; firstName: string; lastName: string; dateOfBirth: string };
  others: { id: string; firstName: string; middleName: string | null; lastName: string; relationship: Relationship }[];
  /** Where to land afterwards: this chart. */
  back: string;
}) {
  // Heading a household is for adults; a child stays in their family's.
  if (others.length === 0 || !adult(patient.dateOfBirth)) return null;
  return (
    <ActionDialog label="Start their own household…" title="Start their own household" action={startOwnHousehold} submitLabel="Start household">
      <input type="hidden" name="patientId" value={patient.id} />
      <input type="hidden" name="back" value={back} />
      <p className="text-sm text-ink-muted">
        {patient.firstName} becomes head of a new household of their own. Tick who moves with them.
      </p>
      <div className="space-y-1.5">
        {others.map((h) => (
          <label key={h.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="memberId" value={h.id} className="accent-[var(--accent)]" />
            {fullName(h)}
            <span className="text-ink-faint">· {RELATIONSHIP_LABELS[h.relationship]}</span>
          </label>
        ))}
      </div>
    </ActionDialog>
  );
}

function adult(dateOfBirth: string) {
  const [y, m, d] = String(dateOfBirth).slice(0, 10).split("-").map(Number);
  const now = new Date();
  const had = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d);
  return now.getFullYear() - y - (had ? 0 : 1) >= 18;
}
