"use client";

import { type ReactNode, useActionState, useEffect, useRef } from "react";
import { changeChart, type ChartFormState } from "@/app/actions/chart";

/**
 * One change to the chart from the side column: an Add form, or a single
 * button (remove, resolve, stop). Says why it was refused, if it was.
 */
export function ChartForm({
  patientId,
  action,
  id,
  className = "",
  children,
}: {
  patientId: string;
  action: string;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<ChartFormState, FormData>(changeChart, {});
  const form = useRef<HTMLFormElement>(null);
  // A successful add starts the form again empty, and folds its "+ Add" away.
  useEffect(() => {
    if (!state.ok) return;
    form.current?.reset();
    form.current?.closest("details")?.removeAttribute("open");
  }, [state]);
  return (
    <form ref={form} action={formAction} className={className} aria-busy={pending || undefined}>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="action" value={action} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {children}
      {state.message ? <p className="mt-1 text-xs text-danger-ink">{state.message}</p> : null}
    </form>
  );
}
