# Admin Dashboard and UI Polish

## Admin dashboard API

`GET /api/dashboard/admin` requires an administrator session. It returns:

- `totalUsers` and `usersByRole` counts for patient, doctor, and admin accounts.
- `patientsPerDoctor`, including an `Unassigned` row for patients with no assigned doctor.
- `patientsPerDisease`, including a `No disease assigned` row where relevant.
- `alerts.bySeverity` and `alerts.byStatus` counts.
- `readingsSubmittedPerDay`, grouping record creation timestamps into exactly 14 UTC calendar days, including days with zero readings.

All dashboard counts are read-only aggregates. They do not change user, patient, or clinical records.

## Admin screens

- `/admin/dashboard` presents a responsive healthcare overview with appointment, patient, critical-alert, and provider totals; 14-day reading trends; patient-to-provider assignment progress; alert status; and a provider directory preview. Counts are loaded from the existing dashboard, appointments, and doctors APIs.
- `/admin/alerts` opens the role-scoped alert list with admin status controls and deletion confirmation.
- `/admin/diseases` supports disease create, edit, and delete. The API rejects deletion while a patient references the disease.
- User, doctor, and patient management remain available under `/admin/users`, `/admin/doctors`, and `/admin/patients`.

## Application shell and accessibility

Authenticated pages share a responsive role-based navigation sidebar, user menu, notification bell, keyboard-visible focus styles, and demo-use disclaimer. Dialogs close with Escape, keep keyboard focus inside while open, and restore focus when dismissed. Destructive disease, alert, appointment cancellation, and health-reading deletion actions use confirmation dialogs.

The visible disclaimer is: **Demo application - not for medical use**. Dashboard values and alerts are demonstrations and are not medical advice.

## Verification

From `backend`, run `npm test`; the dashboard integration test checks role totals, patient grouping, alert aggregates, and all 14 reading-date buckets. From `frontend`, run `npm run build` and `npm run lint`.
