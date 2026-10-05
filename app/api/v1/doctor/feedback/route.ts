import { apiDoctor } from "@/lib/api";
import { fullName, SERVICE_LABELS } from "@/lib/domain";
import { instantFromDb } from "@/lib/datetime";
import { FEEDBACK_TAG_LABELS } from "@/lib/faves";
import { FEEDBACK_VIEWS, readFeedback, tagsOf, type FeedbackViewKey } from "@/lib/feedback";

/**
 * What patients said about this doctor's visits, as the web's /feedback shows
 * it: the figures and a page of ratings, newest first.
 *
 * `?view=attention` for ratings of 1–3 only; `?page=2` for older ones.
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;

  const params = new URL(request.url).searchParams;
  const view = params.get("view");
  const active: FeedbackViewKey = FEEDBACK_VIEWS.some((v) => v.key === view) ? (view as FeedbackViewKey) : "all";
  const f = await readFeedback({ doctorId: doctor.doctorId }, active, Number(params.get("page") ?? 1));

  return Response.json({
    average: f.average,
    count: f.count,
    good: f.good,
    faves: f.faves,
    mentions: f.mentions.map(([tag, n]) => ({ tag, label: FEEDBACK_TAG_LABELS[tag] ?? tag, n })),
    page: f.page,
    pages: f.pages,
    total: f.total,
    items: f.items.map((i) => ({
      id: i.id,
      score: i.score!,
      tags: tagsOf(i.tags).map((t) => ({ tag: t, label: FEEDBACK_TAG_LABELS[t] ?? t })),
      note: i.note,
      createdAt: instantFromDb(i.createdAt).toISOString(),
      appointment: {
        id: i.appointment.id,
        scheduledAt: instantFromDb(i.appointment.scheduledAt).toISOString(),
        serviceLabel: SERVICE_LABELS[i.appointment.service],
      },
      patient: { id: i.appointment.patient.id, fullName: fullName(i.appointment.patient) },
    })),
  });
}
