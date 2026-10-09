"use client";

import { useState } from "react";
import { EXAM_SYSTEMS, isNormalFinding, parseExam, serializeExam, type ExamFindings } from "@/lib/exam";

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
                      onClick={() => set(s.key, "")}
                      className="rounded-full px-3 py-1 text-xs font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink"
                    >
                      Findings
                    </button>
                  </>
                )}
              </div>
              {examined ? (
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
