# Security controls and known limitations

This project is a demonstration health application, not a medical device or a
production-ready health-record service. Do not use it to make clinical
decisions or store real patient information.

## Implemented controls

- **Authentication:** passwords are hashed with bcrypt. JWTs require a
  sufficiently strong secret at server startup, expire, and carry a token
  version checked against the user's current version. Changing a password
  increments the version and invalidates previously issued access tokens.
- **Authorization:** route role guards and controller ownership/doctor
  assignment checks scope patient, health-record, alert, and related data.
  Patient registration ignores role injection, and update handlers whitelist
  editable fields.
- **Request hardening:** Helmet, request rate limits, Mongo query sanitization,
  restricted CORS, validated proxy-hop configuration, and input validation are
  configured. Production startup requires an HTTPS `CLIENT_URL`.
- **Error handling and logs:** API errors do not expose stack traces; HTTP
  access logs omit request URLs/query strings. Audit-write failures are logged
  without request or medical data and do not block product operations.
- **Audit trail:** audit events include actor, action, resource type and ID,
  IP address, and timestamp. They do not include medical measurements,
  credentials, or profile values.
- **Demo seeding:** production seeding is disabled unless explicitly enabled;
  enabled seeding requires a configured `DEMO_PASSWORD` of at least 12
  characters. No built-in demo password is used.

## Security review findings and remediation

| Original severity | Finding | Remediation |
|---|---|---|
| HIGH | Startup demo seeding used a known fallback password, including in production. | Removed the fallback; production seeding now requires explicit enablement and a configured password. |
| MEDIUM | Password changes did not invalidate already-issued JWTs. | Added a token version to JWTs and users; the middleware checks it and password changes increment it. |

Both findings were patched and covered by tests.

## Verification

- Backend built-in tests: `cd backend; npm test`
- Backend API tests: `cd backend; npm run test:jest`
- Frontend tests: `cd frontend; npm test`
- Frontend production build: `cd frontend; npm run build`
- Frontend lint: `cd frontend; npm run lint`
- Dependency audit: `npm audit` from each package directory.

At the latest verification, backend tests passed (20 built-in and 17
Jest/Supertest), frontend tests passed (6), the frontend build passed, and
lint completed with three warnings. Frontend dependency audit reported no
advisories. Backend production dependency audit reported no advisories; the
full backend audit reported 22 advisories in development dependencies,
including the transitive `braces` and `sprintf-js` advisories. The package
registry exposed no patched releases for these transitive packages at review
time; the suggested `jest`/`nodemon` fixes are major-version downgrades, so
they were not applied. Recheck and update these development dependencies when
compatible fixed releases become available.

## Known limitations

- The automated authorization tests cover representative roles, ownership,
  and cross-doctor access, but do not exhaustively enumerate every role and
  endpoint combination.
- Audit writes are best-effort and there is no retention, archival, or
  tamper-evident audit-log policy.
- Access tokens are bearer tokens. Password changes invalidate them, but
  there is no refresh-token or general-purpose session-revocation workflow.
- Deployment security still depends on HTTPS termination, database network
  access and encryption, secret management, backups, monitoring, and
  operational access controls being configured correctly.
- Demo measurement thresholds and validation checks are not clinically
  validated and must not be treated as diagnostic guidance.
- The project has not undergone an independent penetration test or formal
  privacy/compliance assessment.
