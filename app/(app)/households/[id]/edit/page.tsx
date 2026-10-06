import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { updateHousehold } from "@/app/actions/households";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { fullName } from "@/lib/domain";
import { HouseholdForm } from "@/components/forms/household-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Edit household" };

export default async function EditHouseholdPage({ params }: PageProps<"/households/[id]/edit">) {
  const doctor = await requireDoctor();
  const { id } = await params;

  const household = await orm.Household
    .include("patients", (p) =>
      p
        .select("id", "firstName", "middleName", "lastName")
        .orderBy((x) => x.lastName.asc())
        .orderBy((x) => x.firstName.asc()),
    )
    .where((h) => h.id.eq(id))
    .where((h) => h.clinicId.eq(doctor.clinicId))
    .first();
  if (!household) notFound();

  const action = updateHousehold.bind(null, household.id);

  return (
    <div className="space-y-3">
      <PageHeader title={`Edit ${household.name} household`} />
      <Card className="max-w-3xl p-5 sm:p-6">
        <HouseholdForm
          action={action}
          defaults={{
            name: household.name,
            address: household.address ?? "",
            contactNumber: household.contactNumber ?? "",
            primaryContactId: household.primaryContactId ?? "",
            notes: household.notes ?? "",
          }}
          members={household.patients.map((p) => ({ id: p.id, label: fullName(p) }))}
          submitLabel="Save changes"
          cancelHref={`/households/${household.id}`}
        />
      </Card>
    </div>
  );
}
