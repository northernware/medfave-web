/*
 * Pages in outline while they load, built from the same shapes as the real
 * ones — the page header, stat tiles, list cards, the schedule panel — so the
 * page fills in where it already stood. Each section's `loading.tsx` picks the
 * outline that matches it; anything without its own gets `PageSkeleton`.
 */

const pulse = "rounded-md bg-surface-muted motion-safe:animate-pulse";
const card = "rounded-xl border border-border bg-surface shadow-card";

function Busy({ children, className = "space-y-3" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

/** The page title and its line under it, sized like `PageHeader`. */
export function HeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 lg:px-1 lg:pt-5 lg:pb-2">
      <div className="space-y-2">
        <div className={`${pulse} h-9 w-60`} />
        <div className={`${pulse} h-4 w-80 max-w-[70vw]`} />
      </div>
      {action ? <div className={`${pulse} h-10 w-32 rounded-full`} /> : null}
    </div>
  );
}

/** Four tiles: a number, a label, a hint. */
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`${card} p-5`}>
          <div className={`${pulse} h-8 w-10`} />
          <div className={`${pulse} mt-4 h-4 w-20`} />
          <div className={`${pulse} mt-1.5 h-3 w-28`} />
        </div>
      ))}
    </div>
  );
}

/** A card of rows — people or visits: an avatar or time, two lines, something at the end. */
export function ListSkeleton({ rows = 6, title = true, avatar = true }: { rows?: number; title?: boolean; avatar?: boolean }) {
  return (
    <div className={card}>
      {title ? (
        <div className="border-b border-border px-5 py-4">
          <div className={`${pulse} h-5 w-40`} />
        </div>
      ) : null}
      <ul className="divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-5 py-3">
            {avatar ? <div className={`${pulse} size-9 shrink-0 rounded-full`} /> : <div className={`${pulse} h-4 w-14 shrink-0`} />}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className={`${pulse} h-4`} style={{ width: `${45 + ((i * 17) % 35)}%` }} />
              <div className={`${pulse} h-3`} style={{ width: `${25 + ((i * 11) % 30)}%` }} />
            </div>
            <div className={`${pulse} h-6 w-16 rounded-full`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The search box above a list. */
export function SearchSkeleton() {
  return <div className={`${pulse} h-9 w-full max-w-sm`} />;
}

/** The day's schedule panel pinned on the right, as on Today, Calendar and the households pages. */
export function RailSkeleton({ weekStrip = true }: { weekStrip?: boolean }) {
  return (
    <div className="h-[640px] xl:fixed xl:top-3 xl:right-3 xl:bottom-3 xl:z-10 xl:h-auto xl:w-[340px]">
      <div className={`${card} flex h-full flex-col gap-4 p-4`}>
        {weekStrip ? (
          <>
            <div className="flex items-center justify-between">
              <div className={`${pulse} h-5 w-32`} />
              <div className={`${pulse} size-8 rounded-full`} />
            </div>
            <div className="flex justify-between gap-1">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className={`${pulse} h-12 w-9 rounded-lg`} />
              ))}
            </div>
          </>
        ) : (
          <div className={`${pulse} h-5 w-24`} />
        )}
        <div className="flex-1 space-y-6 pt-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <div className={`${pulse} h-3 w-10 shrink-0`} />
              {i % 2 === 0 ? <div className={`${pulse} h-24 flex-1 rounded-lg`} /> : <div className="h-px flex-1 self-center bg-border" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The patient clipboard (components/patient-clipboard.tsx): a tinted top with
 * who they are, then the sheet, its clip in the middle, with a few boxes.
 */
export function ClipboardSkeleton({ boxes = 3 }: { boxes?: number }) {
  return (
    // Stretched (Today), the sheet fills the card, as on the real one.
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-muted">
      <div className="space-y-2.5 px-5 pt-4 pb-6">
        <div className={`${pulse} h-4 w-44 bg-surface`} />
        <div className={`${pulse} h-3 w-28 bg-surface`} />
        <div className={`${pulse} mt-3 h-6 w-16 bg-surface`} />
      </div>
      <div className="relative flex-1 space-y-3 rounded-t-2xl bg-surface px-5 pt-5 pb-4">
        <span aria-hidden className="absolute -top-3 left-1/2 h-3.5 w-20 -translate-x-1/2 rounded-t-lg bg-surface" />
        {Array.from({ length: boxes }, (_, i) => (
          <div key={i} className={`${pulse} h-16 w-full`} />
        ))}
      </div>
    </div>
  );
}

/** A form's card: a few labelled fields, two to a row where the form has them. */
function FormCardSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className={`${card} grid gap-5 p-5 sm:grid-cols-2 sm:p-6`}>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className={`space-y-2 ${i % 3 === 2 ? "sm:col-span-2" : ""}`}>
          <div className={`${pulse} h-4 w-28`} />
          <div className={`${pulse} h-11 w-full rounded-lg`} />
        </div>
      ))}
    </div>
  );
}

/** A month: weekday names and five weeks of days. */
export function CalendarSkeleton() {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className={`${pulse} h-6 w-40`} />
        <div className={`${pulse} h-8 w-24 rounded-full`} />
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="h-20 border-r border-b border-border p-2 sm:h-24">
            <div className={`${pulse} size-6 rounded-full`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Today (doctor or desk): header, tiles, two cards side by side, the schedule panel. */
export function TodaySkeleton() {
  return (
    <Busy>
      <div className="grid grid-cols-1 gap-3 xl:pr-[352px]">
        <div className="min-w-0 space-y-3">
          <HeaderSkeleton />
          <StatsSkeleton />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
            <ListSkeleton rows={5} />
            <ClipboardSkeleton />
          </div>
        </div>
      </div>
      <RailSkeleton />
    </Busy>
  );
}

/** A list page: header, search, the list. */
export function ListPageSkeleton({ search = true, avatar = true }: { search?: boolean; avatar?: boolean }) {
  return (
    <Busy className="space-y-3">
      <HeaderSkeleton action />
      {search ? <SearchSkeleton /> : null}
      <ListSkeleton rows={8} title={false} avatar={avatar} />
    </Busy>
  );
}

/** Calendar: header, the month, the schedule panel. */
export function CalendarPageSkeleton() {
  return (
    <Busy>
      <div className="grid grid-cols-1 gap-3 xl:pr-[352px]">
        <div className="min-w-0 space-y-3">
          <HeaderSkeleton />
          <CalendarSkeleton />
        </div>
      </div>
      <RailSkeleton weekStrip={false} />
    </Busy>
  );
}

/** A list with the schedule panel beside it (the households list). */
export function ListWithRailSkeleton() {
  return (
    <Busy>
      <div className="grid grid-cols-1 gap-3 xl:pr-[352px]">
        <div className="min-w-0 space-y-3">
          <HeaderSkeleton action />
          <SearchSkeleton />
          <ListSkeleton rows={6} title={false} avatar={false} />
        </div>
      </div>
      <RailSkeleton />
    </Busy>
  );
}

/** A household: its details and members, the schedule panel beside. */
export function HouseholdSkeleton() {
  return (
    <Busy>
      <div className="grid grid-cols-1 gap-3 xl:pr-[352px]">
        <div className="min-w-0 space-y-3">
          <HeaderSkeleton action />
          <div className={`${card} space-y-3 p-5`}>
            <div className={`${pulse} h-4 w-2/3`} />
            <div className={`${pulse} h-4 w-1/2`} />
          </div>
          <ListSkeleton rows={5} avatar={false} />
        </div>
      </div>
      <RailSkeleton />
    </Busy>
  );
}

/** The patient page: header and history on the left, the clipboard on the right. */
export function PatientSkeleton() {
  return (
    <Busy>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <HeaderSkeleton action />
          <ListSkeleton rows={3} avatar={false} />
          <ListSkeleton rows={4} avatar={false} />
        </div>
        <div className="lg:self-start">
          <ClipboardSkeleton boxes={4} />
        </div>
      </div>
    </Busy>
  );
}

/** A visit: header and its details on the left, the clipboard on the right. */
export function VisitSkeleton() {
  return (
    <Busy>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-3">
          <HeaderSkeleton action />
          <div className={`${card} space-y-4 p-5`}>
            <div className={`${pulse} h-5 w-40`} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={`${pulse} h-10`} />
              <div className={`${pulse} h-10`} />
            </div>
            <div className={`${pulse} h-10 w-56 rounded-full`} />
          </div>
        </div>
        <ClipboardSkeleton />
      </div>
    </Busy>
  );
}

/** A visit note, read or written: header and the note at reading width, the clipboard beside, centred. */
export function NoteSkeleton() {
  return (
    <Busy className="mx-auto max-w-[69rem]">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,46rem)_minmax(17rem,22rem)] lg:items-start">
        <div className="min-w-0 space-y-3">
          <HeaderSkeleton />
          <FormCardSkeleton fields={7} />
        </div>
        <ClipboardSkeleton />
      </div>
    </Busy>
  );
}

/** A form page: header and card, centred like the clinic settings pages. */
export function FormSkeleton() {
  return (
    <Busy className="mx-auto max-w-3xl space-y-3">
      <HeaderSkeleton />
      <FormCardSkeleton />
    </Busy>
  );
}

/** Anything else: a header and a few cards. */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <Busy className="space-y-3">
      <HeaderSkeleton />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className={`${card} space-y-3 p-5`}>
              <div className={`${pulse} h-5 w-40`} />
              <div className={`${pulse} h-4 w-full`} />
              <div className={`${pulse} h-4 w-5/6`} />
            </div>
          ))}
        </div>
        <div className={`${card} hidden space-y-3 p-5 lg:block`}>
          <div className={`${pulse} h-5 w-32`} />
          <div className={`${pulse} h-24 w-full`} />
        </div>
      </div>
    </Busy>
  );
}
