import type { Metadata } from "next";
import Link from "next/link";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { or } from "@prisma/orm-postgres/orm-client";
import { buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";
import { SearchForm } from "@/components/search-form";
import { loadScheduleRail } from "@/lib/schedule-rail";
import { ScheduleRail } from "../dashboard/panels";

export const metadata: Metadata = { title: "Households" };

export default async function HouseholdsPage({ searchParams }: PageProps<"/households">) {
  const doctor = await requireDoctor();
  const { q, view, day } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const archived = view === "archived";

  let householdQuery = orm.Household
    .select("id", "name", "address", "contactNumber", "archiveReason")
    // Members still in the working list; archived ones are counted out.
    .include("patients", (p) => p.where((x) => x.archivedAt.isNull()).count())
    .where((h) => h.clinicId.eq(doctor.clinicId))
    .where((h) => (archived ? h.archivedAt.isNotNull() : h.archivedAt.isNull()))
    .orderBy((h) => h.name.asc());

  if (query) {
    const like = `%${query}%`;
    householdQuery = householdQuery.where((h) =>
      or(
        h.name.ilike(like),
        h.patients.some((p) => p.lastName.ilike(like)),
        h.patients.some((p) => p.firstName.ilike(like)),
      ),
    );
  }

  const [households, { archivedCount }, rail] = await Promise.all([
    householdQuery.all(),
    orm.Household
      .where((h) => h.clinicId.eq(doctor.clinicId))
      .where((h) => h.archivedAt.isNotNull())
      .aggregate((a) => ({ archivedCount: a.count() })),
    loadScheduleRail(doctor, day),
  ]);
  // Picking a day in the panel keeps the search and the list being looked at.
  const dayHref = (key: string) => {
    const keep = new URLSearchParams();
    if (query) keep.set("q", query);
    if (archived) keep.set("view", "archived");
    if (key !== rail.todayKey) keep.set("day", key);
    const qs = keep.toString();
    return `/households${qs ? `?${qs}` : ""}`;
  };

  return (
    // The list, with the day's visits beside it (each named by household).
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
    <div className="min-w-0 space-y-3">
      <PageHeader
        title={archived ? "Archived households" : "Households"}
        subtitle="Every patient belongs to one. Each keeps their own record — the grouping links relatives, shared contact details and hereditary risk."
        actions={
          <Link href="/households/new" className={buttonClass("primary")}>
            New household
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <SearchForm
            action="/households"
            placeholder="Search households or surnames"
            defaultValue={query}
            keep={archived ? { view: "archived" } : undefined}
          />
        </div>
        {archived ? (
          <Link href="/households" className="text-sm font-medium text-accent-ink hover:underline">
            Back to the working list
          </Link>
        ) : archivedCount > 0 ? (
          <Link
            href="/households?view=archived"
            className="text-sm text-ink-muted hover:text-ink hover:underline"
          >
            {archivedCount} archived
          </Link>
        ) : null}
      </div>

      <Card>
        {households.length === 0 ? (
          <EmptyState
            title={
              query
                ? `No households match “${query}”`
                : archived
                  ? "No household is archived"
                  : "No households yet"
            }
            description={
              query
                ? "Try a shorter search, or clear it to see everyone."
                : "Create a household first, then add its members as patients."
            }
            action={
              query ? (
                <Link href="/households" className={buttonClass("secondary")}>
                  Clear search
                </Link>
              ) : (
                <Link href="/households/new" className={buttonClass("primary")}>
                  New household
                </Link>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {households.map((household) => (
              <li key={household.id} className="transition-colors hover:bg-surface-muted">
                <Link href={`/households/${household.id}`} className="flex items-baseline gap-4 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{household.name}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {archived
                        ? household.archiveReason || "Archived"
                        : household.address || household.contactNumber || "No address on file"}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-xs text-ink-muted">
                    {household.patients}{" "}
                    {household.patients === 1 ? "member" : "members"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
      <aside className="h-[640px] xl:fixed xl:top-3 xl:right-3 xl:bottom-3 xl:z-10 xl:h-auto xl:w-[340px]">
        <ScheduleRail {...rail} keep="" hrefFor={dayHref} showHousehold />
      </aside>
    </div>
  );
}
