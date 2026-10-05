import Link from "next/link";
import { formatDate, instantFromDb } from "@/lib/datetime";
import { fullName, SERVICE_LABELS } from "@/lib/domain";
import { FEEDBACK_TAG_LABELS, SCORE_WORDS } from "@/lib/faves";
import { FEEDBACK_PAGE_SIZE, FEEDBACK_VIEWS as VIEWS, readFeedback, tagsOf, type FeedbackScope, type FeedbackViewKey as ViewKey } from "@/lib/feedback";
import { Pager } from "@/components/pager";
import { RatingFace } from "@/components/rating-face";
import { Badge, Card, EmptyState, PageHeader, Stat, StatStrip } from "@/components/ui";

/**
 * What patients said after their visits: a face from 1 to 5, what stood out,
 * and a line. Only the clinic sees it; it is never public (medfave-design
 * PRODUCT.md, decision 6). The doctor reads their own at /feedback; the desk
 * and administrators read the clinic's at /desk/feedback.
 */
export async function FeedbackView({
  scope,
  base,
  linkBase,
  searchParams,
}: {
  scope: FeedbackScope;
  /** This page's path, for the tabs and the pager. */
  base: string;
  /** Where patients and visits open: "" for the doctor's pages, "/desk" for the desk's. */
  linkBase: string;
  searchParams: { view?: string | string[]; page?: string | string[] };
}) {
  const { view, page: pageParam } = searchParams;
  const active: ViewKey = VIEWS.some((v) => v.key === view) ? (view as ViewKey) : "all";
  const clinicWide = "clinicId" in scope;
  const { average, count, good, faves, mentions, items, total, page, pages, doctorName, showDoctor } = await readFeedback(
    scope,
    active,
    Number(typeof pageParam === "string" ? pageParam : 1),
  );

  return (
    <div className="space-y-3">
      <PageHeader title="Patient feedback" subtitle="What patients said after their visits. Only your clinic sees this." />

      <StatStrip>
        <Stat label="Average" value={average ? average.toFixed(1) : "—"} hint="out of 5" />
        <Stat label="Ratings" value={count} />
        <Stat label="Good or great" value={count ? `${Math.round((good / count) * 100)}%` : "—"} hint="4 or 5" />
        <Stat label="Faves" value={faves} hint={clinicWide ? "patients keeping your doctors close" : "patients keeping you close"} />
      </StatStrip>

      {mentions.length > 0 ? (
        <Card className="space-y-2 px-4 py-3">
          <p className="text-sm font-medium text-ink-muted">What patients mention</p>
          <div className="flex flex-wrap gap-1.5">
            {mentions.map(([tag, n]) => (
              <Badge key={tag} tone={["LONG_WAIT", "RUSHED", "UNCLEAR", "UNFRIENDLY", "COST"].includes(tag) ? "warn" : "accent"}>
                {FEEDBACK_TAG_LABELS[tag] ?? tag} · {n}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}

      <nav aria-label="Filter feedback" className="flex gap-1 border-b border-border">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`${base}?view=${v.key}`}
            aria-current={v.key === active ? "page" : undefined}
            className={[
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              v.key === active ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink",
            ].join(" ")}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            title={active === "attention" ? "Nothing to look into" : "No ratings yet"}
            description={
              active === "attention"
                ? "Ratings of 1 to 3 appear here, so they're easy to find."
                : "After a visit is completed, the app asks the patient how it went. Their answers appear here."
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((f) => (
              <li key={f.id} className="flex gap-3 px-4 py-3">
                <RatingFace score={f.score!} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">{SCORE_WORDS[f.score!]}</span>
                    <span className="text-ink-muted">
                      {" "}
                      · <Link href={`${linkBase}/patients/${f.appointment.patient.id}`} className="hover:underline">{fullName(f.appointment.patient)}</Link> ·{" "}
                      <Link href={`${linkBase}/appointments/${f.appointment.id}`} className="hover:underline">
                        {SERVICE_LABELS[f.appointment.service]}, {formatDate(instantFromDb(f.appointment.scheduledAt))}
                      </Link>
                      {showDoctor && doctorName.has(f.doctorId) ? ` · ${doctorName.get(f.doctorId)}` : null}
                    </span>
                  </p>
                  {tagsOf(f.tags).length ? (
                    <div className="flex flex-wrap gap-1">
                      {tagsOf(f.tags).map((t) => (
                        <Badge key={t}>{FEEDBACK_TAG_LABELS[t] ?? t}</Badge>
                      ))}
                    </div>
                  ) : null}
                  {f.note ? <p className="text-sm text-ink">“{f.note}”</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pager
          page={page}
          pages={pages}
          pageSize={FEEDBACK_PAGE_SIZE}
          total={total}
          shown={items.length}
          hrefFor={(n) => `${base}?view=${active}${n > 1 ? `&page=${n}` : ""}`}
          unit="rating"
        />
      </Card>
    </div>
  );
}
