"use client";

import { useRef } from "react";
import { DangerTriangleIcon } from "@solar-icons/react/linear/danger-triangle";
import { TrashBinMinimalistic2Icon } from "@solar-icons/react/linear/trash-bin-minimalistic-2";
import { buttonClass } from "./ui";
import { Footer, TypedConfirm } from "./typed-confirm";

/**
 * An action that cannot be taken back, kept out of the way of the work: a
 * quiet line at the foot of a page, and a dialog that asks properly. The page
 * stays calm; the red is spent in the dialog, on the button that does it.
 */
export function DangerZone({
  action,
  fieldName,
  fieldValue,
  summary,
  warning,
  confirmLabel,
  variant = "danger",
  confirmPhrase,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  fieldName: string;
  fieldValue: string;
  summary: string;
  warning: string;
  confirmLabel: string;
  /** Archiving is reversible, so it does not have to look like deletion. */
  variant?: "danger" | "secondary";
  /** A permanent deletion: the button waits for this to be typed (and the action checks it again). */
  confirmPhrase?: string;
  /** Extra fields the action needs — a reason, most often. */
  children?: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const loud = variant === "danger";
  const cancel = (
    <button type="button" onClick={() => dialog.current?.close()} className={buttonClass("secondary")}>
      Cancel
    </button>
  );

  return (
    <div className="flex justify-end pt-1">
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-faint transition-colors hover:bg-danger-tint hover:text-danger-ink"
      >
        {loud ? <TrashBinMinimalistic2Icon aria-hidden className="size-4" /> : null}
        {summary}
      </button>

      {/* Closes on Escape and on a click outside, as a dialog should. */}
      <dialog
        ref={dialog}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-left text-ink shadow-card backdrop:bg-[oklch(0.15_0.03_340/0.55)] backdrop:backdrop-blur-[2px]"
      >
        <form action={action} onClick={(e) => e.stopPropagation()}>
          <input type="hidden" name={fieldName} value={fieldValue} />
          <div className="flex items-start gap-4 px-6 pt-6 pb-4">
            {loud ? (
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger-tint text-danger">
                <DangerTriangleIcon aria-hidden className="size-5" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="font-display text-lg leading-6 font-semibold tracking-[-0.01em]">{summary}?</h2>
              <p className="mt-1.5 text-sm leading-6 text-pretty text-ink-muted">{warning}</p>
            </div>
          </div>
          {children ? <div className="px-6 pb-4">{children}</div> : null}
          {confirmPhrase ? (
            <TypedConfirm phrase={confirmPhrase} confirmLabel={confirmLabel} cancel={cancel} />
          ) : (
            <Footer cancel={cancel} confirmLabel={confirmLabel} variant={loud ? "dangerSolid" : "primary"} />
          )}
        </form>
      </dialog>
    </div>
  );
}
