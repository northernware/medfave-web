import "server-only";
import { orm } from "@/src/prisma/db";
import { addDays } from "./scheduling";
import { ranRecently } from "./throttle";
import {
  dayKey,
  formatDateTime,
  instantFromDb,
  instantToDb,
  startOfClinicDay,
} from "./datetime";
import { ACTIVE_STATUSES, fullName } from "./domain";
import { appUrl, sendAppointmentReminder } from "./email";

/**
 * Sends the day-before reminder to everybody who asked for one.
 *
 * Three things have to be true and all three are checked here rather than
 * assumed: the visit is tomorrow, it is still going to happen, and the patient
 * asked to be reminded by email. A reminder for a cancelled visit is worse
 * than no reminder, and mailing somebody who chose not to hear from the clinic
 * is not a reminder, it is unsolicited post.
 *
 * `reminderSentAt` is what stops a second copy. It is stamped whether or not
 * the send succeeded: a provider that refused once will refuse again, and
 * retrying on every page load would turn one failure into a hundred. The
 * failure is logged for somebody to look at instead.
 *
 * There is no scheduler in this application, so this runs when the clinic's
 * own screens are read, exactly as the no-show sweep does. That is enough for
 * a clinic that is opened daily; `/api/cron/reminders` exists for when it is
 * not.
 */
export async function sendDueReminders(clinicId: string, now = new Date()) {
  // Screens call this on every read; once a minute per clinic is plenty. A
  // skipped run loses nothing: the run a moment ago sent what was due.
  if (ranRecently(`reminders:${clinicId}`)) return { considered: 0, sent: 0, skipped: 0, failed: 0 };
  const tomorrow = addDays(dayKey(now), 1);
  const from = instantToDb(startOfClinicDay(tomorrow));
  const to = instantToDb(startOfClinicDay(addDays(tomorrow, 1)));

  const due = await orm.Appointment
    .select("id", "scheduledAt")
    .include("patient", (p) => p.select("firstName", "middleName", "lastName", "email"))
    .include("doctor", (d) => d.select("fullName"))
    .include("clinic", (c) => c.select("name"))
    .where((a) => a.clinicId.eq(clinicId))
    .where((a) => a.scheduledAt.gte(from))
    .where((a) => a.scheduledAt.lt(to))
    .where((a) => a.status.in(ACTIVE_STATUSES))
    .where((a) => a.reminderPreference.eq("EMAIL"))
    .where((a) => a.reminderSentAt.isNull())
    .all();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const appointment of due) {
    if (!appointment.patient.email) {
      // Nothing to send to. Left unstamped, so it goes out if an address is
      // added before the day arrives.
      skipped++;
      continue;
    }

    const outcome = await sendAppointmentReminder({
      to: appointment.patient.email,
      patientName: appointment.patient.firstName,
      clinicName: appointment.clinic.name,
      doctorName: appointment.doctor.fullName,
      when: formatDateTime(instantFromDb(appointment.scheduledAt)),
      link: appUrl("/portal"),
    });

    if (outcome.sent) sent++;
    else {
      failed++;
      console.error(
        `[reminders] ${fullName(appointment.patient)} (${appointment.id}): ${outcome.reason}`,
      );
    }

    // Stamped either way — see above.
    await orm.Appointment
      .where((a) => a.id.eq(appointment.id))
      .update({ reminderSentAt: instantToDb(new Date()) });
  }

  return { considered: due.length, sent, skipped, failed };
}
