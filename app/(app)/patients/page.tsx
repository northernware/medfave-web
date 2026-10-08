import type { Metadata } from "next";
import Link from "next/link";
import { requireDoctor } from "@/lib/auth";
import { caredForIds, idsOrNone } from "@/lib/care";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, formatDate, instantFromDb } from "@/lib/datetime";
import { or } from "@prisma/orm-postgres/orm-client";
import { ACTIVE_STATUSES, ageFrom, fullName, RELATIONSHIP_LABELS, SEX_LABELS } from "@/lib/domain";
import { Badge, buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";
import { SearchForm } from "@/components/search-form";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPage({ searchParams }: PageProps<"/patients">) {
  const doctor = await requireDoctor();
  const { q, view, who, sort } = await searchParams;
  // "Mine" are the patients this doctor cares for; "everyone" is the whole
  // clinic, whose details every doctor there may see (lib/care.ts).
  const everyone = who === "all";
  const mine = await caredForIds(doctor);
  const query = typeof q === "string" ? q.trim() : "";
  // Archived charts are out of the working list, not out of reach: they have a
  // list of their own, which is where they are restored from.
  const archived = view === "archived";

  let patientQuery = orm.Patient
    .select(
      "id",
      "firstName",
      "middleName",
      "lastName",
      "dateOfBirth",
      "sex",
      "relationship",
      "allergyStatus",
      "patientNumber",
      "archivedAt",
      "archiveReason",
    )
    .include("allergies", (a) => a.select("id", "severity"))
    .include("household", (h) => h.select("id", "name"))
    .where((p) => p.clinicId.eq(doctor.clinicId))
    .where((p) => (everyone ? p.clinicId.eq(doctor.clinicId) : p.id.in(idsOrNone(mine))))
    .where((p) => (archived ? p.archivedAt.isNotNull() : p.archivedAt.isNull()))
    .orderBy([(p) => p.lastName.asc(), (p) => p.firstName.asc()]);

  if (query) {
    const like = `%${query}%`;
    patientQuery = patientQuery.where((p) =>
      or(
        p.firstName.ilike(like),
        p.lastName.ilike(like),
        p.patientNumber.ilike(like),
        p.household.some((h) => h.name.ilike(like)),
      ),
    );
  }

  const listed = await patientQuery.all();

  // Last seen and next visit with this doctor, from their visits: what answers
  // "who haven't I seen in a while" and "who's coming".
  const now = new Date();
  const visits = await orm.Appointment
    .select("patientId", "scheduledAt", "status")
    .where((a) => a.doctorId.eq(doctor.id))
    .where((a) => a.patientId.in(idsOrNone(listed.map((p) => p.id))))
    .where((a) => a.status.in(["COMPLETED", ...ACTIVE_STATUSES]))
    .all();
  const lastSeen = new Map<string, Date>();
  const nextVisit = new Map<string, Date>();
  for (const v of visits) {
    const at = instantFromDb(v.scheduledAt);
    if (v.status === "COMPLETED") {
      if (!lastSeen.has(v.patientId) || at > lastSeen.get(v.patientId)!) lastSeen.set(v.patientId, at);
    } else if (at >= now && (!nextVisit.has(v.patientId) || at < nextVisit.get(v.patientId)!)) {
      nextVisit.set(v.patientId, at);
    }
  }
  const order = sort === "last" || sort === "next" ? sort : "name";
  const patients =
    order === "name"
      ? listed
      : [...listed].sort((a, b) => {
          // Last seen: longest ago first, never seen at the top. Next visit: soonest first, none last.
          if (order === "last") return (lastSeen.get(a.id)?.getTime() ?? 0) - (lastSeen.get(b.id)?.getTime() ?? 0);
          return (nextVisit.get(a.id)?.getTime() ?? Infinity) - (nextVisit.get(b.id)?.getTime() ?? Infinity);
        });
  const sortHref = (to: string) => {
    const keep = new URLSearchParams();
    if (query) keep.set("q", query);
    if (everyone) keep.set("who", "all");
    if (archived) keep.set("view", "archived");
    if (to !== "name") keep.set("sort", to);
    const qs = keep.toString();
    return `/patients${qs ? `?${qs}` : ""}`;
  };

  const [{ householdCount }, { archivedCount }] = await Promise.all([
    orm.Household
      .where((h) => h.clinicId.eq(doctor.clinicId))
      .where((h) => h.archivedAt.isNull())
      .aggregate((a) => ({ householdCount: a.count() })),
    orm.Patient
      .where((p) => p.id.in(idsOrNone(mine)))
      .where((p) => p.archivedAt.isNotNull())
      .aggregate((a) => ({ archivedCount: a.count() })),
  ]);

  return (
    <div className="space-y-3">
      <PageHeader
        title={archived ? "Archived patients" : "Patients"}
        subtitle={`${patients.length} ${patients.length === 1 ? "person" : "people"}${query ? " matching" : archived ? " set aside" : everyone ? " at the clinic" : " on your list"}`}
        actions={
          householdCount > 0 ? (
            <Link href="/patients/new" className={buttonClass("secondary")}>
              Add patient
            </Link>
          ) : (
            <Link href="/households/new" className={buttonClass("primary")}>
              New household
            </Link>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <SearchForm
            action="/patients"
            placeholder="Search by name, number or household"
            defaultValue={query}
            keep={archived ? { view: "archived" } : everyone ? { who: "all" } : undefined}
          />
        </div>
        {archived ? null : (
          <div className="flex rounded-full border border-border-strong p-0.5 text-sm" role="group" aria-label="Whose patients">
            <Link
              href={query ? `/patients?q=${encodeURIComponent(query)}` : "/patients"}
              aria-current={everyone ? undefined : "true"}
              className={`rounded-full px-3 py-1 ${everyone ? "text-ink-muted hover:text-ink" : "bg-accent-tint font-semibold text-accent-ink"}`}
            >
              Mine
            </Link>
            <Link
              href={`/patients?who=all${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              aria-current={everyone ? "true" : undefined}
              className={`rounded-full px-3 py-1 ${everyone ? "bg-accent-tint font-semibold text-accent-ink" : "text-ink-muted hover:text-ink"}`}
            >
              Everyone at the clinic
            </Link>
          </div>
        )}
        {archived ? (
          <Link href="/patients" className="text-sm font-medium text-accent-ink hover:underline">
            Back to the working list
          </Link>
        ) : archivedCount > 0 ? (
          <Link
            href="/patients?view=archived"
            className="text-sm text-ink-muted hover:text-ink hover:underline"
          >
            {archivedCount} archived
          </Link>
        ) : null}
      </div>

      {patients.length > 1 ? (
        <div className="flex items-center gap-1 text-sm" role="group" aria-label="Sort">
          <span className="mr-1 text-ink-faint">Sort by</span>
          {[
            ["name", "Name"],
            ["last", "Last seen"],
            ["next", "Next visit"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={sortHref(key)}
              aria-current={order === key ? "true" : undefined}
              className={`rounded-full px-3 py-1 ${order === key ? "bg-accent-tint font-semibold text-accent-ink" : "text-ink-muted hover:text-ink"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      ) : null}

      <Card>
        {patients.length === 0 ? (
          <EmptyState
            title={
              query
                ? `No patients match “${query}”`
                : archived
                  ? "Nobody is archived"
                  : "No patients yet"
            }
            description={
              query
                ? "Try a surname, or clear the search."
                : "Patients are added inside a household, so their household history stays together."
            }
            action={
              query ? (
                <Link href="/patients" className={buttonClass("secondary")}>
                  Clear search
                </Link>
              ) : (
                <Link href={householdCount > 0 ? "/households" : "/households/new"} className={buttonClass("primary")}>
                  {householdCount > 0 ? "Choose a household" : "Create the first household"}
                </Link>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {patients.map((patient) => (
              <li key={patient.id} className="transition-colors hover:bg-surface-muted">
                <Link href={`/patients/${patient.id}`} className="flex items-baseline gap-4 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-medium">{fullName(patient)}</span>
                      {!mine.has(patient.id) ? (
                        <Badge tone="neutral">Not yet your patient</Badge>
                      ) : patient.allergies.length > 0 ? (
                        <Badge tone="danger">
                          {patient.allergies.length} {patient.allergies.length === 1 ? "allergy" : "allergies"}
                        </Badge>
                      ) : patient.allergyStatus === "UNKNOWN" ? (
                        <Badge tone="neutral">Allergies not asked</Badge>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-muted">
                      {patient.household.name} household · {RELATIONSHIP_LABELS[patient.relationship]}
                      {patient.archivedAt && patient.archiveReason ? ` · ${patient.archiveReason}` : ""}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-right text-xs text-ink-muted">
                    {SEX_LABELS[patient.sex]} · {ageFrom(calendarDateFromDb(patient.dateOfBirth))}
                    <span className="mt-0.5 block text-ink-faint">
                      {lastSeen.has(patient.id) ? `Seen ${formatDate(lastSeen.get(patient.id)!)}` : "Not seen yet"}
                      {nextVisit.has(patient.id) ? ` · Next ${formatDate(nextVisit.get(patient.id)!)}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
