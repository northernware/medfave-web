/**
 * The contract's native Postgres enums, as values the app can reference.
 *
 * Prisma 8 types every enum column as a string union rather than generating a
 * runtime enum object, so these constants replace the old generated
 * `@/app/generated/prisma/enums` import. They are checked against the contract
 * by every query that uses them: a member that drifts from `contract.prisma`
 * stops assigning to its column's union and fails the typecheck.
 */

export const ClinicRole = {
  DOCTOR: "DOCTOR",
  SECRETARY: "SECRETARY",
  ADMIN: "ADMIN",
} as const;
export type ClinicRole = (typeof ClinicRole)[keyof typeof ClinicRole];

export const SignupRole = {
  PATIENT: "PATIENT",
  DOCTOR: "DOCTOR",
} as const;
export type SignupRole = (typeof SignupRole)[keyof typeof SignupRole];

export const AppointmentRequestStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  WITHDRAWN: "WITHDRAWN",
} as const;
export type AppointmentRequestStatus =
  (typeof AppointmentRequestStatus)[keyof typeof AppointmentRequestStatus];

export const DocumentType = {
  MEDICAL_CERTIFICATE: "MEDICAL_CERTIFICATE",
  MEDICAL_ABSTRACT: "MEDICAL_ABSTRACT",
  MEDICO_LEGAL_CERTIFICATE: "MEDICO_LEGAL_CERTIFICATE",
  INSURANCE_CLAIM: "INSURANCE_CLAIM",
  RECORD_COPIES: "RECORD_COPIES",
  OUTPATIENT_CERTIFICATE: "OUTPATIENT_CERTIFICATE",
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DocumentRequestStatus = {
  REQUESTED: "REQUESTED",
  READY: "READY",
  RELEASED: "RELEASED",
  DECLINED: "DECLINED",
} as const;
export type DocumentRequestStatus =
  (typeof DocumentRequestStatus)[keyof typeof DocumentRequestStatus];

export const RecordStatus = {
  DRAFT: "DRAFT",
  FINALIZED: "FINALIZED",
  AMENDED: "AMENDED",
} as const;
export type RecordStatus = (typeof RecordStatus)[keyof typeof RecordStatus];

export const Relationship = {
  HEAD: "HEAD",
  SPOUSE: "SPOUSE",
  CHILD: "CHILD",
  PARENT: "PARENT",
  SIBLING: "SIBLING",
  GRANDPARENT: "GRANDPARENT",
  OTHER: "OTHER",
} as const;
export type Relationship = (typeof Relationship)[keyof typeof Relationship];

export const Sex = {
  MALE: "MALE",
  FEMALE: "FEMALE",
} as const;
export type Sex = (typeof Sex)[keyof typeof Sex];

export const BloodType = {
  A_POS: "A_POS",
  A_NEG: "A_NEG",
  B_POS: "B_POS",
  B_NEG: "B_NEG",
  AB_POS: "AB_POS",
  AB_NEG: "AB_NEG",
  O_POS: "O_POS",
  O_NEG: "O_NEG",
  UNKNOWN: "UNKNOWN",
} as const;
export type BloodType = (typeof BloodType)[keyof typeof BloodType];

export const ClinicalListStatus = {
  RECORDED: "RECORDED",
  NONE_KNOWN: "NONE_KNOWN",
  UNKNOWN: "UNKNOWN",
} as const;
export type ClinicalListStatus = (typeof ClinicalListStatus)[keyof typeof ClinicalListStatus];

export const AllergySeverity = {
  MILD: "MILD",
  MODERATE: "MODERATE",
  SEVERE: "SEVERE",
} as const;
export type AllergySeverity = (typeof AllergySeverity)[keyof typeof AllergySeverity];

export const AppointmentStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  CHECKED_IN: "CHECKED_IN",
  IN_CONSULTATION: "IN_CONSULTATION",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const AppointmentType = {
  IN_PERSON: "IN_PERSON",
  TELECONSULTATION: "TELECONSULTATION",
  HOME_VISIT: "HOME_VISIT",
} as const;
export type AppointmentType = (typeof AppointmentType)[keyof typeof AppointmentType];

export const VisitPriority = {
  ROUTINE: "ROUTINE",
  URGENT: "URGENT",
  FOLLOW_UP: "FOLLOW_UP",
} as const;
export type VisitPriority = (typeof VisitPriority)[keyof typeof VisitPriority];

export const BookingSource = {
  STAFF: "STAFF",
  WALK_IN: "WALK_IN",
  PHONE: "PHONE",
  PATIENT_PORTAL: "PATIENT_PORTAL",
} as const;
export type BookingSource = (typeof BookingSource)[keyof typeof BookingSource];

export const ReminderPreference = {
  NONE: "NONE",
  SMS: "SMS",
  EMAIL: "EMAIL",
  APP: "APP",
} as const;
export type ReminderPreference = (typeof ReminderPreference)[keyof typeof ReminderPreference];

export const ServiceType = {
  GENERAL_CONSULTATION: "GENERAL_CONSULTATION",
  FAMILY_CHECKUP: "FAMILY_CHECKUP",
  FOLLOW_UP_CHECKUP: "FOLLOW_UP_CHECKUP",
  ROUTINE_PHYSICAL_EXAM: "ROUTINE_PHYSICAL_EXAM",
  PEDIATRIC_CONSULTATION: "PEDIATRIC_CONSULTATION",
  SENIOR_CITIZEN_CONSULTATION: "SENIOR_CITIZEN_CONSULTATION",
  PRENATAL_POSTNATAL_CONSULTATION: "PRENATAL_POSTNATAL_CONSULTATION",
  CHRONIC_DISEASE_MANAGEMENT: "CHRONIC_DISEASE_MANAGEMENT",
  PRESCRIPTION_RENEWAL: "PRESCRIPTION_RENEWAL",
  LABORATORY_RESULT_REVIEW: "LABORATORY_RESULT_REVIEW",
  MEDICAL_CERTIFICATE_REQUEST: "MEDICAL_CERTIFICATE_REQUEST",
  VACCINATION_CONSULTATION: "VACCINATION_CONSULTATION",
  MINOR_INJURY_WOUND_CARE: "MINOR_INJURY_WOUND_CARE",
  TELECONSULTATION: "TELECONSULTATION",
  REFERRAL_CONSULTATION: "REFERRAL_CONSULTATION",
} as const;
export type ServiceType = (typeof ServiceType)[keyof typeof ServiceType];
