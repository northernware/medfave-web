import type { DocumentRequestStatus, DocumentType } from "@/lib/enums";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  // The everyday one first: a clinic writes these daily (sick leave, fit to work).
  OUTPATIENT_CERTIFICATE: "Medical certificate",
  MEDICAL_CERTIFICATE: "Certificate of confinement",
  MEDICAL_ABSTRACT: "Medical abstract",
  MEDICO_LEGAL_CERTIFICATE: "Medico-legal certificate",
  INSURANCE_CLAIM: "Insurance claim form",
  RECORD_COPIES: "Copies of records",
};

/** What each is for, in the words a person at the records desk would use. */
export const DOCUMENT_TYPE_BLURBS: Record<DocumentType, string> = {
  OUTPATIENT_CERTIFICATE:
    "Certifies that the patient was seen, for what, and the rest advised: sick leave, fit to work or school, clearance. Written from the visit.",
  MEDICAL_CERTIFICATE:
    "Certifies a period of confinement and the diagnosis it was for. For inpatients only — an outpatient visit is certified on the visit's own record.",
  MEDICAL_ABSTRACT:
    "A summary of an admission: why they came, what was found, what was done, and how they left. Usually for a specialist taking over care.",
  MEDICO_LEGAL_CERTIFICATE:
    "Describes injuries and their probable healing time, for a case. States what was observed and no more than that.",
  INSURANCE_CLAIM:
    "The clinical part of an insurer's claim form — diagnosis, dates of treatment, and charges.",
  RECORD_COPIES:
    "Copies of the chart itself, released to the patient or to somebody they have authorised.",
};

/** Shown next to the type where it carries a restriction worth stating twice. */
export const DOCUMENT_TYPE_RESTRICTIONS: Partial<Record<DocumentType, string>> = {
  MEDICAL_CERTIFICATE: "Inpatients only",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentRequestStatus, string> = {
  REQUESTED: "Requested",
  READY: "Ready to collect",
  RELEASED: "Released",
  DECLINED: "Declined",
};

export const DOCUMENT_STATUS_TONE: Record<
  DocumentRequestStatus,
  "accent" | "ok" | "neutral" | "warn"
> = {
  REQUESTED: "warn",
  READY: "accent",
  RELEASED: "ok",
  DECLINED: "neutral",
};

/**
 * Where a request can go from where it is.
 *
 * The same shape as a visit's own flow, and for the same reason: a document
 * that has been handed over cannot go back to being unprepared, and one that
 * was refused is refused until somebody starts again.
 */
export const DOCUMENT_TRANSITIONS: Record<DocumentRequestStatus, DocumentRequestStatus[]> = {
  REQUESTED: ["READY", "DECLINED"],
  READY: ["RELEASED", "DECLINED"],
  RELEASED: [],
  DECLINED: ["REQUESTED"],
};

export const DOCUMENT_ACTION_LABELS: Record<DocumentRequestStatus, string> = {
  REQUESTED: "Reopen request",
  READY: "Mark ready",
  RELEASED: "Record release",
  DECLINED: "Decline",
};

// --- the fields each document needs -----------------------------------------

export type DetailField = {
  name: string;
  label: string;
  kind: "text" | "textarea" | "date" | "datetime" | "number";
  hint?: string;
  required?: boolean;
  /** Rendered across the full width of the form grid. */
  wide?: boolean;
};

/**
 * What each document has to say that the chart does not already say.
 *
 * The form renders these, the action validates against them, and the template
 * reads them back — so a new document type is one entry here plus a template,
 * rather than a new column, a new form and a new validator.
 */
export const DOCUMENT_FIELDS: Record<DocumentType, DetailField[]> = {
  OUTPATIENT_CERTIFICATE: [
    { name: "seenOn", label: "Seen on", kind: "date", required: true },
    { name: "diagnosis", label: "Diagnosis", kind: "text", required: true, wide: true },
    { name: "restFrom", label: "Advised rest from", kind: "date" },
    { name: "restTo", label: "Advised rest to", kind: "date" },
    {
      name: "fitOn",
      label: "Fit to return on",
      kind: "date",
      hint: "To work, school or usual activity.",
    },
    { name: "remarks", label: "Remarks", kind: "textarea", wide: true },
  ],
  MEDICAL_CERTIFICATE: [
    { name: "admittedOn", label: "Admitted on", kind: "date", required: true },
    { name: "dischargedOn", label: "Discharged on", kind: "date", required: true },
    { name: "diagnosis", label: "Diagnosis", kind: "text", required: true, wide: true },
    { name: "restFrom", label: "Advised rest from", kind: "date" },
    { name: "restTo", label: "Advised rest to", kind: "date" },
    { name: "remarks", label: "Remarks", kind: "textarea", wide: true },
  ],
  MEDICAL_ABSTRACT: [
    { name: "admittedOn", label: "Admitted on", kind: "date", required: true },
    { name: "dischargedOn", label: "Discharged on", kind: "date", required: true },
    { name: "chiefComplaint", label: "Chief complaint", kind: "text", required: true, wide: true },
    {
      name: "historyAndFindings",
      label: "History and findings on admission",
      kind: "textarea",
      required: true,
      wide: true,
    },
    { name: "courseInWard", label: "Course in the ward", kind: "textarea", wide: true },
    { name: "finalDiagnosis", label: "Final diagnosis", kind: "text", required: true, wide: true },
    { name: "treatment", label: "Treatment given", kind: "textarea", wide: true },
    { name: "conditionOnDischarge", label: "Condition on discharge", kind: "text", wide: true },
  ],
  MEDICO_LEGAL_CERTIFICATE: [
    { name: "incidentAt", label: "Date and time of incident", kind: "datetime", required: true },
    { name: "examinedAt", label: "Date and time examined", kind: "datetime", required: true },
    { name: "incidentPlace", label: "Place of incident", kind: "text", wide: true },
    {
      name: "allegedCause",
      label: "Alleged cause",
      kind: "text",
      required: true,
      wide: true,
      hint: "As reported by the patient. This is what was said, not a finding.",
    },
    {
      name: "findings",
      label: "Findings on examination",
      kind: "textarea",
      required: true,
      wide: true,
      hint: "Describe what was observed. Nothing here should attribute a cause.",
    },
    {
      name: "healingPeriod",
      label: "Probable healing period",
      kind: "text",
      required: true,
      hint: 'Conventionally given as "barring complications, N days".',
    },
    { name: "disposition", label: "Disposition", kind: "text" },
  ],
  INSURANCE_CLAIM: [
    { name: "insurer", label: "Insurer", kind: "text", required: true },
    { name: "policyNumber", label: "Policy number", kind: "text", required: true },
    { name: "memberNumber", label: "Member or card number", kind: "text" },
    { name: "claimType", label: "Claim type", kind: "text", hint: "Outpatient, inpatient, reimbursement…" },
    { name: "diagnosis", label: "Diagnosis", kind: "text", required: true, wide: true },
    { name: "icdCode", label: "ICD-10 code", kind: "text" },
    { name: "treatmentFrom", label: "Treatment from", kind: "date", required: true },
    { name: "treatmentTo", label: "Treatment to", kind: "date" },
    { name: "totalCharges", label: "Total charges (₱)", kind: "number" },
  ],
  RECORD_COPIES: [
    { name: "coveringFrom", label: "Records from", kind: "date", required: true },
    { name: "coveringTo", label: "Records to", kind: "date", required: true },
    {
      name: "items",
      label: "What is being copied",
      kind: "textarea",
      required: true,
      wide: true,
      hint: "Consultation notes, laboratory results, prescriptions…",
    },
    { name: "pageCount", label: "Number of pages", kind: "number" },
    {
      name: "authorisedBy",
      label: "Release authorised by",
      kind: "text",
      hint: "The patient, or whoever may consent on their behalf.",
    },
    { name: "deliveryMethod", label: "Collected or sent how", kind: "text" },
  ],
};

export type DocumentDetails = Record<string, string>;

/** Reads stored details back, tolerating a row written under an older shape. */
export function parseDetails(json: string | null): DocumentDetails {
  if (!json) return {};
  try {
    const value = JSON.parse(json) as unknown;
    if (typeof value !== "object" || value === null) return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]),
    );
  } catch {
    return {};
  }
}

/** The document types, in the order the records desk lists them. */
export const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[];

const MAX_DETAIL = 4000;

/**
 * Checks details sent as an object (the app's JSON) against the fields the type
 * declares, and keeps only those: the same rules the web form's action applies.
 * `partial` skips required fields, for a draft still being written.
 */
export function checkDetails(
  type: DocumentType,
  input: unknown,
  partial = false,
): { details: DocumentDetails } | { fieldErrors: Record<string, string[]> } {
  const given = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const details: DocumentDetails = {};
  const fieldErrors: Record<string, string[]> = {};
  for (const field of DOCUMENT_FIELDS[type]) {
    const raw = String(given[field.name] ?? "").trim();
    if (!raw) {
      if (field.required && !partial) fieldErrors[field.name] = [`${field.label} is required`];
      continue;
    }
    if (raw.length > MAX_DETAIL) fieldErrors[field.name] = [`Keep ${field.label.toLowerCase()} under ${MAX_DETAIL} characters`];
    else if (field.kind === "number" && Number.isNaN(Number(raw))) fieldErrors[field.name] = [`${field.label} must be a number`];
    else details[field.name] = raw;
  }
  return Object.keys(fieldErrors).length ? { fieldErrors } : { details };
}
