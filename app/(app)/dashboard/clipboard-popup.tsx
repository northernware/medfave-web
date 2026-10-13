"use client";

import { type ReactNode, useEffect, useState } from "react";
import { SidePanel } from "@/components/side-panel";

const NARROW = "(min-width: 1280px) and (max-width: 1439px)";

/**
 * The selected patient's clipboard over the page, at the widths where it
 * doesn't fit beside the visits list (1280–1439px, with the schedule panel
 * there too). Opens when a visit is picked; elsewhere it's beside the list.
 */
export function ClipboardPopup({ title, children }: { title: string; children: ReactNode }) {
  const [narrow, setNarrow] = useState(false);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  if (!narrow || !open) return null;
  return (
    <SidePanel title={title} onClose={() => setOpen(false)}>
      {children}
    </SidePanel>
  );
}
