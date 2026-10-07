import type { Metadata } from "next";
import Link from "next/link";
import { CalendarIcon } from "@solar-icons/react/linear/calendar";
import { ClockCircleIcon } from "@solar-icons/react/linear/clock-circle";
import { DocumentTextIcon } from "@solar-icons/react/linear/document-text";
import { LetterIcon } from "@solar-icons/react/linear/letter";
import { ShieldCheckIcon } from "@solar-icons/react/linear/shield-check";
import { UsersGroupTwoRoundedIcon } from "@solar-icons/react/linear/users-group-two-rounded";
import { redirect } from "next/navigation";
import { getViewer, homeFor } from "@/lib/auth";
import { Brand, HeartMark } from "@/components/brand";
import { buttonClass } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: { absolute: "Medfave — appointments and records for family practice" },
};

/*
 * The public front door. Anyone signed in already has a home, and it is not a
 * sales page: they go straight to it.
 */
export default async function LandingPage() {
  const viewer = await getViewer();
  if (viewer) redirect(homeFor(viewer));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Brand />
          <nav aria-label="Main" className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <a href="#features" className={buttonClass("ghost")}>
                Features
              </a>
              <a href="#who" className={buttonClass("ghost")}>
                Who it&rsquo;s for
              </a>
            </div>
            <ThemeToggle />
            <Link href="/login" className={buttonClass("primary")}>
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Hero />
        <Features />
        <Roles />
        <Privacy />
        <Closing />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <Brand />
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
            <Link href="/register" className="hover:text-ink">
              Activate a patient account
            </Link>
            <Link href="/forgot" className="hover:text-ink">
              Forgot password
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16 lg:px-10 lg:pt-24 lg:pb-28">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full bg-accent-tint px-3 py-1 text-sm font-semibold text-accent-ink">
          <HeartMark className="size-4" tone="accent" />
          For family practice
        </p>
        <h1 className="mt-5 text-[40px] leading-[46px] font-semibold tracking-[-0.02em] text-balance sm:text-[48px] sm:leading-[56px]">
          Care, with a little heart — and the whole family in one place.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-7 text-pretty text-ink-muted">
          Medfave keeps a family practice&rsquo;s appointments, visit notes and prescriptions together,
          organised by household. Find relatives in a click, book a family checkup, and see
          hereditary risk at a glance — while every patient keeps a chart of their own.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup?as=doctor" className={buttonClass("primary", "px-6 py-3 text-base")}>
            I&rsquo;m a doctor
          </Link>
          <Link href="/signup" className={buttonClass("secondary", "px-6 py-3 text-base")}>
            I&rsquo;m a patient
          </Link>
        </div>
        <p className="mt-4 text-sm text-ink-faint">
          Free to start. Already on Medfave?{" "}
          <Link href="/login" className="font-medium text-accent-ink hover:underline">
            Sign in
          </Link>
          .
        </p>
      </div>

      <HouseholdPreview />
    </section>
  );
}

/*
 * An illustration of the product, not live data — the names are made up, so
 * the whole panel is hidden from assistive tech rather than read out as content.
 */
function HouseholdPreview() {
  const members = [
    { initials: "MR", name: "Maria Reyes", detail: "Mother · 41", note: "Hypertension" },
    { initials: "JR", name: "Jose Reyes", detail: "Father · 44", note: "Type 2 diabetes" },
    { initials: "AR", name: "Ana Reyes", detail: "Daughter · 9", note: "Penicillin allergy", alert: true },
  ];

  return (
    <div aria-hidden="true" className="brand-pattern rounded-xl border border-border p-5 sm:p-8">
      <div className="rounded-lg border border-border bg-surface p-5 shadow-pop">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">Household</p>
            <p className="mt-1 font-display text-xl font-semibold">Reyes family</p>
          </div>
          <span className="rounded-full bg-accent-tint px-2.5 py-1 text-xs font-medium text-accent-ink">
            3 members
          </span>
        </div>

        <ul className="mt-5 divide-y divide-border">
          {members.map((m) => (
            <li key={m.initials} className="flex items-center gap-3 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink">
                {m.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{m.name}</p>
                <p className="text-xs text-ink-muted">{m.detail}</p>
              </div>
              <span
                className={[
                  "dot rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                  m.alert ? "bg-danger-tint text-danger-ink" : "bg-surface-muted text-ink-muted",
                ].join(" ")}
              >
                {m.note}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-surface-muted px-4 py-3">
          <div>
            <p className="text-xs text-ink-muted">Next visit</p>
            <p className="nums text-sm font-semibold">Family checkup · Thu 9:30</p>
          </div>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-on-accent">Booked</span>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    title: "Households",
    body: "Group relatives, record how they relate, and keep one shared address and number — without merging anyone's chart.",
    icon: UsersGroupTwoRoundedIcon,
  },
  {
    title: "Appointments & calendar",
    body: "Book against fifteen services, from general consults to family checkups, and see the month at a glance.",
    icon: CalendarIcon,
  },
  {
    title: "Visit records",
    body: "Document each visit with vitals, ICD-11 diagnoses, prescriptions and advice — and print the prescription on the spot.",
    icon: DocumentTextIcon,
  },
  {
    title: "Follow-ups that don't slip",
    body: "A patient due back stays in the queue until a visit actually happens — a cancelled or missed booking doesn't count.",
    icon: ClockCircleIcon,
  },
  {
    title: "Reminders",
    body: "Patients who ask for it get an email the day before their visit. Nobody else does.",
    icon: LetterIcon,
  },
  {
    title: "Documents",
    body: "Certificates, abstracts, insurance forms and record copies, requested by patients and tracked to done.",
    icon: ShieldCheckIcon,
  },
] as const;

function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-t border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-10 lg:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-accent-ink">What&rsquo;s inside</p>
          <h2 className="mt-2 text-[32px] leading-10 font-semibold tracking-[-0.015em] text-balance">
            Everything a family practice runs on, and nothing it doesn&rsquo;t
          </h2>
        </div>

        <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="flex size-11 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
                <f.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-base leading-6 text-pretty text-ink-muted">{f.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const ROLES = [
  {
    who: "Doctors",
    body: "Today's queue, the calendar, households and charts — the consulting room, start to finish.",
  },
  {
    who: "Front desk",
    body: "Check patients in, book and move appointments, and answer requests without touching clinical notes.",
  },
  {
    who: "Clinic managers",
    body: "Set opening hours, breaks and closures, and invite the staff who work there.",
  },
  {
    who: "Patients",
    body: "Request an appointment, ask for a certificate or records, and keep contact details up to date.",
  },
] as const;

function Roles() {
  return (
    <section id="who" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-10 lg:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-accent-ink">Who it&rsquo;s for</p>
          <h2 className="mt-2 text-[32px] leading-10 font-semibold tracking-[-0.015em] text-balance">
            One clinic, a seat for everyone in it
          </h2>
          <p className="mt-3 text-base leading-6 text-pretty text-ink-muted">
            Each person signs in to the part of Medfave that&rsquo;s theirs, and sees only what their
            role needs.
          </p>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => (
            <li key={r.who} className="rounded-lg border border-border bg-surface p-6">
              <h3 className="text-lg font-semibold">{r.who}</h3>
              <p className="mt-2 text-sm leading-5 text-pretty text-ink-muted">{r.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <section className="border-t border-border bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-24">
        <h2 className="text-[32px] leading-10 font-semibold tracking-[-0.015em] text-balance">
          A chart belongs to the doctor who wrote it
        </h2>
        <div className="space-y-4 text-base leading-6 text-pretty text-ink-muted">
          <p>
            Everything a doctor creates in Medfave is visible to that doctor only. A patient signing in
            sees their own records and nobody else&rsquo;s, and the front desk works the schedule
            without reading clinical notes.
          </p>
          <p>
            Allergies and alerts are marked in a true red, well apart from the brand&rsquo;s pink, so a
            warning can never be mistaken for decoration.
          </p>
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="bg-brand-plum">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div>
          <h2 className="text-[32px] leading-10 font-semibold tracking-[-0.015em] text-white">
            Ready when your clinic is.
          </h2>
          <p className="mt-2 text-base leading-6 text-white/80">
            Doctors sign up and set up their clinic; we check every license first. Patients sign up,
            or activate with the code their clinic gives them.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-base font-semibold text-brand-plum transition-colors hover:bg-brand-blush"
          >
            Create an account
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full border border-white/40 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
