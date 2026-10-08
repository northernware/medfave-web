import type { ReactNode } from "react";

/**
 * The column a clipboard sits in, on wide screens: its top level with the
 * page's title, under the back link (it belongs to the page, not the app's
 * frame; centred pages never put it at the window's edge), then staying in
 * view as the page scrolls, scrolling within itself if it's taller than the
 * window.
 */
export const CLIPBOARD_COLUMN =
  "lg:sticky lg:top-3 lg:max-h-[calc(100dvh-1.5rem)] lg:self-start lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * The patient on a clipboard. The top is who they are (number, birth, sex,
 * blood type in large type, then how to reach them); clipped below it, a
 * sheet with what to know before treating them: allergies, alerts, medicines,
 * conditions (`children`). Its edge rises to a clip in the middle. Empty
 * contact fields are left out rather than shown as dashes.
 */
export function PatientClipboard({
  name,
  number,
  facts,
  contacts,
  children,
}: {
  /** The sheet: the clinical summary. */
  children: ReactNode;
  number: string | null;
  /** Who it is, for a page whose header scrolls away while this stays (beside a note). */
  name?: ReactNode;
  /** Large label/value pairs: born, sex, blood type. */
  facts: { label: string; value: ReactNode }[];
  /** How to reach them, under the facts; null values are skipped. */
  contacts: { label: string; value: ReactNode; detail?: string | null }[];
}) {
  const shown = contacts.filter((c) => c.value);
  return (
    <section aria-label="Patient details" className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface-muted">
      <div className="px-5 pt-4 pb-6">
        {name ? <p className="mb-1 truncate text-sm font-semibold">{name}</p> : null}
        {number ? <p className="nums text-xs font-semibold tracking-wide text-accent-ink">{number}</p> : null}
        <dl className="mt-3 grid grid-cols-[1.4fr_1fr_1fr] gap-x-3">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-xs text-ink-faint">{f.label}</dt>
              <dd className="mt-0.5 font-display text-base leading-6 font-semibold">{f.value}</dd>
            </div>
          ))}
        </dl>
        {shown.length > 0 ? (
          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border pt-3.5">
            {shown.map((c) => (
              <div key={c.label} className="min-w-0">
                <dt className="text-xs text-ink-faint">{c.label}</dt>
                <dd className="truncate text-sm leading-6">
                  {c.value}
                  {c.detail ? <span className="block truncate text-xs text-ink-faint">{c.detail}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <div className="relative flex-1 rounded-t-xl bg-surface px-5 pt-5 pb-4">
          {/* The clip: a tab rising from the sheet's edge, curved into it at both shoulders. */}
          <span aria-hidden className="absolute -top-3 left-1/2 h-3.5 w-20 -translate-x-1/2 rounded-t-lg bg-surface">
            <span className="absolute top-1.5 left-1/2 h-1 w-7 -translate-x-1/2 rounded-full bg-border-strong" />
            <span className="absolute bottom-0 -left-2 size-2 bg-[radial-gradient(circle_at_0_0,transparent_0.5rem,var(--surface)_0.5rem)]" />
            <span className="absolute -right-2 bottom-0 size-2 bg-[radial-gradient(circle_at_100%_0,transparent_0.5rem,var(--surface)_0.5rem)]" />
          </span>
          <div className="space-y-4">{children}</div>
      </div>
    </section>
  );
}
