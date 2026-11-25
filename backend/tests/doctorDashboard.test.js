import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Alert from '../models/Alert.js';
import Appointment from '../models/Appointment.js';
import Disease from '../models/Disease.js';
import Doctor from '../models/Doctor.js';
import HealthRecord from '../models/HealthRecord.js';
import Medication from '../models/Medication.js';
import MedicationLog from '../models/MedicationLog.js';
import Note from '../models/Note.js';
import Notification from '../models/Notification.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import { createAppointment } from '../controllers/appointmentController.js';
import { getAdminDashboard, getDoctorDashboard } from '../controllers/dashboardController.js';
import { logMedicationDose } from '../controllers/medicationController.js';
import { getPatientDashboard } from '../controllers/patientDashboardController.js';
import { getPatientOverview } from '../controllers/patientOverviewController.js';
import { createDueReminders } from '../utils/reminderService.js';

let mongoServer;
let doctorUser;
let otherDoctorUser;
let patientUser;
let assignedPatient;
let disease;

const callController = async (controller, req) => {
  return new Promise((resolve, reject) => {
    const response = { statusCode: 200, body: null };
    const res = {
      status(statusCode) {
        response.statusCode = statusCode;
        return this;
      },
      json(body) {
        response.body = body;
        resolve(response);
        return this;
      },
    };
    controller(req, res, reject);
  });
};

before(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: '8.2.6' } });
  await mongoose.connect(mongoServer.getUri());

  doctorUser = await User.create({
    name: 'Assigned Doctor',
    email: 'assigned-doctor@example.test',
    password: 'password123',
    role: 'doctor',
  });
  otherDoctorUser = await User.create({
    name: 'Other Doctor',
    email: 'other-doctor@example.test',
    password: 'password123',
    role: 'doctor',
  });
  patientUser = await User.create({
    name: 'Dashboard Patient',
    email: 'dashboard-patient@example.test',
    password: 'password123',
    role: 'patient',
  });
  const doctor = await Doctor.create({ userId: doctorUser._id });
  const otherDoctor = await Doctor.create({ userId: otherDoctorUser._id });
  disease = await Disease.create({ name: 'Dashboard test condition' });
  assignedPatient = await Patient.create({
    userId: patientUser._id,
    doctorId: doctor._id,
    disease: disease._id,
    status: 'active',
  });
  const unassignedPatientUser = await User.create({
    name: 'Unassigned Patient',
    email: 'unassigned-patient@example.test',
    password: 'password123',
    role: 'patient',
  });
  await Patient.create({ userId: unassignedPatientUser._id, doctorId: otherDoctor._id });

  const now = Date.now();
  const records = await HealthRecord.create([
    {
      patientId: assignedPatient._id,
      systolic: 120,
      diastolic: 80,
      bloodSugar: 100,
      recordedAt: new Date(now - 60 * 60 * 1000),
    },
    {
      patientId: assignedPatient._id,
      systolic: 180,
      recordedAt: new Date(now - 30 * 60 * 1000),
    },
    {
      patientId: assignedPatient._id,
      bloodSugar: 250,
      recordedAt: new Date(now - 15 * 60 * 1000),
    },
  ]);
  await Alert.create([
    {
      patientId: assignedPatient._id,
      doctorId: doctor._id,
      healthRecordId: records[1]._id,
      type: 'systolic',
      severity: 'critical',
      status: 'unread',
      message: 'Systolic reading outside demo range - needs clinical review.',
    },
    {
      patientId: assignedPatient._id,
      doctorId: doctor._id,
      healthRecordId: records[2]._id,
      type: 'bloodSugar',
      severity: 'medium',
      status: 'acknowledged',
      message: 'Blood sugar reading outside demo range - needs clinical review.',
    },
  ]);
  await Note.create({
    patientId: assignedPatient._id,
    doctorId: doctor._id,
    authorId: doctorUser._id,
    content: 'Test recommendation',
  });
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const medication = await Medication.create({
    patientId: assignedPatient._id,
    prescribedBy: doctorUser._id,
    name: 'Test medication',
    instructions: 'Test instructions from clinician.',
    scheduledTimes: ['00:01', '00:02', '00:03'],
    startsAt: dayStart,
  });
  await MedicationLog.create({
    medicationId: medication._id,
    patientId: assignedPatient._id,
    scheduledFor: new Date(new Date().setHours(0, 1, 0, 0)),
    status: 'taken',
  });
  await Appointment.init();
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

test('dashboard aggregates scoped patient stats, alert statuses, filters, and readings', async () => {
  const response = await callController(getDoctorDashboard, {
    user: doctorUser,
    query: {},
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.totalPatients, 1);
  assert.equal(response.body.data.activePatients, 1);
  assert.equal(response.body.data.needsAttention, 1);
  assert.equal(response.body.data.criticalAlerts, 1);
  assert.equal(response.body.data.patients.length, 1);
  assert.equal(response.body.data.readingsStatusBreakdown.normal, 1);
  assert.equal(response.body.data.readingsStatusBreakdown.warning, 1);
  assert.equal(response.body.data.readingsStatusBreakdown.critical, 1);
  assert.equal(response.body.data.recentAlerts.length, 2);

  const filtered = await callController(getDoctorDashboard, {
    user: doctorUser,
    query: { alertSeverity: 'medium', disease: String(disease._id), status: 'active' },
  });
  assert.equal(filtered.body.data.totalFilteredPatients, 1);
  assert.equal(filtered.body.data.patients[0].userId.name, 'Dashboard Patient');
});

test('admin dashboard aggregates role, patient, alert, and 14-day reading totals', async () => {
  const adminUser = await User.create({
    name: 'Dashboard Admin',
    email: 'dashboard-admin@example.test',
    password: 'password123',
    role: 'admin',
  });
  const response = await callController(getAdminDashboard, { user: adminUser, query: {} });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.totalUsers, 5);
  assert.deepEqual(response.body.data.usersByRole, { patient: 2, doctor: 2, admin: 1 });
  assert.equal(response.body.data.patientsPerDoctor.length, 2);
  assert.equal(response.body.data.patientsPerDisease.find((item) => item.diseaseName === disease.name).patientCount, 1);
  assert.equal(response.body.data.alerts.bySeverity.find((item) => item.severity === 'critical').count, 1);
  assert.equal(response.body.data.alerts.byStatus.find((item) => item.status === 'acknowledged').count, 1);
  assert.equal(response.body.data.readingsSubmittedPerDay.length, 14);
  assert.equal(response.body.data.readingsSubmittedPerDay.reduce((total, item) => total + item.count, 0), 3);
});

test('patient overview returns assigned patient readings, summaries, alerts, and notes', async () => {
  const response = await callController(getPatientOverview, {
    user: doctorUser,
    params: { id: String(assignedPatient._id) },
    query: { days: '90' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.profile.userId.name, 'Dashboard Patient');
  assert.equal(response.body.data.latestReading.bloodSugar, 250);
  assert.equal(response.body.data.days, 90);
  assert.equal(response.body.data.readings.length, 3);
  assert.equal(response.body.data.summary30Days.systolic.count, 2);
  assert.equal(response.body.data.unresolvedAlerts.length, 2);
  assert.equal(response.body.data.notes[0].content, 'Test recommendation');
  assert.equal(response.body.data.activeMedications.length, 1);
  assert.equal(response.body.data.medicationAdherence, 33);
  assert.equal(response.body.data.medicationTrackingAvailable, true);
});

test('doctor overview rejects a patient assigned to another doctor', async () => {
  const response = await callController(getPatientOverview, {
    user: otherDoctorUser,
    params: { id: String(assignedPatient._id) },
    query: {},
  });

  assert.equal(response.statusCode, 403);
});

test('patient dashboard includes latest data and a dose-logging status summary', async () => {
  const initial = await callController(getPatientDashboard, {
    user: patientUser,
    query: {},
  });

  assert.equal(initial.statusCode, 200);
  assert.equal(initial.body.data.latestReading.heartRate, undefined);
  assert.equal(initial.body.data.recentReadings.length, 3);
  assert.equal(initial.body.data.unreadAlertsCount, 1);
  assert.equal(initial.body.data.medications.length, 1);
  assert.equal(initial.body.data.medications[0].todayDoses[0].status, 'taken');
  assert.equal(initial.body.data.medicationAdherence.percentage, 33);

  const medication = await Medication.findOne({ patientId: assignedPatient._id }).lean();
  const missedDose = await callController(logMedicationDose, {
    user: patientUser,
    params: { id: String(medication._id) },
    body: { status: 'missed', scheduledFor: new Date(new Date().setHours(0, 2, 0, 0)).toISOString() },
  });
  assert.equal(missedDose.statusCode, 201);

  const takenDose = await callController(logMedicationDose, {
    user: patientUser,
    params: { id: String(medication._id) },
    body: { status: 'taken', scheduledFor: new Date(new Date().setHours(0, 3, 0, 0)).toISOString() },
  });
  assert.equal(takenDose.statusCode, 201);

  const updatedDashboard = await callController(getPatientDashboard, {
    user: patientUser,
    query: {},
  });
  assert.equal(updatedDashboard.body.data.medicationAdherence.percentage, 67);
  const doctorOverview = await callController(getPatientOverview, {
    user: doctorUser,
    params: { id: String(assignedPatient._id) },
    query: {},
  });
  assert.equal(doctorOverview.body.data.medicationAdherence, 67);
});

test('double booking the same doctor and start time is rejected', async () => {
  const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const req = {
    user: doctorUser,
    body: {
      patientId: String(assignedPatient._id),
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      reason: 'Follow-up',
    },
  };
  const first = await callController(createAppointment, req);
  const second = await callController(createAppointment, req);

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 409);
});

test('reminder polling does not duplicate appointment or dose reminders', async () => {
  const appointmentStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
  await Appointment.create({
    patientId: assignedPatient._id,
    doctorId: await Doctor.findOne({ userId: doctorUser._id }).then((item) => item._id),
    createdBy: doctorUser._id,
    startsAt: appointmentStart,
    endsAt: new Date(appointmentStart.getTime() + 30 * 60 * 1000),
  });
  await Medication.updateOne(
    { patientId: assignedPatient._id },
    { $set: { scheduledTimes: ['00:00'] } },
  );
  await createDueReminders();
  await createDueReminders();

  const reminders = await Notification.find({
    recipientId: patientUser._id,
    kind: { $in: ['appointment-reminder', 'medication-reminder'] },
  }).lean();
  assert.equal(reminders.filter((item) => item.kind === 'appointment-reminder').length, 1);
  assert.equal(reminders.filter((item) => item.kind === 'medication-reminder').length, 1);
});
