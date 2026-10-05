/*
 * The sections each side of Medfave shows in its sidebar or pill bar. Plain
 * data in its own module, so server layouts can read it (a "use client" file
 * only hands server code references, not values). Icons are named by key;
 * components/nav.tsx draws them with Solar icons.
 */

export type IconKey =
  | "today"
  | "calendar"
  | "appointments"
  | "households"
  | "patients"
  | "documents"
  | "hours"
  | "settings"
  | "requests"
  | "clinic"
  | "details"
  | "staff"
  | "admin"
  | "emergency"
  | "feedback";

export type NavLink = { href: string; label: string; icon: IconKey; group?: string };

/** The doctor's sections. The front desk is a view (the switch above the menu), not a section. */
export const DOCTOR_LINKS: readonly NavLink[] = [
  { href: "/dashboard", label: "Today", icon: "today", group: "Practice" },
  { href: "/calendar", label: "Calendar", icon: "calendar", group: "Practice" },
  { href: "/appointments", label: "Appointments", icon: "appointments", group: "Practice" },
  { href: "/patients", label: "Patients", icon: "patients", group: "Patients" },
  { href: "/households", label: "Households", icon: "households", group: "Patients" },
  { href: "/documents", label: "Records requests", icon: "documents", group: "Patients" },
  { href: "/feedback", label: "Patient feedback", icon: "feedback", group: "Patients" },
  { href: "/manage/schedule", label: "My hours", icon: "hours", group: "Clinic" },
  { href: "/manage", label: "Clinic settings", icon: "settings", group: "Clinic" },
];

/** A patient's own sections on the web. */
export const PATIENT_LINKS: readonly NavLink[] = [
  { href: "/portal", label: "Home", icon: "today", group: "My care" },
  { href: "/portal/request", label: "Request a visit", icon: "calendar", group: "My care" },
  { href: "/portal/documents", label: "Documents", icon: "documents", group: "My care" },
  { href: "/portal/emergency", label: "Emergency card", icon: "emergency", group: "My care" },
  { href: "/portal/details", label: "My details", icon: "details", group: "My care" },
  { href: "/portal/family", label: "My family", icon: "households", group: "My care" },
];

/** The front desk's sections. */
export const DESK_LINKS: readonly NavLink[] = [
  { href: "/desk", label: "Today", icon: "today", group: "Front desk" },
  { href: "/desk/appointments", label: "Appointments", icon: "appointments", group: "Front desk" },
  { href: "/desk/requests", label: "Requests", icon: "requests", group: "Front desk" },
  { href: "/desk/patients", label: "Patients", icon: "patients", group: "Front desk" },
  { href: "/desk/feedback", label: "Patient feedback", icon: "feedback", group: "Front desk" },
];

/** Running the clinic: for its doctor and its administrators. */
export const MANAGE_LINKS = {
  clinic: { href: "/manage", label: "Overview", icon: "clinic", group: "Clinic settings" },
  details: { href: "/manage/clinic", label: "Details", icon: "details", group: "Clinic settings" },
  schedule: { href: "/manage/schedule", label: "Schedule", icon: "hours", group: "Clinic settings" },
  staff: { href: "/manage/staff", label: "Staff", icon: "staff", group: "Clinic settings" },
  admin: { href: "/admin/verify", label: "Admin", icon: "admin", group: "Medfave" },
} satisfies Record<string, NavLink>;

/** The two ways of working a clinic's day, for those who can do both. */
export type ViewKey = "doctor" | "desk";
export const VIEWS: Record<ViewKey, { href: string; label: string }> = {
  doctor: { href: "/dashboard", label: "Doctor" },
  desk: { href: "/desk", label: "Front desk" },
};

/** Clinic settings: a link (sidebar and the clinic menu), not a view. */
export const CLINIC_SETTINGS: NavLink = { href: "/manage", label: "Clinic settings", icon: "settings", group: "Clinic" };
