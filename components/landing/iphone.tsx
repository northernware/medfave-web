"use client";

import Image from "next/image";
import { useRef } from "react";

/*
 * An iPhone mockup in CSS 3D: a titanium edge with depth, the Dynamic Island,
 * side buttons and a glass glare. It tilts a little toward the pointer; with
 * reduced motion it stays still. `turn` sets its resting angle in degrees.
 */
export function IPhone({
  src,
  alt,
  turn = 0,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  turn?: number;
  className?: string;
  priority?: boolean;
}) {
  const body = useRef<HTMLDivElement>(null);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    body.current?.style.setProperty("--rx", `${-y * 10}deg`);
    body.current?.style.setProperty("--ry", `${turn + x * 16}deg`);
  };
  const leave = () => {
    body.current?.style.setProperty("--rx", "0deg");
    body.current?.style.setProperty("--ry", `${turn}deg`);
  };

  return (
    <div className={`[perspective:1400px] ${className}`} onPointerMove={move} onPointerLeave={leave}>
      <div
        ref={body}
        style={{ ["--rx" as string]: "0deg", ["--ry" as string]: `${turn}deg` }}
        className="iphone-turn relative aspect-[9/19.4] w-full [transform-style:preserve-3d] [transform:rotateX(var(--rx))_rotateY(var(--ry))] transition-transform duration-500 ease-out"
      >
        {/* the edge: layers stepped back in depth give the body its thickness */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            aria-hidden
            className="absolute inset-0 rounded-[17%/8%]"
            style={{ transform: `translateZ(${-2 - i * 2}px)`, background: i === 0 ? "#8a8590" : i === 5 ? "#3a3640" : "#5c5862" }}
          />
        ))}
        <span aria-hidden className="absolute top-[18%] -left-[1.6%] h-[6%] w-[1.6%] rounded-l bg-[#6d6873]" style={{ transform: "translateZ(-6px)" }} />
        <span aria-hidden className="absolute top-[26%] -left-[1.6%] h-[9%] w-[1.6%] rounded-l bg-[#6d6873]" style={{ transform: "translateZ(-6px)" }} />
        <span aria-hidden className="absolute top-[22%] -right-[1.6%] h-[12%] w-[1.6%] rounded-r bg-[#6d6873]" style={{ transform: "translateZ(-6px)" }} />

        {/* the front: titanium rim, black bezel, screen */}
        <div className="absolute inset-0 rounded-[17%/8%] bg-gradient-to-br from-[#d8d4dc] via-[#8f8a95] to-[#cfcad3] p-[1.6%] shadow-[0_40px_80px_-24px_rgb(50_19_44/0.5)]">
          <div className="relative h-full w-full overflow-hidden rounded-[15.5%/7.2%] bg-black p-[3.2%]">
            <div className="relative h-full w-full overflow-hidden rounded-[13%/6%] bg-white">
              <Image src={src} alt={alt} fill priority={priority} sizes="(min-width: 1024px) 280px, 60vw" className="object-cover object-top" />
              <span aria-hidden className="absolute top-[1.6%] left-1/2 h-[3.6%] w-[31%] -translate-x-1/2 rounded-full bg-black" />
              <span aria-hidden className="iphone-glare pointer-events-none absolute inset-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
