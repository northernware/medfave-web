import "server-only";
import { headers } from "next/headers";
import { orm } from "@/src/prisma/db";
import { instantFromDb, instantToDb } from "@/lib/datetime";

/*
 * Counting attempts, so a public sign-up and sign-in can't be hammered.
 *
 * A fixed window per key, kept in the database because the app runs as many
 * short-lived serverless instances with no memory in common. Deliberately
 * simple: two requests racing in the same instant can both be counted as the
 * same number, which lets one extra attempt through now and then — fine for
 * slowing guessing down, which is all this is for.
 */

export type Limit = { limit: number; windowSeconds: number };

/** The limits, in one place so they read as policy. */
export const LIMITS = {
  /** Sign-in per email: guessing one person's password. */
  signInEmail: { limit: 10, windowSeconds: 15 * 60 },
  /** Sign-in per address: guessing many people's. */
  signInAddress: { limit: 50, windowSeconds: 15 * 60 },
  /** New accounts per address. */
  signUpAddress: { limit: 10, windowSeconds: 60 * 60 },
  /** Password-reset and verification emails per email: not a way to flood an inbox. */
  emailSends: { limit: 5, windowSeconds: 60 * 60 },
  /** Activation codes tried per account or address: codes are guessable only by brute force. */
  codeAttempts: { limit: 10, windowSeconds: 15 * 60 },
  /** Waitlist sign-ups per address: a public form, so not a way to fill the table. */
  waitlistAddress: { limit: 10, windowSeconds: 60 * 60 },
} satisfies Record<string, Limit>;

/**
 * Counts one attempt against `key` and says whether it is allowed. The attempt
 * is counted either way, so hammering a blocked key keeps it blocked.
 */
export async function hit(key: string, { limit, windowSeconds }: Limit): Promise<boolean> {
  const now = new Date();
  const bucket = await orm.RateLimitBucket.select("key", "windowStart", "count").where((b) => b.key.eq(key)).first();

  const expired = !bucket || instantFromDb(bucket.windowStart).getTime() + windowSeconds * 1000 <= now.getTime();
  if (expired) {
    if (bucket) {
      await orm.RateLimitBucket.where((b) => b.key.eq(key)).update({ windowStart: instantToDb(now), count: 1 });
    } else {
      // Two first attempts at once can both try to create the bucket; the loser
      // just counts as the first.
      await orm.RateLimitBucket.create({ key, windowStart: instantToDb(now), count: 1 }).catch(() => undefined);
    }
    return true;
  }

  const count = bucket.count + 1;
  await orm.RateLimitBucket.where((b) => b.key.eq(key)).update({ count });
  return count <= limit;
}

/** Every key must pass; all of them are counted. */
export async function hitAll(checks: [string, Limit][]): Promise<boolean> {
  const results = await Promise.all(checks.map(([key, limit]) => hit(key, limit)));
  return results.every(Boolean);
}

/** The caller's address, as the platform's proxy reports it. `unknown` when there is none (a script, a test). */
export async function clientAddress(request?: Request): Promise<string> {
  const source = request?.headers ?? (await headers());
  const forwarded = source.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || source.get("x-real-ip") || "unknown";
}

export const TOO_MANY = "Too many attempts. Wait a few minutes and try again.";
