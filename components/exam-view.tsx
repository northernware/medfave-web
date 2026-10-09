import { EXAM_GRIDS, EXAM_PARTS, EXAM_SYSTEMS, isNormalFinding, parseExam, textToGrid, textToParts } from "@/lib/exam";
import { Prose } from "@/components/ui";

/**
 * A note's physical examination as written: by system (lib/exam.ts), each a
 * label and its finding, the ones that aren't the standard normal in full
 * ink and the normal ones quieter, so what was found stands out. An older
 * free-text exam reads as it was.
 */
export function ExamView({ text }: { text: string | null }) {
  if (!text?.trim()) return null;
  const findings = parseExam(text);
  if (!findings) return <Prose label="Physical examination" text={text} />;
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-muted">Physical examination</h3>
      <dl className="mt-1.5 space-y-1.5">
        {EXAM_SYSTEMS.filter((s) => findings[s.key]).map((s) => {
          const normal = isNormalFinding(s.key, findings[s.key]);
          return (
            <div key={s.key} className="grid gap-x-3 sm:grid-cols-[9rem_1fr]">
              <dt className="text-sm font-medium">{s.label}</dt>
              <dd className={`text-sm leading-6 text-pretty ${normal ? "text-ink-muted" : "text-ink"}`}>
                {EXAM_GRIDS[s.key] && textToGrid(s.key, findings[s.key]) ? (
                  <Grid systemKey={s.key} text={findings[s.key]} />
                ) : EXAM_PARTS[s.key] && textToParts(s.key, findings[s.key]) ? (
                  <Parts systemKey={s.key} text={findings[s.key]} />
                ) : (
                  findings[s.key]
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/** Pulses or reflexes as a right/left table; what isn't normal in full weight. */
function Grid({ systemKey, text }: { systemKey: string; text: string }) {
  const { values, note } = textToGrid(systemKey, text)!;
  const sites = EXAM_GRIDS[systemKey].sites.filter((s) => values[s.name]);
  return (
    <>
      <table className="tabular">
        <thead>
          <tr className="text-xs text-ink-faint">
            <th className="pr-4 text-left font-normal" />
            <th className="px-2 font-normal">R</th>
            <th className="px-2 font-normal">L</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => (
            <tr key={s.name}>
              <td className="pr-4">{s.name}</td>
              {values[s.name].map((v, i) => (
                <td key={i} className={`px-2 text-center ${v && v !== s.normal ? "font-semibold text-ink" : ""}`}>
                  {v || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {note ? <p>{note}</p> : null}
    </>
  );
}

/** HEENT or neurologic by part; what isn't the part's normal in full ink. */
function Parts({ systemKey, text }: { systemKey: string; text: string }) {
  const values = textToParts(systemKey, text)!;
  return (
    <dl className="space-y-0.5">
      {EXAM_PARTS[systemKey]
        .filter((p) => values[p.name])
        .map((p) => (
          <div key={p.name} className={values[p.name] === p.normal ? "text-ink-muted" : "text-ink"}>
            <dt className="inline font-medium">{p.name}: </dt>
            <dd className="inline">{values[p.name]}</dd>
          </div>
        ))}
    </dl>
  );
}
