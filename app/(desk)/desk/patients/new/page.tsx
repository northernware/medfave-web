import type { Metadata } from "next";
import { createPatient } from "@/app/actions/patients";
import { requireStaff } from "@/lib/auth";
import { clinicDoctors } from "@/lib/clinic";
import { orm } from "@/src/prisma/db";
import { blankPatient } from "@/lib/form-defaults";
import { NEW_HOUSEHOLD } from "@/lib/validation";
import { PatientForm } from "@/components/forms/patient-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Add patient" };

export default async function DeskNewPatientPage({ searchParams }: PageProps<"/desk/patients/new">) {
  const staff = await requireStaff();
  const { householdId } = await searchParams;

  const households = await orm.Household
    .select("id", "name")
    .where((h) => h.clinicId.eq(staff.clinicId))
    .where((h) => h.archivedAt.isNull())
    .orderBy((h) => h.name.asc())
    .all();

  const preselected =
    typeof householdId === "string" && households.some((h) => h.id === householdId)
      ? householdId
      : households.length === 0
        ? NEW_HOUSEHOLD
        : "";

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <PageHeader
        title="Add patient"
        subtitle="Registration details. Allergies and conditions are recorded by the doctor at the visit."
      />
      <Card className="p-5 sm:p-6">
        <PatientForm
          action={createPatient}
          defaults={blankPatient(preselected)}
          households={households}
          // The desk registers people; it does not record findings about them.
          clinical={staff.role !== "SECRETARY"}
          doctors={staff.doctorId ? [] : await clinicDoctors(staff.clinicId)}
          submitLabel="Register patient"
          cancelHref="/desk/patients"
        />
      </Card>
    </div>
  );
}
