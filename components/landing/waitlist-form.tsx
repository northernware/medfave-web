"use client";

import Link from "next/link";
import { useActionState } from "react";
import { waitlist, type WaitlistState } from "@/app/actions/waitlist";
import { buttonClass } from "@/components/ui";

const ROLES = [
  { value: "DOCTOR", label: "Doctor" },
  { value: "CLINIC", label: "Clinic staff" },
  { value: "PATIENT", label: "Patient" },
];

/** The app waitlist: an email, who they are, and where they work if they like. */
export function WaitlistForm() {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(waitlist, {});

  if (state.ok) {
    return (
      <p role="status" className="rounded-2xl bg-surface p-6 text-lg leading-7 font-medium text-ink shadow-[var(--shadow-card)]">
        {state.message}
      </p>
    );
  }

  const v = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-5 rounded-3xl bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8" noValidate>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">I&rsquo;m a</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <label key={r.value} className="cursor-pointer">
              <input type="radio" name="role" value={r.value} defaultChecked={(v.role || "DOCTOR") === r.value} className="peer sr-only" />
              <span className="inline-flex min-h-11 items-center rounded-full border border-border-strong px-5 text-sm font-semibold transition-colors peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                {r.label}
              </span>
            </label>
          ))}
        </div>
        {state.field === "role" ? <p className="mt-2 text-sm text-danger-ink">{state.message}</p> : null}
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={v.email}
          aria-invalid={state.field === "email" || undefined}
          aria-describedby={state.field === "email" ? "waitlist-email-error" : undefined}
          placeholder="name@example.com"
          className="min-h-12 rounded-xl border border-border-strong bg-canvas px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
        {state.field === "email" ? <span id="waitlist-email-error" className="text-sm text-danger-ink">{state.message}</span> : null}
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink">
          Clinic or hospital <span className="font-normal text-ink-faint">(optional)</span>
        </span>
        <input
          name="organization"
          autoComplete="organization"
          maxLength={120}
          defaultValue={v.organization}
          className="min-h-12 rounded-xl border border-border-strong bg-canvas px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
      </label>

      {state.message && !state.field ? <p role="alert" className="text-sm text-danger-ink">{state.message}</p> : null}

      <button type="submit" disabled={pending} className={buttonClass("primary", "min-h-12 px-6 text-base")}>
        {pending ? "Adding you…" : "Join the waitlist"}
      </button>
      <p className="text-xs leading-5 text-ink-faint">
        We&rsquo;ll only use your email to tell you when the apps launch. See our{" "}
        <Link href="/privacy" className="underline">privacy notice</Link>.
      </p>
    </form>
  );
}
