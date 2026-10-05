import { orm } from "@/src/prisma/db";
import type { FeedbackTag } from "@/lib/faves";

/**
 * Patient feedback for the clinic's pages and the doctor's app: the figures
 * (average, share of 4–5, faves, tags mentioned) and a page of ratings.
 */

/** Whose feedback: one doctor's, or the whole clinic's (the desk and administrators). */
export type FeedbackScope = { doctorId: string } | { clinicId: string };

export const FEEDBACK_VIEWS = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
] as const;
export type FeedbackViewKey = (typeof FEEDBACK_VIEWS)[number]["key"];

export const FEEDBACK_PAGE_SIZE = 25;
/** Ratings of 1–3: the ones worth reading first. */
const LOW = [1, 2, 3];

export const tagsOf = (tags: string | null) => (tags ? (tags.split(",") as FeedbackTag[]) : []);

export async function readFeedback(scope: FeedbackScope, active: FeedbackViewKey, requested: number) {
  const PAGE_SIZE = FEEDBACK_PAGE_SIZE;

  // The clinic's doctors, for its faves and to say whose visit each rating was.
  const doctors = "clinicId" in scope
    ? await orm.Doctor.select("id", "fullName").where((d) => d.clinicId.eq(scope.clinicId)).all()
    : [];
  const doctorIds = "clinicId" in scope ? doctors.map((d) => d.id) : [scope.doctorId];
  const doctorName = new Map(doctors.map((d) => [d.id, d.fullName]));
  const showDoctor = doctors.length > 1;

  // Every answered rating, for the figures. A clinic's feedback is small enough to sum here.
  const [rated, faves] = await Promise.all([
    orm.VisitFeedback
      .select("score", "tags")
      .where((f) => ("clinicId" in scope ? f.clinicId.eq(scope.clinicId) : f.doctorId.eq(scope.doctorId)))
      .where((f) => f.score.gte(1))
      .all(),
    doctorIds.length
      ? orm.Fave.where((f) => f.doctorId.in(doctorIds)).aggregate((agg) => ({ n: agg.count() }))
      : { n: 0 },
  ]);
  const scores = rated.map((r) => r.score!);
  const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const good = scores.filter((s) => s >= 4).length;
  const tagCounts = new Map<FeedbackTag, number>();
  for (const r of rated) for (const t of tagsOf(r.tags)) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const mentions = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

  let list = orm.VisitFeedback
    .select("id", "doctorId", "score", "tags", "note", "createdAt")
    .include("appointment", (a) =>
      a.select("id", "scheduledAt", "service").include("patient", (p) => p.select("id", "firstName", "middleName", "lastName")),
    )
    .where((f) => ("clinicId" in scope ? f.clinicId.eq(scope.clinicId) : f.doctorId.eq(scope.doctorId)))
    .where((f) => f.score.gte(1));
  let counted = orm.VisitFeedback.where((f) => ("clinicId" in scope ? f.clinicId.eq(scope.clinicId) : f.doctorId.eq(scope.doctorId))).where((f) => f.score.gte(1));
  if (active === "attention") {
    list = list.where((f) => f.score.in(LOW));
    counted = counted.where((f) => f.score.in(LOW));
  }

  const total = (await counted.aggregate((agg) => ({ n: agg.count() }))).n;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), pages);
  const items = await list
    .orderBy((f) => f.createdAt.desc())
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return { average, count: scores.length, good, faves: faves.n, mentions, items, total, page, pages, doctorName, showDoctor };
}
