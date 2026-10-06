import type {
  AppointmentStatus,
  AppointmentType,
  BloodType,
  BookingSource,
  RecordStatus,
  Relationship,
  ReminderPreference,
  ServiceType,
  Sex,
  VisitPriority,
} from "@/lib/enums";

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  HEAD: "Head of household",
  SPOUSE: "Spouse",
  CHILD: "Child",
  PARENT: "Parent",
  SIBLING: "Sibling",
  GRANDPARENT: "Grandparent",
  OTHER: "Other",
};

export const SEX_LABELS: Record<Sex, string> = {
  MALE: "Male",
  FEMALE: "Female",
};

export const BLOOD_TYPE_LABELS: Record<BloodType, string> = {
  A_POS: "A+",
  A_NEG: "A−",
  B_POS: "B+",
  B_NEG: "B−",
  AB_POS: "AB+",
  AB_NEG: "AB−",
  O_POS: "O+",
  O_NEG: "O−",
  UNKNOWN: "Unknown",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  IN_CONSULTATION: "In consultation",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

/** Badge palette keyed by appointment status. */
export const APPOINTMENT_STATUS_TONE: Record<
  AppointmentStatus,
  "accent" | "ok" | "neutral" | "warn"
> = {
  PENDING: "warn",
  CONFIRMED: "accent",
  CHECKED_IN: "accent",
  IN_CONSULTATION: "accent",
  COMPLETED: "ok",
  CANCELLED: "neutral",
  NO_SHOW: "warn",
};

/** Why a note has no visit linked (MedicalRecord.noteKind). */
export const NOTE_KIND_LABELS: Record<string, string> = {
  PHONE: "Phone advice",
  RESULTS: "Results",
  OTHER: "Other",
};

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  DRAFT: "Draft",
  FINALIZED: "Signed",
  AMENDED: "Amended",
};

export const RECORD_STATUS_TONE: Record<RecordStatus, "accent" | "ok" | "neutral" | "warn"> = {
  DRAFT: "warn",
  FINALIZED: "ok",
  AMENDED: "accent",
};

/** Statuses that still expect the patient to turn up, or have them here. */
export const ACTIVE_STATUSES: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_CONSULTATION",
];

/**
 * The queue, in the order it moves: arrived and waiting, then with the doctor.
 * Anything else has either not got here or is finished.
 */
export const QUEUE_STATUSES: AppointmentStatus[] = ["CHECKED_IN", "IN_CONSULTATION"];

/**
 * Where a visit can go from where it is.
 *
 * Offering every status at once let a visit jump from booked straight to
 * completed, or be checked in after it had been marked a no-show, and the
 * order of a consultation stopped meaning anything. A visit moves forward one
 * step at a time — booked, confirmed, arrived, with the doctor, finished — and
 * can fall out of that at any point up to the moment it finishes.
 *
 * Nothing leaves COMPLETED: what happened, happened. A visit that fell through
 * can only be put back to CONFIRMED, and only if its slot is still free —
 * setAppointmentStatus re-checks that under the booking lock.
 */
export const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  // Back to CONFIRMED undoes a check-in made by mistake, until the consultation starts.
  CHECKED_IN: ["IN_CONSULTATION", "CONFIRMED", "CANCELLED", "NO_SHOW"],
  IN_CONSULTATION: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: ["CONFIRMED"],
  // Checking in a no-show is someone arriving late, and only on the visit's own day
  // (changeAppointmentStatus checks it; `movesFrom` offers it only then).
  NO_SHOW: ["CONFIRMED", "CHECKED_IN"],
};

/**
 * The moves to offer from here.
 *
 * A no-show can be checked in on its own day, and then that leads: they turned
 * up late. Putting a cancelled or missed visit back (CONFIRMED) is offered only
 * while its time is still to come (`stillDue`: before its time plus the
 * no-show grace). After that it would only be marked missed again, so there
 * is nothing to restore.
 */
export function movesFrom(status: AppointmentStatus, onItsDay: boolean, stillDue: boolean): AppointmentStatus[] {
  const moves = status === "NO_SHOW" && onItsDay ? ["CHECKED_IN", "CONFIRMED"] as AppointmentStatus[] : STATUS_TRANSITIONS[status];
  return moves.filter(
    (to) => !(to === "CONFIRMED" && (status === "NO_SHOW" || status === "CANCELLED") && !stillDue) && !(to === "CHECKED_IN" && status === "NO_SHOW" && !onItsDay),
  );
}

export function canMoveTo(from: AppointmentStatus, to: AppointmentStatus) {
  return STATUS_TRANSITIONS[from].includes(to);
}

/**
 * What the button says. The same destination means different things depending
 * on where the visit is coming from: reaching CONFIRMED from a booking is
 * confirming it, and reaching it from a cancellation is putting it back.
 */
export function statusActionLabel(from: AppointmentStatus, to: AppointmentStatus) {
  if (to === "CONFIRMED" && (from === "CANCELLED" || from === "NO_SHOW")) {
    return "Restore booking";
  }
  if (to === "CONFIRMED" && from === "CHECKED_IN") return "Undo check-in";
  if (to === "CHECKED_IN" && from === "NO_SHOW") return "Check in (arrived late)";
  return {
    PENDING: "Back to pending",
    CONFIRMED: "Confirm",
    CHECKED_IN: "Check in",
    IN_CONSULTATION: "Start consultation",
    COMPLETED: "Mark completed",
    CANCELLED: "Cancel",
    NO_SHOW: "Mark no-show",
  }[to];
}

/**
 * Statuses that mean the visit actually took place, so there is something to
 * write up. Documenting anything else is documenting a visit that did not
 * happen.
 */
export const CONSULTED_STATUSES: AppointmentStatus[] = ["IN_CONSULTATION", "COMPLETED"];

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  IN_PERSON: "In person",
  TELECONSULTATION: "Teleconsultation",
  HOME_VISIT: "Home visit",
};

export const VISIT_PRIORITY_LABELS: Record<VisitPriority, string> = {
  ROUTINE: "Routine",
  URGENT: "Urgent",
  FOLLOW_UP: "Follow-up",
};

export const VISIT_PRIORITY_TONE: Record<VisitPriority, "neutral" | "danger" | "accent"> = {
  ROUTINE: "neutral",
  URGENT: "danger",
  FOLLOW_UP: "accent",
};

export const BOOKING_SOURCE_LABELS: Record<BookingSource, string> = {
  STAFF: "Staff-created",
  WALK_IN: "Walk-in",
  PHONE: "Phone",
  PATIENT_PORTAL: "Patient portal",
};

export const REMINDER_LABELS: Record<ReminderPreference, string> = {
  NONE: "No reminder",
  SMS: "SMS",
  EMAIL: "Email",
  APP: "App notification",
};

/**
 * The bookable services, in the order they are offered. `minutes` is the slot
 * length: booking derives duration from the service rather than asking, so the
 * slot picker knows how much of the day a visit consumes.
 */
export const SERVICES: {
  value: ServiceType;
  label: string;
  description: string;
  minutes: number;
}[] = [
  {
    value: "GENERAL_CONSULTATION",
    label: "General Consultation",
    description: "Assessment of common symptoms and health concerns.",
    minutes: 30,
  },
  {
    value: "FAMILY_CHECKUP",
    label: "Family Checkup",
    description: "Consultation for multiple members of the same family.",
    minutes: 60,
  },
  {
    value: "FOLLOW_UP_CHECKUP",
    label: "Follow-up Checkup",
    description: "Review of recovery, treatment, or previous findings.",
    minutes: 20,
  },
  {
    value: "ROUTINE_PHYSICAL_EXAM",
    label: "Routine Physical Examination",
    description: "General evaluation of overall health.",
    minutes: 45,
  },
  {
    value: "PEDIATRIC_CONSULTATION",
    label: "Pediatric Consultation",
    description: "Checkup for infants and children.",
    minutes: 30,
  },
  {
    value: "SENIOR_CITIZEN_CONSULTATION",
    label: "Senior Citizen Consultation",
    description: "Care for age-related health concerns.",
    minutes: 45,
  },
  {
    value: "PRENATAL_POSTNATAL_CONSULTATION",
    label: "Prenatal and Postnatal Consultation",
    description: "Basic care before and after childbirth.",
    minutes: 45,
  },
  {
    value: "CHRONIC_DISEASE_MANAGEMENT",
    label: "Chronic Disease Management",
    description: "Monitoring of diabetes, hypertension, asthma, and similar conditions.",
    minutes: 30,
  },
  {
    value: "PRESCRIPTION_RENEWAL",
    label: "Prescription Renewal",
    description: "Review and renewal of regular medicines.",
    minutes: 15,
  },
  {
    value: "LABORATORY_RESULT_REVIEW",
    label: "Laboratory Result Review",
    description: "Interpretation of blood tests and other results.",
    minutes: 20,
  },
  {
    value: "MEDICAL_CERTIFICATE_REQUEST",
    label: "Medical Certificate Request",
    description: "Evaluation for school, work, or fitness clearance.",
    minutes: 20,
  },
  {
    value: "VACCINATION_CONSULTATION",
    label: "Vaccination Consultation",
    description: "Vaccine assessment and scheduling.",
    minutes: 20,
  },
  {
    value: "MINOR_INJURY_WOUND_CARE",
    label: "Minor Injury or Wound Care",
    description: "Treatment of cuts, burns, sprains, and minor injuries.",
    minutes: 30,
  },
  {
    value: "TELECONSULTATION",
    label: "Teleconsultation",
    description: "Consultation through video or voice call.",
    minutes: 20,
  },
  {
    value: "REFERRAL_CONSULTATION",
    label: "Referral Consultation",
    description: "Assessment and referral to an appropriate specialist.",
    minutes: 20,
  },
];

export const SERVICE_LABELS = Object.fromEntries(
  SERVICES.map((s) => [s.value, s.label]),
) as Record<ServiceType, string>;

export const SERVICE_DESCRIPTIONS = Object.fromEntries(
  SERVICES.map((s) => [s.value, s.description]),
) as Record<ServiceType, string>;

export const SERVICE_MINUTES = Object.fromEntries(
  SERVICES.map((s) => [s.value, s.minutes]),
) as Record<ServiceType, number>;

/** A compact form for tight spots — calendar cells, list rows. */
export const SERVICE_SHORT_LABELS: Record<ServiceType, string> = {
  GENERAL_CONSULTATION: "General",
  FAMILY_CHECKUP: "Household",
  FOLLOW_UP_CHECKUP: "Follow-up",
  ROUTINE_PHYSICAL_EXAM: "Physical exam",
  PEDIATRIC_CONSULTATION: "Pediatric",
  SENIOR_CITIZEN_CONSULTATION: "Senior",
  PRENATAL_POSTNATAL_CONSULTATION: "Pre/postnatal",
  CHRONIC_DISEASE_MANAGEMENT: "Chronic care",
  PRESCRIPTION_RENEWAL: "Rx renewal",
  LABORATORY_RESULT_REVIEW: "Lab review",
  MEDICAL_CERTIFICATE_REQUEST: "Med cert",
  VACCINATION_CONSULTATION: "Vaccination",
  MINOR_INJURY_WOUND_CARE: "Wound care",
  TELECONSULTATION: "Teleconsult",
  REFERRAL_CONSULTATION: "Referral",
};

export function fullName(p: { firstName: string; middleName?: string | null; lastName: string }) {
  const middleInitial = p.middleName?.trim() ? `${p.middleName.trim()[0]}. ` : "";
  return `${p.firstName} ${middleInitial}${p.lastName}`;
}

/** Whole years, then months for infants — how a chart actually reads. */
export function ageFrom(dateOfBirth: Date, on: Date = new Date()): string {
  let years = on.getFullYear() - dateOfBirth.getFullYear();
  let months = on.getMonth() - dateOfBirth.getMonth();
  if (on.getDate() < dateOfBirth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return "—";
  if (years === 0) return months === 1 ? "1 month" : `${months} months`;
  if (years < 3) return `${years}y ${months}m`;
  return `${years} years`;
}

export function bloodPressure(systolic: number | null, diastolic: number | null) {
  if (systolic == null && diastolic == null) return null;
  return `${systolic ?? "—"}/${diastolic ?? "—"}`;
}

export function bmi(weightKg: number | null, heightCm: number | null) {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return (weightKg / (m * m)).toFixed(1);
}
