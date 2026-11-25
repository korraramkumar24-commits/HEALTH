# Chronic Disease Remote Monitoring Dashboard — Planning

## Source and scope

This plan is based on the project specification in `DOCUMENTATION-1.md`. A `README.md` was not present in the workspace when this plan was prepared. Where that specification names a feature but does not define its request or response contract, this plan marks a concrete proposal as **proposed** and lists decisions to confirm under [Open questions](#open-questions).

This is a student/portfolio demo, not a medical product. It must use fake patient data only, must not diagnose or prescribe, and must label all configured alert thresholds as demo values that have not been clinically validated.

## 1. Requirements

### Functional requirements by role

#### Patient

- Register a patient account and log in; registration must always create a patient regardless of any client-supplied role.
- View and edit permitted profile fields and view their assigned doctor.
- Add health readings for blood pressure, blood sugar, heart rate, weight, and oxygen level, with optional notes and recording time. The server derives the patient identity from the authenticated account.
- View their own readings as history, charts, date-filtered results, latest reading, and summaries. Edit a reading only within the allowed edit window; delete only their own reading.
- View alerts and doctor recommendations, and view and mark their own notifications as read.
- View their medication plan and medication-log history; log a scheduled dose as taken, missed, or skipped. The app must not recommend medication or calculate a dose.
- View upcoming and past appointments and cancel their own eligible appointment.
- Use the patient dashboard to see recent measurements, trends, alerts, active medication and today's dose status, and the next appointment.

#### Doctor

- Log in to an account created by an admin; doctors cannot self-register.
- View, search, filter, and paginate only patients assigned to them.
- View assigned patients' profiles, readings, charts, summaries, alerts, notes, medication plans, and adherence information.
- Review automatically generated alerts and create manual alerts for assigned patients; acknowledge and resolve alerts.
- Add notes and recommendations to assigned patients. Recommendations are informational and must not be framed as a diagnosis or prescription.
- Create and manage medication entries for assigned patients and create appointments for them.
- Use the doctor dashboard to review patient totals, attention indicators, recent alerts, and recent reading-status breakdowns.

#### Admin

- Log in to an account created administratively; there is no public admin registration.
- Create, update, deactivate, and remove users/doctors/patients as permitted by the final account lifecycle policy.
- Create patient and doctor accounts, assign or reassign patients to doctors, and manage disease categories.
- View system-wide statistics and manage alerts.
- Administer records only where explicitly permitted; access to medical content should be limited and auditable.

### Non-functional requirements

#### Security and privacy

- Hash passwords; never return password hashes or log passwords, tokens, or sensitive medical values.
- Use JWT authentication and backend role authorization on every protected route. Enforce resource ownership in addition to role checks: patients access only their own records, and doctors only records for assigned patients.
- Validate and sanitize all input; whitelist writable fields to prevent mass assignment. Never trust client-supplied roles, patient IDs, doctor assignments, or ownership.
- Use rate limits, stricter limits for authentication endpoints, Helmet, restricted CORS, HTTPS in production, and environment-managed secrets.
- Return consistent error responses without exposing stack traces or internal details in production.
- Use fake patient data only. Avoid sensitive values in URLs, logs, screenshots, and demo materials.
- Record security-relevant administrative actions without storing passwords or medical measurements in audit data. Audit-log scope and retention remain to be decided.

#### Performance and reliability

- Paginate list endpoints with bounded page size (proposed maximum: 50); apply filtering and sorting on the server.
- Index user/profile references, patient-to-doctor assignments, and health records by patient and descending recording time.
- Avoid N+1 queries on dashboards and patient overviews; aggregate counts and summaries in the database where practical.
- Preserve health-record creation if automatic alert/notification generation fails, but report the failure through non-sensitive server-side logging and monitoring.
- Prevent duplicate appointment bookings for the same doctor and time. Ensure scheduled reminders are idempotent.
- Display clear loading, empty, and retryable error states. Charts must preserve gaps for missing measurements instead of treating missing values as zero.

#### Usability and accessibility

- Provide role-specific navigation and redirect authenticated users to their role's dashboard.
- Make forms keyboard accessible, label every input, show field-level validation, expose focus states, and use sufficient color contrast.
- Do not rely on color alone to indicate alert severity; include text and/or an icon.
- Support mobile layouts down to 375px, with responsive navigation, tables, and charts.
- Show a persistent “Demo application - not for medical use” notice and a contextual disclaimer beside readings and alerts.
- Provide helpful empty states, confirmation for destructive actions, disabled submit controls while saving, and visible success/error feedback.

## 2. User stories and acceptance criteria

Acceptance criteria use the proposed shared API envelope `{ success, message, data }` unless stated otherwise.

### Auth

**A1. Patient registration**

As a patient, I want to register an account so that I can record and review my own health measurements.

- Registration accepts the patient's permitted identity and profile fields.
- The server creates a patient account even if the request includes a different role; it never accepts a doctor/admin role from public registration.
- Duplicate email and invalid fields receive actionable validation errors; successful registration never returns a password or hash.
- Maps to `POST /api/auth/register`.

**A2. Sign in**

As a patient, doctor, or admin, I want to sign in so that I can access the features permitted for my role.

- Valid active credentials return an authentication token and safe user profile.
- Invalid credentials and inactive accounts are rejected without revealing which credential was wrong.
- The UI routes the user to `/patient/dashboard`, `/doctor/dashboard`, or `/admin/dashboard`.
- Maps to `POST /api/auth/login`.

**A3. Restore and end a session**

As an authenticated user, I want my session restored after a refresh and be able to change my password so that I can continue securely or protect my account.

- The profile endpoint returns the current safe identity; protected routes reject missing, expired, or tampered tokens.
- Password change verifies the current password and returns a safe success response. Token invalidation behavior must be selected before implementation.
- Maps to `GET /api/auth/profile` and `PUT /api/auth/change-password`.

### Patients

**P1. Manage patient profiles**

As a patient, I want to review and update my permitted profile details so that my care team has current information.

- A patient can view/update only their own profile and cannot change role, user identity references, or doctor assignment.
- Admin can create, update, deactivate/delete, and assign a patient according to the final lifecycle policy.
- Doctors can list only assigned patients and can view only those patients' details.
- Maps to `GET /api/patients`, `GET /api/patients/:id`, `POST /api/patients`, `PUT /api/patients/:id`, `DELETE /api/patients/:id`, and `PUT /api/patients/:id/assign-doctor`.

**P2. Find patients**

As a doctor, I want to search and filter my assigned patients so that I can find the patient I need to review.

- Search supports patient name, email, and patient identifier; disease and status filters are applied server-side.
- Results are paginated and include accurate totals; no unassigned patient is returned.
- Maps to `GET /api/patients?page=&limit=&search=&disease=&status=`.

### Health Records

**H1. Submit a reading**

As a patient, I want to submit a health reading so that I can track changes and share them with my doctor.

- At least one measurement is required; provided values are checked against documented plausibility limits.
- Systolic pressure must exceed diastolic pressure; recording time cannot be in the future.
- The server derives patient identity from the token and rejects attempts to submit for another patient.
- The form explains that validation is for data quality, not diagnosis.
- Maps to `POST /api/health-records`.

**H2. Review reading history**

As a patient, I want to see my health history and trends so that I can understand how my recorded measurements change over time.

- The patient sees only their readings, newest first, with date filtering and pagination.
- Missing measurements remain missing in charts; history supports edit/delete only within the applicable ownership and time rules.
- Maps to `GET /api/health-records`, `GET /api/health-records/latest/:patientId`, `GET /api/health-records/:id`, `PUT /api/health-records/:id`, `DELETE /api/health-records/:id`, and proposed `GET /api/health-records/summary/:patientId`.

**H3. Review assigned-patient readings**

As a doctor, I want to review readings and summaries for my assigned patients so that I can monitor recorded changes.

- The doctor can read only assigned patients' readings and receives 403 for another doctor's patient.
- Summary output includes per-measurement minimum, maximum, average, count, and a documented non-diagnostic trend label.
- Maps to the same read endpoints as H2 and the proposed summary endpoint.

### Alerts

**AL1. Review and manage alerts**

As a doctor, I want to review, acknowledge, resolve, or create alerts for assigned patients so that items needing clinical review are visible to the care team.

- Automatically generated alerts use clearly labelled demo thresholds and neutral, non-diagnostic language.
- Manual alerts require an assigned patient and a message/type/severity.
- Only a doctor with access to the patient or an admin can update alert status; status follows unread → acknowledged → resolved.
- Maps to `GET /api/alerts`, `POST /api/alerts`, `PUT /api/alerts/:id`, and admin-only `DELETE /api/alerts/:id`.

**AL2. See my alerts**

As a patient, I want to see alerts related to my readings so that I know which items my care team has flagged for review.

- A patient can read only their own alerts; patients cannot create, update, or delete alerts.
- High/critical alert notifications may be sent to the patient as well as their assigned doctor.
- Maps to `GET /api/alerts` and notification read endpoints.

### Medications

**M1. View and log medication doses**

As a patient, I want to see my active medication schedule and log doses so that my adherence history is available to my care team.

- The patient can view only their medication plan and medication logs.
- A dose can be logged as taken, missed, or skipped with the scheduled time and optional taken time.
- A patient cannot create/change medication prescriptions or dosage.
- Maps to proposed `GET /api/medications`, `GET /api/medications/:id`, and `POST /api/medications/:id/log`.

**M2. Manage patient medication plans**

As a doctor, I want to record and update a medication plan for an assigned patient so that the patient can view the plan and log doses.

- A medication entry requires patient, medicine name, dosage text, frequency, and start date; the doctor must be assigned to that patient.
- The app records exactly the supplied plan and does not recommend medicine or calculate dosage.
- Admin medication management scope must follow the agreed policy.
- Maps to proposed `POST /api/medications`, `PUT /api/medications/:id`, and `DELETE /api/medications/:id`.

**M3. Review adherence**

As a doctor, I want to review medication adherence so that I can see whether scheduled doses have been logged.

- The overview/dashboard reports adherence based on medication logs and identifies the calculation window/denominator.
- Missing logs are not silently treated as confirmed missed doses unless the policy explicitly says so.
- Maps to `GET /api/patients/:id/overview` and proposed `GET /api/medications/:id/logs`.

### Appointments

**AP1. View and cancel appointments**

As a patient, I want to view my upcoming and past appointments and cancel an eligible appointment so that I can keep track of planned visits.

- The patient sees only their appointments and can cancel only appointments in a cancellable status/window.
- The next appointment is displayed on the patient dashboard.
- Maps to proposed `GET /api/appointments`, `GET /api/appointments/:id`, and `PUT /api/appointments/:id`.

**AP2. Schedule an appointment**

As a doctor, I want to schedule an appointment with an assigned patient so that the planned visit is visible to both parties.

- Doctor/admin can create an appointment for a valid patient/doctor pairing.
- A second appointment for the same doctor and time is rejected.
- Status is one of scheduled, completed, or cancelled.
- Maps to proposed `POST /api/appointments` and `PUT /api/appointments/:id`.

**AP3. Receive reminders**

As a patient, I want an in-app reminder for an upcoming appointment so that I can prepare for it.

- An appointment within the configured 24-hour reminder window creates a notification once, not on every scheduler run.
- The notification contains no medical measurement values.
- Maps to the proposed reminder process and `GET /api/notifications`.

### Dashboards

**D1. Review my health overview**

As a patient, I want a dashboard with my latest readings, alerts, medication status, and next appointment so that I can see a concise overview of my recorded care activity.

- Dashboard data is scoped to the authenticated patient and includes latest readings, a 7-day summary, unread-alert count, active medications/today's status, next appointment, and latest recommendation where available.
- Empty data is represented explicitly and charts do not fabricate zeros.
- Maps to `GET /api/dashboard/patient`.

**D2. Monitor assigned patients**

As a doctor, I want a dashboard of my assigned patients and recent alerts so that I can prioritize review.

- Dashboard includes total/active patients, patients needing attention, critical alert count, latest five alerts, and the last-seven-day reading-status breakdown.
- All values are scoped to the authenticated doctor.
- Maps to `GET /api/dashboard/doctor` and patient overview endpoints.

**D3. Monitor system administration**

As an admin, I want system-wide user, patient, disease, and alert statistics so that I can oversee system configuration and activity.

- Dashboard includes users by role, patients per doctor/disease, alerts by severity/status, and daily readings for the last 14 days.
- Only admins can access the endpoint.
- Maps to `GET /api/dashboard/admin`.

### Supporting modules: notes, notifications, doctors, diseases

**S1. Share a recommendation**

As a doctor, I want to add a note or recommendation to an assigned patient so that the patient can review the care team's guidance.

- Only an assigned doctor can create a note; the patient can read notes for themselves only.
- A note is typed as `note` or `recommendation` and does not present itself as an automated diagnosis or prescription.
- Maps to proposed `GET /api/notes` and `POST /api/notes`.

**S2. Manage doctors and disease categories**

As an admin, I want to manage doctor profiles and disease categories so that patient assignment and classification remain current.

- Doctor creation creates a doctor-role user and linked doctor profile; doctors cannot self-register.
- Disease names are unique; reads are available to authenticated users and writes are admin-only.
- Maps to proposed doctor and disease CRUD endpoints.

**S3. Manage notifications**

As an authenticated user, I want to see and mark my notifications as read so that I can keep track of relevant updates.

- Users see only their own notifications; one notification can be marked read or all can be marked read.
- Maps to `GET /api/notifications`, `PUT /api/notifications/:id/read`, and `PUT /api/notifications/read-all`.

## 3. Text/ASCII wireframes

These are responsive-first structural sketches; exact branding and visual styling are not specified.

### Login

```text
+------------------------------------------------------+
| Chronic Care Monitor        DEMO - NOT FOR MEDICAL USE|
|                                                      |
|                    Sign in                           |
|              [ Email                 ]               |
|              [ Password              ] [Show]        |
|              [       Sign in         ]               |
|                                                      |
|              New patient? Register                   |
|              [ error / status message ]              |
+------------------------------------------------------+
```

### Register

```text
+------------------------------------------------------+
| Chronic Care Monitor        DEMO - NOT FOR MEDICAL USE|
|                 Create patient account               |
| [ Full name                         ]                |
| [ Email                             ]                |
| [ Password                          ]                |
| [ Confirm password                  ]                |
| [ Phone (optional)                  ]                |
| [ Date of birth ] [ Gender (optional) ]              |
| [ Emergency contact name ] [ Phone ]                 |
| [ ] I understand this is a demo, not medical advice   |
| [             Create account          ]              |
| Already registered? Sign in                         |
+------------------------------------------------------+
```

### Patient Dashboard

```text
+--------------------------------------------------------------+
| Logo | Dashboard | History | Alerts | Medications | Appointments | User |
| DEMO APPLICATION - NOT FOR MEDICAL USE                       |
+--------------------------------------------------------------+
| Good morning, Patient                         [ + Add Reading ]|
| [Latest BP] [Blood sugar] [Heart rate] [Weight]               |
| [ Trend chart: measurement selector | 7 days ]                |
| Recent readings                 | Alerts preview              |
| Date/time | measurements       | Severity | Message | View    |
| Today's medications             | Next appointment            |
| [ ] Dose 1 [Mark taken]         | date, time, doctor, reason   |
| [ ] Dose 2 [Mark taken]         | Latest recommendation        |
+--------------------------------------------------------------+
```

### Add Reading form

```text
+------------------------------------------------------+
| < Back to dashboard              Add a reading       |
| Demo application - not for medical use               |
| Blood pressure: [ Systolic ] / [ Diastolic ] mmHg    |
| Blood sugar:    [              ] mg/dL              |
| Heart rate:     [              ] bpm                |
| Weight:         [              ] kg                 |
| Oxygen level:   [              ] %                  |
| Recorded at:    [ date            ] [ time         ]|
| Notes (optional):                                    |
| [                                                  ] |
| Validation checks data plausibility; this is not a   |
| diagnosis. At least one measurement is required.     |
| [Cancel]                             [Save reading]  |
| [Inline field errors / save status]                  |
+------------------------------------------------------+
```

### Health History

```text
+----------------------------------------------------------------+
| Health History                                  [ + Add Reading ]|
| From [date] To [date] [Apply]   Measurement [All v]             |
| [Trend chart with gaps for missing values]                      |
| Date/time | BP | Sugar | Heart rate | Weight | Oxygen | Actions |
| ...                                                           ...|
| [Previous]                 Page 1 of N                 [Next]   |
| Empty/error/loading state appears in this area when applicable. |
+----------------------------------------------------------------+
```

### Doctor Dashboard

```text
+----------------------------------------------------------------+
| Logo | Overview | My Patients | Alerts | User | Notifications  |
| DEMO APPLICATION - NOT FOR MEDICAL USE                         |
| [Total patients] [Active] [Needs attention] [Critical alerts] |
| Search [name/email/id] Disease [v] Status [v] Severity [v]     |
| Patient | Disease | Latest reading | Status | Open details     |
| ...                                                            |
| Reading status (last 7 days): [Normal / Warning / Critical chart]|
| Recent alerts (latest 5): severity | patient | message | status |
+----------------------------------------------------------------+
```

### Patient Details page

```text
+----------------------------------------------------------------+
| < My Patients     Patient name | Disease | Status              |
| Profile: DOB, gender, contact (per privacy policy), assigned MD |
| [7 days] [30 days] [90 days]                                   |
| Blood sugar chart              | Blood pressure (sys/dia) chart |
| Heart rate chart               | Weight chart                   |
| Latest reading | 30-day summary (min/max/avg/count/trend)      |
| Unresolved alerts: severity | message | [Acknowledge] [Resolve]|
| Medications & adherence: plan summary / adherence chart        |
| Notes and recommendations: history                             |
| [Type: note v] [Add note / recommendation................] [Add]|
+----------------------------------------------------------------+
```

### Admin Dashboard

```text
+----------------------------------------------------------------+
| Logo | Overview | Users | Patients | Doctors | Diseases | Alerts|
| DEMO APPLICATION - NOT FOR MEDICAL USE                         |
| [Users by role] [Patients] [Doctors] [Open alerts]             |
| Patients per doctor [bar chart]   Patients per disease [chart] |
| Alerts by severity/status [chart]                               |
| Readings submitted per day - last 14 days [line chart]         |
| Recent system activity / management shortcuts                  |
+----------------------------------------------------------------+
```

## 4. Entity-relationship overview

All collections below use MongoDB document IDs (`ObjectId`) as `_id`. Fields marked optional may be omitted or null according to validation rules. `createdAt`/`updatedAt` are timestamps where enabled; the source specification does not define timestamp policy consistently, so it should be standardized.

| Collection | Fields and types | References and constraints |
|---|---|---|
| `users` | `name: string`; `email: string`; `password: string` (bcrypt hash, excluded from reads); `role: "patient" \| "doctor" \| "admin"`; `phone: string?`; `isActive: boolean`; `createdAt: Date`; `updatedAt: Date` | Email unique. Identity collection. One patient or doctor profile references a user; admin need not have a profile. |
| `patients` | `userId: ObjectId`; `dateOfBirth: Date?`; `gender: string/enum?`; `disease: ObjectId or enum`; `doctorId: ObjectId?`; `emergencyContact: { name: string, phone: string }?`; `status: "active" \| "inactive"`; `createdAt: Date` | `userId -> users._id`, unique; `doctorId -> doctors._id`; disease references `diseases._id` if categories are normalized. |
| `doctors` | `userId: ObjectId`; `specialization: string?`; `licenseNumber: string` (fake/demo); `createdAt: Date` | `userId -> users._id`, unique. Treat license number as synthetic demo data only. |
| `healthRecords` | `patientId: ObjectId`; `bloodPressure: { systolic: number, diastolic: number }?`; `bloodSugar: number?`; `heartRate: number?`; `weight: number?`; `oxygenLevel: number?`; `notes: string?`; `recordedAt: Date`; `createdAt: Date` | `patientId -> patients._id`. At least one measurement required. Index `{ patientId: 1, recordedAt: -1 }`. Plausibility ranges are listed under [Open questions](#open-questions). |
| `alerts` | `patientId: ObjectId`; `doctorId: ObjectId?`; `healthRecordId: ObjectId?`; `type: "Blood Pressure" \| "Blood Sugar" \| "Heart Rate" \| "Weight" \| "Manual"`; `message: string`; `severity: "low" \| "medium" \| "high" \| "critical"`; `status: "unread" \| "acknowledged" \| "resolved"`; `createdBy: "system" \| ObjectId`; `createdAt: Date` | `patientId -> patients._id`; `doctorId -> doctors._id`; `healthRecordId -> healthRecords._id`; user-valued `createdBy -> users._id`. |
| `medications` | `patientId: ObjectId`; `prescribedBy: ObjectId`; `medicineName: string`; `dosage: string`; `frequency: string`; `startDate: Date`; `endDate: Date?`; `isActive: boolean` | `patientId -> patients._id`; `prescribedBy -> doctors._id`. Data is entered by a doctor/admin; app does not calculate or recommend a dose. |
| `medicationLogs` | `medicationId: ObjectId`; `patientId: ObjectId`; `scheduledFor: Date`; `takenAt: Date?`; `status: "taken" \| "missed" \| "skipped"` | `medicationId -> medications._id`; `patientId -> patients._id`. Define uniqueness/idempotency for medication plus scheduled dose. |
| `appointments` | `patientId: ObjectId`; `doctorId: ObjectId`; `appointmentDate: Date`; `reason: string?`; `status: "scheduled" \| "completed" \| "cancelled"`; `createdAt: Date` | `patientId -> patients._id`; `doctorId -> doctors._id`. Prevent double-booking the same doctor/time; exact time-slot policy TBD. |
| `notifications` | `userId: ObjectId`; `type: string`; `message: string`; `link: string?`; `isRead: boolean`; `createdAt: Date` | `userId -> users._id`. Queries and updates are restricted to the owning user. |
| `notes` | `patientId: ObjectId`; `doctorId: ObjectId`; `content: string`; `type: "note" \| "recommendation"`; `createdAt: Date` | `patientId -> patients._id`; `doctorId -> doctors._id`. Doctor must be assigned to patient on creation. |
| `diseases` | `name: string`; `description: string?` | `name` unique. Referenced by `patients.disease` if normalized. |

### Relationships

```text
users 1 ── 0..1 patients
users 1 ── 0..1 doctors
doctors 1 ── many patients (patient.doctorId)
diseases 1 ── many patients
patients 1 ── many healthRecords, alerts, medications, medicationLogs,
                   appointments, notes
doctors 1 ── many alerts, medications, appointments, notes
healthRecords 1 ── 0..many alerts
medications 1 ── many medicationLogs
users 1 ── many notifications
```

An `AuditLog` is mentioned as a later hardening-phase addition, not part of the baseline collection list. If implemented, it should be separately specified with actor/action/target/time/IP and must not contain medical values or passwords.

## 5. API endpoint table

### API conventions

- Base path: `/api`; protected routes use `Authorization: Bearer <JWT>`.
- Default success envelope: `{ "success": true, "message": "...", "data": ... }`; errors use `{ "success": false, "message": "...", "errors": [...]? }`.
- The request body column describes relevant JSON fields; query strings and path IDs are shown in the route.
- `Public` means no JWT. Other roles require authentication. Ownership/assignment checks still apply even when the role is allowed.
- Standard status expectations: `200` read/update, `201` create, `204` or `200` delete, `400` validation, `401` unauthenticated, `403` forbidden, `404` missing, `409` conflict. Exact status/body for delete should be standardized.
- Routes shown as **proposed** complete CRUD/read functionality that the source describes only as “standard CRUD” or does not fully enumerate.

| Method | Route | Role / scope | Request body / query | Response data (success) |
|---|---|---|---|---|
| POST | `/api/auth/register` | Public; patient only | `{ name, email, password, phone?, dateOfBirth?, gender?, emergencyContact? }`; ignore/reject client role | `{ token?, user: { id, name, email, role }, patient }`; never password/hash |
| POST | `/api/auth/login` | Public | `{ email, password }` | `{ token, user: { id, name, email, role } }` |
| GET | `/api/auth/profile` | Any authenticated user | — | `{ user: { id, name, email, role, phone?, isActive }, profile? }` |
| PUT | `/api/auth/change-password` | Any authenticated user | `{ currentPassword, newPassword }` | `{ changed: true }`; token invalidation policy TBD |
| GET | `/api/patients?page=&limit=&search=&disease=&status=` | Doctor (assigned only), admin (all) | Query filters and pagination; proposed max `limit=50` | `{ patients, page, limit, totalPatients, totalPages }` |
| GET | `/api/patients/:id` | Patient owner, assigned doctor, admin | — | `{ patient }` |
| POST | `/api/patients` | Admin | `{ user: { name, email, ... }, patient: { dateOfBirth?, gender?, disease?, doctorId?, emergencyContact? } }` | `{ patient }`; never returns password |
| PUT | `/api/patients/:id` | Owner patient or admin | Whitelisted profile fields only | `{ patient }` |
| DELETE | `/api/patients/:id` | Admin | — | `{ deleted: true }`; source indicates soft delete via patient `status` and user `isActive` |
| PUT | `/api/patients/:id/assign-doctor` | Admin | `{ doctorId }` (nullable only if unassignment is allowed) | `{ patient }` |
| GET | `/api/patients/:id/overview` | Assigned doctor; admin policy TBD | — | `{ profile, latestReading, summary30d, unresolvedAlerts, notes, activeMedications, adherencePercentage }` |
| GET | `/api/users?page=&limit=&search=&role=&isActive=` **proposed** | Admin | Filters and pagination | `{ users, page, limit, total, totalPages }`; never includes password/hash |
| PUT | `/api/users/:id` **proposed** | Admin | Whitelisted account fields such as `{ name, email, phone, isActive }`; role changes restricted by policy | `{ user }`; never includes password/hash |
| DELETE | `/api/users/:id` **proposed** | Admin | — | `{ deactivated: true }` preferred over hard deletion |
| GET | `/api/doctors` **proposed** | Admin | `?page=&limit=&search=` | `{ doctors, page, limit, total, totalPages }` |
| POST | `/api/doctors` **proposed** | Admin | `{ user: { name, email, phone? }, specialization?, licenseNumber? }` | `{ doctor }`; creates linked doctor-role user |
| GET | `/api/doctors/:id` **proposed** | Admin | — | `{ doctor }` |
| PUT | `/api/doctors/:id` **proposed** | Admin | Whitelisted profile/user fields | `{ doctor }` |
| DELETE | `/api/doctors/:id` **proposed** | Admin | — | `{ deleted: true }`; lifecycle/reassignment policy TBD |
| GET | `/api/diseases` **proposed** | Authenticated users | — | `{ diseases }` |
| POST | `/api/diseases` **proposed** | Admin | `{ name, description? }` | `{ disease }` |
| GET | `/api/diseases/:id` **proposed** | Authenticated users | — | `{ disease }` |
| PUT | `/api/diseases/:id` **proposed** | Admin | `{ name?, description? }` | `{ disease }` |
| DELETE | `/api/diseases/:id` **proposed** | Admin | — | `{ deleted: true }`; reject or migrate if referenced |
| POST | `/api/health-records` | Patient | `{ bloodPressure?: { systolic, diastolic }, bloodSugar?, heartRate?, weight?, oxygenLevel?, notes?, recordedAt? }`; patient ID derived from token | `{ healthRecord, alerts? }`; alert generation failure must not undo reading |
| GET | `/api/health-records?patientId=&from=&to=&page=&limit=` | Patient owner or assigned doctor | Date filters, optional patient filter, pagination | `{ healthRecords, page, limit, total, totalPages }` newest first |
| GET | `/api/health-records/latest/:patientId` | Patient owner or assigned doctor | — | `{ healthRecord: object or null }` |
| GET | `/api/health-records/summary/:patientId?days=7\|30` | Patient owner or assigned doctor | `days` restricted to 7 or 30 in baseline | `{ period, measurements: { [name]: { min, max, average, count, trend } } }` |
| GET | `/api/health-records/:id` | Patient owner or assigned doctor | — | `{ healthRecord }` |
| PUT | `/api/health-records/:id` | Patient owner; within 24 hours | Measurement/note fields only; no patient ID or timestamps overriding policy | `{ healthRecord }` |
| DELETE | `/api/health-records/:id` | Patient owner or admin | — | `{ deleted: true }` |
| GET | `/api/alerts?severity=&status=&patientId=&page=&limit=` | Patient owner, assigned doctor, admin | Filters and pagination | `{ alerts, page, limit, total, totalPages }` |
| POST | `/api/alerts` | Doctor for assigned patient | `{ patientId, type: "Manual", message, severity }` | `{ alert }` |
| PUT | `/api/alerts/:id` | Assigned doctor or admin | `{ status: "acknowledged" \| "resolved" }` | `{ alert }` |
| DELETE | `/api/alerts/:id` | Admin | — | `{ deleted: true }` |
| GET | `/api/medications?patientId=&active=` **proposed** | Patient owner, assigned doctor, admin | Filters and pagination | `{ medications, page, limit, total, totalPages }` |
| POST | `/api/medications` **proposed** | Assigned doctor; admin scope TBD | `{ patientId, medicineName, dosage, frequency, startDate, endDate?, isActive? }` | `{ medication }` |
| GET | `/api/medications/:id` **proposed** | Patient owner, assigned doctor, admin | — | `{ medication }` |
| PUT | `/api/medications/:id` **proposed** | Prescribing/assigned doctor; admin scope TBD | Whitelisted plan fields | `{ medication }` |
| DELETE | `/api/medications/:id` **proposed** | Doctor/admin scope TBD | — | `{ deleted: true }` or inactive medication |
| POST | `/api/medications/:id/log` | Patient owner | `{ scheduledFor, status: "taken" \| "missed" \| "skipped", takenAt? }` | `{ medicationLog }` |
| GET | `/api/medications/:id/logs` **proposed** | Patient owner or assigned doctor | `?from=&to=&page=&limit=` | `{ medicationLogs, page, limit, total, totalPages }` |
| GET | `/api/appointments?patientId=&doctorId=&status=&from=&to=` **proposed** | Patient owner, assigned doctor, admin | Role-scoped filters/pagination | `{ appointments, page, limit, total, totalPages }` |
| POST | `/api/appointments` **proposed** | Assigned doctor or admin | `{ patientId, doctorId?, appointmentDate, reason? }` | `{ appointment }`; conflict returns `409` |
| GET | `/api/appointments/:id` **proposed** | Patient owner, assigned doctor, admin | — | `{ appointment }` |
| PUT | `/api/appointments/:id` **proposed** | Patient owner (cancel only), assigned doctor/admin | `{ status }` for patient cancel; permitted fields for doctor/admin | `{ appointment }` |
| DELETE | `/api/appointments/:id` **proposed** | Admin; prefer cancellation over hard delete | — | `{ deleted: true }` or `{ appointment }` |
| GET | `/api/notes?patientId=&page=&limit=` **proposed** | Patient owner, assigned doctor, admin | Patient and pagination filters | `{ notes, page, limit, total, totalPages }` |
| POST | `/api/notes` **proposed** | Assigned doctor | `{ patientId, content, type: "note" \| "recommendation" }` | `{ note }` |
| PUT | `/api/notes/:id` **proposed** | Author doctor for assigned patient; admin policy TBD | `{ content?, type? }`; patient/doctor/patient references immutable | `{ note }` |
| DELETE | `/api/notes/:id` **proposed** | Author doctor or admin | — | `{ deleted: true }`; preserve audit trail if required |
| GET | `/api/notifications?page=&limit=&unreadOnly=` | Any authenticated user, own only | Pagination/read filter | `{ notifications, unreadCount, page, limit, total }` |
| PUT | `/api/notifications/:id/read` | Any authenticated user, own only | — | `{ notification }` |
| PUT | `/api/notifications/read-all` | Any authenticated user, own only | — | `{ updatedCount }` |
| GET | `/api/dashboard/patient` | Patient | — | `{ latestReadings, summary7d, unreadAlertsCount, activeMedications, nextAppointment, latestRecommendation }` |
| GET | `/api/dashboard/doctor` | Doctor | — | `{ totalPatients, activePatients, needsAttention, criticalAlerts, recentAlerts, readingsStatusBreakdown }` |
| GET | `/api/dashboard/admin` | Admin | — | `{ usersByRole, patientsPerDoctor, patientsPerDisease, alertsBySeverityAndStatus, readingsPerDay14d }` |

For all list/read endpoints, apply ownership and assignment checks before returning data. `patientId`/`doctorId` query filters are selectors, not authorization; they never grant access. Recommendation and alert text must remain non-diagnostic.

## 6. Risks and open questions

### Risks and mitigations

| Risk | Impact | Mitigation / planning action |
|---|---|---|
| Demo thresholds are mistaken for medical guidance | Patient harm or false reassurance | Label thresholds and alerts as demo-only; use neutral text; show a persistent disclaimer; do not use real patient data; require clinical validation before any real-world use. |
| Incomplete ownership checks expose another patient's health data | Severe privacy breach | Centralize backend authorization checks and test a patient/doctor/admin/no-token matrix for every resource route. |
| Public registration accepts elevated role or mass-assigned fields | Unauthorized privileged access | Force patient role server-side and whitelist accepted profile fields. |
| Medical and identity data are logged, leaked, or committed | Privacy/security breach | Redact logs, keep secrets in environment variables, use fake data, and review screenshots, URLs, and Git history. |
| Alert/notification side effects fail or duplicate | Missing or repeated follow-up items | Make side effects observable, non-blocking for record save, and idempotent where retries/schedulers are involved. |
| Medication logs do not define expected doses | Incorrect adherence percentage or reminders | Decide schedule model, missed-dose logic, time zone, and calculation window before implementation. |
| Appointment race conditions permit double booking | Conflicting appointments | Enforce conflict checks atomically and define slot granularity/time zone; test concurrent requests. |
| Unclear deletion semantics break references or history | Lost auditability or orphaned data | Prefer deactivation/cancellation and define retention/reference behavior before deletion endpoints are finalized. |
| Optional/missing measurement fields are charted incorrectly | Misleading trends | Keep absent values null/gaps; test charts and summary calculations with sparse data. |
| Scope grows beyond an educational demo | Delays and increased risk | Keep MVP to manual readings and specified roles; defer real-time/device/email/export features. |

### Open questions

1. Where is the intended `README.md`? The workspace contains `DOCUMENTATION-1.md`, which supplied the source used here.
2. Is `patients.disease` an enum/string or a reference to `diseases`? The source allows either; a normalized `ObjectId` reference is assumed when disease administration is needed.
3. Which profile fields may patients edit, and can patients change their own emergency contact?
4. Can admins create patient accounts directly as well as via patient self-registration? How are initial passwords/reset links delivered without sending credentials insecurely?
5. What exact user/profile deletion policy applies to doctors with assigned patients and patients with health history? Are records retained when a profile is deactivated?
6. Should a doctor see notes written by another doctor for an assigned patient? Can the patient see all notes or only recommendation-type notes?
7. Which admin actions are allowed on medical records, medication plans, and alerts? Do all admin reads of medical data require audit logging?
8. What are the exact alert threshold bands, their boundaries, and whether thresholds are per measurement or patient-specific? They must remain demo-only until clinically reviewed.
9. What are the exact validation units and limits? Proposed plausibility checks: systolic 50–250 mmHg, diastolic 30–150 mmHg, blood sugar 20–800 mg/dL, heart rate 20–250 bpm, weight 1–500 kg, oxygen level 50–100%.
10. Are all measurements optional individually, provided at least one is present? Is oxygen level included in the initial Add Reading form despite not appearing in its shorter field list?
11. What summary/trend algorithm maps values to `improving`, `stable`, or `needs review`? How should different measurement directions and sparse data be handled without implying diagnosis?
12. Which exact HTTP status codes and JSON shape should delete, validation, authentication, authorization, and conflict responses use?
13. What are the API pagination defaults and sort orders for each resource, and should list endpoints include total counts?
14. What should the 24-hour health-record edit window measure: time since creation or `recordedAt`? Can users backdate readings, and by how far?
15. How are medication schedules represented beyond free-text `frequency`? What constitutes a scheduled dose, a missed dose, and the denominator/time window for adherence?
16. Should only doctors create medication plans, or can admins also do so? Can patients cancel appointments at any time or only before a cutoff?
17. What time zone governs appointment slots, scheduled medication doses, and reminder windows? How are daylight-saving changes handled?
18. How should notifications be deduplicated, retained, and expired? Should reminder jobs run in UTC or a user-local time zone?
19. Are `GET/POST/PUT/DELETE` standard CRUD routes intended for every listed resource, including notes and notifications, or only the explicit operations described above?
20. Are audit logs part of MVP or a later security phase? If included, define retention, access, and IP-address handling.
21. Is the 90-day chart range supported by a dedicated summary endpoint, or should it be assembled from paginated health-record data?
22. What user experience is intended for a patient with no assigned doctor, a doctor with no patients, and a patient with no readings/appointments/medications?
