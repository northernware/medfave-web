import { z } from "zod";
import { withFullName } from "@/lib/names";
import {
  AllergySeverity,
  AppointmentStatus,
  AppointmentType,
  BloodType,
  BookingSource,
  ClinicalListStatus,
  Relationship,
  ReminderPreference,
  ServiceType,
  Sex,
  VisitPriority,
} from "@/lib/enums";

/** What every server action hands back to `useActionState`. */
export type FormState = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /**
   * Set when the action succeeded but stayed on the page, so a form can present
   * `message` as a confirmation rather than styling it as a failure.
   */
  ok?: boolean;
  /**
   * Possible duplicates found while registering. Presented for a person to
   * judge â records are never merged automatically, and the form resubmits with
   * `confirmDuplicate` once someone has decided this really is a new patient.
   */
  duplicates?: DuplicateMatch[];
  /**
   * Fingerprint of the details the duplicates were found for. The form sends it
   * back as the confirmation, so a tick approves exactly what was on screen.
   */
  confirmToken?: string;
  /**
   * What was typed, handed back with an error. React resets a form after its
   * action runs, so a form that wants to keep the input uses these as its
   * defaults. Never include a password.
   */
  values?: Record<string, string>;
};

/** A form's text fields, to hand back with an error (see `FormState.values`). */
export function formValues(formData: FormData, omit: string[] = []): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string" && !omit.includes(k) && !k.startsWith("$")) values[k] = v;
  return values;
}

export type DuplicateMatch = {
  id: string;
  patientNumber: string | null;
  name: string;
  dateOfBirth: string;
  householdName: string;
  /** Which fields matched, so staff can see why it was flagged. */
  matchedOn: string[];
};

export const EMPTY_FORM_STATE: FormState = {};

/** A blank text input arrives as "" â store it as absent, not as an empty string. */
function optionalText(max = 500) {
  return z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);
}

function optionalNumber(opts: { min: number; max: number; int?: boolean; label: string }) {
  return z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .nullable()
    .refine((v) => v === null || Number.isFinite(v), { message: `${opts.label} must be a number` })
    .refine((v) => v === null || !opts.int || Number.isInteger(v), {
      message: `${opts.label} must be a whole number`,
    })
    .refine((v) => v === null || (v >= opts.min && v <= opts.max), {
      message: `${opts.label} should be between ${opts.min} and ${opts.max}`,
    });
}

const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `Keep ${label.toLowerCase()} under ${max} characters`);

const dateOnly = (label: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a valid date`);

const dateTimeLocal = (label: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, `${label} must be a valid date and time`);

// --- Accounts ---------------------------------------------------------------

/**
 * Activating a patient login.
 *
 * The code is the whole of the identity check — the name and email here are
 * for the account being made, and are never used to find a chart to attach it
 * to. See `activatePatientAccount`.
 */
export const activationSchema = z.preprocess(withFullName, z
  .object({
    code: z.string().trim().min(4, "Enter the code the clinic gave you").max(40),
    fullName: requiredText("Your first and last name", 120),
    firstName: z.string().optional(),
    middleName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
    password: z.string().min(10, "Use at least 10 characters").max(200),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }));

/** Accepting a staff invitation. The role comes from the invitation, not here. */
export const inviteAcceptSchema = z.preprocess(withFullName, z
  .object({
    code: z.string().trim().min(4, "Enter the invitation code").max(40),
    fullName: requiredText("Your first and last name", 120),
    firstName: z.string().optional(),
    middleName: z.string().optional(),
    lastName: z.string().optional(),
    password: z.string().min(10, "Use at least 10 characters").max(200),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }));

/**
 * A person's own account details.
 *
 * The email is what they sign in with, so changing it is changing a
 * credential — the action re-issues the session rather than leaving them
 * holding one that names an address they no longer have.
 */
export const accountDetailsSchema = z.preprocess(
  withFullName,
  z.object({
    fullName: requiredText("Your first and last name", 120),
    firstName: z.string().optional(),
    middleName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  }),
);

/**
 * Changing a password while signed in.
 *
 * The current password is required. Without it, anybody who finds an unlocked
 * screen owns the account permanently rather than until it is locked again.
 */
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: z.string().min(10, "Use at least 10 characters").max(200),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((v) => v.password !== v.currentPassword, {
    message: "Choose a password you have not used here before",
    path: ["password"],
  });

/**
 * Asking for a reset link.
 *
 * An address and nothing else, and the action must answer the same way whether
 * or not it belongs to anybody — a form that says "no such account" is a way to
 * find out who a clinic's patients are.
 */
export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
});

/** Spending a reset code on a new password. No current password: that is the point. */
export const passwordResetSchema = z
  .object({
    code: z.string().trim().min(4, "Enter the code from the email").max(40),
    password: z.string().min(10, "Use at least 10 characters").max(200),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * The practice's own details: what its letterhead says and what its
 * invitations and reminders call it.
 */
export const clinicDetailsSchema = z.object({
  name: requiredText("Clinic name", 160),
  address: optionalText(300),
  contactNumber: optionalText(40),
});

/** The clinician details that print on a prescription or a certificate. */
export const clinicianProfileSchema = z.object({
  specialty: optionalText(120),
  licenseNumber: optionalText(60),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

// --- Households and patients --------------------------------------------------

export const householdSchema = z.object({
  name: requiredText("Household name", 120),
  address: optionalText(300),
  contactNumber: optionalText(40),
  primaryContactId: optionalText(40),
  notes: optionalText(2000),
});

export const NEW_HOUSEHOLD = "__new__";

export const patientSchema = z.object({
  // Either an existing household's id, or the sentinel meaning "create one from
  // `newHouseholdName`" â so a patient can be registered without first
  // navigating into a household.
  householdId: requiredText("Household", 40),
  newHouseholdName: optionalText(120),
  /**
   * The fingerprint of the details staff actually reviewed, set when they tick
   * "this is a different person". It is compared against the submitted details
   * server-side, so it is a token rather than a flag — and long enough to hold
   * every identifying field joined together.
   */
  confirmDuplicate: optionalText(400),
  firstName: requiredText("First name", 80),
  middleName: optionalText(80),
  lastName: requiredText("Last name", 80),
  dateOfBirth: dateOnly("Date of birth"),
  sex: z.enum(Sex, { message: "Select a sex" }),
  relationship: z.enum(Relationship, { message: "Select a relationship" }),
  bloodType: z.enum(BloodType).default(BloodType.UNKNOWN),
  allergyStatus: z.enum(ClinicalListStatus).default(ClinicalListStatus.UNKNOWN),
  conditionStatus: z.enum(ClinicalListStatus).default(ClinicalListStatus.UNKNOWN),
  medicationStatus: z.enum(ClinicalListStatus).default(ClinicalListStatus.UNKNOWN),
  contactNumber: optionalText(40),
  emergencyContactName: optionalText(120),
  emergencyContactRelationship: optionalText(60),
  emergencyContactNumber: optionalText(40),
  emergencyContact2Name: optionalText(120),
  emergencyContact2Relationship: optionalText(60),
  emergencyContact2Number: optionalText(40),
  email: optionalText(160).refine((v) => v === null || z.email().safeParse(v).success, {
    message: "Enter a valid email address",
  }),
});

/**
 * The part of their own chart a patient may correct.
 *
 * Two fields, and deliberately no more. Name, date of birth and household are
 * identity, and a record whose subject can rewrite its identity is not a
 * reliable one — those stay with the desk, which is where somebody was
 * identified in the first place. How to reach them is different: they are the
 * authority on their own phone number, and a wrong one means a missed reminder.
 */
export const patientContactSchema = z
  .object({
    contactNumber: optionalText(40),
    email: optionalText(160).refine((v) => v === null || z.email().safeParse(v).success, {
      message: "Enter a valid email address",
    }),
    // Only the two the application can actually honour. SMS and APP exist in the
    // enum for the clinic's own records, and offering a patient a choice nothing
    // would act on is worse than not offering it.
    reminderPreference: z.enum([ReminderPreference.NONE, ReminderPreference.EMAIL], {
      message: "Choose whether you want a reminder",
    }),
  })
  .refine((v) => v.reminderPreference !== ReminderPreference.EMAIL || v.email !== null, {
    message: "Add an email address to be reminded by email",
    path: ["email"],
  });

// --- Appointments -----------------------------------------------------------

// Date and time are separate fields: the form offers only the slots the clinic
// actually has open, so a free-text datetime would defeat the point.
export const appointmentSchema = z.object({
  patientId: requiredText("Patient", 40),
  date: dateOnly("Appointment date"),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose an available time slot"),
  service: z.enum(ServiceType, { message: "Choose a service" }),
  reason: requiredText("Reason for visit", 300),

  type: z.enum(AppointmentType).default(AppointmentType.IN_PERSON),
  priority: z.enum(VisitPriority).default(VisitPriority.ROUTINE),
  status: z.enum(AppointmentStatus).default(AppointmentStatus.PENDING),
  source: z.enum(BookingSource).default(BookingSource.STAFF),
  reminderPreference: z.enum(ReminderPreference).default(ReminderPreference.NONE),

  previousAppointmentId: optionalText(40),
  room: optionalText(60),
  notes: optionalText(2000),
  internalNotes: optionalText(2000),
});

// --- Medical records --------------------------------------------------------

/**
 * A finished consultation. Every field a signed note must have is required
 * here, because signing is the point at which the note becomes the clinical
 * record and has to stand on its own.
 */
export const medicalRecordSchema = z.object({
  patientId: requiredText("Patient", 40),
  appointmentId: optionalText(40),
  visitDate: dateTimeLocal("Visit date"),
  chiefComplaint: requiredText("Chief complaint", 300),
  historyOfPresentIllness: optionalText(4000),
  physicalExamination: optionalText(4000),

  temperatureC: optionalNumber({ min: 25, max: 45, label: "Temperature" }),
  heartRate: optionalNumber({ min: 20, max: 300, int: true, label: "Heart rate" }),
  respiratoryRate: optionalNumber({ min: 4, max: 100, int: true, label: "Respiratory rate" }),
  systolic: optionalNumber({ min: 50, max: 300, int: true, label: "Systolic" }),
  diastolic: optionalNumber({ min: 20, max: 200, int: true, label: "Diastolic" }),
  weightKg: optionalNumber({ min: 0.3, max: 400, label: "Weight" }),
  heightCm: optionalNumber({ min: 20, max: 260, label: "Height" }),
  oxygenSaturation: optionalNumber({ min: 40, max: 100, int: true, label: "Oxygen saturation" }),

  assessment: optionalText(4000),
  treatmentPlan: optionalText(4000),
  // Only for a note with no visit linked; cleared when one is (lib/consultation.ts).
  noteKind: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .refine((v) => v == null || ["PHONE", "RESULTS", "OTHER"].includes(v), { message: "Pick what kind of note it is" }),
  followUpDate: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "Follow-up must be a valid date",
    }),
  notes: optionalText(4000),
});

/** One row of a clinical list. `label` is free text â the catalogue only suggests. */
export const clinicalItemSchema = z.object({
  label: requiredText("Entry", 160),
  reaction: optionalText(200),
  dosage: optionalText(80),
  frequency: optionalText(80),
  severity: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || v in AllergySeverity, { message: "Pick a severity" }),
  notes: optionalText(400),
});

/**
 * A consultation still being written.
 *
 * The chief complaint is the one field a finished note cannot do without, and
 * it is exactly the field a doctor has not typed yet two minutes into the
 * visit. A draft that refused to save until the note was complete would defeat
 * the point of drafts, so that requirement moves to the moment of signing.
 * Everything else — the ranges on vitals, the shape of a date — still applies:
 * those catch typing mistakes, and a mistake is no more welcome in a draft.
 */
export const medicalRecordDraftSchema = medicalRecordSchema.extend({
  chiefComplaint: optionalText(300).transform((v) => v ?? ""),
});

export const prescriptionSchema = z.object({
  drugName: requiredText("Drug name", 160),
  dosage: requiredText("Dosage", 80),
  frequency: requiredText("Frequency", 80),
  duration: optionalText(80),
  instructions: optionalText(400),
});

/** Turn a Zod failure into the shape the form components read. */
export function toFieldErrors(error: z.ZodError): FormState {
  const flat = z.flattenError(error);
  const fieldErrors = flat.fieldErrors as Record<string, string[]>;
  // Prefer a specific complaint over the generic one â a nested list renders its
  // message in a banner, where "check the highlighted fields" highlights nothing.
  const firstField = Object.values(fieldErrors).find((messages) => messages?.length)?.[0];
  return {
    message: flat.formErrors[0] ?? firstField ?? "Please correct the highlighted fields.",
    fieldErrors,
  };
}

/**
 * A fingerprint of the fields a duplicate check looks at.
 *
 * The confirmation a user gives is tied to this rather than being a bare "yes",
 * so approving one set of details cannot silently approve a different set: edit
 * the name or the date of birth after ticking and the fingerprint no longer
 * matches, so the server asks again. The form clears the tick too, but this is
 * what makes it true rather than merely tidy.
 */
export function identityFingerprint(candidate: {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  contactNumber?: string | null;
  email?: string | null;
}) {
  return [
    candidate.firstName,
    candidate.lastName,
    candidate.dateOfBirth,
    candidate.contactNumber ?? "",
    candidate.email ?? "",
  ]
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}
