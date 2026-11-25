# CareHub Demo

A demonstration patient-care application for fake data only. **Not for medical
use, diagnosis, treatment, or storage of real patient information.**

## Project status

- Live frontend URL: **Not deployed yet**
- Live API URL: **Not deployed yet**
- Screenshots: add only screenshots populated with fake demo data after
  deployment; none are included yet.

The repository does not contain deployed URLs or a shared demo password.
Configure deployment-specific values in the hosting provider. Never commit
credentials, patient data, or secrets.

## Local setup

Requirements: Node.js 22 and a reachable MongoDB deployment or local MongoDB.

1. Install backend dependencies and create a private backend `.env` from
   `backend/.env.example`.
2. Set `MONGO_URI` to the MongoDB connection string, `JWT_SECRET` to a unique
   random secret of at least 32 characters, and `DEMO_PASSWORD` to a unique
   random password of at least 12 characters. A local example can be generated
   with:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

3. Start MongoDB, then run:

   ```sh
   cd backend
   npm ci
   npm run dev
   ```

4. In another terminal, copy `frontend/.env.example` to a private
   `frontend/.env.local`, set `VITE_API_URL=http://localhost:5000/api`, then:

   ```sh
   cd frontend
   npm ci
   npm run dev
   ```

The API health endpoint is `http://localhost:5000/api/health`. The frontend
development server is normally `http://localhost:5173`.

### Visual theme

The frontend uses a dark slate interface (`#0F172A` page background and
`#1E293B` surfaces), cyan (`#06B6D4`) for primary actions and highlights, and
emerald (`#10B981`) for success states. Shared Tailwind color tokens and dark
form/chart styling are defined in `frontend/src/index.css`; chart accents are
defined in `frontend/src/components/Chart.jsx`. Warning and alert severity
colors remain distinct from the primary action color.

### Offline monitoring and emergency support

- Patient readings created without a network are kept in a bounded
  IndexedDB outbox and automatically submitted when connectivity returns and
  the app is open. An idempotency key prevents a retry from creating duplicate
  records/measurement alerts. Rejected entries stay on-device for review and
  can be removed from Health History.
- The app shell is cached by a service worker in production. On the Emergency
  Contacts page, wait until it reports **“Offline app shell is ready”** before
  relying on refresh while offline. The Vite development server does not cache
  offline routes. Locally, run `npm run build` and `npm run preview` from
  `frontend`, open the preview online, then simulate offline mode in browser
  developer tools.
- Offline readings and SOS requests are stored unencrypted in this browser
  profile until sync. Do not use a shared/public device for real health
  information. They are not backed up or shared to other devices.
- The patient SOS creates a critical in-app alert for the assigned doctor;
  when no doctor is assigned, it is recorded but there is no recipient to
  notify. If offline, the alert stays queued and the UI explicitly says it has
  **not** been sent. The system does not dispatch emergency services or send
  SMS. A doctor notification is an in-app notification and requires network
  delivery. Call/text buttons open the device's dialer or messaging app and
  still need a working service connection.
- Exact location is optional and requested only after a user checks the
  location-sharing option and presses SOS. The SOS coordinates are sent on
  synchronization and visible in scoped alerts to that patient, the assigned
  doctor, and admins. A location older than 24 hours at server receipt is
  omitted. Searching for nearby workers also asks for location on button
  press; that query is sent to the app server once and is not stored by that
  lookup. Opening the external OpenStreetMap link shares coordinates with
  OpenStreetMap.
- The nearby community health worker directory is curated by admins at
  `/admin/community-health-workers`. Only add verified, fake/demo or
  organization-approved contact details and approximate service coordinates.
  There is no automatic worker registration, background tracking, or
  guarantee that a listed person is currently available.
- English and Telugu controls are available in the authenticated navigation.
  Telugu translation currently covers navigation and key patient dashboard,
  health-entry, emergency SOS, contact, and nearby-worker strings. Other
  application screens may remain in English.
- Low-data mode and the operating system's reduced-motion preference disable
  decorative backgrounds, transitions, and animations. The existing doctor
  dashboard and assigned-patient routes continue to provide remote readings
  and review. Measurement alerts remain demo rules, not clinical assessment.

Test the safeguards locally:

```sh
cd backend
npm test
npm run test:jest

cd ../frontend
npm test
```

The frontend tests cover local contact storage, queued offline SOS messaging,
outbox idempotency/retry behavior, and English/Telugu and low-data preferences.

### Fake demo accounts

When demo seeding is enabled, it creates fake accounts for:

| Role | Email |
|---|---|
| Admin | `admin@carehub.demo` |
| Doctor | `doctor1@carehub.demo` |
| Doctor | `doctor2@carehub.demo` |
| Patient | `patient1@carehub.demo` through `patient5@carehub.demo` |

Newly seeded accounts use the configured `DEMO_PASSWORD`. This repository
does not publish or prescribe a shared password. Set a unique value yourself
and share it only with intended demo users through a private channel. Changing
`DEMO_PASSWORD` later does not change passwords on accounts that already
exist; use the application's password-change flow or recreate the disposable
demo database.

## Production environment and security

The backend reads environment variables at startup; do not put production
values into committed `.env` files or source code.

| Variable | Required value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Set by Render/Railway; the server defaults to `5000` locally. |
| `MONGO_URI` | Atlas `mongodb+srv://...` connection string for the application DB. URL-encode special characters in the DB user's password. |
| `JWT_SECRET` | Unique random secret, minimum 32 characters. Generate one with the Node command above. |
| `JWT_EXPIRES_IN` | Token lifetime accepted by `jsonwebtoken`, e.g. `7d`; choose a shorter lifetime for public deployments as appropriate. |
| `CLIENT_URL` | Exact deployed frontend origin, including `https://`, with no path or trailing slash. CORS allows this origin only. |
| `TRUST_PROXY_HOPS` | Exact number of trusted proxy hops in front of the service. Use `1` for a single provider proxy only when verified for the chosen provider; otherwise configure the correct value. |
| `SEED_DEMO_DATA` | `false` for a private/real deployment. Set `true` only for an explicitly disposable public demo with fake data. |
| `DEMO_PASSWORD` | Required if seeding is enabled; unique, random, at least 12 characters, not a committed value. |

Helmet, JSON payload limits, global and authentication rate limits, and
production origin-restricted CORS are configured in the backend. The application
uses bearer JWTs stored by the frontend in browser local storage; it does **not**
currently issue secure cookies. Serve the frontend and API exclusively over
HTTPS. `withCredentials` in the frontend HTTP client is not evidence of a
cookie-based session. For public deployments, review rate limits and proxy
configuration against the provider's actual network topology.

Generate a production JWT secret without writing it into a file:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

## Deploy the backend

### Render (configured by `render.yaml`)

1. Push this project to a private or public GitHub repository and create a
   Render **Blueprint** for it.
2. Review the `carehub-api` web service settings from `render.yaml`:
   - Root directory: `backend`
   - Build command: `npm ci`
   - Start command: `npm start`
   - Health check path: `/api/health`
   - Runtime: Node.js 22
3. In the service environment, set:
   - `MONGO_URI`: Atlas connection string
   - `CLIENT_URL`: final Vercel/Netlify HTTPS origin (not a URL path)
   - `JWT_SECRET`: Render-generated secret or a separately generated unique
     value of at least 32 characters
   - `JWT_EXPIRES_IN`: `7d` or a shorter chosen lifetime
   - `TRUST_PROXY_HOPS`: verify provider proxy topology; Blueprint default is 1
   - `SEED_DEMO_DATA`: `false`, unless intentionally running a fake-data demo
   - `DEMO_PASSWORD`: only when demo seeding is enabled
4. Deploy and note the assigned HTTPS service URL. Set it as the frontend
   `VITE_API_URL` value with `/api` appended.

Do not enable demo seeding on a service containing real data. The seed routine
creates only the built-in fake demo user profiles and disease categories; it
does not populate fake health readings.

### Railway alternative

Create a Railway service from the GitHub repository and set:

- Root directory: `/backend`
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/api/health`
- Node version: 22 (`NODE_VERSION=22`)
- Variables: `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`,
  `JWT_EXPIRES_IN=7d`, `CLIENT_URL`, `TRUST_PROXY_HOPS` verified for Railway,
  and `SEED_DEMO_DATA=false` (plus `DEMO_PASSWORD` only for a disposable demo).

Generate a Railway public HTTPS domain, then verify it with
`https://<api-domain>/api/health`.

## Deploy the frontend

Both frontend hosting configurations include an SPA fallback so React Router
URLs load on direct navigation and refresh.

### Vercel (configured by `frontend/vercel.json`)

1. Import the repository into Vercel.
2. Set the project root directory to `frontend`; framework preset: Vite.
3. Build command: `npm run build`; output directory: `dist`; install command:
   `npm ci`.
4. Add the environment variable `VITE_API_URL=https://<api-domain>/api` for
   Production (and Preview only if the preview frontend should call a
   non-production API).
5. Deploy and note the assigned HTTPS origin. Set that exact origin in backend
   `CLIENT_URL`, then redeploy/restart the backend.

### Netlify alternative (configured by `frontend/netlify.toml`)

1. Import the repository into Netlify.
2. Base directory: `frontend`; build command: `npm run build`; publish
   directory: `dist`.
3. Set `VITE_API_URL=https://<api-domain>/api` in the site's build environment.
4. Deploy, note the assigned HTTPS origin, and set that exact origin as the
   backend `CLIENT_URL`.

`VITE_API_URL` is embedded at frontend build time. Redeploy the frontend after
changing it. Do not place secrets in any `VITE_*` variable; all are public in
the built browser assets.

## MongoDB Atlas

1. Create an Atlas project and a cluster in a region near the backend service.
2. Create a dedicated database user for this app. Grant only `readWrite` on
   the application database; do not use an Atlas project owner/admin user in
   the application connection string.
3. Add the backend provider's static outbound IP addresses to Network Access
   when the hosting plan supports them. If the provider has no fixed egress,
   use the narrowest provider-supported private networking or outbound-IP
   solution. Avoid `0.0.0.0/0` except for a temporary, isolated demo, and
   remove it promptly.
4. Copy the driver connection string, select the intended database name, and
   store it only as backend `MONGO_URI`. URL-encode special characters in the
   database username/password.
5. Confirm TLS is enabled (Atlas connection strings use TLS by default), and
   enable/configure Atlas backups appropriate to the deployment tier and
   recovery requirements. Test restoration procedures; backups are not a
   substitute for access controls.

## Seed script: fake demo data only

The seed runs during backend startup. In development it requires
`DEMO_PASSWORD`; in production it skips seeding unless `SEED_DEMO_DATA=true`.
The opt-in seed creates fake admin/doctor/patient accounts and disease
categories only. It never creates measurements or real patient records.
Use a disposable database and a unique private demo password. Do not enable
seeding in a production environment with real user data. Existing seeded
accounts are not re-passworded on later starts.

## CI and verification

GitHub Actions runs on every push and pull request using Node.js 22. It runs
backend Node tests, backend Jest/Supertest tests, frontend Vitest tests,
frontend lint, and a production frontend build. The workflow is
`.github/workflows/ci.yml`.

Run the same checks locally:

```sh
cd backend
npm ci
npm test
npm run test:jest

cd ../frontend
npm ci
npm test
npm run lint
npm run build
```

## Post-deployment checklist

- [ ] `https://<api-domain>/api/health` returns HTTP 200.
- [ ] Backend and frontend both use HTTPS; HTTP is redirected/disabled at the
      hosting layer.
- [ ] Register/login works for patient; log in as doctor and admin using
      privately provisioned fake demo accounts (never publish passwords).
- [ ] Backend `CLIENT_URL` exactly matches the frontend HTTPS origin; browser
      console/network show no CORS errors.
- [ ] Create a fake patient reading; verify it appears in history and charts.
- [ ] In a disposable demo, submit a fake reading across a configured demo
      threshold and verify the assigned doctor sees an alert and notification.
- [ ] Open nested routes directly and refresh them (for example `/login` and
      the role dashboard); the SPA fallback serves the app.
- [ ] Verify chart data loads and no real patient data appears in screenshots,
      logs, URLs, or demo accounts.
- [ ] Confirm `SEED_DEMO_DATA=false` unless this is a deliberately seeded
      fake-data demo.
- [ ] Review provider egress/IP allowlists, DB user privileges, backups, and
      recovery access.

## Secret and sensitive-file review

Before pushing/deploying, review:

- `backend/.env` and any `backend/.env.*` local files
- `frontend/.env.local` and any `frontend/.env.*.local` files
- Render/Railway/Vercel/Netlify environment-variable dashboards
- GitHub Actions secrets and the full Git history for previously committed
  credentials
- Atlas database users, connection strings, and Network Access entries
- Screenshots, logs, URLs, and any exported demo data

`.gitignore` excludes `.env` files while retaining `.env.example` templates.
That does not remove secrets already committed to history; rotate any exposed
credential and clean the history if necessary.
