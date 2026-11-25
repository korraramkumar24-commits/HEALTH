# Patient dashboard, medication tracking, and appointments

All API paths below are under `/api` and require bearer authentication.

## Patient dashboard

`GET /dashboard/patient` returns the latest health reading, last-seven-day
summary and chart readings, recent readings, unread-alert count and alert
preview, the patient's active medication schedule with today's dose status,
30-day medication adherence, next scheduled appointment, and latest doctor
recommendation.

## Medication plans and dose logs

| Method and path | Access |
| --- | --- |
| `GET /medications?patientId=` | Patients see their own plans; doctors see assigned patients' plans; admins can view all. Includes today's dose status and 30-day adherence. |
| `POST /medications` | Doctor or admin. Requires `patientId`, clinician-entered `name`, `instructions`, and one or more `scheduledTimes` in 24-hour `HH:mm` format. A doctor may only create a plan for an assigned patient. |
| `POST /medications/:id/log` | Patient owner only. Body: `{ "status": "taken\|missed\|skipped", "scheduledFor": "<ISO date-time>" }`. Each scheduled dose can be logged once. |
| `GET /medications/:id/logs` | Patient owner, assigned doctor, or admin. |

The adherence percentage is `taken` log entries divided by scheduled dose slots
through the current time in the last 30 days. A `missed` or `skipped` entry
counts as a scheduled but not taken dose. Future scheduled doses today are not
yet included. This is a recordkeeping measure, not a medication recommendation.
Medication name, instructions, and schedule are entered by a clinician; the
application does not suggest or calculate medication or dosage.

## Appointments

| Method and path | Access |
| --- | --- |
| `GET /appointments?status=` | Patients see their own; doctors see their own appointments; admins may filter by patient or doctor. |
| `POST /appointments` | Doctor or admin. Requires `patientId`, `startsAt`, and `endsAt`; admin may also supply `doctorId`. The doctor must be the patient's assigned doctor. |
| `PUT /appointments/:id/cancel` | Patient owner, appointment doctor, or admin. |

A unique partial MongoDB index on `(doctorId, startsAt)` for scheduled
appointments prevents two scheduled appointments for the same doctor from
starting at the same time. A duplicate returns `409`. End time must follow start
time, and start time must be in the future.

## Reminders

The server runs an in-process reminder check every 15 minutes after connecting
to MongoDB. It creates a reminder for a scheduled appointment within 24 hours
and for each elapsed medication dose slot with no log for today. Stable unique
reminder keys and a unique partial index make repeated checks idempotent. This
demo reminder service runs only while the API process is running; a
multi-instance production deployment should move scheduling to a coordinated
worker/queue.

## Test workflow

1. As an admin, assign a doctor to a patient. As that doctor, create a
   clinician-entered medication plan for the patient with a dose time earlier
   than the current local time.
2. As the patient, open **Medications** and log today's dose as taken.
3. Log another scheduled dose as missed or skipped. The patient dashboard and
   the assigned doctor's patient overview calculate adherence from those dose
   logs; the value changes as scheduled slots and logs change.
4. As the doctor, open **Appointments**, schedule a future appointment, and
   attempt another appointment at the same start time for the same doctor. The
   second request should return `409`.
5. Let a scheduled appointment enter the next 24 hours and leave a due
   medication slot unlogged. Run the reminder check more than once (or wait for
   the 15-minute interval); only one notification per appointment/dose slot
   should be created.

Backend integration tests cover dashboard adherence updates, appointment
double-booking, and duplicate reminder prevention.
