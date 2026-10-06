/**
 * The stored shape of one version of a consultation note.
 *
 * A version holds the clinical content and nothing else — not the ids, not the
 * timestamps the row keeps anyway. What it is for is answering "what did this
 * note say at the time", so it carries exactly the fields a reader of the note
 * would have seen.
 *
 * It is written as JSON text rather than a set of columns because it is only
 * ever read back whole. Columns would have to be migrated in step with the
 * record's own, and a version is a photograph: its value is that it does not
 * change when the schema does.
 */
export type RecordSnapshot = {
  visitDate: string;
  chiefComplaint: string;
  historyOfPresentIllness: string | null;
  physicalExamination: string | null;
  temperatureC: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  systolic: number | null;
  diastolic: number | null;
  weightKg: number | null;
  heightCm: number | null;
  oxygenSaturation: number | null;
  assessment: string | null;
  treatmentPlan: string | null;
  followUpDate: string | null;
  notes: string | null;
  prescriptions: {
    drugName: string;
    dosage: string;
    frequency: string;
    duration: string | null;
    instructions: string | null;
  }[];
  /** ICD-11, primary first. Versions written before diagnoses existed have none. */
  diagnoses: { code: string; title: string }[];
};

/** Field order and wording for the history, so a change reads as a sentence. */
const FIELDS: { key: keyof RecordSnapshot; label: string; unit?: string }[] = [
  { key: "visitDate", label: "Visit date" },
  { key: "chiefComplaint", label: "Chief complaint" },
  { key: "historyOfPresentIllness", label: "History of present illness" },
  { key: "physicalExamination", label: "Physical examination" },
  { key: "temperatureC", label: "Temperature", unit: "°C" },
  { key: "heartRate", label: "Pulse", unit: "bpm" },
  { key: "respiratoryRate", label: "Respiratory rate", unit: "/min" },
  { key: "systolic", label: "Systolic", unit: "mmHg" },
  { key: "diastolic", label: "Diastolic", unit: "mmHg" },
  { key: "weightKg", label: "Weight", unit: "kg" },
  { key: "heightCm", label: "Height", unit: "cm" },
  { key: "oxygenSaturation", label: "Oxygen saturation", unit: "%" },
  { key: "assessment", label: "Assessment" },
  { key: "treatmentPlan", label: "Treatment plan" },
  { key: "followUpDate", label: "Follow-up date" },
  { key: "notes", label: "Notes" },
];

export type FieldChange = { label: string; from: string; to: string };

const EMPTY = "—";

function show(value: unknown, unit?: string) {
  if (value === null || value === undefined || value === "") return EMPTY;
  return unit ? `${value} ${unit}` : String(value);
}

/** One line per prescription, so a changed list can be compared as text. */
function prescriptionLines(snapshot: RecordSnapshot) {
  return snapshot.prescriptions.map((rx) =>
    [rx.drugName, rx.dosage, rx.frequency, rx.duration, rx.instructions]
      .filter(Boolean)
      .join(" · "),
  );
}

/**
 * What changed between two versions, in the order a note is read.
 *
 * Only differences are returned. A history that listed every field on every
 * amendment would bury the one line that actually moved, which is the only
 * thing anyone opens the history to find.
 */
export function changesBetween(before: RecordSnapshot, after: RecordSnapshot): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const field of FIELDS) {
    const from = before[field.key];
    const to = after[field.key];
    if (from === to) continue;
    changes.push({
      label: field.label,
      from: show(from, field.unit),
      to: show(to, field.unit),
    });
  }

  // Prescriptions are compared as a whole list: "amoxicillin was replaced by
  // co-amoxiclav" is one change to a reader, not a removal and an addition.
  const wasRx = prescriptionLines(before);
  const nowRx = prescriptionLines(after);
  if (wasRx.join("\n") !== nowRx.join("\n")) {
    changes.push({
      label: "Prescriptions",
      from: wasRx.length > 0 ? wasRx.join("; ") : EMPTY,
      to: nowRx.length > 0 ? nowRx.join("; ") : EMPTY,
    });
  }

  // Diagnoses, like prescriptions, change as a list: order matters (the first is primary).
  const wasDx = before.diagnoses.map((d) => `${d.code} ${d.title}`);
  const nowDx = after.diagnoses.map((d) => `${d.code} ${d.title}`);
  if (wasDx.join("\n") !== nowDx.join("\n")) {
    changes.push({
      label: "Diagnoses",
      from: wasDx.length > 0 ? wasDx.join("; ") : EMPTY,
      to: nowDx.length > 0 ? nowDx.join("; ") : EMPTY,
    });
  }

  return changes;
}

/** Reads a stored snapshot, tolerating a row written by an older shape. */
export function parseSnapshot(json: string): RecordSnapshot | null {
  try {
    const value = JSON.parse(json) as Partial<RecordSnapshot>;
    if (typeof value !== "object" || value === null) return null;
    return { ...value, prescriptions: value.prescriptions ?? [], diagnoses: value.diagnoses ?? [] } as RecordSnapshot;
  } catch {
    return null;
  }
}
