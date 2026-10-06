import "server-only";
import { and, or } from "@prisma/orm-postgres/orm-client";
import { newId } from "@/lib/ids";
import { instantToDb } from "@/lib/datetime";
import { likeSafe, looksLikeCode, queryWords, rankHits, synonymCodes } from "@/lib/diagnosis-rank";
import type { FormState } from "@/lib/validation";
import { orm } from "@/src/prisma/db";

/*
 * Coded diagnoses on visit notes, in WHO ICD-11 (MMS). The list is loaded by
 * `npm run icd11:import`. ICD-11 is © World Health Organization, used under
 * CC BY-ND 3.0 IGO: codes and titles exactly as published, with their URIs,
 * and WHO credited wherever the list is shown (`ICD11_CREDIT`).
 */

export const ICD11 = "ICD-11";
export const ICD11_CREDIT = "ICD-11 MMS © World Health Organization, CC BY-ND 3.0 IGO";
export const MAX_DIAGNOSES = 12;

/**
 * Chapters a diagnosis is never picked from: X holds extension codes, which
 * only qualify another code (a virus, a severity, a body site), and 26 is the
 * supplementary chapter on traditional medicine conditions.
 */
const NOT_DIAGNOSES = ["X", "26"];

export type Diagnosis = { system: string; code: string; title: string; uri: string };

/** Up to `limit` codes for what the doctor typed: a code, or words from the title. */
export async function searchIcd11(q: string, limit = 20): Promise<(Diagnosis & { leaf: boolean })[]> {
  const query = q.trim().slice(0, 80);
  if (query.length < 2) return [];
  const words = queryWords(query);

  const named = synonymCodes(query);
  const [byName, byCode, byTitle] = await Promise.all([
    named.length
      ? orm.Icd11Code.select("code", "title", "uri", "leaf").where((c) => c.code.in(named)).all()
      : Promise.resolve([]),
    looksLikeCode(query)
      ? orm.Icd11Code.select("code", "title", "uri", "leaf")
          .where((c) => c.code.ilike(`${likeSafe(query)}%`))
          .where((c) => c.chapter.notIn(NOT_DIAGNOSES))
          .orderBy((c) => c.code.asc())
          .limit(limit)
          .all()
      : Promise.resolve([]),
    words.length
      ? orm.Icd11Code.select("code", "title", "uri", "leaf")
          // Each word starts a word of the title (or a code): "uti" isn't found in "cutis".
          .where((c) =>
            and(
              ...words.map((w) => {
                const x = likeSafe(w);
                return or(c.title.ilike(`${x}%`), c.title.ilike(`% ${x}%`), c.title.ilike(`%-${x}%`), c.title.ilike(`%(${x}%`), c.code.ilike(`${x}%`));
              }),
            ),
          )
          .where((c) => c.chapter.notIn(NOT_DIAGNOSES))
          .limit(200)
          .all()
      : Promise.resolve([]),
  ]);

  return rankHits([...byName, ...byCode, ...byTitle], query)
    .slice(0, limit)
    .map((c) => ({ system: ICD11, code: c.code, title: c.title, uri: c.uri, leaf: c.leaf }));
}

/**
 * The note's diagnoses from the form: codes in the doctor's order, repeated
 * `dx.code` fields. Titles and URIs are looked up, never taken from the form,
 * so what's saved is exactly what WHO publishes.
 *
 * Only a form that says it carries diagnoses (`dx.present`) replaces them:
 * an older app that knows nothing of diagnoses must not wipe the ones set on
 * the web. `keep` means leave them as they are.
 */
export async function readDiagnoses(formData: FormData): Promise<{ rows: Diagnosis[]; ongoing: string[]; keep?: boolean; error?: FormState }> {
  // Codes the doctor marked "Ongoing condition": they join the chart when the note is signed.
  const ongoing = formData.getAll("dx.ongoing").map((c) => String(c).trim().toUpperCase()).filter(Boolean);
  if (!formData.has("dx.present")) return { rows: [], ongoing: [], keep: true };
  const codes = [...new Set(formData.getAll("dx.code").map((c) => String(c).trim().toUpperCase()).filter(Boolean))];
  if (codes.length === 0) return { rows: [], ongoing: [] };
  if (codes.length > MAX_DIAGNOSES) {
    return { rows: [], ongoing: [], error: { message: `Keep it to ${MAX_DIAGNOSES} diagnoses.`, fieldErrors: { diagnoses: ["Too many"] } } };
  }
  const found = await orm.Icd11Code.select("code", "title", "uri")
    .where((c) => c.code.in(codes))
    .where((c) => c.chapter.notIn(NOT_DIAGNOSES))
    .all();
  const byCode = new Map(found.map((c) => [c.code, c]));
  const missing = codes.filter((c) => !byCode.has(c));
  if (missing.length) {
    return {
      rows: [],
      ongoing: [],
      error: { message: `Not an ICD-11 code: ${missing.join(", ")}. Pick it from the search.`, fieldErrors: { diagnoses: ["Unknown code"] } },
    };
  }
  return { rows: codes.map((c) => ({ system: ICD11, ...byCode.get(c)! })), ongoing: ongoing.filter((c) => byCode.has(c)) };
}

/** A transaction's ORM, or the plain one. */
type T = typeof orm;

/** Writes a note's diagnoses after its old ones were cleared, in order: position 0 is primary. */
export async function writeDiagnoses(t: T, medicalRecordId: string, rows: Diagnosis[]) {
  const now = instantToDb(new Date());
  for (const [position, d] of rows.entries()) {
    await t.VisitDiagnosis.create({ ...d, id: newId(), medicalRecordId, position, createdAt: now });
  }
}
