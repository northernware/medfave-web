# Medfave

**Care, with a little heart.** Medfave connects family practices in the
Philippines with the patients and households they look after: the clinic runs its
day on the web, and patients and doctors carry it in the Medfave app.

Live: **[medfave.vercel.app](https://medfave.vercel.app)** · App:
[medfave-mobile](https://github.com/northernware/medfave-mobile) (Expo) · Brand
and product: [medfave-design](https://github.com/northernware/medfave-design)

## What it does

**For patients (mobile app first)**
- **Find a doctor.** Search verified doctors by name, specialty, clinic or town, or
  scan a clinic's QR code from its poster, card or a screenshot, and ask for a visit.
- **Link the records the clinic already keeps.** The desk hands over a
  6-digit code or a QR to scan; one login can hold charts at several clinics.
- **See visits and documents,** request, reschedule or cancel appointments, and
  choose how to be reminded.

**For doctors (app and web)**
- **Today, calendar and appointments,** with a waiting room that shows who has
  arrived and for how long.
- **Charts and visit notes:** allergies, alerts, conditions, medications, vitals,
  assessment, plan and prescriptions. Details are clinic-wide, the chart is for the
  doctors caring for the patient, and a note belongs to its author.
- **My hours and clinic settings:** weekly hours inside the clinic's, the clinic's
  public page and QR (share it like a GCash QR, or print a poster), listing in
  Find a doctor, staff invitations and chart sharing.

**For the front desk (web)**
- A day view with walk-ins, bookings and check-ins; booking requests from the
  app, each answered by the desk or the doctor; patient registration by household.
- Linking a patient's Medfave account in person: a QR and a 6-digit code on screen.

**Built in:** households (relatives grouped, never merged into one chart),
PRC license verification of every doctor before a clinic opens, email
reminders, light and dark themes, and a JSON API (`app/api/v1`, see
[`docs/api.md`](docs/api.md)) that the app uses with the same rules as the web.

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions) + React 19
- **Prisma 8** (Prisma Next) against **PostgreSQL**, via `@prisma/orm-postgres`
- **Tailwind CSS v4** with the Medfave brand palette (light and dark) in
  `app/globals.css`; Plus Jakarta Sans and Inter self-hosted via Fontsource
- **Auth**: email + bcrypt password, session as a signed JWT (`jose`) in an
  HttpOnly cookie
- **Validation**: Zod schemas shared by every server action

## Getting started

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL and SESSION_SECRET
npm run db:migrate          # bring the database up to the contract
npm run db:seed             # optional: a demo practice to click around in
npm run dev
```

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

The seed creates a demo doctor — **doctor@medfave.com** / **password** —
with two households, seven patients, seventeen appointments spread across the
month and a few past encounters.
Delete it before going anywhere near real data.

### Database

The data layer is Prisma 8 (Prisma Next), which is contract-first: the schema
lives in `src/prisma/contract.prisma`, and `prisma contract emit` derives the
runtime types (`contract.d.ts`) and the artefact the client reads
(`contract.json`) from it. Both are committed, and `prebuild` re-emits them, so a
clean checkout typechecks and builds without a database.

Any PostgreSQL connection string works — Prisma Postgres, Neon, Supabase, RDS or
your own server. Put it in `DATABASE_URL`; `npm run db:migrate` applies the
migrations under `migrations/app/` and needs no shadow database.

The shared dev database (and medfave.vercel.app) is a free **Supabase** project
(Mumbai, `ap-south-1`): no cap on queries, unlike Prisma Postgres's free plan,
which this app's polling ran out of. Locally use its **Session pooler** string
(port 5432); Vercel uses the **Transaction pooler** (port 6543). Ask the owner
for the connection string; never commit it.

Changing the schema is three steps: edit `src/prisma/contract.prisma`, run
`npm run db:emit`, then either `npm run db:update` to push the change straight
into a development database, or `npm run db:plan` to write a migration to disk
for the ones you deploy to. `npm run db:verify` reports whether a database
matches the contract.

### Upgrading a database created before Prisma 8

A database built by the old Prisma 7 migrations is one change away from matching
the contract: Prisma 7 enforced the two `MedicalRecord` links with bare unique
indexes, and Prisma 8 declares uniqueness as a constraint. Everything else — the
tables, columns, native enum types and other indexes — is byte-identical.

```bash
npm run db:verify   # "Marker missing" — Prisma 8 has never signed this database
npm run db:update   # drops the two indexes, adds the constraints, signs it
```

`db:update` prints the plan and asks for confirmation, because dropping an index
is destructive in general; here each one is immediately replaced by the unique
constraint's own index, so the guarantee never lapses. Confirm it by passing the
database's name (`npm run db:update -- --confirm <dbname>`) or by answering the
prompt. Afterwards `db:verify` reports that marker and schema match the contract.

Do not run `db:seed` against a database with real patients in it — it creates a
demo practice.

## Deploying

The app deploys to **Vercel** as an ordinary Next.js app — no adapter, no build
flags, no `output` setting. Import the repository, then set two environment
variables under *Settings → Environment Variables* for every environment you
want to build:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | A PostgreSQL connection string. Use a **pooled** endpoint — serverless functions open a connection per instance. |
| `SESSION_SECRET` | 32 random bytes; generate it with the command above. Rotating it signs everyone out. |

Neither is read at import time, so the build succeeds without a database — which
also means a missing variable surfaces on the first request rather than in the
build log. If pages throw `DATABASE_URL is not set` after a green deploy, the
variable is missing from that environment, not from the code.

Create the schema before the first request, from your own machine against the
same database:

```bash
DATABASE_URL="<the connection string>" npm run db:migrate
```

Set `NEXT_PUBLIC_CLINIC_TIMEZONE` too if the clinic is not in `Asia/Manila`; it
is inlined at build time, so changing it needs a redeploy.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:emit` | Re-emit `contract.json` / `contract.d.ts` from the contract |
| `npm run db:update` | Push contract changes straight into a dev database |
| `npm run db:plan` | Write a migration to `migrations/app/` |
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `npm run db:verify` | Check a database against the contract |
| `npm run db:seed` | Load the demo practice |

## How it fits together

```
app/
  (auth)/            login and register — redirects to / when already signed in
  (app)/             everything behind the session gate
    page.tsx         today's clinic, waiting room, follow-ups due, no-shows
    calendar/        month grid of booked days and times, plus a day panel
    households/      list, create, edit, household detail, add a member
    patients/        list, chart, edit
    appointments/    list (upcoming/past/all), booking, detail, reschedule
    records/         document a visit, view, edit, printable prescription
  actions/           server actions — one module per resource
lib/
  auth.ts            getCurrentDoctor / requireDoctor
  session.ts         JWT cookie create / read / destroy
  queries.ts         the reads more than one page needs
  validation.ts      Zod schemas and the FormState shape forms read
  datetime.ts        clinic-timezone formatting, input parsing, DB text <-> Date
  domain.ts          enum labels, age, BP, BMI
  enums.ts           the contract's enums as values the app can reference
  ids.ts             primary keys for new rows
components/          UI kit, shared lists, and the four forms
src/prisma/
  contract.prisma    the data contract — the schema you edit
  contract.json      emitted artefact the client reads (do not edit)
  contract.d.ts      emitted types (do not edit)
  db.ts              the client, cached across hot reloads
  seed.ts            the demo practice
migrations/app/      migrations planned from the contract
```

### Data model

`Doctor → Household → Patient`, with `Appointment` and `MedicalRecord` hanging
off a patient and `Prescription` off a record. A record optionally links to the
appointment it documents; making that link marks the appointment completed.

### The clinical flow

The release target is one unbroken path, and each step hands off to the next:

```
register patient → group under household → book appointment
  → check in → document consultation → prescribe → schedule follow-up
```

The dashboard is where that flow is driven. Today's schedule carries a **Check
in** button; checking someone in moves them to a **Waiting room** panel with a
**Start consultation** link that opens a record already bound to their booking;
documenting the visit marks the appointment completed; the record offers
**Print prescription**; and a follow-up date raises the visit in **Follow-ups
due** until an appointment is booked against it.

That last link is explicit — `MedicalRecord.followUpAppointmentId` — so "due"
means *asked for and not yet booked*, rather than a guess from whatever
appointments happen to sit near the date. Booking from the dashboard or the
record sets it and the item drops off the list.

### Booking rules

One module, `lib/scheduling.ts`, holds the clinic's rules: open 8:00 AM to
5:00 PM, closed Sundays, and a booking must be at least one day ahead (and at
most 180). The booking form mirrors them — the date input is bounded, Sundays
explain themselves, and the slot grid only offers times a visit of that length
actually fits into — but `checkBookingRules` on the server is what decides. A
stale slot list and a direct POST both land there.

Overlap is checked the same way: the form greys out any start time that would
collide with an existing booking, and the action re-checks against the whole
clinic day before writing, so two people racing for the last slot cannot both
get it.

### Clinical lists

Allergies, chronic conditions, current medications and medical alerts are each
lists of rows rather than free text, so an allergy carries its own reaction and
severity and a medication carries its dose and frequency. One `ClinicalPicker`
drives all four — type to filter a grouped catalogue in `lib/clinical.ts`, pick
several, remove them as tags, and add anything the catalogue does not list. The
suggestions are a shortcut, never a constraint. Each picker declares which
per-item detail fields it wants.

Medical alerts sit above the allergies on every chart, appointment and
consultation screen: they are things to act on before touching the patient —
anticoagulants, a pacemaker, a difficult airway — rather than history.

Allergies, conditions and medications also carry a `ClinicalListStatus`, because
**an empty list is not the same as "no known allergies"**. `UNKNOWN` (nobody has asked) renders as an
amber warning on the chart; `NONE_KNOWN` (asked, none found) renders as a quiet
confirmation; `RECORDED` renders the list itself, worst severity first. Nothing
reads as safe by omission.

### Deleting a list

`.delete()` on the Prisma 8 ORM removes **one** row — it is shaped for a unique
predicate. Anywhere a delete is keyed on something non-unique (a patient's
clinical lists, a record's prescriptions) it goes through the SQL-builder lane
instead: `tx.sql.public.<Table>.delete().where(...)`. Using the ORM there left
every row but one behind and the next insert collided with the unique index.

### Services

Every appointment carries a `ServiceType` from a fixed list of fifteen — general
consultation, family checkup, follow-up, routine physical, pediatric, senior
citizen, prenatal/postnatal, chronic disease management, prescription renewal,
laboratory result review, medical certificate, vaccination, minor injury and
wound care, teleconsultation, and referral. The catalogue lives in one place,
`SERVICES` in `lib/domain.ts`, which also carries each service's description and
its default slot length. Duration is derived from the service rather than asked
for — the slot picker needs to know how much of the day a visit consumes.
Free-text `reason` still carries the specifics.

### Calendar

`/calendar?month=YYYY-MM&day=YYYY-MM-DD` renders whole Sunday-first weeks for the
month, each day cell showing its booked times in a compact form (`9:00a`) with a
colour per status — phones get density dots instead, where there is no room for
text. The selected day's full schedule sits in a sticky panel **beside** the
grid on large screens, stacking underneath on small ones. Selecting an empty day
offers a booking link prefilled to it, and picking a leading or trailing cell
moves the grid to that neighbouring month. Days are bucketed by a
clinic-timezone `YYYY-MM-DD` key, so the month query stays a single indexed
range scan.

### Security notes

- Server Actions are reachable by direct POST, so **every** action calls
  `requireDoctor()` and scopes its query by `doctorId` — the layout guard is
  convenience, not the boundary. Reads and writes for another doctor's ids come
  back as 404 / "not on your list", never as data.
- Passwords are bcrypt with cost 12. A failed login compares against a decoy
  hash so a wrong email and a wrong password take the same time, and the error
  never says which was wrong.
- The session cookie is HttpOnly, SameSite=Lax, and Secure in production.
  Rotating `SESSION_SECRET` signs everyone out.

### Timezone

Appointment times are rendered in the clinic's timezone rather than the
viewer's, so server-rendered markup and the doctor's wall clock agree. It
defaults to `Asia/Manila`; set `NEXT_PUBLIC_CLINIC_TIMEZONE` to change it.

## Not yet built

**A patient-facing portal.** The doctor books on the patient's behalf today.
Patients choosing their own slot needs patient accounts, a public booking flow,
and a review step for `PENDING` requests. `BookingSource.PATIENT_PORTAL` exists
so those bookings will be distinguishable when it lands.

**Multiple doctors per clinic.** One account is one doctor, and every query
scopes to the signed-in doctor's own records. A "which doctor" field on booking
needs a clinic that owns doctors, per-doctor availability, and a rethink of that
scoping — it is not a dropdown.

**Attending household members.** `FAMILY_CHECKUP` labels the visit but still
books one patient. Several members in one appointment needs a join table and a
decision about whose record the encounter belongs to.

**Roles and permissions.** Every account is a doctor with full access to its own
data. Nurses, receptionists and administrators — and permission-scoped access to
records — are not modelled at all. This is the largest single gap for a clinic
with more than one person in it, and it has to land before an audit trail means
anything.

**An audit trail.** Nothing records who viewed or changed a record. For
Philippine Data Privacy Act purposes this is not optional, and retrofitting it
after roles exist is the right order.

**Patient documents and lab results.** No file storage of any kind, so uploaded
labs, referral letters and images have nowhere to go. Laboratory *requests* are
likewise unmodelled — a visit can describe them in the plan, but they are not
structured or trackable.

**Medical certificates and referral letters.** The printable prescription is the
only document the app produces; these two would follow the same shape.

**Billing, payments and receipts. Reporting and CSV/Excel export. Reminder
delivery. Two-factor authentication. Session timeouts. Consent records.** None
started.

**Calendar depth.** Month view only — no day or week view, no clinic-hours
editing, no breaks, leave or blocked dates, no filtering by service or status,
no drag-to-reschedule.

**Attachments** (labs, referral letters, images) need file storage, which the
app has none of yet.

**Reminders** are recorded as a preference only; nothing sends anything.

Also outstanding: repeat/recurring appointments, week and day calendar views,
per-doctor working hours and holidays beyond the fixed Sunday closure,
printable prescriptions and medical certificates, an audit trail of who changed
what, and soft deletes — deletion is permanent.
