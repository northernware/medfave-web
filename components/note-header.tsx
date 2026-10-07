import type { ReactNode } from "react";
import { fullName } from "@/lib/domain";
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
 * The top of a note being written, new or continued: the same title style,
 * so the two read as the same page. Who the patient is lives on the clipboard
 * beside the form, which stays in view; `status` says where the note stands
 * ("Draft · last saved …").
 */
export function NoteHeader({ title, patient, status }: { title: string; patient: NotePatient; status?: ReactNode }) {
  return (
    <>
      <BackTo href={`/patients/${patient.id}`} label={fullName(patient)} />
      <PageHeader title={title} subtitle={status ? <span className="text-ink-muted">{status}</span> : undefined} />
    </>
  );
}
