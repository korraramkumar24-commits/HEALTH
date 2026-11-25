# Health monitoring

Health records belong to a `Patient` document and are indexed by
`{ patientId: 1, recordedAt: -1 }`. Measurement fields are optional
individually, but a record must contain at least one measurement.

## API

All endpoints are under `/api/health-records` and require a bearer token.

| Method and path | Access |
| --- | --- |
| `POST /` | Patient only. The API looks up the patient from the authenticated user; a supplied `patientId` is rejected. |
| `GET /?from=&to=&patientId=&page=1&limit=10` | Patients see only themselves; doctors see only assigned patients; admins may see all. Sorted newest `recordedAt` first. `limit` is capped at 50. |
| `GET /latest/:patientId` | Patient owner, assigned doctor, or admin. |
| `GET /:id` | Patient owner, assigned doctor, or admin. |
| `PUT /:id` | Patient owner, within 24 hours of record creation. |
| `DELETE /:id` | Patient owner or admin. |
| `GET /summary/:patientId?days=7` | Patient owner, assigned doctor, or admin. `days` must be 7 or 30. |

Each measurement is validated as a data-quality plausibility check, not a
diagnostic range: systolic 50–250, diastolic 30–150, blood sugar 20–800 mg/dL,
heart rate 20–250, weight 1–500 kg, oxygen level 50–100. When both blood
pressure measurements are present, systolic must be greater than diastolic.
`recordedAt` cannot be in the future.

List responses contain `records`, `page`, `limit`, `totalRecords`, and
`totalPages`. Summary responses contain a `summary` object keyed by measurement,
with `min`, `max`, `average`, `count`, and `trend`.

## Trend labels

`utils/trendRules.js` defines the project-only trend convention. Values are
compared from the earliest to latest observation in the requested date window.
The percentage change is `(latest - earliest) / max(abs(earliest), abs(latest), 1)`.
A change of 5% or less in magnitude is `stable`; a larger decrease is `improving`
for systolic, diastolic, blood sugar, heart rate, and weight; a larger increase
is `improving` for oxygen level. Movement in the opposite direction is `needs
review`. Missing values return `needs review`. This fixed numeric convention is
not clinically validated and must not be interpreted as a diagnosis, risk
assessment, target, or treatment recommendation.

## Postman

Import [health-monitoring.postman_collection.json](./health-monitoring.postman_collection.json).
Configure `baseUrl`, `patientToken`, `doctorToken`, `adminToken`, `patientId`,
and `otherPatientId` as collection variables. Run the requests in order; the
first successful patient create request saves its resulting ID as `recordId`.
The negative cases assert out-of-range rejection, rejection of a forged
`patientId`, and doctor access denial for an unassigned patient.

Health readings also generate review alerts using the demo-only rules described
in [ALERTS-NOTIFICATIONS.md](./ALERTS-NOTIFICATIONS.md).
