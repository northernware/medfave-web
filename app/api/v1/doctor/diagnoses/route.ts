import { apiDoctor } from "@/lib/api";
import { ICD11_CREDIT, searchIcd11 } from "@/lib/diagnoses";

/**
 * ICD-11 codes for a diagnosis search: `?q=` a code ("CA23") or words
 * ("asthma"), at least two characters. → `{ results: [{ system, code, title,
 * uri, leaf }], credit }`. Show `credit` with the list (WHO's licence).
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return Response.json({ results: await searchIcd11(q), credit: ICD11_CREDIT });
}
