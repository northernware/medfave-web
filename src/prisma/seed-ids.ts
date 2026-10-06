import { createHash } from "node:crypto";

/*
 * Ids for demo rows that look like any other id in a URL, yet a seed can find
 * and replace its own on a rerun: the first block is a fixed marker for that
 * seed, the rest comes from the row's name, so a rerun makes the same id.
 */

/** "d0c70000-…": the doctor showcase. "5a7e0000-…": the patient showcase. "5ce00000-…": scenarios. */
export const MARK = { doctor: "d0c70000", patient: "5a7e0000", scenario: "5ce00000" } as const;

export function seedId(mark: string, name: string) {
  const h = createHash("sha1").update(name).digest("hex");
  return `${mark}-${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}-${h.slice(12, 24)}`;
}
