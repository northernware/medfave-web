"use client";

import { useState } from "react";
import {
  EXAM_GRIDS,
  EXAM_SYSTEMS,
  gridToText,
  isNormalFinding,
  normalGrid,
  parseExam,
  serializeExam,
  textToGrid,
  type ExamFindings,
} from "@/lib/exam";

const box = "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint";

/**
 * The physical examination by body system (lib/exam.ts). Each system is one
 * line until it's examined: "Normal" fills in its standard finding (editable),
 * "Findings" opens an empty box. Systems not examined stay out of the note.
 * The common ones for a routine visit show first; the rest are a tap away.
 * The note keeps a line per system in `physicalExamination`, so everything
 * downstream reads it as before. An older note written as free text keeps its
 * text box.
 */
export function ExamField({ name, defaultValue, onEdit }: { name: string; defaultValue: string; onEdit: () => void }) {
  const parsed = parseExam(defaultValue);
  const [findings, setFindings] = useState<ExamFindings>(parsed ?? {});
  const [freeText, setFreeText] = useState(parsed ? null : defaultValue);
  const [showAll, setShowAll] = useState(() => EXAM_SYSTEMS.some((s) => !s.common && parsed?.[s.key]));

  // A free-text exam from before: as it was, with the way to the systems if it's empty.
  if (freeText !== null) {
    return (
      <div className="space-y-2">
        <textarea name={name} rows={4} className={box} value={freeText} onChange={(e) => setFreeText(e.target.value)} />
        <p className="text-xs text-ink-faint">Written before the exam went by system; kept as it was.</p>
      </div>
    );
  }

  const set = (key: string, text: string | undefined) => {
    setFindings((f) => {
      const next = { ...f };
      if (text === undefined) delete next[key];
      else next[key] = text;
      return next;
    });
    onEdit();
  };
  const systems = EXAM_SYSTEMS.filter((s) => showAll || s.common || findings[s.key] !== undefined);
  const hidden = EXAM_SYSTEMS.length - systems.length;

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={serializeExam(findings)} />
      <ul className="divide-y divide-border rounded-lg border border-border">
        {systems.map((s) => {
          const text = findings[s.key];
          const examined = text !== undefined;
          const normal = examined && isNormalFinding(s.key, text);
          return (
            <li key={s.key} className="space-y-2 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {s.label}
                  {examined ? (
                    <span className={`ml-2 text-xs font-normal ${normal ? "text-ink-faint" : "text-warn-ink"}`}>
                      {normal ? "Normal" : "Findings"}
                    </span>
                  ) : null}
                </span>
                {examined ? (
                  <button
                    type="button"
                    onClick={() => set(s.key, undefined)}
                    className="rounded-full px-2.5 py-1 text-xs text-ink-muted hover:bg-surface-muted hover:text-ink"
                  >
                    Not examined
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => set(s.key, s.normal)}
                      className="rounded-full border border-border-strong px-3 py-1 text-xs font-semibold hover:border-accent hover:text-accent-ink"
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      // A grid starts at normal: change only what's different.
                      onClick={() => set(s.key, EXAM_GRIDS[s.key] ? s.normal : "")}
                      className="rounded-full px-3 py-1 text-xs font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink"
                    >
                      Findings
                    </button>
                  </>
                )}
              </div>
              {examined && EXAM_GRIDS[s.key] && textToGrid(s.key, text) ? (
                <GridEditor systemKey={s.key} text={text} onChange={(t) => set(s.key, t)} />
              ) : examined ? (
                <textarea
                  aria-label={`${s.label} findings`}
                  rows={3}
                  autoFocus={text === ""}
                  className={box}
                  value={text}
                  placeholder={`What you found on ${s.label.toLowerCase()} examination`}
                  onChange={(e) => set(s.key, e.target.value)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {hidden > 0 ? (
        <button type="button" onClick={() => setShowAll(true)} className="text-sm font-medium text-accent-ink hover:underline">
          More systems ({hidden}): skin, neck, lymph nodes, breasts, genitalia, rectal, extremities, pulses, musculoskeletal, neurologic, reflexes
        </button>
      ) : null}
    </div>
  );
}

/** Right/left values per site (pulses, reflexes), and a note. Written back as the system's line. */
function GridEditor({ systemKey, text, onChange }: { systemKey: string; text: string; onChange: (text: string) => void }) {
  const grid = EXAM_GRIDS[systemKey];
  const { values, note } = textToGrid(systemKey, text) ?? { values: normalGrid(systemKey), note: "" };
  const put = (site: string, side: 0 | 1, value: string) => {
    const pair: [string, string] = [...(values[site] ?? ["", ""])] as [string, string];
    pair[side] = value;
    onChange(gridToText(systemKey, { ...values, [site]: pair }, note));
  };
  const select = "rounded-md border border-border-strong bg-surface px-2 py-1 text-sm";
  return (
    <div className="space-y-2">
      <table className="text-sm">
        <thead>
          <tr className="text-xs text-ink-faint">
            <th className="pr-4 text-left font-normal" />
            <th className="px-1 font-normal">Right</th>
            <th className="px-1 font-normal">Left</th>
          </tr>
        </thead>
        <tbody>
          {grid.sites.map((site) => (
            <tr key={site.name}>
              <td className="py-0.5 pr-4">{site.name}</td>
              {([0, 1] as const).map((side) => {
                const value = values[site.name]?.[side] ?? "";
                return (
                  <td key={side} className="px-1 py-0.5">
                    <select
                      aria-label={`${site.name}, ${side === 0 ? "right" : "left"}`}
                      value={value}
                      onChange={(e) => put(site.name, side, e.target.value)}
                      className={`${select} ${value && value !== site.normal ? "font-semibold text-warn-ink" : ""}`}
                    >
                      <option value="">—</option>
                      {site.scale.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <input
        aria-label={`${systemKey} note`}
        placeholder="Note (optional)"
        defaultValue={note}
        onChange={(e) => onChange(gridToText(systemKey, values, e.target.value))}
        className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
      />
    </div>
  );
}
