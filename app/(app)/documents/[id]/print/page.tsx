import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDoctor } from "@/lib/auth";
import { clinicLetterhead, type ClinicLetterhead } from "@/lib/clinic";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, formatDate, formatDateTime } from "@/lib/datetime";
import { ageFrom, fullName, SEX_LABELS } from "@/lib/domain";
import { DOCUMENT_TYPE_LABELS, parseDetails, type DocumentDetails } from "@/lib/documents";
import type { DocumentType } from "@/lib/enums";
import { PrintButton } from "@/components/print-button";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Document" };

/**
 * A stored detail as it should read on paper.
 *
 * The values come from date and datetime inputs, so they are ISO-ish strings.
 * Anything that does not parse is printed as typed rather than dropped — a
 * document with a blank where a date should be is worse than one with an
 * unusual date format.
 */
function onDate(value: string | undefined) {
  if (!value) return "____________";
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(parsed.getTime()) ? value : formatDate(parsed);
}

function onDateTime(value: string | undefined) {
  if (!value) return "____________";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatDateTime(parsed);
}

const text = (value: string | undefined) => value || "____________";

export default async function DocumentPrintPage({ params }: PageProps<"/documents/[id]/print">) {
  const doctor = await requireDoctor();
  const { id } = await params;
  const clinic = await clinicLetterhead(doctor.clinicId);

  const request = await orm.DocumentRequest
    .include("patient", (p) =>
      p
        .select(
          "id",
          "firstName",
          "middleName",
          "lastName",
          "dateOfBirth",
          "sex",
          "patientNumber",
        )
        .include("household", (h) => h.select("name", "address")),
    )
    .include("medicalRecord", (r) => r.select("id", "visitDate", "chiefComplaint", "assessment"))
    .where((r) => r.id.eq(id))
    .where((r) => r.doctorId.eq(doctor.id))
    .first();
  if (!request) notFound();

  const { patient } = request;
  const details = parseDetails(request.details);
  const issued = new Date();

  return (
    <div className="space-y-3">
      {/* Screen-only controls; the sheet below is what prints. */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {DOCUMENT_TYPE_LABELS[request.type]}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {fullName(patient)} · requested by {request.requesterName}
          </p>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          <Link href={`/documents/${request.id}`} className={buttonClass("secondary")}>
            Back to request
          </Link>
        </div>
      </div>

      <article className="document-sheet mx-auto w-full max-w-[210mm] rounded-xl border border-border bg-white p-10 text-black shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <Letterhead
          doctor={doctor}
          clinic={clinic}
          title={DOCUMENT_TYPE_LABELS[request.type].toUpperCase()}
        />

        <PatientBlock
          name={fullName(patient)}
          number={patient.patientNumber}
          age={ageFrom(calendarDateFromDb(patient.dateOfBirth))}
          sex={SEX_LABELS[patient.sex]}
          birth={formatDate(calendarDateFromDb(patient.dateOfBirth))}
          address={patient.household.address}
          household={patient.household.name}
        />

        <Body type={request.type} details={details} patient={fullName(patient)} purpose={request.purpose} />

        <Footer doctor={doctor} clinic={clinic} issued={issued} purpose={request.purpose} />
      </article>
    </div>
  );
}

// --- shared chrome ----------------------------------------------------------

type Doctor = {
  fullName: string;
  specialty: string | null;
  licenseNumber: string | null;
};

function Letterhead({
  doctor,
  clinic,
  title,
}: {
  doctor: Doctor;
  clinic: ClinicLetterhead;
  title: string;
}) {
  return (
    <header className="border-b-2 border-black pb-4 text-center">
      <p className="text-lg font-semibold">{clinic.name || doctor.fullName}</p>
      {clinic.address ? <p className="text-sm">{clinic.address}</p> : null}
      {clinic.contactNumber ? <p className="text-sm">Tel. {clinic.contactNumber}</p> : null}
      {clinic.name ? <p className="mt-2 text-sm">{doctor.fullName}</p> : null}
      {doctor.specialty ? <p className="text-sm">{doctor.specialty}</p> : null}
      <h2 className="mt-4 text-base font-bold tracking-[0.18em]">{title}</h2>
    </header>
  );
}

function PatientBlock({
  name,
  number,
  age,
  sex,
  birth,
  address,
  household,
}: {
  name: string;
  number: string | null;
  age: string | number;
  sex: string;
  birth: string;
  address: string | null;
  household: string;
}) {
  return (
    <section className="grid grid-cols-2 gap-x-8 gap-y-1 border-b border-black/30 py-4 text-sm">
      <p className="col-span-2">
        <span className="font-medium">Patient:</span> {name}
      </p>
      <p>
        <span className="font-medium">Patient no.:</span> {number ?? "—"}
      </p>
      <p>
        <span className="font-medium">Age / Sex:</span> {age} / {sex}
      </p>
      <p>
        <span className="font-medium">Date of birth:</span> {birth}
      </p>
      <p>
        <span className="font-medium">Household:</span> {household}
      </p>
      <p className="col-span-2">
        <span className="font-medium">Address:</span> {address ?? "____________"}
      </p>
    </section>
  );
}

/** A labelled block of prose, as these documents set them out. */
function Clause({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-bold tracking-wider uppercase">{label}</p>
      <p className="mt-1 text-sm whitespace-pre-wrap">{children}</p>
    </div>
  );
}

function Footer({
  doctor,
  clinic,
  issued,
  purpose,
}: {
  doctor: Doctor;
  clinic: ClinicLetterhead;
  issued: Date;
  purpose: string;
}) {
  return (
    <footer className="mt-10">
      <p className="text-sm">
        Issued on {formatDate(issued)} at {clinic.name || "this clinic"} upon request, for{" "}
        {purpose.toLowerCase()} and for no other purpose.
      </p>
      <div className="mt-12 flex justify-end">
        <div className="w-64 border-t border-black pt-2 text-center text-sm">
          <p className="font-medium">{doctor.fullName}</p>
          {doctor.licenseNumber ? (
            <p className="text-xs">PRC License No. {doctor.licenseNumber}</p>
          ) : null}
          <p className="text-xs">Attending Physician</p>
        </div>
      </div>
    </footer>
  );
}

// --- the five documents -----------------------------------------------------

function Body({
  type,
  details,
  patient,
  purpose,
}: {
  type: DocumentType;
  details: DocumentDetails;
  patient: string;
  purpose: string;
}) {
  const d = details;

  if (type === "OUTPATIENT_CERTIFICATE") {
    return (
      <section className="py-6 text-sm">
        <p className="leading-relaxed">
          This is to certify that <strong>{patient}</strong> was seen and examined by me on{" "}
          <strong>{onDate(d.seenOn)}</strong>, and was found to have the condition stated below.
        </p>
        <Clause label="Diagnosis">{text(d.diagnosis)}</Clause>
        {d.restFrom || d.restTo ? (
          <Clause label="Recommendation">
            Advised rest from {onDate(d.restFrom)} to {onDate(d.restTo)}
            {d.fitOn ? `, and may return to work, school or usual activity on ${onDate(d.fitOn)}.` : "."}
          </Clause>
        ) : d.fitOn ? (
          <Clause label="Recommendation">Fit to return to work, school or usual activity on {onDate(d.fitOn)}.</Clause>
        ) : null}
        {d.remarks ? <Clause label="Remarks">{d.remarks}</Clause> : null}
      </section>
    );
  }

  if (type === "MEDICAL_CERTIFICATE") {
    return (
      <section className="py-6 text-sm">
        <p className="leading-relaxed">
          This is to certify that <strong>{patient}</strong> was admitted to and confined at this
          institution from <strong>{onDate(d.admittedOn)}</strong> to{" "}
          <strong>{onDate(d.dischargedOn)}</strong>, under my care, and was managed for the
          condition stated below.
        </p>
        <Clause label="Diagnosis">{text(d.diagnosis)}</Clause>
        {d.restFrom || d.restTo ? (
          <Clause label="Recommendation">
            Advised rest from {onDate(d.restFrom)} to {onDate(d.restTo)}, and may resume usual
            activity thereafter unless symptoms recur.
          </Clause>
        ) : null}
        {d.remarks ? <Clause label="Remarks">{d.remarks}</Clause> : null}
      </section>
    );
  }

  if (type === "MEDICAL_ABSTRACT") {
    return (
      <section className="py-6 text-sm">
        <p className="leading-relaxed">
          The following is a summary of the confinement of <strong>{patient}</strong> from{" "}
          <strong>{onDate(d.admittedOn)}</strong> to <strong>{onDate(d.dischargedOn)}</strong>.
        </p>
        <Clause label="Chief complaint">{text(d.chiefComplaint)}</Clause>
        <Clause label="History and findings on admission">{text(d.historyAndFindings)}</Clause>
        {d.courseInWard ? <Clause label="Course in the ward">{d.courseInWard}</Clause> : null}
        <Clause label="Final diagnosis">{text(d.finalDiagnosis)}</Clause>
        {d.treatment ? <Clause label="Treatment given">{d.treatment}</Clause> : null}
        {d.conditionOnDischarge ? (
          <Clause label="Condition on discharge">{d.conditionOnDischarge}</Clause>
        ) : null}
      </section>
    );
  }

  if (type === "MEDICO_LEGAL_CERTIFICATE") {
    return (
      <section className="py-6 text-sm">
        <p className="leading-relaxed">
          This is to certify that <strong>{patient}</strong> was examined at this institution on{" "}
          <strong>{onDateTime(d.examinedAt)}</strong>, in connection with an incident said to have
          occurred on <strong>{onDateTime(d.incidentAt)}</strong>
          {d.incidentPlace ? ` at ${d.incidentPlace}` : ""}.
        </p>
        <Clause label="Alleged cause, as reported by the patient">{text(d.allegedCause)}</Clause>
        <Clause label="Findings on examination">{text(d.findings)}</Clause>
        <Clause label="Probable period of healing">{text(d.healingPeriod)}</Clause>
        {d.disposition ? <Clause label="Disposition">{d.disposition}</Clause> : null}
        <p className="mt-6 text-xs leading-relaxed italic">
          The findings above describe what was observed on examination. The alleged cause is
          recorded as reported by the patient and is not a medical finding as to how the injuries
          were sustained.
        </p>
      </section>
    );
  }

  if (type === "INSURANCE_CLAIM") {
    return (
      <section className="py-6 text-sm">
        <p className="text-xs font-bold tracking-wider uppercase">Attending physician&rsquo;s statement</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2">
          <p>
            <span className="font-medium">Insurer:</span> {text(d.insurer)}
          </p>
          <p>
            <span className="font-medium">Policy no.:</span> {text(d.policyNumber)}
          </p>
          <p>
            <span className="font-medium">Member no.:</span> {d.memberNumber || "—"}
          </p>
          <p>
            <span className="font-medium">Claim type:</span> {d.claimType || "—"}
          </p>
          <p className="col-span-2">
            <span className="font-medium">Diagnosis:</span> {text(d.diagnosis)}
            {d.icdCode ? ` (ICD-10 ${d.icdCode})` : ""}
          </p>
          <p>
            <span className="font-medium">Treatment from:</span> {onDate(d.treatmentFrom)}
          </p>
          <p>
            <span className="font-medium">Treatment to:</span> {onDate(d.treatmentTo)}
          </p>
          <p className="col-span-2">
            <span className="font-medium">Total charges:</span>{" "}
            {d.totalCharges ? `₱ ${Number(d.totalCharges).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "____________"}
          </p>
        </dl>
        <p className="mt-6 text-sm leading-relaxed">
          I certify that the statements above are true and correct to the best of my knowledge, and
          that they are drawn from this patient&rsquo;s clinical record held at this institution.
        </p>
      </section>
    );
  }

  // RECORD_COPIES
  return (
    <section className="py-6 text-sm">
      <p className="leading-relaxed">
        The records described below, covering <strong>{onDate(d.coveringFrom)}</strong> to{" "}
        <strong>{onDate(d.coveringTo)}</strong>, are released from the chart of{" "}
        <strong>{patient}</strong>.
      </p>
      <Clause label="Records released">{text(d.items)}</Clause>
      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2">
        <p>
          <span className="font-medium">Pages:</span> {d.pageCount || "____"}
        </p>
        <p>
          <span className="font-medium">Released how:</span> {d.deliveryMethod || "Collected"}
        </p>
        <p className="col-span-2">
          <span className="font-medium">Release authorised by:</span> {text(d.authorisedBy)}
        </p>
      </dl>

      {/* The receipt is the point of this one: it is the clinic's evidence that
          the records went to somebody entitled to them. */}
      <div className="mt-10 border border-black/40 p-4">
        <p className="text-xs font-bold tracking-wider uppercase">Acknowledgement of receipt</p>
        <p className="mt-2 text-sm leading-relaxed">
          I acknowledge that I have received the records described above, and that they are to be
          used only for {purpose.toLowerCase()}.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-8">
          <div className="border-t border-black pt-2 text-center text-xs">
            Signature over printed name
          </div>
          <div className="border-t border-black pt-2 text-center text-xs">Date received</div>
        </div>
      </div>
    </section>
  );
}
