import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { updateDocumentRequest } from "@/app/actions/documents";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { documentFormData } from "@/lib/queries";
import { fullName } from "@/lib/domain";
import { DOCUMENT_TYPE_LABELS, parseDetails } from "@/lib/documents";
import { DocumentForm } from "@/components/forms/document-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Edit request" };

export default async function EditDocumentPage({ params }: PageProps<"/documents/[id]/edit">) {
  const doctor = await requireDoctor();
  const { id } = await params;

  const request = await orm.DocumentRequest
    .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
    .where((r) => r.id.eq(id))
    .where((r) => r.doctorId.eq(doctor.id))
    .first();
  if (!request) notFound();

  // What has been handed over is what was handed over.
  if (request.status === "RELEASED") redirect(`/documents/${request.id}`);

  const { patients, visits } = await documentFormData(doctor.id);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <PageHeader
        title={`Edit ${DOCUMENT_TYPE_LABELS[request.type].toLowerCase()}`}
        subtitle={fullName(request.patient)}
      />
      <Card className="p-5 sm:p-6">
        <DocumentForm
          action={updateDocumentRequest.bind(null, request.id)}
          patients={patients}
          visits={visits}
          lockedType
          defaults={{
            patientId: request.patientId,
            type: request.type,
            medicalRecordId: request.medicalRecordId ?? "",
            purpose: request.purpose,
            requesterName: request.requesterName,
            requesterRelation: request.requesterRelation,
            notes: request.notes ?? "",
            details: parseDetails(request.details),
          }}
          submitLabel="Save changes"
          cancelHref={`/documents/${request.id}`}
        />
      </Card>
    </div>
  );
}
