"use client";

import { type ReactNode, useActionState, useEffect, useRef } from "react";
import { changeChart, type ChartFormState } from "@/app/actions/chart";
import { buttonClass } from "@/components/ui";

/**
 * One change to the chart from the side column: an Add form, or a single
 * button (remove, resolve, stop). Says why it was refused, if it was.
 */
export function ChartForm({
  patientId,
  action,
  id,
  confirm,
  className = "",
  children,
}: {
  patientId: string;
  action: string;
  id?: string;
  /** Asked first, in our own dialog ("Remove X? Why…"); nothing happens unless the doctor agrees. */
  confirm?: string;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<ChartFormState, FormData>(changeChart, {});
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const agreed = useRef(false);
  // "Remove Sulfa drugs? Only if…" → a question for the title, the rest beneath it.
  const [question, ...rest] = (confirm ?? "").split(/(?<=\?)\s+/);
  const verb = action.endsWith(".remove") ? "Remove" : action.endsWith(".resolve") ? "Mark resolved" : action.endsWith(".stop") ? "Stop" : "Confirm";
  // A successful add starts the form again empty, and folds its "+ Add" away.
  useEffect(() => {
    if (!state.ok) return;
    form.current?.reset();
    form.current?.closest("details")?.removeAttribute("open");
  }, [state]);
  return (
    <form
      ref={form}
      action={formAction}
      onSubmit={(e) => {
        if (!confirm || agreed.current) {
          agreed.current = false;
          return;
        }
        e.preventDefault();
        dialog.current?.showModal();
      }}
      className={className}
      aria-busy={pending || undefined}
    >
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="action" value={action} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {children}
      {state.message ? <p className="mt-1 text-xs text-danger-ink">{state.message}</p> : null}
      {confirm ? (
        // Closes on Escape and on a click outside, as a dialog should.
        <dialog
          ref={dialog}
          onClick={(e) => {
            if (e.target === dialog.current) dialog.current.close();
          }}
          className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-left text-ink shadow-card backdrop:bg-[oklch(0.15_0.03_340/0.55)] backdrop:backdrop-blur-[2px]"
        >
          <div className="space-y-1.5 px-6 pt-6 pb-4">
            <h2 className="font-display text-lg leading-6 font-semibold tracking-[-0.01em]">{question}</h2>
            {rest.length ? <p className="text-sm text-ink-muted">{rest.join(" ")}</p> : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
            <button type="button" autoFocus onClick={() => dialog.current?.close()} className={buttonClass("secondary")}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                dialog.current?.close();
                agreed.current = true;
                form.current?.requestSubmit();
              }}
              className={buttonClass(verb === "Remove" ? "dangerSolid" : "primary")}
            >
              {verb}
            </button>
          </div>
        </dialog>
      ) : null}
    </form>
  );
}
