import type { ReactNode } from "react";

/**
 * Who this patient is, at a glance: an ID card. The top is the identity
 * (number, birth, sex, blood type) in large type; below it a sheet, its edge
 * rising to a clip in the middle like a clipboard's, with the ways to reach
 * them. Empty fields are left out rather than shown as dashes.
 */
export function PatientCard({
  number,
  facts,
  contacts,
}: {
  number: string | null;
  /** Large label/value pairs: born, sex, blood type. */
  facts: { label: string; value: ReactNode }[];
  /** The sheet's rows; null values are skipped. */
  contacts: { label: string; value: ReactNode; detail?: string | null }[];
}) {
  const shown = contacts.filter((c) => c.value);
  return (
    <section aria-label="Patient details" className="overflow-hidden rounded-2xl border border-border bg-surface-muted">
      <div className="px-5 pt-4 pb-6">
        {number ? <p className="nums text-xs font-semibold tracking-wide text-accent-ink">{number}</p> : null}
        <dl className="mt-3 grid grid-cols-[1.4fr_1fr_1fr] gap-x-3">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-xs text-ink-faint">{f.label}</dt>
              <dd className="mt-0.5 font-display text-base leading-6 font-semibold">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {shown.length > 0 ? (
        <div className="relative rounded-t-2xl bg-surface px-5 pt-5 pb-4">
          {/* The clip: a tab rising from the sheet's edge, curved into it at both shoulders. */}
          <span aria-hidden className="absolute -top-3 left-1/2 h-3.5 w-20 -translate-x-1/2 rounded-t-lg bg-surface">
            <span className="absolute top-1.5 left-1/2 h-1 w-7 -translate-x-1/2 rounded-full bg-border-strong" />
            <span className="absolute bottom-0 -left-2 size-2 bg-[radial-gradient(circle_at_0_0,transparent_0.5rem,var(--surface)_0.5rem)]" />
            <span className="absolute -right-2 bottom-0 size-2 bg-[radial-gradient(circle_at_100%_0,transparent_0.5rem,var(--surface)_0.5rem)]" />
          </span>
          <dl className="space-y-3">
            {shown.map((c) => (
              <div key={c.label} className="min-w-0">
                <dt className="text-xs text-ink-faint">{c.label}</dt>
                <dd className="text-sm leading-6">
                  {c.value}
                  {c.detail ? <span className="block text-xs text-ink-faint">{c.detail}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}
