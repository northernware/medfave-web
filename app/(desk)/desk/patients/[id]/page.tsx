import type { Metadata } from "next";
import { CrumbName } from "@/components/crumb-names";
import Link from "next/link";
import { notFound } from "next/navigation";
import { giveCareAccess, issuePatientActivation, revokeCareLink, revokePatientActivation } from "@/app/actions/access";
import { isAdult as isAdultDob } from "@/lib/households";
import { StartHousehold } from "@/components/start-household";
import { requireStaff } from "@/lib/auth";
import { PatientClipboard } from "@/components/patient-clipboard";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, formatCalendarDate, formatDateTime, instantFromDb } from "@/lib/datetime";
import { ageFrom, fullName, RELATIONSHIP_LABELS, REMINDER_LABELS, SEX_LABELS } from "@/lib/domain";
import { AppointmentList } from "@/components/appointment-list";
import { ShareCode } from "@/components/share-code";
import { activationLink, qrSvg } from "@/lib/activation-link";
import { Badge, buttonClass, Card, CardHeader, SectionTitle } from "@/components/ui";
import { TextInput } from "@/components/form";

export const metadata: Metadata = { title: "Patient" };

/**
 * The code, just issued, handed over at the desk: the patient scans the QR in
 * the Medfave app or types the 6 digits. For later, the message carries the
 * long code (14 days). Shown this once — only hashes are kept.
 */
async function ActivationHandover({
  code,
  pin,
  patientName,
  clinicName,
  mail,
  caregiver,
}: {
  code: string;
  pin?: string;
  patientName: string;
  clinicName: string;
  mail?: string;
  /** Set when the code is for a parent or guardian: their name, or "" when the desk didn't give one. */
  caregiver?: string;
}) {
  const link = await activationLink(code);
  const svg = await qrSvg(link);
  const firstName = patientName.split(/\s+/)[0];
  const mailNote =
    mail === "sent"
      ? "Also emailed to them."
      : mail === "failed"
        ? "The email didn't go through."
        : mail === "no-address"
          ? "No email on file."
          : null;

  return (
    <section className="overflow-hidden rounded-xl border border-accent/30 bg-surface shadow-card">
      <div className="flex items-baseline justify-between gap-4 bg-accent-tint px-5 py-3.5 sm:px-6">
        <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">
          {caregiver !== undefined
            ? `${caregiver || "A parent or guardian"} — to look after ${firstName}`
            : <>Link {firstName}&rsquo;s Medfave account</>}
        </h2>
        <p className="shrink-0 text-xs font-medium text-accent-ink">Shown once</p>
      </div>

      <div className="grid gap-6 px-5 py-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-10 sm:px-6">
        <figure className="mx-auto space-y-2 text-center sm:mx-0">
          <div
            className="size-44 rounded-lg border-2 border-brand bg-white p-2.5 [&>svg]:size-full"
            role="img"
            aria-label={`QR code that links ${patientName}'s Medfave account`}
            // Generated here from our own link by the qrcode package — no user input reaches it unescaped.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <figcaption className="text-sm text-ink-muted">Scan in the Medfave app</figcaption>
        </figure>

        <div className="space-y-3 text-center sm:text-left">
          <p className="text-sm font-medium text-ink-muted">Or type this code</p>
          {pin ? (
            <div className="flex justify-center gap-2 sm:justify-start" aria-label={`Code ${pin.split("").join(" ")}`}>
              {pin.split("").map((d, i) => (
                <span
                  key={i}
                  className={`tabular grid h-14 w-11 place-items-center rounded-md border border-border-strong bg-surface-muted font-display text-3xl font-semibold ${i === 2 ? "mr-2" : ""}`}
                >
                  {d}
                </span>
              ))}
            </div>
          ) : (
            <p className="tabular font-display text-xl font-semibold tracking-wider">{code}</p>
          )}
          <p className="text-sm text-ink-muted">{pin ? "Works for 30 minutes, once." : "Works once."}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border bg-surface-muted/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-ink-muted">
          <span className="font-medium text-ink">Not with them?</span> Send a link that lasts 14 days.
          {mailNote ? ` ${mailNote}` : ""}
        </p>
        <ShareCode code={code} link={link} clinicName={clinicName} />
      </div>
    </section>
  );
}

export default async function DeskPatientPage({
  params,
  searchParams,
}: PageProps<"/desk/patients/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const { code, pin, mail, for: forWho, to, household: householdNote, care, why } = await searchParams;

  const patient = await orm.Patient
    .select(
      "id",
      "firstName",
      "middleName",
      "lastName",
      "dateOfBirth",
      "sex",
      "relationship",
      "contactNumber",
      "email",
      "reminderPreference",
      "patientNumber",
      "accountId",
      "archivedAt",
      "emergencyContactName",
      "emergencyContactRelationship",
      "emergencyContactNumber",
      "emergencyContact2Name",
      "emergencyContact2Relationship",
      "emergencyContact2Number",
    )
    .include("household", (h) => h.select("id", "name", "address", "contactNumber"))
    .include("appointments", (a) =>
      a
        .select("id", "scheduledAt", "durationMinutes", "service", "reason", "status", "priority", "visitType")
        .include("patient", (p) =>
          p.select("id", "firstName", "middleName", "lastName").include("household", (h) => h.select("id", "name")),
        )
        .include("medicalRecord", (r) => r.select("id"))
        .orderBy((x) => x.scheduledAt.desc())
        .limit(20),
    )
    .where((p) => p.id.eq(id))
    .where((p) => p.clinicId.eq(staff.clinicId))
    .first();
  if (!patient) notFound();

  const appointments = patient.appointments.map((a) => ({
    ...a,
    scheduledAt: instantFromDb(a.scheduledAt),
  }));

  const activation = await orm.PatientActivation
    .select("id", "expiresAt", "usedAt", "revokedAt", "createdAt")
    .where((a) => a.patientId.eq(patient.id))
    .where((a) => a.forCaregiver.eq(false))
    .where((a) => a.clinicId.eq(staff.clinicId))
    .orderBy((a) => a.createdAt.desc())
    .first();
  const live =
    activation && !activation.usedAt && !activation.revokedAt
      ? instantToDbSafe(activation.expiresAt)
      : null;

  // Logins that look after this chart for the patient, and the caregiver codes still out (one per person).
  const [carers, careCodes] = await Promise.all([
    orm.CareLink
      .select("id", "caregiverName", "createdAt", "accountId")
      .include("account", (a) => a.select("fullName", "email"))
      .where((l) => l.patientId.eq(patient.id))
      .where((l) => l.clinicId.eq(staff.clinicId))
      .where((l) => l.revokedAt.isNull())
      .orderBy((l) => l.createdAt.asc())
      .all(),
    orm.PatientActivation
      .select("id", "expiresAt", "caregiverName")
      .where((a) => a.patientId.eq(patient.id))
      .where((a) => a.clinicId.eq(staff.clinicId))
      .where((a) => a.forCaregiver.eq(true))
      .where((a) => a.usedAt.isNull())
      .where((a) => a.revokedAt.isNull())
      .orderBy((a) => a.createdAt.asc())
      .all(),
  ]);
  const careCodesLive = careCodes.filter((c) => instantToDbSafe(c.expiresAt));

  // The rest of their household: who could come along if they start their own.
  const housemates = await orm.Patient
    .select("id", "firstName", "middleName", "lastName", "relationship", "accountId", "dateOfBirth")
    .where((p) => p.householdId.eq(patient.household.id))
    .where((p) => p.clinicId.eq(staff.clinicId))
    .where((p) => p.archivedAt.isNull())
    .all();
  const others = housemates.filter((h) => h.id !== patient.id);
  // Who could look after them in one tap: grown-ups in the household who use
  // Medfave and don't already. Anybody else: by email, or a code.
  const carerIds = new Set(carers.map((c) => c.accountId));
  const suggested = others.filter(
    (h) => h.accountId && h.accountId !== patient.accountId && !carerIds.has(h.accountId) && isAdultDob(String(h.dateOfBirth)),
  );

  return (
    <div className="space-y-3">
      <CrumbName id={patient.id} name={fullName(patient)} />
      {/* The header heads the left column, so the clipboard starts level with the name. */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className="min-w-0">
          <div className="mb-3 space-y-3">
          <header className="flex flex-wrap items-center gap-4">
            <span
              aria-hidden="true"
              className="grid size-14 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-lg font-semibold text-accent-ink"
            >
              {`${patient.firstName[0] ?? ""}${patient.lastName[0] ?? ""}`.toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[26px] leading-8 font-semibold tracking-[-0.015em] sm:text-[30px] sm:leading-9">
                {fullName(patient)}
              </h1>
              <p className="mt-0.5 text-sm text-ink-muted">
                {SEX_LABELS[patient.sex]} · {ageFrom(calendarDateFromDb(patient.dateOfBirth))} · {patient.household.name}{" "}
                household
                {patient.patientNumber ? <span className="tabular"> · {patient.patientNumber}</span> : null}
              </p>
            </div>
            {patient.archivedAt ? null : (
              <div className="flex w-full gap-2 sm:w-auto">
                <Link
                  href={`/desk/appointments/new?patientId=${patient.id}`}
                  className={buttonClass("primary", "flex-1 sm:flex-none")}
                >
                  Book a visit
                </Link>
                <Link
                  href={`/desk/patients/${patient.id}/edit`}
                  className={buttonClass("secondary", "flex-1 sm:flex-none")}
                >
                  Edit details
                </Link>
              </div>
            )}
          </header>

          {patient.archivedAt ? (
            <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
              <p className="font-medium">This chart is archived.</p>
              <p className="mt-0.5 text-ink-muted">
                It cannot be booked or edited until the clinician restores it.
              </p>
            </div>
          ) : null}

          {/* Handed over in person, once. This is the only way a login ever reaches
              a chart, so it is issued to somebody the desk has identified. */}
          {code && typeof code === "string" ? (
            <ActivationHandover
              code={code}
              pin={typeof pin === "string" && /^\d{6}$/.test(pin) ? pin : undefined}
              patientName={fullName(patient)}
              clinicName={staff.clinicName}
              mail={typeof mail === "string" ? mail : undefined}
              caregiver={forWho === "caregiver" ? (typeof to === "string" ? to : "") : undefined}
            />
          ) : null}
          </div>
          <SectionTitle title="Visits" />
          <Card className="overflow-hidden">
            <AppointmentList
              appointments={appointments}
              hrefFor={(appointmentId) => `/desk/appointments/${appointmentId}`}
              emptyTitle="No visits yet"
              emptyDescription="Nothing booked for this patient."
            />
          </Card>
        </section>

        <div className="space-y-3">
        {/* Who they are and how to reach them, on the clipboard the doctor's pages
            use. Nothing clinical: the desk's sheet is contacts only. */}
        <PatientClipboard
          number={patient.patientNumber}
          facts={[
            {
              label: "Born",
              value: (
                <>
                  {formatCalendarDate(calendarDateFromDb(patient.dateOfBirth))}
                  <span className="block text-xs font-normal text-ink-muted">{ageFrom(calendarDateFromDb(patient.dateOfBirth))}</span>
                </>
              ),
            },
            { label: "Sex", value: SEX_LABELS[patient.sex] },
          ]}
          contacts={[]}
        >
          <dl className="space-y-3">
            {[
              { label: "Mobile", value: patient.contactNumber },
              { label: "Email", value: patient.email },
              { label: "Reminders", value: REMINDER_LABELS[patient.reminderPreference] },
              { label: "Household address", value: patient.household.address },
              { label: "Household number", value: patient.household.contactNumber },
              {
                label: "Primary contact",
                value: patient.emergencyContactName,
                detail: [patient.emergencyContactRelationship, patient.emergencyContactNumber].filter(Boolean).join(" · "),
              },
              {
                label: "Secondary contact",
                value: patient.emergencyContact2Name,
                detail: [patient.emergencyContact2Relationship, patient.emergencyContact2Number].filter(Boolean).join(" · "),
              },
            ]
              .filter((c) => c.value)
              .map((c) => (
                <div key={c.label} className="min-w-0">
                  <dt className="text-xs text-ink-faint">{c.label}</dt>
                  <dd className="text-sm leading-6">
                    {c.value}
                    {"detail" in c && c.detail ? <span className="block text-xs text-ink-faint">{c.detail}</span> : null}
                  </dd>
                </div>
              ))}
          </dl>
        </PatientClipboard>
        <Card>
          <CardHeader title="Medfave account" subtitle="Lets them see their visits and ask for times." />
          <div className="flex flex-wrap items-center gap-3 px-5 py-4">
            {patient.accountId ? (
              <Badge dot tone="ok">
                Account active
              </Badge>
            ) : live ? (
              <>
                <Badge dot tone="accent">
                  Code issued
                </Badge>
                <span className="text-sm text-ink-muted">
                  Expires {formatDateTime(instantFromDb(activation!.expiresAt))}
                </span>
                <form action={revokePatientActivation}>
                  <input type="hidden" name="patientId" value={patient.id} />
                  <button className={buttonClass("secondary")}>Revoke</button>
                </form>
              </>
            ) : (
              <>
                <Badge tone="neutral">No account</Badge>
                <form action={issuePatientActivation}>
                  <input type="hidden" name="patientId" value={patient.id} />
                  <button className={buttonClass("primary")}>Link their account</button>
                </form>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Household" subtitle={`${patient.household.name} household · ${housemates.length} ${housemates.length === 1 ? "person" : "people"}`} />
          <div className="space-y-3 px-5 py-4">
            {householdNote === "new" ? (
              <p className="text-sm text-ok-ink">Their own household is set up. Records went with each person.</p>
            ) : null}
            {/* The household page is the doctor's. */}
            {staff.doctorId ? (
              <Link href={`/households/${patient.household.id}`} className="block text-sm font-medium text-accent-ink hover:underline">
                Open household
              </Link>
            ) : null}
            {patient.archivedAt ? null : <StartHousehold patient={patient} others={others} back={`/desk/patients/${patient.id}`} />}
          </div>
        </Card>

        {/* A parent or guardian the desk has identified: their own login looks
            after this chart, beside their own records, without becoming it. */}
        <Card>
          <CardHeader title="Looked after by" subtitle="Parents or guardians who see this chart and book for them." />
          <div className="divide-y divide-border">
            {carers.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.caregiverName ?? c.account.fullName}</p>
                  <p className="truncate text-xs text-ink-muted">{c.account.email}</p>
                </div>
                <form action={revokeCareLink}>
                  <input type="hidden" name="linkId" value={c.id} />
                  <button className={buttonClass("secondary")}>Remove</button>
                </form>
              </div>
            ))}
            {careCodesLive.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Badge dot tone="accent">
                  Code issued{c.caregiverName ? ` · ${c.caregiverName}` : ""}
                </Badge>
                <span className="text-sm text-ink-muted">Expires {formatDateTime(instantFromDb(c.expiresAt))}</span>
                <form action={revokePatientActivation}>
                  <input type="hidden" name="patientId" value={patient.id} />
                  <input type="hidden" name="activationId" value={c.id} />
                  <button className={buttonClass("secondary")}>Revoke</button>
                </form>
              </div>
            ))}
            {care === "given" ? (
              <p className="px-5 py-3 text-sm text-ok-ink">
                {typeof to === "string" && to ? to : "They"} can now see this chart and book for {patient.firstName}. It&rsquo;s in
                their family list in the app.
              </p>
            ) : care === "refused" ? (
              <p className="px-5 py-3 text-sm text-danger-ink">{typeof why === "string" ? why : "That didn't work."}</p>
            ) : null}
            {patient.archivedAt ? null : (
              <div className="space-y-3 px-5 py-4">
                {/* One tap for a grown-up in the household who already uses Medfave. */}
                {suggested.map((h) => (
                  <form key={h.id} action={giveCareAccess} className="flex items-center gap-3">
                    <input type="hidden" name="patientId" value={patient.id} />
                    <input type="hidden" name="accountId" value={h.accountId!} />
                    <p className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{fullName(h)}</span>
                      <span className="text-ink-muted"> · {RELATIONSHIP_LABELS[h.relationship]} · uses Medfave</span>
                    </p>
                    <button className={buttonClass("primary")}>Give access</button>
                  </form>
                ))}
                <form action={giveCareAccess} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="patientId" value={patient.id} />
                  <div className="min-w-0 flex-1">
                    <TextInput name="email" type="email" placeholder="Their Medfave email" aria-label="Their Medfave email" />
                  </div>
                  <button className={buttonClass("secondary")}>Give access</button>
                </form>
                <details>
                  <summary className="cursor-pointer text-sm text-ink-muted hover:text-ink">Not on Medfave yet? Give them a code</summary>
                  <form action={issuePatientActivation} className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="patientId" value={patient.id} />
                    <input type="hidden" name="for" value="caregiver" />
                    <div className="min-w-0 flex-1">
                      <TextInput name="caregiverName" placeholder="Their name (optional)" aria-label="Their name" />
                    </div>
                    <button className={buttonClass("secondary")}>Make a code</button>
                  </form>
                </details>
              </div>
            )}
          </div>
        </Card>


        </div>
      </div>
    </div>
  );
}

/** The stored value is already a database timestamp; this only proves it is set. */
function instantToDbSafe(value: string | null) {
  return value ?? null;
}
