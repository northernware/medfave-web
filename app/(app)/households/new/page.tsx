import type { Metadata } from "next";
import { createHousehold } from "@/app/actions/households";
import { requireDoctor } from "@/lib/auth";
import { HouseholdForm } from "@/components/forms/household-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "New household" };

export default async function NewHouseholdPage() {
  await requireDoctor();

  return (
    <div className="space-y-3">
      <PageHeader title="New household" subtitle="A shared address and history. Members are added next, each with their own record." />
      <Card className="max-w-3xl p-5 sm:p-6">
        <HouseholdForm action={createHousehold} submitLabel="Create household" cancelHref="/households" />
      </Card>
    </div>
  );
}
