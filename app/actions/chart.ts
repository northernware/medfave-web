"use server";

import { revalidatePath } from "next/cache";
import { requireDoctor } from "@/lib/auth";
import { editChart } from "@/lib/chart-edits";

export type ChartFormState = { message?: string; ok?: boolean };

/**
 * A change to the patient's chart from the note's side column (lib/chart-edits.ts).
 * The note pages and the patient page show it at once; the draft being written
 * is client state and stays as it was.
 */
export async function changeChart(_prev: ChartFormState, formData: FormData): Promise<ChartFormState> {
  const doctor = await requireDoctor();
  const result = await editChart(doctor, formData);
  if (!result.ok) return { message: result.message };
  revalidatePath("/records", "layout");
  revalidatePath(`/patients/${String(formData.get("patientId") ?? "")}`);
  return { ok: true };
}
