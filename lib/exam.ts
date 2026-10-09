/**
 * The physical examination by body system, as a doctor writes it up (Bates'
 * Guide order): general survey down to neurologic. Kept in the note's one
 * `physicalExamination` text as a line per system, "HEENT: …", so versions,
 * the API and the app read it as they always have; `parseExam` splits it back
 * into systems for the form. A note written as free text before this stays
 * free text (`parseExam` returns null).
 *
 * Each system has a standard normal finding, which "Normal" fills in and the
 * doctor can edit. Pure, no imports: shared by the form and the pages.
 */

/**
 * Systems recorded as a right/left grid rather than prose: pulses (0–4+) and
 * reflexes (0–4+, plantar ↓ flexor / ↑ extensor). Written on their line as
 * "Radial 2+/2+; Femoral 2+/2+" (right/left), then " — " and any note.
 */
export type ExamGrid = { sites: { name: string; scale: string[]; normal: string }[] };
const GRADES = ["0", "1+", "2+", "3+", "4+"];
export const EXAM_GRIDS: Record<string, ExamGrid> = {
  pulses: {
    sites: ["Radial", "Femoral", "Popliteal", "Dorsalis pedis", "Posterior tibial"].map((name) => ({ name, scale: GRADES, normal: "2+" })),
  },
  reflexes: {
    sites: [
      ...["Biceps", "Triceps", "Brachioradialis", "Patellar", "Achilles"].map((name) => ({ name, scale: GRADES, normal: "2+" })),
      { name: "Plantar", scale: ["↓", "↑", "—"], normal: "↓" },
    ],
  },
};

/** A grid's values by site, [right, left]. */
export type GridValues = Record<string, [string, string]>;

export function gridToText(key: string, values: GridValues, note = "") {
  const grid = EXAM_GRIDS[key];
  const cells = grid.sites
    .filter((s) => values[s.name]?.[0] || values[s.name]?.[1])
    .map((s) => `${s.name} ${values[s.name][0] || "—"}/${values[s.name][1] || "—"}`)
    .join("; ");
  return [cells, note.trim()].filter(Boolean).join(" — ");
}

/** A grid line read back; null if it isn't one (typed as prose). */
export function textToGrid(key: string, text: string): { values: GridValues; note: string } | null {
  const grid = EXAM_GRIDS[key];
  if (!grid) return null;
  const [cells, ...rest] = text.split(" — ");
  const values: GridValues = {};
  for (const cell of cells.split(";").map((c) => c.trim()).filter(Boolean)) {
    const site = grid.sites.find((s) => cell.startsWith(`${s.name} `));
    const m = site && cell.slice(site.name.length + 1).match(/^(\S+)\/(\S+)$/);
    if (!site || !m) return null;
    values[site.name] = [m[1] === "—" ? "" : m[1], m[2] === "—" ? "" : m[2]];
  }
  return { values, note: rest.join(" — ") };
}

/** Every site at its normal, both sides. */
export function normalGrid(key: string): GridValues {
  return Object.fromEntries(EXAM_GRIDS[key].sites.map((s) => [s.name, [s.normal, s.normal]]));
}

/**
 * Systems examined in parts, each with its own normal: HEENT and neurologic,
 * as the doctor's sample writes them. On the system's line as "Head: …
 * Eyes: …", parts not examined left out.
 */
export const EXAM_PARTS: Record<string, { name: string; normal: string }[]> = {
  heent: [
    { name: "Head", normal: "Normocephalic, atraumatic." },
    { name: "Eyes", normal: "Pupils equal, round, reactive to light. Conjunctivae pink, sclerae anicteric." },
    { name: "Ears", normal: "Canals clear, tympanic membranes intact." },
    { name: "Nose", normal: "Mucosa pink, septum midline." },
    { name: "Mouth and throat", normal: "Oral mucosa moist; pharynx without exudates." },
  ],
  neuro: [
    { name: "Mental status", normal: "Alert and oriented to person, place and time." },
    { name: "Cranial nerves", normal: "II–XII intact." },
    { name: "Motor and strength", normal: "Normal bulk and tone. Strength 5/5 throughout." },
    { name: "Cerebellar", normal: "Point-to-point movements intact. Gait steady." },
    { name: "Sensory", normal: "Light touch, pinprick and position sense intact." },
  ],
};

/** A parts system's findings by part name; parts not examined absent. */
export type PartValues = Record<string, string>;

export function partsToText(key: string, values: PartValues) {
  return EXAM_PARTS[key]
    .filter((p) => values[p.name]?.trim())
    .map((p) => `${p.name}: ${values[p.name].trim().replace(/\s*\n+\s*/g, " ")}`)
    .join(" ");
}

/** A parts system's line read back by part; null if it isn't written in parts. */
export function textToParts(key: string, text: string): PartValues | null {
  const parts = EXAM_PARTS[key];
  if (!parts || !text.trim()) return parts ? {} : null;
  const names = parts.map((p) => p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const found = [...text.matchAll(new RegExp(`(?:^|\\s)(${names}): `, "g"))];
  if (!found.length || text.slice(0, found[0].index).trim()) return null;
  const values: PartValues = {};
  found.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < found.length ? found[i + 1].index! : text.length;
    values[m[1]] = text.slice(start, end).trim();
  });
  return values;
}

/** Every part at its normal. */
export function normalParts(key: string): PartValues {
  return Object.fromEntries(EXAM_PARTS[key].map((p) => [p.name, p.normal]));
}

export type ExamSystem = {
  key: string;
  label: string;
  /** What "Normal" fills in. A draft for the doctor to check. */
  normal: string;
  /** Shown first for a routine visit; the rest are under "More systems". */
  common?: boolean;
};

export const EXAM_SYSTEMS: ExamSystem[] = [
  { key: "general", label: "General survey", common: true, normal: "Alert, well-appearing, in no acute distress." },
  { key: "skin", label: "Skin", normal: "Warm and dry. No rashes or lesions. Nails without clubbing or cyanosis." },
  {
    key: "heent",
    label: "HEENT",
    common: true,
    normal: "",
  },
  { key: "neck", label: "Neck", normal: "Supple. Trachea midline. Thyroid not enlarged." },
  { key: "nodes", label: "Lymph nodes", normal: "No cervical, axillary or inguinal lymphadenopathy." },
  {
    key: "lungs",
    label: "Thorax and lungs",
    common: true,
    normal: "Symmetric expansion. Resonant to percussion. Vesicular breath sounds; no crackles or wheezes.",
  },
  {
    key: "cardio",
    label: "Cardiovascular",
    common: true,
    normal: "Regular rate and rhythm. Normal S1 and S2. No murmurs, rubs or gallops.",
  },
  { key: "breasts", label: "Breasts", normal: "Symmetric. No masses or nipple discharge." },
  {
    key: "abdomen",
    label: "Abdomen",
    common: true,
    normal: "Soft, non-tender, non-distended. Bowel sounds active. No masses or organomegaly.",
  },
  { key: "genitalia", label: "Genitalia", normal: "External genitalia without lesions." },
  { key: "rectal", label: "Rectal", normal: "No external lesions. Normal sphincter tone. No masses." },
  { key: "extremities", label: "Extremities", normal: "Warm, no edema. Calves supple, non-tender." },
  { key: "pulses", label: "Peripheral pulses", normal: "" },
  { key: "msk", label: "Musculoskeletal", normal: "No joint deformity or swelling. Full range of motion." },
  {
    key: "neuro",
    label: "Neurologic",
    normal: "",
  },
  { key: "reflexes", label: "Reflexes", normal: "" },
];
// A grid system's normal is its grid at normal.
for (const s of EXAM_SYSTEMS) if (EXAM_GRIDS[s.key]) s.normal = gridToText(s.key, normalGrid(s.key));
// A parts system's normal is every part at normal.
for (const s of EXAM_SYSTEMS) if (EXAM_PARTS[s.key]) s.normal = partsToText(s.key, normalParts(s.key));

const BY_LABEL = new Map(EXAM_SYSTEMS.map((s) => [s.label.toLowerCase(), s]));

/** Findings by system key; systems not examined are absent. */
export type ExamFindings = Record<string, string>;

/** One line per examined system, in the exam's order. */
export function serializeExam(findings: ExamFindings): string {
  return EXAM_SYSTEMS.filter((s) => findings[s.key]?.trim())
    .map((s) => `${s.label}: ${findings[s.key].trim().replace(/\s*\n+\s*/g, " ")}`)
    .join("\n");
}

/**
 * The systems in a note's exam text, or null if it isn't written by system
 * (an older free-text exam). Empty text is an exam with nothing recorded.
 */
export function parseExam(text: string | null | undefined): ExamFindings | null {
  const lines = String(text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const findings: ExamFindings = {};
  for (const line of lines) {
    const at = line.indexOf(":");
    const system = at > 0 ? BY_LABEL.get(line.slice(0, at).trim().toLowerCase()) : undefined;
    if (!system) return null;
    findings[system.key] = line.slice(at + 1).trim();
  }
  return findings;
}

/** Whether a finding is the system's standard normal, untouched. */
export function isNormalFinding(key: string, text: string) {
  const system = EXAM_SYSTEMS.find((s) => s.key === key);
  return !!system && text.trim() === system.normal;
}
