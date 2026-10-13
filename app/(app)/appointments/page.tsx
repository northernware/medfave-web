import type { Metadata } from "next";
import Link from "next/link";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { appointmentListQuery, toAppointmentListItem } from "@/lib/queries";
import { instantToDb } from "@/lib/datetime";
import { sweepNoShows } from "@/lib/no-show";
import { AppointmentList } from "@/components/appointment-list";
import { Pager } from "@/components/pager";
import { buttonClass, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Appointments" };

const VIEWS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

/**
 * One screenful, day headings included.
 *
 * Small enough that a page is scannable, large enough that a busy week does
 * not take four presses to read.
 */
const PAGE_SIZE = 50;

export default async function AppointmentsPage({ searchParams }: PageProps<"/appointments">) {
  const doctor = await requireDoctor();
  const { view, page: pageParam } = await searchParams;
  const active: ViewKey = VIEWS.some((v) => v.key === view) ? (view as ViewKey) : "upcoming";

  const at = new Date();
  await sweepNoShows(doctor.id, at);
  const now = instantToDb(at);

  // The same window applied twice: once to the rows, once to the count. The
  // count is what makes paging honest — a page's own length cannot say how
  // much is behind it.
  let list = appointmentListQuery().where((a) => a.doctorId.eq(doctor.id));
  let counted = orm.Appointment.where((a) => a.doctorId.eq(doctor.id));

  if (active === "upcoming") {
    list = list.where((a) => a.scheduledAt.gte(now));
    counted = counted.where((a) => a.scheduledAt.gte(now));
  } else if (active === "past") {
    list = list.where((a) => a.scheduledAt.lt(now));
    counted = counted.where((a) => a.scheduledAt.lt(now));
  }

  const total = (await counted.aggregate((agg) => ({ n: agg.count() }))).n;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // A page number out of range is clamped rather than refused: it usually means
  // a bookmark from when the list was longer.
  const requested = Number(typeof pageParam === "string" ? pageParam : 1);
  const page = Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), pages);

  const appointments = (
    await list
      .orderBy((a) => (active === "past" ? a.scheduledAt.desc() : a.scheduledAt.asc()))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .all()
  ).map(toAppointmentListItem);

  const hrefFor = (n: number) => `/appointments?view=${active}${n > 1 ? `&page=${n}` : ""}`;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Appointments"
        subtitle="Grouped by day, in clinic time."
        actions={
          <>
            {/* Walk-in leads, as on Today. */}
            <Link href="/appointments/new?source=WALK_IN" className={buttonClass("primary")}>
              Register walk-in
            </Link>
            <Link href="/appointments/new" className={buttonClass("secondary")}>
              Book appointment
            </Link>
          </>
        }
      />


      <Card className="overflow-hidden">
        {/* The filter heads the list it filters. */}
        <nav aria-label="Filter appointments" className="flex gap-1 border-b border-border px-2">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={`/appointments?view=${v.key}`}
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
        <AppointmentList
          appointments={appointments}
          emptyTitle={active === "past" ? "No past appointments" : "Nothing booked"}
          emptyDescription={
            active === "past"
              ? "Completed and cancelled visits will collect here."
              : "Book a visit and it will show up on this list and on your dashboard."
          }
        />
        <Pager
          page={page}
          pages={pages}
          pageSize={PAGE_SIZE}
          total={total}
          shown={appointments.length}
          hrefFor={hrefFor}
          unit="appointment"
        />
      </Card>
    </div>
  );
}
