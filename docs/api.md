# Mobile API (v1)

The JSON API the Medfave mobile app talks to, under `/api/v1`. It applies the
same rules as the web pages; where a page would redirect, the API answers with
a status code instead.

## Authentication

Sign in (or activate) to get a token, keep it on the device, and send it on
every request:

```
Authorization: Bearer <token>
```

- A token lasts **30 days**. Changing the account's password ends every token
  issued before the change.
- Roles are read from the database on every request, never from the token, so
  a revoked role stops working at once.
- App tokens work only as bearer tokens, and web session cookies work only as
  cookies.
- Signing out is the app deleting its token.

## Cross-origin

`/api/v1` answers any origin (CORS `*`). That's safe because it is
authenticated by the bearer token, never by cookies. It lets the app's web
build call it; the native apps don't use CORS. Web pages don't send these
headers.

## Errors

Every error is JSON:

```json
{ "error": "Check the details of your request.", "fieldErrors": { "preferredDate": ["Choose a date"] } }
```

`fieldErrors` is present when specific inputs were wrong, keyed by field name.

| Status | Meaning |
| --- | --- |
| 400 | The body was not JSON |
| 401 | No token, an expired or invalid token, or wrong email or password |
| 403 | Signed in, but this endpoint is for another kind of account |
| 404 | Not found, or not yours — deliberately the same answer |
| 422 | The input broke a rule; see `fieldErrors` |
| 429 | Too many attempts (sign-in, sign-up, codes, emails); wait a few minutes |

## Endpoints

Times are ISO 8601 instants in UTC (`2026-09-29T03:20:00.000Z`). Calendar dates
are `YYYY-MM-DD` and times of day `HH:MM`, both in clinic time (Asia/Manila).

### Sign-in

| | |
| --- | --- |
| `POST /auth/signup` | `{ firstName, middleName?, lastName, email, password, confirmPassword, role: "PATIENT" \| "DOCTOR", consent: true }` → `201 { token, expiresAt, viewer }`. The name is joined into `fullName` and tidied (all-lower or ALL-CAPS typing is title-cased; mixed case kept); `fullName` alone is still accepted. Open sign-up: the account is signed in at once, unverified, and linked to nothing (`role: "none"`) |
| `POST /auth/resend-verification` | → `{ sent }`. A new verification link to the signed-in account's email |
| `POST /auth/login` | `{ email, password }` → `{ token, expiresAt, viewer }` |
| `POST /activation/preview` | `{ code }` → `{ preview: { patientId, code, name, born, clinicName, emailOnFile, emailDiffers, forCaregiver } }`. Whose record a code opens, without spending it: show it ("Is this you?") before activating or adding a clinic, and send `patientId` back as `confirmedPatientId`. Signed in or not; signed in, `emailDiffers` compares the clinic's email with the login's (`emailOnFile` is masked). `forCaregiver`: the desk issued it to a parent or guardian, so it lets the login look after this person rather than be them. |
| `POST /auth/activate` | `{ code, confirmedPatientId, firstName, middleName?, lastName, email, password, confirmPassword }` → `201 { token, expiresAt, viewer }`. Turns the activation code the clinic gave a patient into their login (or, for a caregiver code, a login that looks after them). `confirmedPatientId` is from the preview; `422` if the code now opens a different chart. Optional for older app builds. |
| `GET /auth/providers` | → `{ google }`. Whether "Continue with Google" is set up on this server; show the button only when `true` |
| `POST /auth/google/exchange` | `{ code, verifier }` → `{ token, expiresAt, viewer }`. The end of a Google sign-in; see below |
| `GET /me` | `{ viewer }` |
| `POST /practice` | `{ licenseName, licenseNumber, specialty?, clinicName, address, contactNumber }` → `201 { viewer }`. A signed-up doctor creates their clinic; it opens once a Medfave admin verifies the license (`viewer.verification`). Email must be confirmed first (422 otherwise). `licenseNumber` is 7 digits |
| `POST /practice/resubmit` | `{ licenseName, licenseNumber, specialty? }` → `{ viewer }`. A declined doctor sends corrected details again |

**Continue with Google.** The server does the OAuth; the app opens it in a
browser session (`WebBrowser.openAuthSessionAsync`) and never sees Google's
tokens.

1. Make a random `verifier` (43+ characters, base64url) and its
   `challenge = base64url(sha256(verifier))`.
2. Open `GET /auth/google?app=<return link>&challenge=<challenge>` (a page,
   not under `/api/v1`), adding `&as=doctor` when the person chose doctor. The
   return link must use the `medfave://` scheme; in development `exp://` and
   `http://localhost` are allowed too.
3. The person picks a Google account. Somebody new also chooses patient or
   doctor and agrees to the privacy notice on a Medfave page in that same
   browser session.
4. The browser comes back to the return link with `?code=…` (good for two
   minutes), or `?error=cancelled | unverified | failed | unavailable`.
5. `POST /auth/google/exchange` with the `code` and the `verifier`.

A Google account whose verified email matches an existing account signs in to
that account; there is never a second account for one email.

`viewer` is `{ id, email, fullName, role, clinic, charts, emailVerified, signupRole, patientId, doctorId }`:

- `role` is `"doctor"`, `"patient"`, `"staff"` or `"none"`. A doctor or staff
  member of a clinic that isn't verified yet is `"none"`. Work comes first:
  a doctor who is also somebody's patient elsewhere is `"doctor"`. The app
  opens the patient or doctor side from `role`.
- `charts` is `[{ patientId, clinic: { id, name } }]`, one per clinic this
  login is linked to. One login can be a patient at several clinics.
- `emailVerified` is whether they've followed the emailed link.
- `signupRole` is `"PATIENT"`, `"DOCTOR"` or `null` (accounts from before open
  sign-up): what they said they were. It picks the welcome for an account with
  `role: "none"`, and grants nothing.
- `patientId` is the first chart's id, kept for older app builds. Use `charts`.
- `verification` is a doctor's license check, `{ status: "PENDING" | "VERIFIED"
  | "DECLINED", declineReason }`, or `null` for anyone with no clinician
  profile. Until it is `VERIFIED` the doctor's `role` is `"none"` and their
  clinic is closed: doctor endpoints answer 403. The practice is set up, and
  a decline fixed, on the web (`/welcome`, then `/manage`).

### Patient

Everything is scoped to **one chart at one clinic**: the login's own, or one
it looks after for somebody else (a child, a parent in their care) through a
caregiver code the desk issued. Nobody else in the household shows, and a
clinic's records are never mixed with another's. Other accounts get `403`.

**Choosing the clinic:** pass `?clinic=<clinicId>` or an `X-Clinic-Id`
header on any patient endpoint. Left out, it uses the login's own chart, else
the first of `viewer.charts`. A clinic the login isn't linked to gets `404`.

**Choosing the person:** pass `?patient=<patientId>` or an `X-Patient-Id`
header, one of `viewer.charts` (each has `self: true` for the login's own,
`false` for somebody looked after, and the patient's `name`). Left out, it
uses the login's own chart at the clinic. Any other chart gets `404`.

| | |
| --- | --- |
| `GET /patient/emergency` | `{ cards: [{ key, name, dateOfBirth, self, general, clinics[] }] }` — the emergency card for this login and each person it looks after, read-only from the clinics' records. `clinics[]`: each clinic's own (`bloodType`, `allergies[]`, `medications[]`, `conditions[]`, `emergencyContact`, the three list statuses, `updatedAt`). `general`: all of them side by side, each item with `clinics[]`; every allergy from every clinic, the worst severity kept; `bloodTypeDisagrees` when clinics differ |
| `POST /patient/emergency/physician` | `{ cardKey, doctorId \| null }` → `204`. Choose the primary care physician on an emergency card: one of a clinic record's `doctorsSeen`, or null for the default (seen most in the past year, the more recent on a tie, else the household's doctor). Each record's `physician` has `chosen`, `visits`, `lastVisit` |
| `GET /patient/carers` | `{ carers: [{ id, name, email, since }], canManage }` — who can see this patient's **own** records here. `canManage` is false under 18 (the desk manages a child's). `404` when viewing somebody looked after |
| `POST /patient/carers` | `{ email }` → `201` (same shape). "Let someone look after me": an adult adds a Medfave login by its email. `422` when no account uses it |
| `DELETE /patient/carers/:id` | `204`. An adult removes somebody's access |
| `DELETE /patient/care` | `204`. A caregiver stops looking after the person chosen with `?patient=` |
| `GET /patient/clinics` | `{ clinics: [{ id, name, patientId, self, personName }] }`: one row per chart this login may act on; a clinic shows twice when the login has its own chart there and looks after somebody else's |
| `POST /patient/clinics` | `{ code, confirmedPatientId }` → `201 { clinic: { id, name }, patientId }`. **Add a clinic:** redeems an activation code (after `POST /activation/preview`) and links that chart to this login: as its own, or, for a caregiver code, as somebody it looks after. Open to any signed-in account. `422` for an invalid code, a clinic already linked (own codes only) or a code that now opens a different chart |
| `GET /patient/appointments` | `{ upcoming[], past[], cancelHours }`. `upcoming`: visits still ahead, plus today's that aren't over yet (pending, confirmed, checked in or in consultation), even past their start time; `past`: the rest. Each `{ id, scheduledAt, durationMinutes, service, serviceLabel, reason, status, statusLabel, visitType, doctor, doctorId }`; upcoming ones also `{ queue, canCancel, cancelBy, canMove, movePending, confirmedAt, canConfirm }` (`confirmedAt`: when the patient said "I'll be there", or null; `canConfirm`: not yet said, pending or confirmed, from the start of the day before the visit until its time); completed past ones also `{ feedback: { score, tags[], note } \; `queue`: for a checked-in visit, `{ ahead, doctorBusy }` (how many arrived earlier and are still waiting; whether the doctor is with someone), else null | null, canRate, doctorFaved }` (this login's rating; `canRate` for 14 days after the visit) |
| `POST /patient/appointments/:id/cancel` | Cancels the patient's own visit, up to the clinic's cut-off (`cancelHours` before it) → `{ id, status: "CANCELLED" }`; `409` with what to do instead when it's too late |
| `POST /patient/appointments/:id/confirm` | "I'll be there" → `{ id, confirmedAt }`. Not the `CONFIRMED` status, which is the clinic accepting the booking. Only while `canConfirm`; sending it again returns the first `confirmedAt`; `409` otherwise. The clinic sees it on the desk and the doctor's day; a new time from the clinic clears it |
| `GET /patient/after-visit` | `{ visit: { id, scheduledAt, serviceLabel, doctor: { id, fullName }, faved } \| null }`: the latest completed visit of this person in the last 14 days that this login hasn't given feedback on or closed, for the "How was your visit?" card |
| `POST /patient/appointments/:id/feedback` | `{ score?: 1–5, tags?: string[], note? }` → `{ id, saved: true }`. Only the clinic sees it. `tags`: `LISTENED`, `EXPLAINED`, `ON_TIME`, `FRIENDLY`, `CLEAN`, `LONG_WAIT`, `RUSHED`, `UNCLEAR`, `UNFRIENDLY`, `COST`. Without `score`, records the sheet as closed. Completed visits only (`409` otherwise); sending again replaces it |
| `GET /patient/requests` | `{ requests[] }`, each `{ id, preferredDate, preferredTime, service, serviceLabel, reason, status, decisionNote, createdAt, rescheduleOf, rescheduleFrom, doctor: { id, fullName } }`; `rescheduleOf` / `rescheduleFrom`: for a move, the visit and its current time |
| `POST /patient/requests` | `{ service, preferredDate, preferredTime?, reason, doctorId?, rescheduleOf? }` (`rescheduleOf`: an upcoming visit's id, to ask to move it; same doctor, and the old time is freed when accepted) → `201 { id, status: "PENDING" }`. Patients ask for a **doctor**: `doctorId` is one of `/patient/clinic`'s `doctors`. Left out: the doctor they saw last, or the only one; with several and no history, `422` asks to choose. Checked against that doctor's hours |
| `DELETE /patient/requests/:id` | Withdraws a request that is still pending → `{ id, status: "WITHDRAWN" }` |
| `GET /patient/documents` | `{ documents[] }`, each `{ id, type, typeLabel, purpose, sharedAt }` |
| `GET /patient/documents/:id` | `{ document }`, with `fields[]` of `{ name, label, value }` in the clinic's order |
| `GET /patient/clinic?doctor=` | `{ clinic, doctors[], doctorId, takingRequests, services[], schedule }` — what the request form needs. `doctors` are the clinic's bookable doctors `{ id, fullName, specialty }`; `doctorId` is whose hours and services follow: `?doctor=` if given, else the patient's last doctor, else the only one (`null`: ask them to choose). `schedule` has the week's hours, closures ahead, and `earliestDay` / `latestDay` |
| `GET /patient/clinic/openings?doctor=&service=&services=&date=&limit=&perDay=` | `{ doctorId, service, services, minutes, openings: [{ date, time }] }`: start times that are really free for that doctor and service: inside the hours and booking window, clear of breaks, closures, booked visits and times other patients have already asked for. Times only, never whose. `doctor` as for `/patient/clinic`; `service` defaults to `GENERAL_CONSULTATION`; `services=A,B,C` (instead) is several people seen back to back, one each in order: `minutes` is their total and only starts where the whole run fits are listed (`400` for an unknown one). Without `date`: the next `limit` (default 6, max 60), at most `perDay` a day (default 2, max 20), spread through it; `perDay=1&limit=14` lists the next 14 days with anything free (Home's day strip). With `date=YYYY-MM-DD`: every free time that day (the request form's chips); `400` for a malformed date |

A request is **not** a booking. It holds no slot, and the doctor or front desk
accepts or declines it. The app should say so. The server checks each request
against the clinic's hours, closures and booking window; `/patient/clinic` lets
the app warn before sending, and `/patient/clinic/openings` offers only times
nobody holds or has asked for.

### Doctor

For accounts that are a clinic's DOCTOR, with a clinician profile in that
clinic, which is the same gate as the web's clinical pages. Other accounts get
`403`. Everything is scoped to the doctor's clinic.

An appointment is always this shape:

```
{ id, scheduledAt, durationMinutes, service, serviceLabel, reason, status, statusLabel,
  source, arrivedAt, consultationStartedAt, patientConfirmedAt, patient: { id, fullName },
  nextStatuses: [{ status, label }] }
```

`patientConfirmedAt` is when the patient said "I'll be there" from the app,
or null. `nextStatuses` lists the only moves the status endpoint will accept from where
the visit is now.

| | |
| --- | --- |
| `GET /doctor/day?date=YYYY-MM-DD` | `{ date, isToday, appointments[], queue[], pendingRequests, leftovers[] }`. Today when `date` is left out. `leftovers` (today only, up to 20): visits from earlier days still checked in or in consultation, to complete or cancel. `queue` is who is here, only for today and only today's visits: those with the doctor first, then the checked-in in arrival order (longest wait first). Here each `patient` also carries `householdId`, so family waiting together can be seen together. Marks overdue no-shows and sends tomorrow's reminders first, as the dashboard does. |
| `GET /doctor/diagnoses?q=` | `{ results: [{ system: "ICD-11", code, title, uri, leaf }], credit }`: up to 20 ICD-11 codes for a code ("CA23") or words ("asthma"), best first; `q` of two characters or more. Show `credit` with the list (WHO's CC BY-ND 3.0 IGO licence) |
| `GET /doctor/feedback?view=all\|attention&page=` | `{ average, count, good, faves, mentions: [{ tag, label, n }], page, pages, total, items: [{ id, score, tags: [{ tag, label }], note, createdAt, appointment: { id, scheduledAt, serviceLabel }, patient: { id, fullName } }] }`: what patients said about this doctor's visits, as the web's `/feedback`. `good` counts scores of 4–5; `attention` lists 1–3 only; 25 per page, newest first |
| `GET /doctor/week?from=&days=` | `{ days: [{ date, count }] }`: visits still expected per day (7 by default, 31 at most) |
| `GET /doctor/clinic` | Same shape as `/patient/clinic`, for the signed-in doctor's own hours, plus `breaks`, `slotStepMinutes` and `today` |
| `GET /doctor/hours` | `{ mine, mineConfigured, clinic }`: this doctor's week (the standard week inside the clinic's when never set — `mineConfigured: false`) and the clinic's, each `[{ weekday, openMinute, closeMinute }]` (0 = Sunday). An empty `clinic` sets no limit |
| `PUT /doctor/hours` | `{ which: "mine" \| "clinic", days: [{ weekday, from: "HH:MM", to: "HH:MM" }] }` (open days only) → the same as GET. A doctor's days must sit inside the clinic's; `422` with `fieldErrors["day-<weekday>"]` otherwise |
| `GET /doctor/schedule` | `{ breaks: [{ id, weekday \| null, startMinute, endMinute, label }], closures: [{ id, startsOn, endsOn, startMinute?, endMinute?, reason }] (not yet over), observeHolidays, holidays: [{ date, name, kind: "regular" \| "special" }] (next 12 months), lengths: [{ service, label, defaultMinutes, minutes \| null }] }` for this doctor. `weekday: null` is every day |
| `POST /doctor/schedule` | One of `{ kind: "break", weekday \| null, from, to, label }`, `{ kind: "closure", startsOn, endsOn?, from?, to?, reason, repeat?: "NONE" \| "WEEKLY" \| "MONTHLY" \| "YEARLY" }` (no times = whole days), `{ kind: "holidays", observe: boolean }` or `{ kind: "lengths", minutes: { [service]: number \| null } }` (null = built-in) → the same as GET; `422` with `fieldErrors` when something needs fixing |
| `DELETE /doctor/schedule?break=<id>` or `?closure=<id>` | → the same as GET |
| `GET /doctor/clinic-settings` | `{ clinic: { name, address, contactNumber, sharedCharts }, staff: [{ fullName, email, role }], invites: [{ email, role }] }` |
| `PUT /doctor/clinic-settings` | `{ name, address, contactNumber }` and/or `{ sharedCharts }` → the same as GET. Details follow the web's rules (`422` with `fieldErrors`) |
| `POST /doctor/staff` | `{ email, role: "SECRETARY" \| "DOCTOR" \| "ADMIN" }` → `201 { code, mail }`. Invites somebody, as Manage → Staff; `mail` is `sent`, `off` or `failed` and the code is shown either way |

### Finding a doctor

Any signed-in account. Only verified doctors appear.

| | |
| --- | --- |
| `GET /discover?q=&specialty=` | `{ doctors: [{ id, fullName, specialty, clinic: { id, name, address, slug } }], specialties[] }` — doctors at clinics that list themselves |
| `GET /discover/doctors/:id` | `{ doctor, booking, knownPatient, faved }` — `booking` is `/patient/clinic`'s shape for this doctor (services, hours, window); `knownPatient` says the caller already has a record there; `faved`, that they keep this doctor in their faves |
| `GET /discover/clinics/:slug` | `{ clinic, doctors[] }` — a clinic by its link, listed or not |

### Faves

Any signed-in account. A fave is private to the login; doctors are never told who (PRODUCT.md, decision 6).

| | |
| --- | --- |
| `GET /faves` | `{ doctors[] }`, newest first, in `/discover`'s shape |
| `PUT /faves/:doctorId` | → `{ doctorId, faved: true }`. Verified doctors only (`404` otherwise); faving twice is fine |
| `DELETE /faves/:doctorId` | → `{ doctorId, faved: false }` |
| `POST /discover/requests` | `{ doctorId, service, preferredDate, preferredTime?, reason, details? }` → `201 { id, status, newPatient }`. Without a record at that clinic, `details` (`{ firstName, middleName?, lastName, dateOfBirth, sex, contactNumber, address, email? }`) is required and the request is a new patient's. **For somebody else:** add `familyMemberId` (from `GET /family`): their name, birthday and sex come from the list, `details` gives the mobile and address. Accepting makes the requester their caregiver, never the chart's own login |
| `GET /discover/requests` | `{ requests[] }` — every request this account sent, at any clinic |
| `GET /family` | `{ family: [{ id, firstName, middleName, lastName, dateOfBirth, sex, relationship, links: [{ patientId, clinicId, clinicName }] }] }` — the people this login books for, **one list whichever side started them**: every chart this login looks after appears here (a clinic-made link joins or creates an entry). Once `links` is non-empty the name, birthday and sex are the clinic's record (`relationship`: `CHILD`, `SPOUSE`, `PARENT`, `SIBLING`, `GRANDPARENT`, `OTHER`). Details on the account holder's word; grants nothing at any clinic |
| `POST /family` | `{ firstName, middleName?, lastName, dateOfBirth, sex, relationship }` → `201 { member }`. At most 20 |
| `PATCH /family/:id` | Same body → `{ member }`. For a linked person only `relationship` changes; the rest is the clinic's |
| `DELETE /family/:id` | `204`. Requests already sent for them stand. `409` for a linked person: `DELETE /patient/care?patient=` first |

`GET /doctor/requests` marks a new patient's request with `newPatient: { dateOfBirth, contactNumber, email, lookalikes[] }` (`patient.id` is null), and a request made for somebody else with `askedBy: { fullName, relationship }`: accepting it lets that login look after the chart. Accepting one needs `record`: `"new"` to create their record, or a look-alike's patient id to link it. `/doctor/clinic-settings` adds `listed`, `slug` and `link`. The clinic's QR code is a PNG at `/c/<slug>/qr` (public, not under `/api/v1`), and a printable poster at `/c/<slug>/poster`.
| `GET /doctor/patients?q=&who=` | `{ patients[] }`, each `{ id, fullName, patientNumber, household, mine }`. The clinic's patients (for booking); `who=mine` keeps those this doctor cares for. Name or number match; at most 50; archived charts left out |
| `GET /doctor/patients/:id` | `{ patient, caresFor, chart, visits, upcoming[], past[] }`. Details for any clinic patient, with `patient.bloodType` and `patient.primaryContact` (`{ name, relationship, number }` or null). `chart` (`allergies`, `alerts`, `conditions`, `medications`, and the three `…Status` values) and `visits` (`{ id, status, visitDate, chiefComplaint, assessment, diagnoses: [{ code, title }], mine, author }`, diagnoses ICD-11, primary first) only when `caresFor`, else `null`; in a clinic that shares charts every doctor cares for every patient. `upcoming` / `past` are this doctor's own appointments. `patient.household` adds `housemates[]` and `canStartOwn`. Opening a chart is logged |
| `POST /doctor/patients/:id/chart` | `{ action, id?, label?, severity?, reaction?, notes?, dosage?, frequency? }` → `200 { ok: true }`, `422 { error }` with why. **Change the chart in place**, as the web's side column: `allergy.add` (`label`, `severity` MILD/MODERATE/SEVERE, `reaction`), `allergy.remove` (`id`), `allergy.none`, `alert.add` (`label`, `notes`), `alert.remove` (`id`), `condition.add` (`label`), `condition.resolve` (`id`), `medication.add` (`label`, `dosage`, `frequency`), `medication.stop` (`id`), `medication.restart` (`id`). Only for a patient this doctor cares for, not archived |
| `POST /doctor/patients/:id/household` | `{ memberIds[] }` → `201 { household: { id, name } }`. **Start their own household:** this adult heads a new one, and the housemates named move with them. `422` for a child or an archived chart |
| `GET /doctor/records/carry-over?patientId=` | `{ carryOver: { from, heightCm, diagnoses: [{ code, title }], notes, prescriptions[], assessment, treatmentPlan } \| null }`: what a new note starts from, the latest finalized note this doctor may read. `notes` is its advice (or an older note's treatment plan); `assessment` and `treatmentPlan` are always empty: diagnoses are coded, and plans are prescriptions plus advice. Never today's complaint, vitals or examination |
| `GET /doctor/records?appointmentId=` | `{ record }`: the note this doctor already started for that appointment, or `null` |
| `GET /doctor/records/:id` | `{ record }`: a note to read or continue — this doctor's, or any at a clinic that shares charts (`mine` says whether it can be changed). Logged |
| `POST /doctor/records` | `{ recordId?, intent: "draft" \| "finish", patientId, appointmentId?, visitDate: "YYYY-MM-DDTHH:MM", chiefComplaint, historyOfPresentIllness?, physicalExamination?, temperatureC?, heartRate?, respiratoryRate?, systolic?, diastolic?, weightKg?, heightCm?, oxygenSaturation?, assessment?, treatmentPlan?, followUpDate?, notes?, amendmentReason?, prescriptions: [{ drugName, dosage, frequency, duration?, instructions? }], diagnoses?: ["CA23.32", …], ongoing?: ["BA00.Z", …], noteKind? } → `{ record }`. `ongoing` are diagnoses to add to the patient's ongoing conditions when the note is signed, unless already there. `noteKind` (PHONE, RESULTS, OTHER) says why a note has no visit; it's cleared when the note is linked to one. `diagnoses` are ICD-11 codes, primary first, each checked against the list; leave the field out and the note keeps the diagnoses it has. `record.diagnoses` is `[{ code, title, uri }]`. The web's rules exactly: drafts autosave to one row (send back `record.id`); `finish` validates and signs; changing a signed note needs `amendmentReason` and adds a version; a teleconsultation can't record examination or vitals; an appointment must be in consultation or completed. `422` with `fieldErrors` otherwise |
| `POST /doctor/appointments` | `{ patientId, service, reason, date, time, walkIn? }` → `201 { id }`. A walk-in skips the booking lead time and joins the queue as checked in. `409` when the time was just taken |
| `GET /doctor/appointments/:id/history` | `{ history: [{ at, label, by, detail }] }`, oldest first: requested, accepted, booked, checked in, started… with who did each |
| `POST /doctor/appointments/:id/status` | `{ status }` → `{ id, status }`. Checking in (or starting) a visit booked for another day moves it to now; undoing the check-in puts it back. While it is only checked in, its old time stays held (nobody can be booked into it), so the undo always fits; starting the consultation releases it. `409` for a move `nextStatuses` doesn't allow, or when restoring a visit whose slot has since gone |
| `GET /doctor/requests` | `{ requests[] }` for **this doctor** waiting for an answer, oldest first, each with `patient: { id, fullName }`. A doctor can only accept or decline their own (others are `404`); the desk handles any, on the web |
| `POST /doctor/requests/:id/accept` | `{ time? }` → `{ id, status: "ACCEPTED", appointmentId }`. `time` is required when the patient asked for any time. `409` when the time is no longer free |
| `POST /doctor/requests/:id/decline` | `{ note? }` → `{ id, status: "DECLINED" }`. The patient reads the note |

Booking, status changes and accepting requests all run through
`lib/booking.ts`, under the same lock and overlap check as the web forms.
