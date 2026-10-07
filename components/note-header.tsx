import type { ReactNode } from "react";
import Link from "next/link";
import { calendarDateFromDb } from "@/lib/datetime";
import { ageFrom, fullName, SEX_LABELS } from "@/lib/domain";
import type { Sex } from "@/lib/enums";
import { PageHeader } from "@/components/ui";
import { BackTo } from "@/components/crumb-names";

type NotePatient = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  sex: Sex;
  dateOfBirth: string;
  household: { name: string };
};

/**
 * The top of a note being written, new or continued: the same title style and
 * patient line, so the two read as the same page. `status` says where the note
 * stands ("Draft · last saved …").
 */
export function NoteHeader({ title, patient, status }: { title: string; patient: NotePatient; status?: ReactNode }) {
  return (
    <>
    <BackTo href={`/patients/${patient.id}`} label={fullName(patient)} />
    <PageHeader
      title={title}
      subtitle={
        <>
          <Link href={`/patients/${patient.id}`} className="text-accent-ink hover:underline">
            {fullName(patient)}
          </Link>
          {" · "}
          {SEX_LABELS[patient.sex]} · {ageFrom(calendarDateFromDb(patient.dateOfBirth))} · {patient.household.name} household
          {status ? <span className="mt-0.5 block text-ink-muted">{status}</span> : null}
        </>
      }
    />
    </>
  );
}
