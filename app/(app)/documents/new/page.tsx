import type { Metadata } from "next";
import Link from "next/link";
import { createDocumentRequest } from "@/app/actions/documents";
import { requireDoctor } from "@/lib/auth";
import { documentFormData } from "@/lib/queries";
import { DocumentType } from "@/lib/enums";
import { DocumentForm } from "@/components/forms/document-form";
import { buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Request a document" };

export default async function NewDocumentPage({ searchParams }: PageProps<"/documents/new">) {
  const doctor = await requireDoctor();
  const { patientId, type, recordId } = await searchParams;
  const { patients, visits } = await documentFormData(doctor.id);

  if (patients.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Request a document" />
        <Card>
          <EmptyState
            title="No patients yet"
            description="A document is drawn from a patient's chart, so there has to be a chart first."
            action={
              <Link href="/patients/new" className={buttonClass("primary")}>
                Add patient
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const preselected =
    typeof patientId === "string" && patients.some((p) => p.id === patientId) ? patientId : "";

  return (
    <div className="space-y-3">
      <PageHeader
        title="Request a document"
        subtitle="Recorded as a request first, prepared, then handed over — so the chart says who got what."
      />
      <Card className="max-w-3xl p-5 sm:p-6">
        <DocumentForm
          action={createDocumentRequest}
          patients={patients}
          visits={visits}
          defaults={{
            patientId: preselected,
            type:
              typeof type === "string" && type in DocumentType
                ? (type as DocumentType)
                : DocumentType.MEDICAL_CERTIFICATE,
            medicalRecordId: typeof recordId === "string" ? recordId : "",
            purpose: "",
            requesterName: "",
            requesterRelation: "",
            notes: "",
            details: {},
          }}
          submitLabel="Record request"
          cancelHref="/documents"
        />
      </Card>
    </div>
  );
}
