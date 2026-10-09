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
    normal:
      "Normocephalic, atraumatic. Pupils equal, round, reactive to light. Conjunctivae pink, sclerae anicteric. Ear canals clear, tympanic membranes intact. Nasal mucosa pink. Oral mucosa moist; pharynx without exudates.",
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
  {
    key: "pulses",
    label: "Peripheral pulses",
    normal: "Radial, femoral, popliteal, dorsalis pedis and posterior tibial 2+ and equal bilaterally.",
  },
  { key: "msk", label: "Musculoskeletal", normal: "No joint deformity or swelling. Full range of motion." },
  {
    key: "neuro",
    label: "Neurologic",
    normal: "Alert and oriented to person, place and time. Cranial nerves II–XII intact. Strength 5/5 throughout. Sensation intact. Gait steady.",
  },
  {
    key: "reflexes",
    label: "Reflexes",
    normal: "Biceps, triceps, brachioradialis, patellar and Achilles 2+ and symmetric. Plantar responses flexor.",
  },
];

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
