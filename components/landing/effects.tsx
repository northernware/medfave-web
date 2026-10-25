"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

/*
 * The cursor light: tracks the pointer (viewport coordinates) as --mx/--my on
 * the page, for the `.spot-card` borders and the plum band's spotlight in
 * globals.css. Mouse only; nothing happens on touch or with reduced motion.
 */
export function CursorLight({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, x = -999, y = -999;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX; y = e.clientY;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { el.style.setProperty("--mx", `${x}px`); el.style.setProperty("--my", `${y}px`); });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={root} className="landing-grain relative">{children}</div>;
}

/* The ICD-11 search, as it behaves in the app: the results change as the word is typed. */
const RESULTS: Record<string, [string, string][]> = {
  hyper: [["5C76", "Hyperkalaemia"], ["9D00.1", "Hypermetropia"], ["5B91.0", "Hypercalcaemia"], ["ED71", "Hypertrichosis"]],
  hyperte: [["BA03", "Hypertensive crisis"], ["BA01", "Hypertensive heart disease"], ["BA02", "Hypertensive renal disease"], ["BA00", "Essential hypertension"]],
  hypertension: [["BA00", "Essential hypertension"], ["9C61.01", "Ocular hypertension"], ["MC80.00", "White coat hypertension"], ["JA23", "Gestational hypertension"]],
};
const WORD = "hypertension";

export function IcdDemo() {
  const box = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(WORD.length);

  useEffect(() => {
    const el = box.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const run = () => {
      let i = 0;
      setN(0);
      const tick = () => { i += 1; setN(i); if (i < WORD.length) timer = window.setTimeout(tick, 95 + Math.random() * 60); };
      timer = window.setTimeout(tick, 500);
    };
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { run(); io.disconnect(); } }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, []);

  const typed = WORD.slice(0, n);
  const key = n >= 12 ? "hypertension" : n >= 7 ? "hyperte" : n >= 5 ? "hyper" : null;
  const rows = key ? RESULTS[key] : [];

  return (
    <div ref={box} className="mt-6 rounded-2xl border border-border bg-canvas p-4" role="img" aria-label="Example: searching hypertension finds BA00, Essential hypertension">
      <p className="flex min-h-12 items-center rounded-xl border border-border bg-surface px-4 text-ink" aria-hidden>
        {typed}
        {n < WORD.length ? <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-accent" /> : null}
      </p>
      <ul className="mt-2 min-h-[176px] divide-y divide-border" aria-hidden>
        {rows.map(([c, name], i) => (
          <li key={c} className={`flex gap-6 px-4 py-2.5 transition-colors duration-300 ${key === "hypertension" && i === 0 ? "rounded-lg bg-accent-tint" : ""}`}>
            <span className="w-20 font-semibold">{c}</span>
            <span className="text-ink-muted">{name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
