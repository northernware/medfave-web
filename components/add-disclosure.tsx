"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * "+ Add …" that folds open under a list, and folds away again on a click or
 * tap anywhere else (or Esc). What was typed stays, in case it's reopened.
 */
export function AddDisclosure({ label, summaryClassName, children }: { label: string; summaryClassName: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return (
    <details ref={ref} className="mt-2 text-sm">
      <summary className={`cursor-pointer list-none text-xs font-semibold underline-offset-2 hover:underline ${summaryClassName}`}>+ {label}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
