"use client";

import { useRef } from "react";

/*
 * An iPhone 16 Pro in CSS 3D, to its real proportions: 71.5 × 149.6 × 8.25 mm,
 * corner radius ~9.5 mm, a ~1.4 mm black bezel. Sizes are in container units
 * (cqw = 1% of the phone's width), so it scales with whatever width it's given.
 *
 * Depth: the titanium band is a stack of rounded slices between the glass front
 * and the back, shaded so the edge reads as a rounded band. The buttons sit on
 * the side faces where the real ones are: Action and volume on the left; side
 * button and Camera Control on the right. They show when the phone turns.
 *
 * It tilts toward the mouse pointer and turns into place on scroll (globals.css);
 * with reduced motion it stays still. `turn` is its resting angle in degrees.
 */
const DEPTH = 11.5; // cqw: 8.25 mm of 71.5 mm
const SLICES = 18;

const BAND = ["#e9e6ec", "#c9c5cd", "#a39fa8", "#8a8690", "#7a7680", "#8a8690", "#a39fa8", "#c9c5cd", "#dedbe2"];

export function IPhone({
  src,
  alt,
  turn = 0,
  className = "",
  priority = false,
  flat = false,
  lite = false,
}: {
  src: string;
  alt: string;
  turn?: number;
  className?: string;
  priority?: boolean;
  /** Just the front: no edge slices, sides or tilt. Light enough for a phone's GPU. */
  flat?: boolean;
  /** Fewer edge slices (6, not 18): the 3D phone on a phone's GPU. */
  lite?: boolean;
}) {
  const body = useRef<HTMLDivElement>(null);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    body.current?.style.setProperty("--rx", `${-y * 10}deg`);
    body.current?.style.setProperty("--ry", `${turn + x * 18}deg`);
  };
  const leave = () => {
    body.current?.style.setProperty("--rx", "0deg");
    body.current?.style.setProperty("--ry", `${turn}deg`);
  };

  return (
    <div className={`[container-type:inline-size] [perspective:1600px] ${className}`} onPointerMove={move} onPointerLeave={leave}>
      <div
        ref={body}
        style={{ ["--rx" as string]: "0deg", ["--ry" as string]: `${turn}deg` }}
        className={flat ? "relative aspect-[71.5/149.6] w-full" : "iphone-turn relative aspect-[71.5/149.6] w-full [transform-style:preserve-3d] [transform:rotateX(var(--rx))_rotateY(var(--ry))] transition-transform duration-500 ease-out"}
      >

        {!flat && <>
        {/* the titanium band: slices from the front to the back */}
        {Array.from({ length: lite ? 6 : SLICES }, (_, i) => {
          const t = i / ((lite ? 6 : SLICES) - 1);
          return (
            <div
              key={i}
              aria-hidden
              className="iphone-r0 absolute inset-0"
              style={{
                transform: `translateZ(${-0.3 - t * (DEPTH - 0.6)}cqw)`,
                background: BAND[Math.round(t * (BAND.length - 1))],
              }}
            />
          );
        })}
        {/* the back glass */}
        <div aria-hidden className="iphone-r0 absolute inset-0 bg-[#4b4650]" style={{ transform: `translateZ(${-DEPTH}cqw) rotateY(180deg)` }} />

        {/* the side faces, carrying the buttons */}
        <Side side="left">
          <Button top={17.5} len={4.6} />
          <Button top={25} len={8} />
          <Button top={35} len={8} />
        </Side>
        <Side side="right">
          <Button top={26} len={12.5} />
          <Button top={59} len={7} flush />
        </Side>
        </>}

        {/* the front: a hairline of polished titanium, the black bezel, the screen */}
        <div className="iphone-r0 absolute inset-0 bg-gradient-to-br from-[#f2f0f4] via-[#9d99a3] to-[#e2dfe6] p-[0.9%] shadow-[0_18px_30px_-18px_rgb(50_19_44/0.45)]">
          <div className="iphone-r1 relative h-full w-full bg-black p-[2.3%]">
            <div className="iphone-r2 relative h-full w-full overflow-hidden bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- already-sized webp; next/image skipped loading it inside the 3D transform */}
              <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" className="absolute inset-0 h-full w-full object-cover object-top" />
              <span aria-hidden className="absolute top-[1.55%] left-1/2 h-[3.55%] w-[30%] -translate-x-1/2 rounded-full bg-black" />
              <span aria-hidden className="iphone-glare pointer-events-none absolute inset-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A side face of the phone: a plane turned 90° at the edge, spanning the depth. */
function Side({ side, children }: { side: "left" | "right"; children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="absolute top-[7%] bottom-[7%] [backface-visibility:hidden] [transform-style:preserve-3d]"
      style={{
        width: `${DEPTH}cqw`,
        [side]: 0,
        transformOrigin: side === "left" ? "left center" : "right center",
        transform: side === "left" ? "rotateY(90deg)" : "rotateY(-90deg)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * A button on a side face, standing out from the band. `top` and `len` are
 * percentages of the phone's height (measured on the 16 Pro; the face starts at 7%).
 * Camera Control sits flush, in sapphire.
 */
function Button({ top, len, flush = false }: { top: number; len: number; flush?: boolean }) {
  return (
    <span
      className="absolute left-1/2 -translate-x-1/2"
      style={{
        top: `${((top - 7) / 86) * 100}%`,
        height: `${(len / 86) * 100}%`,
        width: flush ? "48%" : "40%",
        borderRadius: 999,
        transform: `translateX(-50%) translateZ(${flush ? -0.15 : -0.6}cqw)`,
        background: flush ? "linear-gradient(90deg,#3a3740,#57535c,#3a3740)" : "linear-gradient(90deg,#8d8993,#d7d4db,#8d8993)",
      }}
    />
  );
}
