"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AltArrowLeftIcon } from "@solar-icons/react/linear/alt-arrow-left";
import { useCrumbNames } from "@/components/crumb-names";

/*
 * Where you are, and the way back: "Patients › Patient › Edit" above any page
 * below a section, built from the address so every page has it without asking.
 * Phones get the one link that matters, "‹ Patients". A section's own page
 * (Today, Patients…) shows nothing: the sidebar already says where you are.
 */

// What each place is called. An id segment is named by what it is under.
const NAMES: Record<string, string> = {
  dashboard: "Today",
  calendar: "Calendar",
  appointments: "Appointments",
  patients: "Patients",
  households: "Households",
  documents: "Records requests",
  records: "Visit notes",
  desk: "Today",
  requests: "Requests",
  portal: "Home",
  details: "My details",
  family: "My family",
  request: "Request a visit",
  "add-clinic": "Add a clinic",
  manage: "Clinic settings",
  clinic: "Details",
  schedule: "Schedule",
  staff: "Staff",
  new: "New",
  edit: "Edit",
  print: "Print",
  prescription: "Prescription",
};
const ITEM: Record<string, string> = {
  appointments: "Visit",
  patients: "Patient",
  households: "Household",
  documents: "Request",
  records: "Visit note",
};

// Places with a page of their own, so they can be linked to. "/records" has
// none: a visit note's way back is the visit or the patient, not a list.
const LISTS = new Set([
  "/dashboard", "/calendar", "/appointments", "/patients", "/households", "/documents",
  "/desk", "/desk/appointments", "/desk/patients", "/desk/requests",
  "/portal", "/portal/documents", "/portal/emergency", "/portal/details", "/portal/family", "/portal/request",
  "/manage",
]);

// The patient's own words for the same places, under /portal.
const PORTAL_NAMES: Record<string, string> = { documents: "Documents", emergency: "Emergency card" };
const PORTAL_ITEM: Record<string, string> = { documents: "Document" };

const isId = (s: string) => /^[0-9a-f-]{16,}$/i.test(s);

/** Form and note pages centre their content; the trail sits over it, not at the far left. */
const columnFor = (path: string) =>
  /^\/records\/(new|[^/]+\/edit)$/.test(path) ? "mx-auto max-w-[69rem]" : /\/(new|edit)$/.test(path) ? "mx-auto max-w-3xl" : "";

export function Breadcrumbs() {
  const path = usePathname() ?? "";
  const named = useCrumbNames();
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2 || (parts.length === 2 && ["desk", "portal", "manage"].includes(parts[0]) && LISTS.has(path))) {
    return null;
  }

  const crumbs = parts.map((part, i) => {
    const href = "/" + parts.slice(0, i + 1).join("/");
    // An id is called what its page says it is (`CrumbName`), or by its kind.
    const portal = parts[0] === "portal";
    const label = isId(part)
      ? (named[part] ?? (portal ? PORTAL_ITEM[parts[i - 1]] : undefined) ?? ITEM[parts[i - 1]] ?? "Details")
      : ((portal ? PORTAL_NAMES[part] : undefined) ?? NAMES[part] ?? part);
    // An id is linkable (it has a page); a list only if it has one.
    const linkable = i < parts.length - 1 && (isId(part) || LISTS.has(href));
    return { href, label, linkable };
  });
  const back = [...crumbs].reverse().find((c) => c.linkable);

  return (
    <nav aria-label="Breadcrumb" className={`mb-3 text-sm ${columnFor(path)}`}>
      {back ? (
        <Link href={back.href} className="inline-flex items-center gap-1 font-medium text-ink-muted hover:text-ink sm:hidden">
          <AltArrowLeftIcon className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <ol className="hidden flex-wrap items-center gap-1.5 text-ink-muted sm:flex">
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden="true" className="text-ink-faint">›</span> : null}
            {c.linkable ? (
              <Link href={c.href} className="hover:text-ink hover:underline">
                {c.label}
              </Link>
            ) : (
              <span className={i === crumbs.length - 1 ? "font-medium text-ink" : ""} aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
