"use client";

import { useRef, type ReactNode } from "react";
import { buttonClass } from "@/components/ui";

/**
 * A quiet button that opens a dialog around a form: for a rare chart action
 * that shouldn't take a card of its own (styled like "Archive this chart",
 * without the danger colour).
 */
export function ActionDialog({
  label,
  title,
  action,
  submitLabel,
  children,
}: {
  label: string;
  title: string;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
      >
        {label}
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
          <div className="space-y-3 px-6 pt-6 pb-4">
            <h2 className="font-display text-lg leading-6 font-semibold tracking-[-0.01em]">{title}</h2>
            {children}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
            <button type="button" onClick={() => dialog.current?.close()} className={buttonClass("secondary")}>
              Cancel
            </button>
            <button className={buttonClass("primary")}>{submitLabel}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
