import type { ClinicalItem } from "@/components/clinical-picker";
import type { RecordStatus } from "@/lib/enums";

/**
 * Shapes and blank values the forms are seeded with. These live outside the
 * `"use client"` form modules because server components build the defaults —
 * a function exported from a client module cannot be called on the server.
 */

export type HouseholdDefaults = {
  name: string;
  address: string;
  contactNumber: string;
  primaryContactId: string;
  notes: string;
};

export const BLANK_HOUSEHOLD: HouseholdDefaults = {
  name: "",
  address: "",
  contactNumber: "",
  primaryContactId: "",
  notes: "",
};

export type PatientDefaults = {
  householdId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  relationship: string;
  bloodType: string;
  allergyStatus: string;
  allergies: ClinicalItem[];
  conditionStatus: string;
  conditions: ClinicalItem[];
  medicationStatus: string;
  medications: ClinicalItem[];
  alerts: ClinicalItem[];
  contactNumber: string;
  email: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactNumber: string;
  emergencyContact2Name: string;
  emergencyContact2Relationship: string;
  emergencyContact2Number: string;
};

export function blankPatient(householdId: string): PatientDefaults {
  return {
    householdId,
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    sex: "",
    relationship: "CHILD",
    bloodType: "UNKNOWN",
    allergyStatus: "UNKNOWN",
    allergies: [],
    conditionStatus: "UNKNOWN",
    conditions: [],
    medicationStatus: "UNKNOWN",
    medications: [],
    alerts: [],
    contactNumber: "",
    email: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactNumber: "",
    emergencyContact2Name: "",
    emergencyContact2Relationship: "",
    emergencyContact2Number: "",
  };
}

export type AppointmentDefaults = {
  patientId: string;
  /** "YYYY-MM-DD" — the picker offers slots for whichever day this names. */
  date: string;
  /** "HH:mm" in clinic time, or "" when nothing is chosen yet. */
  time: string;
  service: string;
  reason: string;
  type: string;
  priority: string;
  status: string;
  source: string;
  reminderPreference: string;
  previousAppointmentId: string;
  room: string;
  notes: string;
  internalNotes: string;
};

export type PatientOption = { id: string; label: string; householdName: string };

/** Past visits a booking can be marked as following on from, keyed by patient. */
export type FollowUpOptions = Record<string, { id: string; label: string }[]>;

/** Minutes-from-midnight intervals already taken, keyed by "YYYY-MM-DD". */
export type BusyByDay = Record<string, { start: number; end: number }[]>;

export type PrescriptionRow = {
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
};

export const BLANK_PRESCRIPTION: PrescriptionRow = {
  drugName: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
};

export type RecordDefaults = {
  /** Empty for a note that has not been saved once yet. */
  recordId: string;
  status: RecordStatus;
  /** When it was last written, so the form can say so. */
  savedAt: string | null;
  visitDate: string;
  appointmentId: string;
  /** PHONE, RESULTS, OTHER or "", for a note with no visit. */
  noteKind: string;
  chiefComplaint: string;
  historyOfPresentIllness: string;
  physicalExamination: string;
  temperatureC: string;
  heartRate: string;
  respiratoryRate: string;
  systolic: string;
  diastolic: string;
  weightKg: string;
  heightCm: string;
  oxygenSaturation: string;
  assessment: string;
  treatmentPlan: string;
  followUpDate: string;
  notes: string;
  prescriptions: PrescriptionRow[];
  /** ICD-11, primary first. */
  diagnoses: { code: string; title: string }[];
};

export function blankRecord(visitDate: string): RecordDefaults {
  return {
    recordId: "",
    status: "DRAFT",
    savedAt: null,
    visitDate,
    appointmentId: "",
    noteKind: "",
    chiefComplaint: "",
    historyOfPresentIllness: "",
    physicalExamination: "",
    temperatureC: "",
    heartRate: "",
    respiratoryRate: "",
    systolic: "",
    diastolic: "",
    weightKg: "",
    heightCm: "",
    oxygenSaturation: "",
    assessment: "",
    treatmentPlan: "",
    followUpDate: "",
    notes: "",
    prescriptions: [],
    diagnoses: [],
  };
}
