import { AddDisclosure } from "./add-disclosure";
import { ChartForm } from "./chart-form";
import { buttonClass } from "./ui";

/*
 * The chart's history, filled in on the web as in the app's clipboard: lists
 * (past medical, family, vaccine doses) get an Add form; whole sections
 * (personal and social, OB, birth and development) an Edit form filled with
 * what's there. Each posts one chart action (lib/chart-edits.ts).
 */

const field = "w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink";
const save = buttonClass("primary", "justify-self-start");

/** The DOH routine childhood schedule, as the app lists it (same codes). */
export const VACCINES = [
  { code: "BCG", name: "BCG" },
  { code: "HEPB", name: "Hepatitis B (birth)" },
  { code: "PENTA", name: "Pentavalent (DPT-HepB-Hib)" },
  { code: "OPV", name: "Oral polio (OPV)" },
  { code: "IPV", name: "Inactivated polio (IPV)" },
  { code: "PCV", name: "Pneumococcal (PCV)" },
  { code: "MMR", name: "Measles, mumps, rubella (MMR)" },
];

function Choice({ name, label, options, value }: { name: string; label: string; options: [string, string][]; value: string | null }) {
  return (
    <select name={name} defaultValue={value ?? ""} className={field} aria-label={label}>
      <option value="">{label}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function AddPast({ patientId }: { patientId: string }) {
  return (
    <AddDisclosure label="Add to past history" summaryClassName="text-accent-ink">
      <ChartForm patientId={patientId} action="past.add" className="grid gap-1.5">
        <div className="flex gap-1.5">
          <Choice name="kind" label="Kind" value="ILLNESS" options={[["ILLNESS", "Illness"], ["SURGERY", "Surgery"], ["HOSPITALIZATION", "Hospitalization"]]} />
          <input name="year" placeholder="When (2015, childhood)" className={field} />
        </div>
        <input name="label" required placeholder="What (e.g. Appendectomy, Dengue)" className={field} />
        <button className={save}>Save</button>
      </ChartForm>
    </AddDisclosure>
  );
}

export function AddFamily({ patientId }: { patientId: string }) {
  return (
    <AddDisclosure label="Add family history" summaryClassName="text-accent-ink">
      <ChartForm patientId={patientId} action="family.add" className="grid gap-1.5">
        <input name="label" required placeholder="Condition (e.g. Diabetes)" className={field} />
        <input name="relative" required placeholder="Who (e.g. Mother, both parents)" className={field} />
        <button className={save}>Save</button>
      </ChartForm>
    </AddDisclosure>
  );
}

export function EditSocial({
  patientId,
  smoking,
  packYears,
  alcohol,
  occupation,
  notes,
}: {
  patientId: string;
  smoking: string | null;
  packYears: string | null;
  alcohol: string | null;
  occupation: string | null;
  notes: string | null;
}) {
  return (
    <AddDisclosure label="Edit personal and social" summaryClassName="text-accent-ink">
      <ChartForm patientId={patientId} action="social.set" className="grid gap-1.5">
        <div className="flex gap-1.5">
          <Choice name="smoking" label="Smoking" value={smoking} options={[["NEVER", "Never smoked"], ["FORMER", "Former smoker"], ["CURRENT", "Smokes"]]} />
          <input name="packYears" defaultValue={packYears ?? ""} placeholder="Pack-years" className={field} />
        </div>
        <Choice name="alcohol" label="Alcohol" value={alcohol} options={[["NONE", "No alcohol"], ["OCCASIONAL", "Occasional"], ["REGULAR", "Regular"]]} />
        <input name="occupation" defaultValue={occupation ?? ""} placeholder="Occupation" className={field} />
        <textarea name="notes" defaultValue={notes ?? ""} placeholder="Notes (diet, exercise, who they live with)" rows={2} className={field} />
        <button className={save}>Save</button>
      </ChartForm>
    </AddDisclosure>
  );
}

export function EditOb({
  patientId,
  ob,
}: {
  patientId: string;
  ob: {
    gravida: string | null;
    para: string | null;
    term: string | null;
    preterm: string | null;
    abortions: string | null;
    living: string | null;
    menarche: string | null;
    cycle: string | null;
    lastMenstrualPeriod: string | null;
    notes: string | null;
  };
}) {
  const n = (name: keyof typeof ob, label: string) => (
    <label className="grid gap-0.5 text-xs text-ink-muted">
      {label}
      <input name={name} defaultValue={ob[name] ?? ""} inputMode="numeric" className={field} />
    </label>
  );
  return (
    <AddDisclosure label="Edit OB history" summaryClassName="text-accent-ink">
      <ChartForm patientId={patientId} action="ob.set" className="grid gap-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          {n("gravida", "G (pregnancies)")}
          {n("para", "P (births)")}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {n("term", "Term")}
          {n("preterm", "Preterm")}
          {n("abortions", "Abortions")}
          {n("living", "Living")}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {n("menarche", "Age at first period")}
          <label className="grid gap-0.5 text-xs text-ink-muted">
            Last menstrual period
            <input type="date" name="lastMenstrualPeriod" defaultValue={ob.lastMenstrualPeriod ?? ""} className={field} />
          </label>
        </div>
        <input name="cycle" defaultValue={ob.cycle ?? ""} placeholder="Cycle (e.g. regular, 28 days)" className={field} />
        <textarea name="notes" defaultValue={ob.notes ?? ""} placeholder="Notes" rows={2} className={field} />
        <button className={save}>Save</button>
      </ChartForm>
    </AddDisclosure>
  );
}

export function EditChild({
  patientId,
  child,
}: {
  patientId: string;
  child: {
    birthTerm: string | null;
    birthWeight: string | null;
    birthDelivery: string | null;
    birthNotes: string | null;
    development: string | null;
    developmentNotes: string | null;
  };
}) {
  return (
    <AddDisclosure label="Edit birth and development" summaryClassName="text-accent-ink">
      <ChartForm patientId={patientId} action="child.set" className="grid gap-1.5">
        <div className="flex gap-1.5">
          <Choice name="birthTerm" label="Born" value={child.birthTerm} options={[["TERM", "Term"], ["PRETERM", "Preterm"], ["POSTTERM", "Post-term"]]} />
          <input name="birthWeight" defaultValue={child.birthWeight ?? ""} placeholder="Birth weight (3.1 kg)" className={field} />
        </div>
        <Choice name="birthDelivery" label="Delivery" value={child.birthDelivery} options={[["NSD", "Normal (NSD)"], ["CS", "Caesarean"], ["ASSISTED", "Assisted"]]} />
        <input name="birthNotes" defaultValue={child.birthNotes ?? ""} placeholder="Birth notes (complications, NICU)" className={field} />
        <Choice name="development" label="Development" value={child.development} options={[["ON_TRACK", "On track"], ["DELAYED", "Delayed"]]} />
        <textarea name="developmentNotes" defaultValue={child.developmentNotes ?? ""} placeholder="Milestones (sat 6 mo, walked 12 mo…)" rows={2} className={field} />
        <button className={save}>Save</button>
      </ChartForm>
    </AddDisclosure>
  );
}

export function AddDose({ patientId }: { patientId: string }) {
  return (
    <AddDisclosure label="Record a dose" summaryClassName="text-accent-ink">
      <ChartForm patientId={patientId} action="immunization.add" className="grid gap-1.5">
        <select name="label" required defaultValue="" className={field} aria-label="Vaccine">
          <option value="" disabled>
            Vaccine
          </option>
          {VACCINES.map((v) => (
            <option key={v.code} value={v.code}>
              {v.name}
            </option>
          ))}
        </select>
        <div className="flex gap-1.5">
          <input name="dose" placeholder="Dose (1, 2, booster)" className={field} />
          <input type="date" name="givenOn" className={field} aria-label="Given on" />
        </div>
        <button className={save}>Save</button>
      </ChartForm>
    </AddDisclosure>
  );
}
