"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSelectedLayoutSegments } from "next/navigation";
import { AltArrowLeftIcon } from "@solar-icons/react/linear/alt-arrow-left";
import { useCrumbNames } from "@/components/crumb-names";

/*
 * The way back, as one link: "‹ Today" back to wherever you came from, named
 * after it. A full trail ("Patients › Patient › Edit") read like the address,
 * repeated the title, and led somewhere other than where you'd been. Opened
 * cold (a link, a refresh) it falls back to the page above: a note's patient,
 * an edit's record. A section's own page (Today, Patients…) shows nothing:
 * the sidebar already says where you are.
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

/** Form and note pages centre their content; the link sits over it, not at the far left. */
const columnFor = (path: string) =>
  /^\/records\/(new|[^/]+\/edit)$/.test(path) ? "mx-auto max-w-[69rem]" : /\/(new|edit)$/.test(path) ? "mx-auto max-w-3xl" : "";

type Visit = { path: string; url: string; title: string };
const KEY = "medfave.trail";

function readTrail(): Visit[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
function writeTrail(trail: Visit[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-30)));
  } catch {}
  window.dispatchEvent(new Event(KEY));
}
const subscribe = (changed: () => void) => {
  window.addEventListener(KEY, changed);
  return () => window.removeEventListener(KEY, changed);
};
const rawTrail = () => {
  try {
    return sessionStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
};

/** What a visited page is called: a section by its name, anything else by its title. */
function titleOf(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (LISTS.has(path)) return (parts[0] === "portal" ? PORTAL_NAMES[parts.at(-1)!] : undefined) ?? NAMES[parts.at(-1)!] ?? "Back";
  return document.title.replace(/\s*·\s*Medfave$/, "").trim() || "Back";
}

/** The page above this one, for when there's nowhere you came from. */
function parentOf(path: string, named: Record<string, string>) {
  const parts = path.split("/").filter(Boolean);
  const portal = parts[0] === "portal";
  for (let i = parts.length - 2; i >= 0; i--) {
    const part = parts[i];
    const href = "/" + parts.slice(0, i + 1).join("/");
    if (isId(part)) {
      return { href, label: named[part] ?? (portal ? PORTAL_ITEM[parts[i - 1]] : undefined) ?? ITEM[parts[i - 1]] ?? "Back" };
    }
    if (LISTS.has(href)) return { href, label: (portal ? PORTAL_NAMES[part] : undefined) ?? NAMES[part] ?? part };
  }
  return null;
}

export function Breadcrumbs() {
  // The page itself, not a panel opened over it (a note over Today keeps Today's path).
  const path = "/" + useSelectedLayoutSegments().filter((s) => !s.startsWith("(") && !s.startsWith("@")).join("/");
  const named = useCrumbNames();
  const router = useRouter();
  const raw = useSyncExternalStore(subscribe, rawTrail, () => "[]");
  const trail: Visit[] = JSON.parse(raw);
  // Where you came from, once this page is the latest step.
  const from = trail.at(-1)?.path === path ? (trail.at(-2) ?? null) : null;

  // Keep a short trail of pages in this tab: arriving where you just were is
  // going back (drop the page you left); anything else is a step forward.
  useEffect(() => {
    const url = path + window.location.search;
    const trail = readTrail();
    if (trail.at(-2)?.path === path) trail.pop();
    else if (trail.at(-1)?.path !== path) trail.push({ path, url, title: "" });
    trail[trail.length - 1] = { ...trail[trail.length - 1], url };
    writeTrail(trail);
    // The title arrives with the page's metadata, a moment after it renders.
    const name = window.setTimeout(() => {
      const t = readTrail();
      if (t.at(-1)?.path === path) {
        t[t.length - 1].title = titleOf(path);
        writeTrail(t);
      }
    }, 400);
    return () => window.clearTimeout(name);
  }, [path]);

  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2 || (parts.length === 2 && ["desk", "portal", "manage"].includes(parts[0]) && LISTS.has(path))) {
    return null;
  }

  const fallback = parentOf(path, named);
  const label = from?.title || fallback?.label;
  if (!from && !fallback) return null;

  const className = "inline-flex items-center gap-1 font-medium text-ink-muted hover:text-ink";
  const inner = (
    <>
      <AltArrowLeftIcon className="size-4" aria-hidden />
      {label}
    </>
  );
  return (
    <nav aria-label="Back" className={`mb-3 text-sm ${columnFor(path)}`}>
      {from ? (
        // Really going back keeps that page as you left it (scroll, filters).
        <a
          href={from.url}
          className={className}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            router.back();
          }}
        >
          {inner}
        </a>
      ) : (
        <Link href={fallback!.href} className={className}>
          {inner}
        </Link>
      )}
    </nav>
  );
}
