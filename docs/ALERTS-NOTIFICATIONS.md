# Alerts and notifications

All endpoints require a bearer token and are mounted under `/api`.

| Method and path | Access |
| --- | --- |
| `GET /alerts?severity=&status=&patientId=&page=1&limit=10` | Patients see their own alerts; doctors see alerts for assigned patients; admins can list all alerts. |
| `POST /alerts` | Doctor only. Body: `{ "patientId", "type", "severity" }`; the alert is attached to the doctor's assigned patient. |
| `PUT /alerts/:id` | Doctor assigned to the patient or admin. Only `unread -> acknowledged -> resolved` transitions are accepted. |
| `DELETE /alerts/:id` | Admin only. |
| `GET /notes?patientId=` | Patients see their own recommendations; doctors see notes they authored for assigned patients; admins can read notes. |
| `POST /notes` | Doctor only. Body: `{ "patientId", "content" }`; patient assignment is verified. |
| `GET /notifications?page=1&limit=20` | Authenticated user sees only their own notifications; response includes `unreadCount`. |
| `PUT /notifications/:id/read` | Authenticated user can mark only their own notification as read. |
| `PUT /notifications/read-all` | Marks the authenticated user's unread notifications as read. |

`config/thresholds.js` contains example bands only and is explicitly not
clinically validated. Alert-engine messages are neutral review prompts. The
thresholds are not diagnostic criteria, medical advice, or a substitute for
clinical judgment. A health-record write succeeds even if persisting its
derived alerts or notifications fails; that failure is logged without exposing
patient data.

The pure `utils/alertEngine.js` evaluates each numeric reading independently.
An automatic alert is assigned the patient's currently assigned doctor. The
doctor receives a notification for each alert; the patient also receives one
for high and critical alerts. Alerts persist even if a patient has no assigned
doctor.

## Verify a high-reading alert end to end

1. Assign a doctor to a patient and sign in as that patient.
2. In the app, open **Add Reading** and submit a valid systolic value of `180`
   (or use the Postman request **Phase 7 - Patient posts high reading**).
3. Sign in as the assigned doctor. The Alerts page should show a critical
   systolic review alert with neutral wording, and the notification bell should
   show an unread notification after at most 30 seconds.
4. Open the notification or Alerts page. Acknowledge the alert, then resolve
   it. The doctor can only update alerts attached to their assigned patients.
5. Sign in as the patient: the alert is visible as read-only, and the patient
   has a notification for this critical alert.

To run the Postman flow, set the collection variables in
`health-monitoring.postman_collection.json`: `baseUrl`, `patientToken`,
`doctorToken`, `adminToken`, and the assigned `patientId`. Run the Phase 7
patient reading request followed by the doctor alert and notification requests.
The doctor notification request asserts that the generated alert ID is present
in the doctor's inbox.
