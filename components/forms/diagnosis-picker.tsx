"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TextInput } from "@/components/form";
import type { DiagnosisHit } from "@/app/actions/records";

export type DiagnosisRow = { code: string; title: string };

/**
 * Coded diagnoses for a note, in WHO ICD-11: search by code or words, pick one
 * or more; the first is the primary diagnosis. Sends `dx.present` and the
 * codes in order as `dx.code`; the server looks the titles up itself.
 */
export function DiagnosisPicker({
  initial,
  search,
  credit,
  error,
  onChange,
}: {
  initial: DiagnosisRow[];
  search: (q: string) => Promise<DiagnosisHit[]>;
  credit: string;
  error?: string[];
  /** Tells the form something changed, for autosave: hidden inputs don't fire input events. */
  onChange: () => void;
}) {
  const id = useId();
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<DiagnosisHit[]>([]);
  const [active, setActive] = useState(0);
  const latest = useRef(0);

  // Debounced: a request per pause in typing, and only the newest answer is shown.
  useEffect(() => {
    const query = q.trim();
    const call = ++latest.current;
    if (query.length < 2) return;
    const timer = setTimeout(async () => {
      const found = await search(query);
      if (call === latest.current) {
        setHits(found);
        setActive(0);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [q, search]);

  function change(next: DiagnosisRow[]) {
    setRows(next);
    onChange();
  }

  function pick(hit: DiagnosisHit) {
    if (!rows.some((r) => r.code === hit.code)) change([...rows, { code: hit.code, title: hit.title }]);
    setQ("");
    setHits([]);
  }

  // Too short a query shows nothing, whatever the last answer was.
  const shown = q.trim().length < 2 ? [] : hits.filter((h) => !rows.some((r) => r.code === h.code));

  return (
    <div className="space-y-2">
      <input type="hidden" name="dx.present" value="1" />
      {rows.map((r) => (
        <input key={r.code} type="hidden" name="dx.code" value={r.code} />
      ))}

      {rows.length > 0 ? (
        <ol className="divide-y divide-border rounded-xl border border-border">
          {rows.map((r, i) => (
            <li key={r.code} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-16 shrink-0 font-mono text-xs font-semibold">{r.code}</span>
              <span className="min-w-0 flex-1">
                {r.title}
                {i === 0 ? <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-ink">Primary</span> : null}
              </span>
              {i > 0 ? (
                <button type="button" className="text-xs font-medium text-ink-muted hover:text-ink" onClick={() => change([r, ...rows.filter((x) => x.code !== r.code)])}>
                  Make primary
                </button>
              ) : null}
              <button
                type="button"
                aria-label={`Remove ${r.code} ${r.title}`}
                className="text-xs font-medium text-ink-muted hover:text-danger-ink"
                onClick={() => change(rows.filter((x) => x.code !== r.code))}
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="relative">
        <TextInput
          id={id}
          role="combobox"
          aria-expanded={shown.length > 0}
          aria-controls={`${id}-list`}
          aria-label="Search ICD-11 by code or words"
          aria-invalid={Boolean(error) || undefined}
          placeholder={rows.length ? "Add another diagnosis" : "Search ICD-11: a code (CA23) or words (asthma)"}
          value={q}
          autoComplete="off"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (!shown.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, shown.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              // Picks rather than submitting the note.
              e.preventDefault();
              pick(shown[active]);
            } else if (e.key === "Escape") {
              setHits([]);
            }
          }}
        />
        {shown.length > 0 ? (
          <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-surface shadow-lg">
            {shown.map((h, i) => (
              <li
                key={h.code}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(h);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer gap-3 px-3 py-2 text-sm ${i === active ? "bg-surface-muted" : ""}`}
              >
                <span className="w-16 shrink-0 font-mono text-xs font-semibold">{h.code}</span>
                <span className="min-w-0 flex-1">{h.title}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {error?.[0] ? <p className="text-sm text-danger-ink">{error[0]}</p> : null}
      <p className="text-xs text-ink-faint">The first is the primary diagnosis. {credit}</p>
    </div>
  );
}
