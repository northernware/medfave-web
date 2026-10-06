/*
 * Ordering ICD-11 search results, apart from the database so it can be tested.
 * A doctor types either a code ("CA23") or words ("asthma unspec"); the best
 * match comes first.
 */

export type CodeHit = { code: string; title: string; leaf: boolean };

/**
 * Diagnoses a family practice makes most, ranked first among equal matches.
 * Medfave's own search aid, not part of the classification.
 */
export const COMMON = new Set([
  "BA00", "5A11", "5A10", "CA23", "CA40", "1D2Z", "CA07", "CA02", "1A40", "MD12", "MG26", "8A80", "8A81",
  "CA20", "GC08", "EA80", "5B81", "1B10", "9A60", "ME84", "MD81", "DA63", "6A70", "6B00", "BD10",
]);

/**
 * Words doctors and patients use that aren't in WHO's titles, pointing to the
 * code they mean. Our own search aid: the codes and their titles come from
 * the classification unchanged.
 */
export const SYNONYMS: Record<string, string[]> = {
  "high blood pressure": ["BA00"],
  hbp: ["BA00"],
  htn: ["BA00"],
  dm: ["5A11", "5A10"],
  t2dm: ["5A11"],
  uti: ["GC08"],
  uri: ["CA07"],
  urti: ["CA07"],
  colds: ["CA07"],
  "sore throat": ["CA02"],
  lbm: ["1A40"],
  diarrhea: ["1A40"],
  ptb: ["1B10"],
  tb: ["1B10"],
  "pink eye": ["9A60"],
  "back pain": ["ME84"],
  lbp: ["ME84"],
  "stomach ache": ["MD81"],
};

/** Codes a query names by a word or phrase of its own (see SYNONYMS). */
export const synonymCodes = (q: string) => SYNONYMS[q.trim().toLowerCase()] ?? [];

/** Escapes LIKE's wildcards in what the doctor typed. */
export const likeSafe = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The words of a query, lower-cased, for matching titles. */
export const queryWords = (q: string) => q.toLowerCase().split(/[^\p{L}\p{N}.]+/u).filter((w) => w.length > 1);

/** Looks like the start of a code: a digit or letter, a letter or digit, and so on ("CA2", "1A00", "BA00.Z"). */
export const looksLikeCode = (q: string) => /^[0-9A-Z][0-9A-Z]{0,3}(\.[0-9A-Z]{0,2})?$/i.test(q.trim());

/**
 * Best first: the exact code or a code the query names (SYNONYMS), then codes
 * starting with the query, then the exact title, then titles starting with
 * it, then titles containing every word. Within each, a common diagnosis
 * first, then the more specific choice (a leaf), then the shorter title, then
 * the code.
 */
export function rankHits<T extends CodeHit>(hits: T[], q: string): T[] {
  const query = q.trim().toLowerCase();
  const named = new Set(synonymCodes(q));
  const tier = (h: T) => {
    const code = h.code.toLowerCase();
    const title = h.title.toLowerCase();
    if (code === query || named.has(h.code)) return 0;
    if (code.startsWith(query)) return 1;
    if (title === query) return 2;
    if (title.startsWith(query)) return 3;
    return 4;
  };
  const unique = [...new Map(hits.map((h) => [h.code, h])).values()];
  return unique.sort(
    (a, b) =>
      tier(a) - tier(b) ||
      Number(COMMON.has(b.code)) - Number(COMMON.has(a.code)) ||
      Number(b.leaf) - Number(a.leaf) ||
      a.title.length - b.title.length ||
      a.code.localeCompare(b.code),
  );
}
