"use client";

import { useEffect } from "react";

/**
 * Reloads the current address as a full page. For a route the side panel
 * caught but that isn't meant for it: a full load isn't intercepted.
 */
export function FullPage() {
  useEffect(() => {
    window.location.replace(window.location.href);
  }, []);
  return null;
}
