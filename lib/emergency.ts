import "server-only";
import { orm } from "@/src/prisma/db";
import type { PatientChart } from "@/lib/auth";
import { formatDateTime, instantFromDb, instantToDb } from "@/lib/datetime";
import { BLOOD_TYPE_LABELS } from "@/lib/domain";
import { listFamily } from "@/lib/family";

/*
 * The emergency card: what a medic needs, for the patient and each person they
 * look after — read-only, straight from what the clinics recorded.
 *
 * `clinics`: each clinic's record as it stands, with when it last changed.
 * `general`: those records side by side for the patient's own eyes — every
 * allergy from every clinic (leaving one out is the dangerous mistake), each
 * item saying where it came from, and disagreements shown rather than settled.
 * Combining happens only here, for somebody entitled to every part; no clinic
 * sees another's record.
 */

type Tagged<T> = T & { clinics: string[] };
export type Allergy = { label: string; reaction: string | null; severity: "MILD" | "MODERATE" | "SEVERE" | null };
export type Medication = { label: string; dosage: string | null; frequency: string | null };
export type Contact = { name: string; relationship: string | null; number: string | null };
type ListStatus = "RECORDED" | "NONE_KNOWN" | "UNKNOWN";

/**
 * Their regular doctor at a clinic: the one they chose, else the one who saw
 * them most in the past year (the more recent on a tie), else their
 * household's. A single visit to a specialist doesn't make them it.
 */
export type Physician = {
  doctorId: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  clinicName: string;
  /** The patient (or their caregiver) picked this doctor. */
  chosen: boolean;
  /** Visits with them in the past year. */
  visits: number;
  lastVisit: string;
};

export type ClinicRecord = {
  clinicId: string;
  clinicName: string;
  patientId: string;
  updatedAt: string;
  address: string | null;
  /** First and second, in that order; either may be missing. */
  contacts: Contact[];
  physician: Physician | null;
  doctorsSeen: { id: string; name: string; specialty: string | null }[];
  bloodType: string | null;
  allergyStatus: ListStatus;
  allergies: Allergy[];
  medicationStatus: ListStatus;
  medications: Medication[];
  conditionStatus: ListStatus;
  conditions: string[];
  emergencyContact: Contact | null;
  /** When they were last seen there, to pick the usual doctor across clinics. */
  lastSeenAt: string;
};

export type EmergencyCard = {
  key: string;
  name: string;
  dateOfBirth: string;
  self: boolean;
  clinics: ClinicRecord[];
  general: {
    bloodTypes: Tagged<{ value: string }>[];
    /** Clinics recorded different blood types: shown, never chosen between. */
    bloodTypeDisagrees: boolean;
    allergies: Tagged<Allergy>[];
    /** Every clinic that has said says none known, and none recorded any. */
    noKnownAllergies: boolean;
    medications: Tagged<Medication>[];
    conditions: Tagged<{ label: string }>[];
    contacts: Tagged<Contact>[];
    address: string | null;
    /** The usual doctor at the clinic seen most recently. */
    physician: Physician | null;
  };
};

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const RANK = { SEVERE: 3, MODERATE: 2, MILD: 1 } as const;

/** One person's records at each clinic, from charts this login may see. */
async function recordsFor(charts: PatientChart[]): Promise<ClinicRecord[]> {
  return Promise.all(
    charts.map(async (c) => {
      const [p, allergies, medications, conditions, seen] = await Promise.all([
        orm.Patient
          .select(
            "updatedAt", "bloodType", "allergyStatus", "medicationStatus", "conditionStatus",
            "emergencyContactName", "emergencyContactRelationship", "emergencyContactNumber",
            "emergencyContact2Name", "emergencyContact2Relationship", "emergencyContact2Number",
          )
          .include("household", (h) =>
            h.select("address").include("doctor", (d) => d.select("id", "fullName", "specialty")),
          )
          .include("clinic", (k) => k.select("contactNumber"))
          .include("primaryDoctor", (d) => d.select("id", "fullName", "specialty"))
          .where((x) => x.id.eq(c.id))
          .first(),
        orm.PatientAllergy.select("label", "reaction", "severity").where((x) => x.patientId.eq(c.id)).all(),
        orm.PatientMedication.select("label", "dosage", "frequency").where((x) => x.patientId.eq(c.id)).where((x) => x.stoppedAt.isNull()).all(),
        orm.PatientCondition.select("label").where((x) => x.patientId.eq(c.id)).where((x) => x.resolvedAt.isNull()).all(),
        // Who has seen them there: the year's visits, newest first.
        orm.Appointment
          .select("scheduledAt", "doctorId")
          .include("doctor", (d) => d.select("id", "fullName", "specialty"))
          .where((a) => a.patientId.eq(c.id))
          .where((a) => a.status.in(["COMPLETED", "IN_CONSULTATION", "CHECKED_IN"]))
          .where((a) => a.scheduledAt.gte(instantToDb(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000))))
          .orderBy((a) => a.scheduledAt.desc())
          .all(),
      ]);
      // Seen most this year, the more recent on a tie (the list is newest first).
      const tally = new Map<string, { doctor: { id: string; fullName: string; specialty: string | null }; visits: number; last: string }>();
      for (const v of seen) {
        const t = tally.get(v.doctor.id);
        if (t) t.visits++;
        else tally.set(v.doctor.id, { doctor: v.doctor, visits: 1, last: String(v.scheduledAt) });
      }
      const regular = [...tally.values()].sort((a, b) => b.visits - a.visits || b.last.localeCompare(a.last))[0];
      const picked = p?.primaryDoctor ?? null;
      const doc = picked ?? regular?.doctor ?? p?.household.doctor ?? null;
      const contact = (name: string | null | undefined, relationship: string | null | undefined, number: string | null | undefined) =>
        name ? { name, relationship: relationship ?? null, number: number ?? null } : null;
      return {
        clinicId: c.clinicId,
        clinicName: c.clinicName,
        patientId: c.id,
        updatedAt: p ? formatDateTime(instantFromDb(p.updatedAt)) : "",
        bloodType: p && p.bloodType !== "UNKNOWN" ? BLOOD_TYPE_LABELS[p.bloodType] : null,
        allergyStatus: (p?.allergyStatus ?? "UNKNOWN") as ListStatus,
        allergies: allergies.map((a) => ({ label: a.label, reaction: a.reaction, severity: a.severity })),
        medicationStatus: (p?.medicationStatus ?? "UNKNOWN") as ListStatus,
        medications: medications.map((m) => ({ label: m.label, dosage: m.dosage, frequency: m.frequency })),
        conditionStatus: (p?.conditionStatus ?? "UNKNOWN") as ListStatus,
        conditions: conditions.map((x) => x.label),
        emergencyContact: contact(p?.emergencyContactName, p?.emergencyContactRelationship, p?.emergencyContactNumber),
        address: p?.household.address ?? null,
        contacts: [
          contact(p?.emergencyContactName, p?.emergencyContactRelationship, p?.emergencyContactNumber),
          contact(p?.emergencyContact2Name, p?.emergencyContact2Relationship, p?.emergencyContact2Number),
        ].filter((x): x is Contact => x !== null),
        physician: doc
          ? {
              doctorId: doc.id,
              name: doc.fullName,
              specialty: doc.specialty,
              phone: p?.clinic.contactNumber ?? null,
              clinicName: c.clinicName,
              chosen: Boolean(picked),
              visits: tally.get(doc.id)?.visits ?? 0,
              lastVisit: tally.get(doc.id)?.last ?? "",
            }
          : null,
        doctorsSeen: [...tally.values()].map((t) => ({ id: t.doctor.id, name: t.doctor.fullName, specialty: t.doctor.specialty })),
        lastSeenAt: seen[0] ? String(seen[0].scheduledAt) : "",
      };
    }),
  );
}

/** Same item from several clinics, once, saying which clinics. */
function merge<T>(records: ClinicRecord[], pick: (r: ClinicRecord) => T[], id: (t: T) => string, better?: (a: T, b: T) => T) {
  const out = new Map<string, Tagged<T>>();
  for (const r of records) {
    for (const item of pick(r)) {
      const k = key(id(item));
      const seen = out.get(k);
      if (!seen) out.set(k, { ...item, clinics: [r.clinicName] });
      else {
        const kept = better ? better(seen, item) : seen;
        out.set(k, { ...kept, clinics: [...new Set([...seen.clinics, r.clinicName])] });
      }
    }
  }
  return [...out.values()];
}

function combine(records: ClinicRecord[]): EmergencyCard["general"] {
  const bloodTypes = merge(records, (r) => (r.bloodType ? [{ value: r.bloodType }] : []), (b) => b.value);
  return {
    bloodTypes,
    bloodTypeDisagrees: bloodTypes.length > 1,
    // The worst severity any clinic recorded, and every reaction noted.
    allergies: merge(records, (r) => r.allergies, (a) => a.label, (a, b) =>
      (RANK[b.severity ?? "MILD"] ?? 0) > (RANK[a.severity ?? "MILD"] ?? 0) || (!a.severity && b.severity) ? { ...a, severity: b.severity, reaction: b.reaction ?? a.reaction } : a,
    ).sort((a, b) => (RANK[b.severity ?? "MILD"] ?? 0) - (RANK[a.severity ?? "MILD"] ?? 0)),
    noKnownAllergies:
      records.some((r) => r.allergyStatus === "NONE_KNOWN") && records.every((r) => r.allergies.length === 0),
    medications: merge(records, (r) => r.medications, (m) => `${m.label} ${m.dosage ?? ""}`),
    conditions: merge(records, (r) => r.conditions.map((label) => ({ label })), (c) => c.label),
    contacts: merge(records, (r) => r.contacts, (c) => `${c.name} ${c.number ?? ""}`),
    address: records.find((r) => r.address)?.address ?? null,
    // Their choice wins; otherwise whoever, at any clinic, saw them most this year.
    physician:
      records.find((r) => r.physician?.chosen)?.physician ??
      records
        .map((r) => r.physician)
        .filter((x): x is Physician => x !== null)
        .sort((a, b) => b.visits - a.visits || b.lastVisit.localeCompare(a.lastVisit))[0] ??
      null,
  };
}

/**
 * Cards for this login: its own (from every clinic it is a patient of), then
 * each person it looks after, grouped as its family list groups them.
 */
export async function emergencyCards(viewer: { accountId: string; fullName: string; charts: PatientChart[] }): Promise<EmergencyCard[]> {
  const cards: EmergencyCard[] = [];
  const own = viewer.charts.filter((c) => c.self);
  if (own.length) {
    const records = await recordsFor(own);
    const dob = await orm.Patient.select("dateOfBirth").where((p) => p.id.eq(own[0].id)).first();
    cards.push({ key: "me", name: viewer.fullName, dateOfBirth: String(dob?.dateOfBirth ?? "").slice(0, 10), self: true, clinics: records, general: combine(records) });
  }
  const cared = viewer.charts.filter((c) => !c.self);
  if (cared.length) {
    const family = await listFamily(viewer.accountId);
    const used = new Set<string>();
    for (const m of family) {
      const charts = cared.filter((c) => m.links.some((l) => l.patientId === c.id));
      if (!charts.length) continue;
      charts.forEach((c) => used.add(c.id));
      const records = await recordsFor(charts);
      cards.push({ key: m.id, name: `${m.firstName} ${m.lastName}`, dateOfBirth: m.dateOfBirth, self: false, clinics: records, general: combine(records) });
    }
    for (const c of cared.filter((x) => !used.has(x.id))) {
      const records = await recordsFor([c]);
      const dob = await orm.Patient.select("dateOfBirth").where((p) => p.id.eq(c.id)).first();
      cards.push({ key: c.id, name: c.name, dateOfBirth: String(dob?.dateOfBirth ?? "").slice(0, 10), self: false, clinics: records, general: combine(records) });
    }
  }
  return cards;
}

/**
 * The patient (or their caregiver) choosing the primary care physician on a
 * card: a doctor at one of that person's clinics. Set on that clinic's chart,
 * cleared on their others, so a card has one. `doctorId` null: back to the
 * card working it out.
 */
export async function choosePhysician(
  viewer: { accountId: string; fullName: string; charts: PatientChart[] },
  cardKey: string,
  doctorId: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const card = (await emergencyCards(viewer)).find((c) => c.key === cardKey);
  if (!card) return { ok: false, message: "Not found." };
  const at = doctorId ? card.clinics.find((r) => r.doctorsSeen.some((d) => d.id === doctorId)) : null;
  if (doctorId && !at) return { ok: false, message: "Choose a doctor who has seen them." };
  for (const r of card.clinics) {
    await orm.Patient.where((p) => p.id.eq(r.patientId)).update({
      primaryDoctorId: at && r.patientId === at.patientId ? doctorId : null,
    } as never);
  }
  return { ok: true };
}
