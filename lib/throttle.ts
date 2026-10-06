import "server-only";

/*
 * Jobs that run when a clinic screen is read (the no-show sweep, tomorrow's
 * reminders) only need to run about once a minute, not on every poll of every
 * open screen: each run is several database operations.
 */
const lastRun = new Map<string, number>();

/** True when `key` ran in the last `ms` on this server; otherwise notes that it runs now. */
export function ranRecently(key: string, ms = 60_000, now = Date.now()) {
  const last = lastRun.get(key);
  if (last !== undefined && now - last < ms) return true;
  lastRun.set(key, now);
  return false;
}
