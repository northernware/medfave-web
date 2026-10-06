import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPatient } from "@/app/actions/patients";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { PatientForm } from "@/components/forms/patient-form";
import { blankPatient } from "@/lib/form-defaults";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Add patient" };

export default async function NewHouseholdMemberPage({ params }: PageProps<"/households/[id]/patients/new">) {
  const doctor = await requireDoctor();
  const { id } = await params;

  const household = await orm.Household
    .select("id", "name")
    .where((h) => h.id.eq(id))
    .where((h) => h.clinicId.eq(doctor.clinicId))
    .where((h) => h.archivedAt.isNull())
    .first();
  if (!household) notFound();

  const households = await orm.Household
    .select("id", "name")
    .where((h) => h.clinicId.eq(doctor.clinicId))
    .where((h) => h.archivedAt.isNull())
    .orderBy((h) => h.name.asc())
    .all();

  return (
    <div className="space-y-3">
      <PageHeader title="Add patient" subtitle={`Joining the ${household.name} household`} />
      <Card className="max-w-3xl p-5 sm:p-6">
        <PatientForm
          action={createPatient}
          defaults={blankPatient(household.id)}
          households={households}
          submitLabel="Add patient"
          cancelHref={`/households/${household.id}`}
        />
      </Card>
    </div>
  );
}
