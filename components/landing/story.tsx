"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type StoryStep = { id: string; eyebrow: string; title: string; body: string; image: string; alt: string; mobileImage: string };

/*
 * The product, told as a scroll: the steps scroll past on the right while one
 * browser window stays pinned on the left and changes to the step in view.
 * Below the large breakpoint there is no pinning: each step shows the same screen
 * from the phone app, which reads at phone size where a desktop screenshot can't.
 */
export function Story({ steps }: { steps: StoryStep[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const seen = new Map<number, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(Number((e.target as HTMLElement).dataset.i), e.intersectionRatio);
        let best = 0, ratio = -1;
        for (const [i, r] of seen) if (r > ratio) { best = i; ratio = r; }
        setActive(best);
      },
      { rootMargin: "-35% 0px -35% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
      <div className="hidden lg:block">
        <div className="sticky top-28">
          <BrowserFrame>
            <div className="relative aspect-[16/10]">
              {steps.map((s, i) => (
                <Image
                  key={s.id}
                  src={s.image}
                  alt={i === active ? s.alt : ""}
                  aria-hidden={i !== active}
                  fill
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className={`object-cover object-top transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${i === active ? "scale-100 opacity-100" : "scale-[1.015] opacity-0"}`}
                />
              ))}
            </div>
          </BrowserFrame>
          <ol className="mt-5 flex justify-center gap-2" aria-hidden>
            {steps.map((s, i) => (
              <li key={s.id} className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-8 bg-accent" : "w-1.5 bg-border-strong"}`} />
            ))}
          </ol>
        </div>
      </div>

      <div className="flex flex-col gap-10 lg:gap-0">
        {steps.map((s, i) => (
          <section
            key={s.id}
            data-i={i}
            ref={(el) => { refs.current[i] = el; }}
            aria-labelledby={`story-${s.id}`}
            className="flex flex-col justify-center lg:min-h-[78vh]"
          >
            <p className="text-sm font-semibold tracking-[0.12em] text-accent-ink uppercase">{s.eyebrow}</p>
            <h3 id={`story-${s.id}`} className="mt-3 text-[32px] leading-10 font-semibold tracking-[-0.02em] text-balance lg:text-[40px] lg:leading-[48px]">
              {s.title}
            </h3>
            <p className="mt-4 max-w-md text-lg leading-7 text-pretty text-ink-muted">{s.body}</p>
            <div className="mt-8 flex justify-center lg:hidden">
              <div className="w-[min(72vw,280px)] overflow-hidden rounded-[36px] border-[6px] border-brand-plum bg-brand-plum shadow-[0_24px_60px_-20px_rgb(50_19_44/0.4)]">
                <Image src={s.mobileImage} alt={s.alt} width={603} height={1311} sizes="72vw" className="h-auto w-full rounded-[30px]" />
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-border bg-surface shadow-[0_30px_80px_-20px_rgb(50_19_44/0.25)]">
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-muted px-4 py-3" aria-hidden>
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="ml-3 rounded-full bg-surface px-3 py-0.5 text-xs text-ink-faint">medfave.vercel.app</span>
      </div>
      {children}
    </div>
  );
}
