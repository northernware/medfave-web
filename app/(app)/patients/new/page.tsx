import type { Metadata } from "next";
import { createPatient } from "@/app/actions/patients";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { blankPatient } from "@/lib/form-defaults";
import { NEW_HOUSEHOLD } from "@/lib/validation";
import { PatientForm } from "@/components/forms/patient-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Add patient" };

/**
 * Registering a patient without first navigating into a household.
 *
 * The household is chosen — or created — inside this form, so the flow is one
 * screen rather than two. `/households/[id]/patients/new` still exists for
 * adding someone to a household you are already looking at, and both post to
 * the same action.
 */
export default async function NewPatientPage({ searchParams }: PageProps<"/patients/new">) {
  const doctor = await requireDoctor();
  const { householdId } = await searchParams;

  const households = await orm.Household
    .select("id", "name")
    .where((h) => h.clinicId.eq(doctor.clinicId))
    .where((h) => h.archivedAt.isNull())
    .orderBy((h) => h.name.asc())
    .all();

  // Preselect a household when one was named, otherwise start on "new" for a
  // clinic with none yet, so the first registration needs no detour.
  const preselected =
    typeof householdId === "string" && households.some((h) => h.id === householdId)
      ? householdId
      : households.length === 0
        ? NEW_HOUSEHOLD
        : "";

  return (
    <div className="space-y-3">
      <PageHeader
        title="Add patient"
        subtitle="Choose a household or create one here — no need to go and make it first."
      />
      <Card className="max-w-3xl p-5 sm:p-6">
        <PatientForm
          action={createPatient}
          defaults={blankPatient(preselected)}
          households={households}
          submitLabel="Register patient"
          cancelHref="/patients"
        />
      </Card>
    </div>
  );
}
