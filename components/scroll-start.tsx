"use client";

import { useEffect, useRef } from "react";

/** Scrolls the nearest scrolling box it sits in to `top` px once, on arrival. */
export function ScrollStart({ top }: { top: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let box = ref.current?.parentElement ?? null;
    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    if (box) box.scrollTop = top;
  }, [top]);
  return <span ref={ref} hidden />;
}
