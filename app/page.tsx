import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer, homeFor } from "@/lib/auth";
import { HeartMark, Lockup } from "@/components/brand";
import { CursorLight, IcdDemo } from "@/components/landing/effects";
import { HeroFilm } from "@/components/landing/film";
import { IPhone } from "@/components/landing/iphone";
import { Phones3D, type PhoneSpec } from "@/components/landing/phones-3d";
import { Story, type StoryStep } from "@/components/landing/story";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import { buttonClass } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: { absolute: "Medfave — the whole visit, in one place" },
  description:
    "Medfave keeps the whole visit in one place for doctors and clinics in the Philippines: the day, the chart, ICD-11 coded notes, certificates and the family. On the web today; apps coming soon.",
};

/*
 * The public front door. Anyone signed in already has a home, and it is not a
 * sales page: they go straight to it.
 *
 * Doctors and clinics first: the web app is live for them today. The iPhone and
 * Android apps are coming soon, so the page collects a waitlist for them.
 */
export default async function LandingPage() {
  const viewer = await getViewer();
  if (viewer) redirect(homeFor(viewer));

  return (
    <CursorLight>
    <div className="flex min-h-dvh flex-col bg-canvas">
      <Header />
      <main className="flex-1">
        <Hero />
        <PaperTrail />
        <Product />
        <Trained />
        <Apps />
        <Closing />
      </main>
      <Footer />
    </div>
    </CursorLight>
  );
}

const wrap = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10";
/** Coloured sections are inset panels with large rounded corners, not hard full-width bands. */
const panel = "relative mx-2 overflow-hidden rounded-[32px] sm:mx-4 sm:rounded-[44px]";

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-canvas/80 backdrop-blur-xl">
      <div className={`${wrap} flex items-center justify-between gap-4 py-3`}>
        <Link href="/" aria-label="Medfave home" className="rounded-md focus-visible:outline-2 focus-visible:outline-accent">
          <Lockup className="h-7 w-auto" />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <div className="hidden items-center gap-1 md:flex">
            <a href="#product" className={buttonClass("ghost")}>Product</a>
            <a href="#trained" className={buttonClass("ghost")}>For doctors</a>
            <a href="#apps" className={buttonClass("ghost")}>Apps</a>
          </div>
          <span className="hidden sm:block"><ThemeToggle /></span>
          <Link href="/login" className={buttonClass("secondary")}>Sign in</Link>
          <span className="hidden sm:block"><Link href="/signup?as=doctor" className={buttonClass("primary")}>Get started</Link></span>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="landing-glow pointer-events-none absolute -top-48 -right-40 size-[720px] rounded-full bg-[radial-gradient(circle,rgb(233_30_131/0.22),rgb(253_231_241/0.6)_45%,transparent_70%)] blur-2xl" />
      <div aria-hidden className="landing-glow-2 pointer-events-none absolute top-72 -left-56 size-[620px] rounded-full bg-[radial-gradient(circle,rgb(253_231_241/0.9),rgb(233_30_131/0.12)_50%,transparent_72%)] blur-2xl" />
      <div aria-hidden className="landing-pattern-fade landing-pattern-drift pointer-events-none absolute inset-x-0 top-[38%] h-[70%] bg-[url(/landing/pattern-hearts.svg)] bg-[length:180px_120px] opacity-60 dark:opacity-15" />
      <div className={`${wrap} relative pt-16 pb-20 lg:pt-24 lg:pb-28`}>
        <div className="mx-auto max-w-4xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-4 py-1.5 text-sm font-semibold text-accent-ink shadow-[var(--shadow-card)]">
            <HeartMark className="size-4" tone="accent" />
            For doctors and clinics in the Philippines
          </p>
          <h1 className="mt-6 text-[38px] leading-[1.08] font-semibold tracking-[-0.03em] text-balance sm:text-[52px] lg:text-[64px]">
            The whole visit,{" "}
            <span className="text-accent-ink">in one place.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-pretty text-ink-muted sm:text-lg sm:leading-8">
            Your day, the chart, notes coded to ICD-11, certificates and the patient&rsquo;s family — kept together,
            so you can give the visit your full attention.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/signup?as=doctor" className={buttonClass("primary", "min-h-12 px-7 text-base")}>
              Start free on the web
            </Link>
            <a href="#apps" className={buttonClass("secondary", "min-h-12 px-7 text-base")}>
              Join the app waitlist
            </a>
          </div>
          <p className="mt-5 text-sm text-ink-faint">On the web today · iPhone and Android apps coming soon</p>
        </div>
        <div className="landing-rise relative mx-auto mt-14 max-w-5xl lg:mt-20">
          <div aria-hidden className="absolute -inset-x-10 -bottom-10 top-1/3 rounded-[48px] bg-[radial-gradient(ellipse_at_50%_80%,rgb(233_30_131/0.35),transparent_65%)] blur-2xl" />
          <HeroFilm />
        </div>
      </div>
    </section>
  );
}

const PAPER = [
  ["The chart", "in a folder, allergies on page three"],
  ["The follow-up", "on a sticky note, with no reminder sent"],
  ["The certificate", "filled in by hand, waiting to be signed"],
  ["The vaccines", "in a booklet that stayed at home"],
];

function PaperTrail() {
  return (
    <section aria-labelledby="paper-title" className={`${panel} landing-spot text-[#fff9fc]`}>
      <div aria-hidden className="landing-pattern-drift pointer-events-none absolute inset-0 bg-[url(/landing/pattern-plum.svg)] bg-[length:180px_120px] opacity-70 [mask-image:linear-gradient(to_bottom,transparent,#000_30%,#000_70%,transparent)]" />
      <div className={`${wrap} relative py-20 lg:py-28`}>
        <div className="landing-rise max-w-3xl">
          <p className="text-sm font-semibold tracking-[0.14em] text-brand-blush uppercase">Why we built it</p>
          <h2 id="paper-title" className="mt-4 text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance sm:text-[40px]">
            One patient, one visit, and usually a trail of paper.
          </h2>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PAPER.map(([t, d], i) => (
            <li key={t} className="landing-rise spot-card rounded-3xl bg-[#3e2139]/90 p-7 ring-1 ring-white/8 backdrop-blur-sm" style={{ animationRangeStart: `entry ${i * 6}%` }}>
              <p className="text-lg font-semibold">{t}</p>
              <p className="mt-2 leading-7 text-[#c6b9c2]">{d}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STEPS: StoryStep[] = [
  { id: "today", mobileImage: "/landing/app-today.webp", eyebrow: "Today", title: "Your day, at a glance.", body: "Who is with you, who is waiting and for how long, and the follow-ups that are due. Add a walk-in in one tap.", image: "/landing/web-dashboard.webp", alt: "The Medfave dashboard: today’s counts, the waiting room and upcoming visits" },
  { id: "chart", mobileImage: "/landing/app-chart.webp", eyebrow: "The chart", title: "Her whole picture, before you say hello.", body: "Allergies in red and alerts you can’t miss, then her conditions, medicines and history — past, family, personal and social, OB.", image: "/landing/web-corazon.webp", alt: "A patient’s chart: visit history, appointments, allergies, alerts and history" },
  { id: "schedule", mobileImage: "/landing/app-visits.webp", eyebrow: "The schedule", title: "Book the follow-up before she leaves.", body: "Every visit on its day. Patients ask for a time and you confirm it; a reminder goes out the day before.", image: "/landing/web-calendar.webp", alt: "The month calendar with visits on each day" },
  { id: "households", mobileImage: "/landing/app-house.webp", eyebrow: "Households", title: "The whole family, one tap away.", body: "Relatives grouped together, each with a chart of their own: a child’s vaccines, an emergency contact, hereditary risk.", image: "/landing/web-households.webp", alt: "The households list with members" },
  { id: "documents", mobileImage: "/landing/app-cert.webp", eyebrow: "Documents", title: "The certificate, done before she reaches the door.", body: "Filled in from the visit, signed, and shared to the patient — or printed.", image: "/landing/web-documents.webp", alt: "Documents: a medical certificate ready to collect" },
  { id: "feedback", mobileImage: "/landing/app-pfeed.webp", eyebrow: "Patient feedback", title: "Hear how the visit went.", body: "One tap after the visit, a few words if they like. Only your clinic sees it.", image: "/landing/web-feedback.webp", alt: "Patient feedback: average rating and recent comments" },
];

function Product() {
  return (
    <section id="product" aria-labelledby="product-title" className="scroll-mt-20">
      <div className={`${wrap} py-20 lg:py-28`}>
        <div className="landing-rise max-w-3xl">
          <p className="text-sm font-semibold tracking-[0.14em] text-accent-ink uppercase">On the web, today</p>
          <h2 id="product-title" className="mt-4 text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance sm:text-[40px]">
            Everything about the visit, from the first hello to the follow-up.
          </h2>
        </div>
        <div className="relative mt-14">
          <div aria-hidden className="landing-dots pointer-events-none absolute -inset-x-6 -inset-y-10 -z-0" />
          <Story steps={STEPS} />
        </div>
      </div>
    </section>
  );
}

function Trained() {
  return (
    <section id="trained" aria-labelledby="trained-title" className={`${panel} scroll-mt-20 bg-surface-muted/70 ring-1 ring-border/60`}>
      <div aria-hidden className="landing-dots pointer-events-none absolute inset-0 opacity-60" />
      <div className={`${wrap} relative py-20 lg:py-28`}>
        <div className="landing-rise max-w-3xl">
          <p className="text-sm font-semibold tracking-[0.14em] text-accent-ink uppercase">For doctors</p>
          <h2 id="trained-title" className="mt-4 text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance sm:text-[40px]">
            Taken the way you were trained.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-6">
          <article className="landing-rise flex flex-col overflow-hidden spot-card rounded-3xl bg-surface p-7 shadow-[var(--shadow-card)] ring-1 ring-border/70 lg:col-span-4">
            <h3 className="text-xl font-semibold tracking-[-0.01em]">Diagnoses coded to ICD-11</h3>
            <p className="mt-2 max-w-lg leading-7 text-ink-muted">Search in plain words. Medfave finds the code, and ongoing diagnoses join the chart when the note is signed.</p>
            <IcdDemo />
            <p className="mt-4 text-xs text-ink-faint">ICD-11 MMS © World Health Organization, CC BY-ND 3.0 IGO</p>
          </article>

          <article className="landing-rise flex flex-col spot-card rounded-3xl bg-surface p-7 shadow-[var(--shadow-card)] ring-1 ring-border/70 lg:col-span-2">
            <h3 className="text-xl font-semibold tracking-[-0.01em]">The full history</h3>
            <p className="mt-2 leading-7 text-ink-muted">Past, family, personal and social, OB — and birth and immunizations for children.</p>
            <dl className="mt-6 space-y-3 text-sm">
              {[["Past", "Cholecystectomy 2009 · Pneumonia 2018"], ["Family", "Hypertension (mother)"], ["Social", "Never smoked · retired teacher"], ["OB", "G3 P3 (3-0-0-3)"]].map(([k, v]) => (
                <div key={k} className="flex gap-4 border-b border-border pb-3">
                  <dt className="w-14 font-semibold">{k}</dt>
                  <dd className="text-ink-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </article>

          <article className="landing-rise spot-card rounded-3xl bg-surface p-7 shadow-[var(--shadow-card)] ring-1 ring-border/70 lg:col-span-2">
            <h3 className="text-xl font-semibold tracking-[-0.01em]">Allergies first</h3>
            <p className="mt-2 leading-7 text-ink-muted">In red at the top of every chart and every note, so they&rsquo;re never on page three.</p>
            <div className="mt-6 flex flex-wrap gap-2" aria-hidden>
              <span className="rounded-full bg-danger-soft px-4 py-2 font-semibold text-danger-ink">Sulfa drugs</span>
              <span className="rounded-full bg-danger-tint px-4 py-2 font-semibold text-danger-ink">Shellfish</span>
            </div>
          </article>

          <article className="landing-rise spot-card rounded-3xl bg-surface p-7 shadow-[var(--shadow-card)] ring-1 ring-border/70 lg:col-span-2">
            <h3 className="text-xl font-semibold tracking-[-0.01em]">Certificates in a minute</h3>
            <p className="mt-2 leading-7 text-ink-muted">Sick leave, fit to work, school, clearance. Choose the days of rest, sign, share.</p>
            <div className="mt-6 flex items-center justify-between rounded-2xl bg-canvas px-5 py-4" aria-hidden>
              <span className="text-xl text-ink-faint">‹</span>
              <span className="text-center"><span className="block text-lg font-semibold">3 days</span><span className="text-sm text-ink-muted">back Oct 24</span></span>
              <span className="text-xl">›</span>
            </div>
          </article>

          <article className="landing-rise spot-card rounded-3xl bg-surface p-7 shadow-[var(--shadow-card)] ring-1 ring-border/70 lg:col-span-2">
            <h3 className="text-xl font-semibold tracking-[-0.01em]">Vaccines on the national schedule</h3>
            <p className="mt-2 leading-7 text-ink-muted">Every child&rsquo;s doses, from BCG at birth to MMR at 12 months.</p>
            <div className="mt-6 flex flex-wrap gap-2" aria-hidden>
              {["BCG", "Hep B", "Penta 1", "Penta 2", "Penta 3", "OPV 1", "PCV 1", "MMR 1"].map((d, i) => (
                <span key={d} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${i < 6 ? "vax-chip bg-ok-soft text-ok-ink" : "bg-surface-muted text-ink-muted"}`} style={i < 6 ? { animationRange: `entry ${40 + i * 7}% cover ${48 + i * 7}%` } : undefined}>{d}</span>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function StoreBadge({ store }: { store: "apple" | "google" }) {
  return (
    <span className="inline-flex min-h-12 items-center gap-3 rounded-2xl border border-brand-plum/20 bg-brand-plum px-4 py-2 text-white dark:border-white/20">
      {store === "apple" ? (
        <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden><path d="M16.4 12.6c0-2.5 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3.1-.5 7.6 1.3 10.1.8 1.2 1.8 2.6 3.1 2.5 1.3-.1 1.7-.8 3.3-.8 1.5 0 1.9.8 3.3.8 1.4 0 2.2-1.2 3-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4zM14 5.2c.7-.8 1.2-2 1-3.2-1 .1-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3.1 1.1.1 2.2-.6 2.9-1.4z" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden><path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" /></svg>
      )}
      <span className="leading-tight">
        <span className="block text-[11px] opacity-80">Coming soon to</span>
        <span className="block text-base font-semibold">{store === "apple" ? "the App Store" : "Google Play"}</span>
      </span>
    </span>
  );
}

const APP_PHONES: [PhoneSpec, PhoneSpec, PhoneSpec] = [
  { src: "/landing/app-today.webp", alt: "Doctor app: Today, with the patient in consultation and the waiting room" },
  { src: "/landing/app-chart.webp", alt: "Doctor app: a patient’s chart with allergies and medical alerts" },
  { src: "/landing/app-phome.webp", alt: "Patient app: the next visit and days to ask for a time" },
];

function Apps() {
  return (
    <section id="apps" aria-labelledby="apps-title" className={`${panel} mt-4 scroll-mt-20 bg-brand-blush text-brand-plum dark:bg-accent-soft dark:text-ink`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url(/landing/pattern-hearts.svg)] bg-[length:180px_120px] opacity-70 [mask-image:radial-gradient(ellipse_70%_70%_at_75%_50%,#000_10%,transparent_75%)] dark:opacity-10" />
      <div className={`${wrap} relative grid items-center gap-14 py-20 lg:grid-cols-2 lg:py-28`}>
        <div className="landing-rise">
          <p className="text-sm font-semibold tracking-[0.14em] text-accent uppercase dark:text-accent-ink">Coming soon · iPhone and Android</p>
          <h2 id="apps-title" className="mt-4 text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance sm:text-[40px]">
            The same chart, in your pocket.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-pretty sm:text-lg sm:leading-8 text-brand-plum/80 dark:text-ink-muted">
            The doctor app brings Today, the chart, notes and certificates to the ward and the room. The patient app gives
            your patients — and their families — their visits, reminders and documents. Both use the same records as the web.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <StoreBadge store="apple" />
            <StoreBadge store="google" />
          </div>
          <div className="mt-10 max-w-lg">
            <h3 className="mb-4 text-xl font-semibold">Be the first to know</h3>
            <WaitlistForm />
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-2xl">
          <div aria-hidden className="absolute inset-x-[12%] bottom-[6%] h-10 rounded-[50%] bg-brand-plum/30 blur-2xl dark:bg-black/50" />
          <Phones3D
            phones={APP_PHONES}
            fallback={
              <div className="flex items-center justify-center gap-3 px-2 sm:gap-6 sm:px-0">
                <IPhone src={APP_PHONES[0].src} alt={APP_PHONES[0].alt} turn={22} className="w-[31%] translate-y-6" />
                <IPhone src={APP_PHONES[1].src} alt={APP_PHONES[1].alt} className="z-10 w-[35%]" />
                <IPhone src={APP_PHONES[2].src} alt={APP_PHONES[2].alt} turn={-22} className="w-[31%] translate-y-6" />
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section aria-labelledby="closing-title" className={`${panel} my-4 bg-brand text-white`}>
      <div aria-hidden className="landing-pattern-drift pointer-events-none absolute inset-0 bg-[url(/landing/pattern-tonal.svg)] bg-[length:180px_120px]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_45%,#e91e83_30%,transparent_80%)]" />
      <div className={`${wrap} relative flex flex-col items-center py-20 text-center lg:py-28`}>
        <Lockup className="h-12 w-auto sm:h-16" tone="white" />
        <h2 id="closing-title" className="mt-8 text-[32px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[48px]">
          Care that remembers.
        </h2>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/signup?as=doctor" className="inline-flex min-h-12 items-center rounded-full bg-white px-7 text-base font-semibold text-accent shadow-lg transition-transform hover:scale-[1.03]">
            Start free on the web
          </Link>
          <a href="#apps" className="inline-flex min-h-12 items-center rounded-full border-2 border-white/80 px-7 text-base font-semibold text-white transition-colors hover:bg-white/10">
            Join the app waitlist
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className={`${wrap} flex flex-col gap-6 py-10 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex items-center gap-4">
          <Lockup className="h-6 w-auto" />
          <span>by Northernware®</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/login" className="hover:text-ink">Sign in</Link>
          <Link href="/register" className="hover:text-ink">Activate a patient account</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}

