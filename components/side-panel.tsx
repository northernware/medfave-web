"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

/**
 * A panel that slides over the right of the page, for a quick look without
 * losing your place. It is a route (an intercepted one), so closing it is
 * going back: the close button, Esc and the backdrop all do that.
 */
export function SidePanel({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    document.addEventListener("keydown", onKey);
    // The page underneath stays put while the panel scrolls.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [router]);

  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden className="absolute inset-0 bg-black/40 motion-safe:animate-[fade-in_150ms_ease-out]" onClick={() => router.back()} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-surface shadow-2xl outline-none motion-safe:animate-[slide-in_200ms_ease-out]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          <p className="truncate font-display text-base font-semibold">{title}</p>
          <button type="button" onClick={() => router.back()} className="rounded-md px-2 py-1 text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
