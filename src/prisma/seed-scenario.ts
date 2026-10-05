import "dotenv/config";
import { orm } from "./db";
import { instantToDb } from "../../lib/datetime";

/*
 * Test scenarios that need a visit at a particular moment, for showing and
 * checking the apps. Each removes its own rows (ids starting "scenario-") and
 * makes them again, timed from now. Never run against real data.
 *
 *   npm run db:scenario -- late     Ramon's visit 2 minutes ago, not checked in:
 *                                   "Held until …" and "Call the clinic" in the
 *                                   patient app (patient@medfave.com) for 13
 *                                   minutes, then a no-show. It leads his Home
 *                                   unless an earlier visit today is still on.
 */

const SCENARIOS = ["late"] as const;
type Scenario = (typeof SCENARIOS)[number];

async function late() {
  const account = await orm.Account.select("id").where((a) => a.email.eq("patient@medfave.com")).first();
  const ramon = account ? await orm.Patient.select("id", "clinicId").where((p) => p.accountId.eq(account.id)).first() : null;
  if (!ramon) throw new Error("No patient@medfave.com chart: run npm run db:seed first.");
  const doctor = await orm.Doctor.select("id", "accountId").where((d) => d.clinicId.eq(ramon.clinicId)).where((d) => d.fullName.eq("Dr. Ana Reyes")).first();
  if (!doctor) throw new Error("No Dr. Ana Reyes at the demo clinic.");

  await orm.Appointment.where((a) => a.id.eq("scenario-late")).deleteAndCount();
  const now = instantToDb(new Date());
  const at = new Date(Math.floor(Date.now() / 60_000) * 60_000 - 2 * 60_000);
  await orm.Appointment.create({
    id: "scenario-late",
    clinicId: ramon.clinicId,
    patientId: ramon.id,
    doctorId: doctor.id,
    bookedById: doctor.accountId,
    scheduledAt: instantToDb(at),
    durationMinutes: 30,
    service: "GENERAL_CONSULTATION",
    reason: "Running late test",
    status: "CONFIRMED",
    source: "STAFF",
    createdAt: now,
    updatedAt: now,
  } as Parameters<typeof orm.Appointment.create>[0]);
  const until = new Date(at.getTime() + 15 * 60_000).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
  console.log(`Ramon's visit was 2 minutes ago, held until ${until} (Manila). Sign in as patient@medfave.com.`);
}

async function main() {
  const name = process.argv[2] as Scenario | undefined;
  if (!name || !SCENARIOS.includes(name)) throw new Error(`Pick a scenario: ${SCENARIOS.join(", ")}`);
  if (name === "late") await late();
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
