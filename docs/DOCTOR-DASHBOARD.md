# Doctor dashboard

## API

### `GET /api/dashboard/doctor`

Doctor bearer token required. Optional query parameters:

| Parameter | Meaning |
| --- | --- |
| `search` | Patient name, email, or patient ID. |
| `disease` | Disease document ID. |
| `status` | `active` or `inactive`. |
| `alertSeverity` | `low`, `medium`, `high`, or `critical` for a patient's unresolved alerts. |
| `page`, `limit` | Patient-list pagination; limit is capped at 50. |

Returns doctor-assigned patient totals, active count, distinct patients with
unresolved high/critical alerts, unresolved critical-alert count, the latest
five alerts, and reading status counts for the last seven days. Readings are
classified using their attached demo alerts: no alert is normal, low/medium is
warning, and high/critical is critical. This is a demo status grouping, not a
clinical determination. Patient data and alerts are joined in MongoDB
aggregations; no per-patient API lookup loop is used.

### `GET /api/patients/:id/overview?days=7|30|90`

Doctor bearer token required; a doctor may only load an assigned patient. The
response includes the populated profile, latest reading, 30-day measurement
statistics and trend labels, readings for the selected chart range, unresolved
alerts, and recommendations/notes.

Medication models and dose logs have not yet been implemented in this project.
Until that work exists, the endpoint returns `activeMedications: []`,
`medicationAdherence: null`, and `medicationTrackingAvailable: false`; it does
not report a fabricated adherence percentage.

## UI

The doctor dashboard is at `/doctor/dashboard`; selecting a patient opens
`/doctor/patients/:id`. The reusable chart component leaves absent measurements
as missing values and renders line gaps instead of turning them into zeroes.
Empty and loading states are shown for all chart types.

For an end-to-end check, sign in as a doctor with at least one assigned patient
who has health readings. Confirm the four statistic cards and seven-day chart,
filter by disease/status/alert severity, then open a patient to inspect the
readings and 30-day summary. An unassigned patient's overview request must
return `403`.
