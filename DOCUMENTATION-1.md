# Chronic Disease Remote Monitoring Dashboard (MERN)

A full-stack web application where patients with chronic conditions (diabetes, hypertension, etc.) record health measurements at home, and doctors monitor trends, review alerts, and add recommendations remotely.

> **Disclaimer:** This is a student / portfolio project. It does **not** diagnose or prescribe. All alert thresholds are **example/demo thresholds** and must be clinically validated before any real-world use. Use **fake patient data only**.

---

## Table of Contents

1. [Features by Role](#1-features-by-role)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Database Design](#4-database-design)
5. [API Reference](#5-api-reference)
6. [Folder Structure](#6-folder-structure)
7. [How to Use the AI Prompts](#7-how-to-use-the-ai-prompts)
8. [Phase-wise Build Prompts](#8-phase-wise-build-prompts)
9. [Security Checklist](#9-security-checklist)
10. [Advanced Features (After MVP)](#10-advanced-features-after-mvp)
11. [Definition of Done](#11-definition-of-done)

---

## 1. Features by Role

### Patient
- Register / login, view and edit profile
- Enter health measurements (blood pressure, blood sugar, heart rate, weight)
- View health history and charts
- View alerts and doctor recommendations
- Track medication (mark doses as taken)
- View appointments and receive in-app reminders

### Doctor
- Login (accounts are created by Admin)
- View assigned patients, search and filter them
- View patient profile, measurements, charts, historical trends
- See abnormal readings
- Create alerts, add notes/recommendations
- Monitor medication adherence

### Admin
- Manage users, patients, doctors
- Assign patients to doctors
- View system statistics
- Manage diseases/categories
- Manage alerts

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), React Router DOM, Axios, React Hook Form, Tailwind CSS, Recharts |
| Backend | Node.js, Express.js, Mongoose, JWT, bcrypt, express-validator (or Zod) |
| Database | MongoDB (local or Atlas) |
| Tools | VS Code, Git, GitHub, Postman, MongoDB Compass |
| Security extras | helmet, cors, express-rate-limit, morgan |
| Optional | Socket.IO (real-time), Jest + Supertest (API tests) |

---

## 3. Architecture

```
┌─────────────────┐
│    React App    │   Patient UI / Doctor UI / Admin UI
└────────┬────────┘
         │ Axios (JWT in Authorization header)
         ▼
┌─────────────────┐
│ Express REST API│   routes → middleware → controllers
└────────┬────────┘
         │ Mongoose
         ▼
┌─────────────────┐
│     MongoDB     │
└─────────────────┘
```

Request flow for protected endpoints:

```
Request → verify JWT → check role → check ownership → controller → DB
              │            │              │
             401          403            403
```

**Key design decisions**
- `users` is the single identity layer (email, password, role). `patients` and `doctors` are profile collections referencing `userId`.
- Only **patients** can self-register. Doctors and admins are created by an admin. The register endpoint must never accept `role` from the request body.
- **Ownership checks are enforced in the backend**: a patient can only access their own data; a doctor only their assigned patients.
- Alert thresholds live in a config file (`config/thresholds.js`), clearly labelled as demo values.

---

## 4. Database Design

### users
```js
{ name, email (unique), password (hashed, select:false), role: "patient"|"doctor"|"admin",
  phone, isActive: true, createdAt, updatedAt }
```

### patients
```js
{ userId (ref users, unique), dateOfBirth, gender, disease (ref/enum), doctorId (ref doctors),
  emergencyContact: { name, phone }, status: "active"|"inactive", createdAt }
```

### doctors
```js
{ userId (ref users, unique), specialization, licenseNumber (fake/demo), createdAt }
```

### healthRecords
```js
{ patientId (ref patients),
  bloodPressure: { systolic, diastolic },
  bloodSugar, heartRate, weight, oxygenLevel, notes,
  recordedAt, createdAt }
// index: { patientId: 1, recordedAt: -1 }
```

### alerts
```js
{ patientId, doctorId, healthRecordId (optional),
  type: "Blood Pressure"|"Blood Sugar"|"Heart Rate"|"Weight"|"Manual",
  message, severity: "low"|"medium"|"high"|"critical",
  status: "unread"|"acknowledged"|"resolved", createdBy: "system"|userId, createdAt }
```

### medications
```js
{ patientId, prescribedBy (doctorId), medicineName, dosage, frequency,
  startDate, endDate, isActive }
```

### medicationLogs
```js
{ medicationId, patientId, scheduledFor, takenAt, status: "taken"|"missed"|"skipped" }
```

### appointments
```js
{ patientId, doctorId, appointmentDate, reason,
  status: "scheduled"|"completed"|"cancelled", createdAt }
```

### notifications
```js
{ userId, type, message, link, isRead: false, createdAt }
```

### notes
```js
{ patientId, doctorId, content, type: "note"|"recommendation", createdAt }
```

### diseases (categories)
```js
{ name (unique), description }
```

---

## 5. API Reference

All routes are prefixed with `/api`. 🔒 = requires JWT.

### Auth
| Method | Route | Access |
|---|---|---|
| POST | `/auth/register` | Public (patient only) |
| POST | `/auth/login` | Public |
| GET | `/auth/profile` | 🔒 Any |
| PUT | `/auth/change-password` | 🔒 Any |

### Patients
| Method | Route | Access |
|---|---|---|
| GET | `/patients?page=1&limit=10&search=&disease=&status=` | 🔒 Patient (own), Doctor (assigned), Admin (all) |
| GET | `/patients/me` | 🔒 Patient (own profile) |
| GET | `/patients/:id` | 🔒 Owner patient, assigned doctor, admin |
| POST | `/patients` | 🔒 Admin |
| PUT | `/patients/:id` | 🔒 Owner / Admin |
| DELETE | `/patients/:id` | 🔒 Admin |
| PUT | `/patients/:id/assign-doctor` | 🔒 Admin |

### Doctors (Admin)
`GET/POST/PUT/DELETE /doctors`

### Users and Diseases
| Method | Route | Access |
|---|---|---|
| GET | `/users?search=` | 🔒 Admin |
| PUT | `/users/:id` | 🔒 Admin (name, email, phone, active state only) |
| DELETE | `/users/:id` | 🔒 Admin (soft delete) |
| GET | `/diseases` | 🔒 Any |
| POST / PUT / DELETE | `/diseases` and `/diseases/:id` | 🔒 Admin |

Patient list responses include `{ patients, page, limit, totalPatients, totalPages }`; page size is capped at 50. Search supports patient name, email, or an exact patient ID. Patient, doctor, and user deletes deactivate records rather than removing them.

### Phase 5 test cases
1. Unauthenticated requests to `/patients`, `/doctors`, `/users`, and `/diseases` return `401`.
2. A patient lists and reads their own profile, but cannot read another patient's ID (`403`).
3. A doctor lists only assigned patients and can read an assigned patient.
4. A doctor opening a patient assigned to another doctor receives `403` from `GET /patients/:id`.
5. A patient, doctor, or other non-admin attempting patient creation, doctor CRUD, user administration, or doctor assignment receives `403`.
6. Admin creates a patient and a doctor; each generated account has the correct role, and responses never contain password data.
7. Pagination defaults safely, caps `limit` at 50, and reports correct `totalPatients` and `totalPages` across 50+ patients.
8. Patient search matches name, email, and exact patient ID; disease and status filters combine with search and doctor ownership.
9. Admin assigns and reassigns a valid doctor; assigning an unknown doctor returns `400`; sending an empty `doctorId` unassigns the doctor.
10. Patient profile updates accept only the allowed user/profile fields; doctors cannot edit patient profiles and non-admins cannot alter status.
11. Deleting a patient sets status to inactive without removing the user or patient record; deleting a doctor/user disables the account.
12. Disease read is available to all authenticated roles; only admin can create, update, or delete diseases, and an in-use disease cannot be deleted.
13. Invalid IDs and invalid status values return `400`; duplicate emails and disease names return `409`.

### Health Records
| Method | Route | Access |
|---|---|---|
| POST | `/health-records` | 🔒 Patient |
| GET | `/health-records?patientId=&from=&to=&page=&limit=` | 🔒 Owner / assigned doctor |
| GET | `/health-records/latest/:patientId` | 🔒 Owner / assigned doctor |
| GET | `/health-records/:id` | 🔒 Owner / assigned doctor |
| PUT | `/health-records/:id` | 🔒 Owner |
| DELETE | `/health-records/:id` | 🔒 Owner / Admin |

### Alerts, Medications, Appointments, Notes, Notifications
Standard CRUD: `GET/POST/PUT/DELETE` on `/alerts`, `/medications`, `/appointments`, `/notes`. Plus `GET /notifications`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`.

### Dashboards
| Method | Route | Access |
|---|---|---|
| GET | `/dashboard/patient` | 🔒 Patient |
| GET | `/dashboard/doctor` | 🔒 Doctor |
| GET | `/dashboard/admin` | 🔒 Admin |

---

## 6. Folder Structure

```
chronic-care-monitoring/
├── README.md
├── backend/
│   ├── config/            db.js, thresholds.js
│   ├── controllers/       auth, patient, doctor, health, alert, medication, appointment, note, notification, dashboard
│   ├── models/            User, Patient, Doctor, HealthRecord, Alert, Medication, MedicationLog, Appointment, Notification, Note, Disease
│   ├── routes/
│   ├── middleware/        authMiddleware.js, roleMiddleware.js, ownershipMiddleware.js, errorMiddleware.js, validate.js
│   ├── utils/             generateToken.js, alertEngine.js, asyncHandler.js, seed.js
│   ├── server.js
│   └── .env.example
└── frontend/
    └── src/
        ├── components/    Navbar, Sidebar, Card, Modal, Table, Pagination, Chart, Loader, EmptyState
        ├── pages/         auth/, patient/, doctor/, admin/
        ├── services/      api.js (+ one file per resource)
        ├── context/       AuthContext.jsx
        ├── hooks/
        ├── routes/        ProtectedRoute.jsx, AppRoutes.jsx
        ├── App.jsx
        └── main.jsx
```

---

## 7. How to Use the AI Prompts

1. Create the repo and put this README in the root. **Keep it open in VS Code** so Copilot can use it as context (or attach it with `#file:README.md` in Copilot Chat).
2. Start every new chat session by pasting the **Master Context Prompt** below.
3. Work **one phase at a time**. Paste the phase prompt, review the generated code, run it, test it, then commit.
4. Do not move to the next phase until the **Acceptance Checklist** of the current one passes.
5. If something breaks, paste the exact error message and the relevant file back to the AI. Do not ask it to "fix everything."
6. Commit after every phase: `git commit -m "Phase 4: authentication complete"`.

### Master Context Prompt (paste at the start of every session)

```text
You are a senior MERN stack developer helping me build a "Chronic Disease Remote Monitoring Dashboard" as a student/portfolio project.

Stack: React (Vite) + React Router DOM + Axios + React Hook Form + Tailwind CSS + Recharts on the frontend; Node.js + Express + Mongoose + JWT + bcrypt on the backend; MongoDB database.

Roles: patient, doctor, admin.
Collections: users, patients, doctors, healthRecords, alerts, medications, medicationLogs, appointments, notifications, notes, diseases.

Rules you must always follow:
1. Use ES modules (import/export), async/await, and a central error-handling middleware.
2. Follow the folder structure in README.md exactly. Do not invent new top-level folders.
3. Never store plain-text passwords. Never return password hashes in responses.
4. Never trust the client for role or ownership. Enforce authorization in the backend.
5. Validate all input. Return consistent JSON: { success, message, data } and proper HTTP status codes.
6. Never log sensitive patient data with console.log.
7. This app does not diagnose or prescribe. Alert thresholds are demo values stored in config/thresholds.js and must be labelled as such in the UI.
8. Write clean, commented, beginner-readable code. Explain briefly what you created and how to test it.
9. Only build what the current phase asks for. Do not skip ahead.

Confirm you understand, then wait for the phase prompt.
```

---

## 8. Phase-wise Build Prompts

---

### Phase 1 — Project Planning

**Goal:** Requirements, wireframes, DB design, API list. No code.

**Prompt**
```text
Phase 1: Planning only. Do not write application code.

Based on README.md, produce:
1. A requirements document: functional requirements per role (patient, doctor, admin) and non-functional requirements (security, performance, usability).
2. User stories in the format "As a <role>, I want <goal> so that <benefit>" with acceptance criteria, grouped by module (Auth, Patients, Health Records, Alerts, Medications, Appointments, Dashboards).
3. Text/ASCII wireframes for: Login, Register, Patient Dashboard, Add Reading form, Health History, Doctor Dashboard, Patient Details page, Admin Dashboard.
4. An entity-relationship overview of all collections with fields, types, and references.
5. A table of API endpoints (method, route, role, request body, response).
6. A list of risks and open questions.

Save this as docs/PLANNING.md.
```

**Acceptance Checklist**
- [ ] Every feature in Section 1 maps to at least one user story
- [ ] Every user story maps to at least one API endpoint
- [ ] Wireframes exist for every page in the route list

---

### Phase 2 — Project Setup

**Goal:** Repo, folders, dependencies, tooling.

**Prompt**
```text
Phase 2: Project setup.

1. Create the monorepo structure from README.md section 6 with empty placeholder files where needed.
2. Backend: initialize npm with "type": "module"; install express mongoose dotenv cors helmet morgan bcryptjs jsonwebtoken express-validator express-rate-limit; install nodemon as a dev dependency; add "dev" and "start" scripts.
3. Frontend: create a Vite + React app; install react-router-dom axios react-hook-form recharts; install and configure Tailwind CSS.
4. Create .gitignore files (node_modules, .env, dist) and backend/.env.example with: PORT, MONGO_URI, JWT_SECRET, JWT_EXPIRES_IN, CLIENT_URL.
5. Give me the exact terminal commands in order and the final package.json for both apps.
```

**Acceptance Checklist**
- [ ] `npm run dev` runs in both folders without errors
- [ ] Tailwind classes render in the Vite app
- [ ] `.env` is git-ignored; `.env.example` is committed

---

### Phase 3 — Backend Foundation

**Goal:** Express server, DB connection, env config, error handling, base middleware.

**Prompt**
```text
Phase 3: Backend foundation.

Create:
1. config/db.js: connect to MongoDB using MONGO_URI with clear success/failure logging (no secrets in logs).
2. server.js: Express app with express.json (with a body size limit), helmet, cors (origin from CLIENT_URL), morgan (dev only), a global rate limiter, GET /api/health returning { success: true, message: "API running" }, and a 404 handler.
3. middleware/errorMiddleware.js: central error handler that returns consistent JSON, handles Mongoose validation errors, duplicate key errors, invalid ObjectId (CastError), and JWT errors; hides stack traces in production.
4. utils/asyncHandler.js to wrap async controllers.
5. Graceful startup: do not start listening until the DB connects.

Explain how to test with Postman.
```

**Acceptance Checklist**
- [ ] `GET /api/health` returns 200
- [ ] Unknown route returns a JSON 404
- [ ] Server exits with a clear message when MONGO_URI is wrong

---

### Phase 4 — Authentication & Authorization

**Goal:** Register, login, JWT, protected routes, role-based access.

**Prompt**
```text
Phase 4: Authentication and authorization.

Backend:
1. models/User.js with the schema from README.md (password select:false, email unique and lowercase, pre-save bcrypt hashing with 10+ salt rounds, comparePassword method).
2. utils/generateToken.js: sign a JWT containing userId and role, expiry from env.
3. controllers/authController.js:
   - register: PATIENT ONLY. Ignore any "role" in the request body. Create the user and an empty patient profile.
   - login: generic error message "Invalid email or password" for both wrong email and wrong password. Reject inactive users.
   - getProfile
   - changePassword (requires current password)
4. middleware/authMiddleware.js (protect): read Bearer token, verify, load the user, attach req.user, return 401 on failure.
5. middleware/roleMiddleware.js: authorizeRoles(...roles) returning 403 when not allowed.
6. middleware/validate.js with express-validator rules for register/login (name, email format, password min 8 with letters and numbers).
7. routes/authRoutes.js with a stricter rate limiter on /login and /register.
8. utils/seed.js: create 1 admin, 2 doctors, and 5 patients with FAKE data, plus a few diseases (Diabetes, Hypertension, Heart Disease, Asthma). Passwords from env or a documented demo value.

Frontend (minimal):
9. services/api.js: Axios instance with baseURL from import.meta.env.VITE_API_URL and a request interceptor adding the Bearer token; a response interceptor that logs out on 401.
10. context/AuthContext.jsx with login, logout, register, user, loading state; restore session on refresh.
11. routes/ProtectedRoute.jsx with an allowedRoles prop; redirect unauthenticated users to /login and unauthorized users to a /unauthorized page.
12. Login.jsx and Register.jsx using React Hook Form with validation and error display; redirect by role after login (/patient/dashboard, /doctor/dashboard, /admin/dashboard) with placeholder dashboard pages.

Give me a Postman test list including negative tests (no token, wrong role, tampered token, role injection in register).
```

**Acceptance Checklist**
- [ ] Passwords are hashed in MongoDB Compass
- [ ] Registering with `"role": "admin"` still creates a patient
- [ ] Protected routes return 401 without a token and 403 for the wrong role
- [ ] Login redirects to the correct dashboard per role
- [ ] Refreshing the page keeps the user logged in

---

### Phase 5 — Patient Module

**Goal:** Patient profile CRUD, doctor assignment, search, pagination, ownership checks.

**Prompt**
```text
Phase 5: Patient and doctor management.

Backend:
1. Models: Patient, Doctor, Disease (schemas from README.md, with indexes on userId, doctorId, disease).
2. middleware/ownershipMiddleware.js: a reusable check that allows (a) a patient accessing only their own patient record, (b) a doctor accessing only patients assigned to them, (c) admin accessing all. Return 403 otherwise.
3. patientController + routes per the API table:
   - GET /patients with server-side pagination (page, limit max 50), search (name, email, patient id), filter by disease and status; response shape { patients, page, limit, totalPatients, totalPages }. Doctors only see their assigned patients.
   - GET /patients/:id, POST (admin creates user + patient together), PUT (whitelist updatable fields), DELETE (soft delete via status/isActive), PUT /patients/:id/assign-doctor (admin; verify doctor exists).
4. doctorController + routes (admin CRUD; creating a doctor creates the user with role "doctor").
5. diseaseController + routes (admin CRUD; read for all authenticated users).
6. Use .select() and .lean() where appropriate; never return password data.

Frontend:
7. Patient Profile page (view/edit) using React Hook Form.
8. Doctor "My Patients" page: search box with debounce, disease and status filters, table, and a reusable Pagination component.
9. Admin pages: Users, Doctors, Patients lists with create/edit/delete modals and an "Assign Doctor" dropdown.
10. Reusable components: Table, Pagination, Modal, Loader, EmptyState.

List the test cases, including a doctor trying to open a patient who is not assigned to them (must be 403).
```

**Acceptance Checklist**
- [ ] Pagination metadata is correct for 50+ seeded patients
- [ ] A doctor cannot read another doctor's patient (403)
- [ ] Admin can assign and reassign a doctor
- [ ] Deleting a patient is a soft delete

---

### Phase 6 — Health Monitoring

**Goal:** Health records create/read/history with validation and ownership.

**Prompt**
```text
Phase 6: Health monitoring.

Backend:
1. models/HealthRecord.js per README.md with index { patientId: 1, recordedAt: -1 }. All measurement fields optional individually, but at least one must be present.
2. Validation ranges (plausibility checks for data quality, NOT diagnosis): systolic 50-250, diastolic 30-150, bloodSugar 20-800 mg/dL, heartRate 20-250, weight 1-500 kg, oxygenLevel 50-100. Systolic must be greater than diastolic. recordedAt cannot be in the future.
3. healthController + routes:
   - POST /health-records (patient only; patientId derived from the logged-in user, never from the body)
   - GET /health-records with filters from, to, patientId, pagination, sorted by recordedAt desc (patients see own; doctors see assigned patients only)
   - GET /health-records/latest/:patientId
   - GET /health-records/:id, PUT (owner, only within 24 hours of creation), DELETE (owner/admin)
4. GET /health-records/summary/:patientId?days=7|30 returning per-measurement min, max, average, count, and a simple trend label (improving/stable/needs review) based on clearly documented project rules in utils/trendRules.js.

Frontend:
5. "Add Reading" form with React Hook Form: systolic, diastolic, blood sugar, heart rate, weight, date/time, notes; inline error messages; success toast; show a note that validation is not a diagnosis.
6. Health History page: table with date range filter and pagination, edit/delete actions.

Provide Postman tests, including out-of-range values and a patient trying to post for another patient.
```

**Acceptance Checklist**
- [ ] Invalid ranges return 400 with field-level messages
- [ ] Patient cannot create or read another patient's records
- [ ] Latest and summary endpoints return correct values for seeded data

---

### Phase 7 — Alerts & Notifications

**Goal:** Threshold-based alerts, severity, alert lifecycle, in-app notifications.

**Prompt**
```text
Phase 7: Alerts and notifications.

Backend:
1. config/thresholds.js: example/demo thresholds per measurement with low/medium/high/critical bands. Add a top-of-file comment: "DEMO THRESHOLDS ONLY - not clinically validated."
2. utils/alertEngine.js: a pure function evaluateRecord(record, thresholds) returning an array of { type, severity, message } with neutral wording such as "Blood sugar reading outside demo range - needs clinical review". Never use diagnostic language.
3. After a health record is created, run the engine; create Alert documents (include doctorId from the patient's assignment) and Notification documents for the assigned doctor (and the patient for high/critical). Do not fail the record creation if alert creation fails; log a non-sensitive error.
4. models: Alert, Notification, Note. Controllers + routes:
   - GET /alerts (filters: severity, status, patientId; pagination; role-scoped)
   - POST /alerts (doctor manual alert for an assigned patient)
   - PUT /alerts/:id (status: unread -> acknowledged -> resolved, doctor/admin)
   - DELETE /alerts/:id (admin)
   - GET/POST /notes (doctor adds notes/recommendations; patient can read their own)
   - GET /notifications, PUT /notifications/:id/read, PUT /notifications/read-all
5. Unit tests for alertEngine covering boundaries.

Frontend:
6. Notification bell in Navbar with unread count and dropdown; polling every 30 seconds for now.
7. Alerts page for patient (read-only) and doctor (filter by severity/status, acknowledge/resolve, create manual alert).
8. Doctor notes/recommendations panel; patient "Doctor Recommendations" section.
9. Severity badges with consistent colors (low, medium, high, critical).

Explain how to test by posting a high reading and verifying the doctor sees an alert and a notification.
```

**Acceptance Checklist**
- [ ] Posting an out-of-range reading creates an alert and notification
- [ ] Threshold boundary tests pass
- [ ] Doctor can acknowledge and resolve alerts only for assigned patients
- [ ] No alert text sounds like a diagnosis

---

### Phase 8 — Doctor Dashboard

**Goal:** Statistics, patient list with latest status, patient details with charts.

**Prompt**
```text
Phase 8: Doctor dashboard.

Backend:
1. GET /dashboard/doctor using MongoDB aggregation, returning: totalPatients, activePatients, needsAttention (patients with unresolved high/critical alerts), criticalAlerts count, recentAlerts (latest 5), readingsStatusBreakdown (normal/warning/critical counts for the last 7 days).
2. GET /patients/:id/overview returning profile, latest reading, 30-day summary, unresolved alerts, notes, active medications, and medication adherence percentage (from medicationLogs).
3. Optimize with indexes; avoid N+1 queries.

Frontend (Tailwind, responsive):
4. DoctorDashboard.jsx: stat cards (Total Patients, Active, Needs Attention, Critical Alerts), a patient table with columns Patient, Disease, Latest Reading, Status badge, and a search bar with disease/status/alert-severity filters, plus a donut chart of normal/warning/critical readings.
5. PatientDetails.jsx (/doctor/patients/:id): profile card; separate Recharts LineCharts for blood sugar, blood pressure (two lines), heart rate, weight; 7-day/30-day/90-day range toggle; recent alerts list; notes/recommendations form; medication adherence bar chart.
6. Create a reusable Chart component that accepts data, dataKey(s), title, unit, and renders loading and empty states.

Make sure charts handle missing values gracefully (gaps, not zeros).
```

**Acceptance Checklist**
- [ ] Dashboard numbers match data in MongoDB Compass
- [ ] Charts render for 7/30/90 days and handle empty data
- [ ] Layout works at mobile width

---

### Phase 9 — Patient Dashboard, Medication & Appointments

**Goal:** Patient-facing summary, medication tracking, appointments, reminders.

**Prompt**
```text
Phase 9: Patient dashboard, medications, appointments.

Backend:
1. Models: Medication, MedicationLog, Appointment. Routes per the API list.
   - Medications are entered by doctors (or admin) as part of their recommendations; patients can view them and log doses (POST /medications/:id/log with status taken/missed/skipped). The app does not suggest or calculate medication or dosage.
   - Appointments: doctor/admin create, patient can view and cancel their own; prevent double-booking the same doctor and time.
2. GET /dashboard/patient returning latest readings, 7-day summary, unread alerts count, active medications with today's status, next appointment, latest doctor recommendation.
3. Reminders: a node-cron job (or a simple interval for the demo) that creates in-app notifications for (a) appointments in the next 24 hours and (b) medication doses not yet logged today. Make sure it does not create duplicate reminders.

Frontend:
4. PatientDashboard.jsx: stat cards (latest BP, sugar, heart rate, weight), a trend line chart with a measurement selector, recent measurements table, alerts preview, today's medication checklist with "Mark as taken," next appointment card.
5. Medications page (list, history, adherence bar chart) and Appointments page (upcoming/past, cancel).
6. Patient Profile and Alerts pages polished.

Test: log doses, miss some, and verify the doctor's adherence percentage updates.
```

**Acceptance Checklist**
- [ ] Patient can log doses and the doctor sees adherence change
- [ ] Double booking is rejected
- [ ] Reminders are created once, not repeatedly

---

### Phase 10 — Admin Dashboard & UI/UX Polish

**Goal:** Admin statistics, consistent UI, accessibility, responsiveness.

**Prompt**
```text
Phase 10: Admin dashboard and UI/UX polish.

1. GET /dashboard/admin: total users by role, patients per doctor, patients per disease, alerts by severity/status, readings submitted per day (last 14 days).
2. AdminDashboard.jsx with stat cards and Recharts (bar, pie/donut, line); admin screens for managing alerts and diseases.
3. App shell: responsive Sidebar (collapsible on mobile) with role-based menu items, Navbar with user menu and notification bell.
4. Consistency pass across all pages: loading skeletons/spinners, empty states with helpful text, error states with retry buttons, toast notifications, confirm dialogs for destructive actions, disabled buttons while submitting.
5. Accessibility: labels for inputs, focus states, keyboard-friendly modals, sufficient color contrast, and never rely on color alone for severity (add icon/text).
6. Add a visible "Demo application - not for medical use" banner/footer.

List every page you changed and anything left inconsistent.
```

**Acceptance Checklist**
- [x] Data-driven pages provide loading and empty states, with retry controls for fetch errors
- [x] App is usable at a 375px viewport without horizontal overflow; mobile navigation opens and closes
- [x] Demo disclaimer is visible on authenticated application pages

Implementation details and API response shape: [Admin dashboard and UI polish](./docs/ADMIN-DASHBOARD-UI-POLISH.md).

---

### Phase 11 — Testing & Security Hardening

**Goal:** Automated tests, security review, bug fixing.

**Prompt**
```text
Phase 11: Testing and security hardening.

1. Backend tests with Jest + Supertest and mongodb-memory-server:
   - Auth: register (role injection ignored), login, wrong password, inactive user, token expiry
   - Authorization matrix: for each endpoint, test patient/doctor/admin/no-token and own vs other patient's data
   - Health records: validation ranges, ownership, pagination
   - Alert engine boundaries and alert creation on record save
   - Search, filters, pagination
2. Frontend tests with Vitest + React Testing Library for: login form validation, ProtectedRoute redirects, Add Reading form errors.
3. Security review of the codebase. Check and fix: NoSQL injection (sanitize query operators, e.g. express-mongo-sanitize), mass assignment (whitelist fields), IDOR (every :id route checks ownership), rate limiting, helmet configuration, CORS restricted to CLIENT_URL, JWT secret strength and expiry, error messages that leak internals, sensitive data in logs, password change invalidation strategy.
4. Add audit logging: an AuditLog model recording who did what (login, create/update/delete on patients, records, alerts) with timestamp and IP, but never storing medical values or passwords.
5. Output a SECURITY.md summarizing what was implemented and known limitations.

Report all bugs found and the fixes applied.
```

**Acceptance Checklist**
- [ ] All tests pass in CI/locally
- [ ] Authorization matrix has no unexpected 200s
- [ ] No sensitive data in logs or URLs

---

### Phase 12 — Deployment

**Goal:** Production-ready configuration and hosting.

**Prompt**
```text
Phase 12: Deployment.

1. Prepare production configuration: environment-based settings, MongoDB Atlas connection string, strong JWT_SECRET, CORS restricted to the deployed frontend URL, helmet, trust proxy setting, rate limits, secure cookie/HTTPS notes.
2. Frontend: VITE_API_URL per environment; build with `npm run build`; add an SPA fallback rule so React Router paths work on refresh.
3. Backend deployment steps for Render or Railway; frontend deployment steps for Vercel or Netlify. Provide exact settings (build command, start command, root directory, env vars).
4. MongoDB Atlas setup: create a cluster, a DB user with least privilege, network access rules, and backups note.
5. Add a GitHub Actions workflow that installs dependencies, runs tests, and builds the frontend on every push.
6. Create a seed script usage guide for demo data (fake patients only) and a post-deployment checklist: health endpoint, login for each role, create reading, alert generated, charts render, HTTPS enforced.
7. Update README with live URLs, demo credentials (fake), screenshots (fake data only), and setup instructions.

Make sure no secrets are committed; list any file I should double-check.
```

**Acceptance Checklist**
- [ ] Live frontend talks to the live backend with no CORS errors
- [ ] Refreshing any route works
- [ ] No secrets in the Git history
- [ ] CI pipeline passes

---

## 9. Security Checklist

- [ ] Passwords hashed with bcrypt, never returned in API responses
- [ ] JWT secret is long and random, stored only in environment variables
- [ ] Role-based authorization **and** ownership checks on every protected route
- [ ] Input validation and sanitization on all endpoints
- [ ] Rate limiting (stricter on login/register)
- [ ] `helmet` and a restricted CORS origin
- [ ] HTTPS in production
- [ ] Audit logging without sensitive medical values
- [ ] No sensitive data in `console.log`, URLs, screenshots, or Git
- [ ] Fake data only in demos and portfolio material

---

## 10. Advanced Features (After MVP)

Each can be done as its own mini-phase with the Master Context Prompt.

**A. Real-time monitoring (Socket.IO)**
```text
Add Socket.IO to the backend with JWT-authenticated socket connections. Each doctor joins a private room. When a patient submits a reading that triggers an alert, emit "alert:new" to the assigned doctor's room only. On the frontend, update the notification bell and the Doctor Dashboard live without polling. Verify that a doctor can never receive another doctor's events.
```

**B. Trend visualization**
```text
Add 7-day and 30-day trend indicators (Improving / Stable / Needs Review) per measurement, calculated by documented rules in utils/trendRules.js (for example, comparing the average of the latest half of the period to the earlier half). Show them as badges on the doctor patient list. Never use diagnostic wording.
```

**C. More measurements**
```text
Add temperature and oxygen saturation (and optionally cholesterol, steps, sleep) to the HealthRecord model, validation, alert thresholds, forms, and charts without breaking existing records.
```

**D. Email reminders**
```text
Add optional email notifications with Nodemailer for appointment reminders, with an opt-in setting per user and no medical values in the email body.
```

**E. Export**
```text
Add a doctor feature to export a patient's last 30 days of readings as CSV/PDF, restricted to assigned patients and recorded in the audit log.
```

**F. Device integration (future)**
Manual entry first. Later: a device/mobile app posts readings to a dedicated authenticated ingestion endpoint.

---

## 11. Definition of Done

- [ ] All three roles can log in and see only what they are allowed to
- [ ] Patients can record readings, view history, charts, alerts, medications, and appointments
- [ ] Doctors can search patients, view trends, handle alerts, and add notes
- [ ] Admin can manage users, doctors, patients, diseases, assignments, and view stats
- [ ] Alerts are generated from demo thresholds and clearly labelled as such
- [ ] Pagination, search, and filters work
- [ ] UI is responsive with loading, empty, and error states
- [ ] Tests pass and the security checklist is complete
- [ ] Deployed, with fake demo data and documented setup

---

## Tips for Working with Copilot / AI Tools

- Keep prompts **scoped to one phase**; paste the Master Context Prompt in new sessions.
- Ask the AI to **list the files it will change** before generating code.
- After generation, ask: *"Review this code for security issues, missing validation, and authorization gaps."*
- Run and test each phase before moving on; commit often.
- Paste exact error messages and the relevant file, not just "it doesn't work."
- Understand every file you keep. This is a learning project, and you should be able to explain it in an interview.
