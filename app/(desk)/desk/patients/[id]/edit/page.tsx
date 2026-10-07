import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { updatePatient } from "@/app/actions/patients";
import { requireStaff } from "@/lib/auth";
import { clinicDoctors } from "@/lib/clinic";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, toDateInputValue } from "@/lib/datetime";
import { CrumbName } from "@/components/crumb-names";
import { fullName } from "@/lib/domain";
import { PatientForm } from "@/components/forms/patient-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Edit details" };

const text = (v: string | null) => v ?? "";

export default async function DeskEditPatientPage({
  params,
}: PageProps<"/desk/patients/[id]/edit">) {
  const staff = await requireStaff();
  const { id } = await params;

  // Only the registration side is loaded. The clinical lists are not read here
  // and not written back — see `updatePatient`, which leaves them alone for a
  // secretary rather than trusting the form to have omitted them.
  const patient = await orm.Patient
    .select(
      "id",
      "firstName",
      "middleName",
      "lastName",
      "dateOfBirth",
      "sex",
      "relationship",
      "bloodType",
      "contactNumber",
      "email",
      "householdId",
      "emergencyContactName",
      "emergencyContactRelationship",
      "emergencyContactNumber",
      "emergencyContact2Name",
      "emergencyContact2Relationship",
      "emergencyContact2Number",
    )
    .where((p) => p.id.eq(id))
    .where((p) => p.clinicId.eq(staff.clinicId))
    .first();
  if (!patient) notFound();

  const households = await orm.Household
    .select("id", "name")
    .where((h) => h.clinicId.eq(staff.clinicId))
    .where((h) => h.archivedAt.isNull())
    .orderBy((h) => h.name.asc())
    .all();

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <CrumbName id={patient.id} name={fullName(patient)} />
      <PageHeader title="Edit details" subtitle={fullName(patient)} />
      <Card className="p-5 sm:p-6">
        <PatientForm
          action={updatePatient.bind(null, patient.id)}
          households={households}
          clinical={staff.role !== "SECRETARY"}
          doctors={staff.doctorId ? [] : await clinicDoctors(staff.clinicId)}
          defaults={{
            householdId: patient.householdId,
            firstName: patient.firstName,
            middleName: text(patient.middleName),
            lastName: patient.lastName,
            dateOfBirth: toDateInputValue(calendarDateFromDb(patient.dateOfBirth)),
            sex: patient.sex,
            relationship: patient.relationship,
            bloodType: patient.bloodType,
            contactNumber: text(patient.contactNumber),
            email: text(patient.email),
            emergencyContactName: text(patient.emergencyContactName),
            emergencyContactRelationship: text(patient.emergencyContactRelationship),
            emergencyContactNumber: text(patient.emergencyContactNumber),
            emergencyContact2Name: text(patient.emergencyContact2Name),
            emergencyContact2Relationship: text(patient.emergencyContact2Relationship),
            emergencyContact2Number: text(patient.emergencyContact2Number),
            // Not shown and not written back for a secretary; the action
            // leaves whatever the doctor recorded exactly as it is.
            allergyStatus: "UNKNOWN",
            conditionStatus: "UNKNOWN",
            medicationStatus: "UNKNOWN",
            allergies: [],
            conditions: [],
            medications: [],
            alerts: [],
          }}
          submitLabel="Save changes"
          cancelHref={`/desk/patients/${patient.id}`}
        />
      </Card>
    </div>
  );
}
