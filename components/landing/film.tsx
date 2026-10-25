"use client";

import { useEffect, useRef } from "react";

/*
 * The hero: a silent loop cut from the introduction film, and a button that
 * opens the full film (with sound) in a dialog. With reduced motion the loop
 * doesn't autoplay; the poster stands in.
 */
export function HeroFilm() {
  const dialog = useRef<HTMLDialogElement>(null);
  const film = useRef<HTMLVideoElement>(null);
  const loop = useRef<HTMLVideoElement>(null);

  // the loop plays only while it's on screen
  useEffect(() => {
    const v = loop.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-[28px] border border-border bg-brand-plum shadow-[0_12px_28px_-14px_rgb(50_19_44/0.35)] sm:shadow-[0_40px_100px_-30px_rgb(50_19_44/0.45)]">
        <video
          ref={loop}
          className="aspect-video w-full object-cover motion-reduce:hidden"
          src="/landing/hero-loop.mp4"
          poster="/landing/hero-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing/hero-poster.jpg" alt="" className="hidden aspect-video w-full object-cover motion-reduce:block" />
      </div>
      <button
        type="button"
        onClick={() => { dialog.current?.showModal(); film.current?.play(); }}
        className="absolute bottom-4 left-4 inline-flex min-h-11 items-center gap-3 rounded-full bg-white/95 py-2 pr-5 pl-2 text-sm font-semibold text-brand-plum shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:bottom-6 sm:left-6"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-accent text-white" aria-hidden>
          <svg viewBox="0 0 24 24" className="ml-0.5 size-4" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
        </span>
        Watch the film · 1:35
      </button>

      <dialog
        ref={dialog}
        onClose={() => film.current?.pause()}
        onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}
        className="m-auto w-[min(92vw,1100px)] overflow-visible bg-transparent p-0 backdrop:bg-black/80"
        aria-label="Medfave introduction film"
      >
        <video ref={film} className="w-full rounded-2xl" src="/landing/medfave-film.mp4" poster="/landing/film-poster.jpg" controls playsInline preload="none" />
        <form method="dialog" className="mt-3 text-right">
          <button className="min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-brand-plum">Close</button>
        </form>
      </dialog>
    </div>
  );
}
