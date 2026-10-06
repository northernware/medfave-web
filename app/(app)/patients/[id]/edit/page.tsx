import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { updatePatient } from "@/app/actions/patients";
import { requireDoctor } from "@/lib/auth";
import { caresFor } from "@/lib/care";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb } from "@/lib/datetime";
import { toDateInputValue } from "@/lib/datetime";
import { fullName } from "@/lib/domain";
import { PatientForm } from "@/components/forms/patient-form";
import { BLANK_ITEM } from "@/components/clinical-picker";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Edit patient" };

export default async function EditPatientPage({ params }: PageProps<"/patients/[id]/edit">) {
  const doctor = await requireDoctor();
  const { id } = await params;
  // Only doctors caring for this patient edit their chart (lib/care.ts).
  if (!(await caresFor(doctor, id))) notFound();

  const patient = await orm.Patient
    .include("allergies", (a) =>
      a.select("id", "label", "reaction", "severity", "notes").orderBy((x) => x.createdAt.asc()),
    )
    // The form edits current conditions; resolved ones are history and stay out of it.
    .include("conditions", (c) =>
      c.select("id", "label", "notes").where((x) => x.resolvedAt.isNull()).orderBy((x) => x.createdAt.asc()),
    )
    .include("medications", (m) =>
      m
        .select("id", "label", "dosage", "frequency", "notes")
        .orderBy((x) => x.createdAt.asc()),
    )
    .include("alerts", (a) =>
      a.select("id", "label", "notes").orderBy((x) => x.createdAt.asc()),
    )
    .where((p) => p.id.eq(id))
    .where((p) => p.clinicId.eq(doctor.clinicId))
    .first();
  if (!patient) notFound();

  const households = await orm.Household
    .select("id", "name")
    .where((h) => h.clinicId.eq(doctor.clinicId))
    .where((h) => h.archivedAt.isNull())
    .orderBy((h) => h.name.asc())
    .all();

  const action = updatePatient.bind(null, patient.id);

  return (
    <div className="space-y-3">
      <PageHeader title={`Edit ${fullName(patient)}`} />
      <Card className="p-5 sm:p-6">
        <PatientForm
          action={action}
          households={households}
          defaults={{
            householdId: patient.householdId,
            firstName: patient.firstName,
            middleName: patient.middleName ?? "",
            lastName: patient.lastName,
            dateOfBirth: toDateInputValue(calendarDateFromDb(patient.dateOfBirth)),
            sex: patient.sex,
            relationship: patient.relationship,
            bloodType: patient.bloodType,
            allergyStatus: patient.allergyStatus,
            allergies: patient.allergies.map((a) => ({
              ...BLANK_ITEM,
              label: a.label,
              reaction: a.reaction ?? "",
              severity: a.severity ?? "",
              notes: a.notes ?? "",
            })),
            conditionStatus: patient.conditionStatus,
            conditions: patient.conditions.map((c) => ({
              ...BLANK_ITEM,
              label: c.label,
              notes: c.notes ?? "",
            })),
            medicationStatus: patient.medicationStatus,
            medications: patient.medications.map((m) => ({
              ...BLANK_ITEM,
              label: m.label,
              dosage: m.dosage ?? "",
              frequency: m.frequency ?? "",
              notes: m.notes ?? "",
            })),
            alerts: patient.alerts.map((a) => ({
              ...BLANK_ITEM,
              label: a.label,
              notes: a.notes ?? "",
            })),
            contactNumber: patient.contactNumber ?? "",
            email: patient.email ?? "",
            emergencyContactName: patient.emergencyContactName ?? "",
            emergencyContactRelationship: patient.emergencyContactRelationship ?? "",
            emergencyContactNumber: patient.emergencyContactNumber ?? "",
            emergencyContact2Name: patient.emergencyContact2Name ?? "",
            emergencyContact2Relationship: patient.emergencyContact2Relationship ?? "",
            emergencyContact2Number: patient.emergencyContact2Number ?? "",
          }}
          submitLabel="Save changes"
          cancelHref={`/patients/${patient.id}`}
        />
      </Card>
    </div>
  );
}
