/*
 * Sample-data scripts make fake patients, visits and logins with a shared
 * password. They must never touch the production database, so they stop here
 * when the environment says it is production.
 *
 * Production's connection is used only with MEDFAVE_ENV=production set (in
 * Vercel's Production environment, and in any shell that points at it).
 */
export function devOnly(script: string) {
  if (process.env.MEDFAVE_ENV === "production") {
    console.error(`${script} makes sample data and won't run against production (MEDFAVE_ENV=production).`);
    process.exit(1);
  }
}
