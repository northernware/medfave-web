import type { Metadata } from "next";
import Link from "next/link";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { formatDate, instantFromDb } from "@/lib/datetime";
import { fullName } from "@/lib/domain";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONE,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/documents";
import type { DocumentRequestStatus } from "@/lib/enums";
import { Pager } from "@/components/pager";
import { Badge, buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Documents" };

const VIEWS = [
  { key: "open", label: "Open" },
  { key: "released", label: "Released" },
  { key: "all", label: "All" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

const PAGE_SIZE = 25;

/** Open means somebody is still waiting for it. */
const OPEN: DocumentRequestStatus[] = ["REQUESTED", "READY"];

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const doctor = await requireDoctor();
  const { view, page: pageParam } = await searchParams;
  const active: ViewKey = VIEWS.some((v) => v.key === view) ? (view as ViewKey) : "open";

  let list = orm.DocumentRequest
    .select("id", "type", "status", "purpose", "requesterName", "createdAt", "releasedAt")
    .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName", "patientNumber"))
    .where((r) => r.doctorId.eq(doctor.id));
  let counted = orm.DocumentRequest.where((r) => r.doctorId.eq(doctor.id));

  if (active === "open") {
    list = list.where((r) => r.status.in(OPEN));
    counted = counted.where((r) => r.status.in(OPEN));
  } else if (active === "released") {
    list = list.where((r) => r.status.eq("RELEASED"));
    counted = counted.where((r) => r.status.eq("RELEASED"));
  }

  const total = (await counted.aggregate((agg) => ({ n: agg.count() }))).n;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = Number(typeof pageParam === "string" ? pageParam : 1);
  const page = Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), pages);

  const requests = await list
    .orderBy((r) => r.createdAt.desc())
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return (
    <div className="space-y-3">
      <PageHeader
        title="Documents"
        subtitle="Certificates, abstracts and copies asked for from the chart."
        actions={
          <Link href="/documents/new" className={buttonClass("primary")}>
            New document
          </Link>
        }
      />

      <nav aria-label="Filter requests" className="flex gap-1 border-b border-border">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/documents?view=${v.key}`}
            aria-current={v.key === active ? "page" : undefined}
            className={[
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              v.key === active
                ? "border-accent text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            ].join(" ")}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <Card className="overflow-hidden">
        {requests.length === 0 ? (
          <EmptyState
            title={active === "released" ? "Nothing released yet" : "Nothing outstanding"}
            description={
              active === "released"
                ? "Documents handed over will be listed here, with who received them."
                : "When somebody asks for a certificate, an abstract or copies of a chart, record it here."
            }
            action={
              <Link href="/documents/new" className={buttonClass("primary")}>
                New document
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((r) => (
              <li key={r.id} className="transition-colors hover:bg-surface-muted">
                <Link href={`/documents/${r.id}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {DOCUMENT_TYPE_LABELS[r.type]}
                    </span>
                    <span className="block truncate text-sm text-ink-muted">
                      {fullName(r.patient)}
                      {r.patient.patientNumber ? ` · ${r.patient.patientNumber}` : ""} · {r.purpose}
                    </span>
                    <span className="block truncate text-xs text-ink-faint">
                      Asked by {r.requesterName} · {formatDate(instantFromDb(r.createdAt))}
                    </span>
                  </span>
                  <Badge dot tone={DOCUMENT_STATUS_TONE[r.status]}>
                    {DOCUMENT_STATUS_LABELS[r.status]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pager
          page={page}
          pages={pages}
          pageSize={PAGE_SIZE}
          total={total}
          shown={requests.length}
          hrefFor={(n) => `/documents?view=${active}${n > 1 ? `&page=${n}` : ""}`}
          unit="request"
        />
      </Card>
    </div>
  );
}
