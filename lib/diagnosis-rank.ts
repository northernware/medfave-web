/*
 * Ordering ICD-11 search results, apart from the database so it can be tested.
 * A doctor types either a code ("CA23") or words ("asthma unspec"); the best
 * match comes first.
 */

export type CodeHit = { code: string; title: string; leaf: boolean };

/** Escapes LIKE's wildcards in what the doctor typed. */
export const likeSafe = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The words of a query, lower-cased, for matching titles. */
export const queryWords = (q: string) => q.toLowerCase().split(/[^\p{L}\p{N}.]+/u).filter((w) => w.length > 1);

/** Looks like the start of a code: a digit or letter, a letter or digit, and so on ("CA2", "1A00", "BA00.Z"). */
export const looksLikeCode = (q: string) => /^[0-9A-Z][0-9A-Z]{0,3}(\.[0-9A-Z]{0,2})?$/i.test(q.trim());

/**
 * Best first: the exact code, then codes starting with the query, then the
 * exact title, then titles starting with it, then titles containing every
 * word. Within each, the more specific choice (a leaf) first, then the
 * shorter title, then the code.
 */
export function rankHits<T extends CodeHit>(hits: T[], q: string): T[] {
  const query = q.trim().toLowerCase();
  const tier = (h: T) => {
    const code = h.code.toLowerCase();
    const title = h.title.toLowerCase();
    if (code === query) return 0;
    if (code.startsWith(query)) return 1;
    if (title === query) return 2;
    if (title.startsWith(query)) return 3;
    return 4;
  };
  const unique = [...new Map(hits.map((h) => [h.code, h])).values()];
  return unique.sort(
    (a, b) =>
      tier(a) - tier(b) ||
      Number(b.leaf) - Number(a.leaf) ||
      a.title.length - b.title.length ||
      a.code.localeCompare(b.code),
  );
}
