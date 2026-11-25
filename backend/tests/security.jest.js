import { afterAll, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import Alert from '../models/Alert.js';
import AuditLog from '../models/AuditLog.js';
import CommunityHealthWorker from '../models/CommunityHealthWorker.js';
import Doctor from '../models/Doctor.js';
import HealthRecord from '../models/HealthRecord.js';
import Notification from '../models/Notification.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';

process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';
process.env.JWT_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';

const app = (await import('../app.js')).default;
let mongo;
let patientUser;
let otherPatientUser;
let doctorUser;
let adminUser;
let patient;
let otherPatient;
let record;
let tokens;

const login = async (email, password = 'TestPassword123') => {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  expect(response.status).toBe(200);
  return response.body.data.token;
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Patient.init(),
    HealthRecord.init(),
    Alert.init(),
    Notification.init(),
    CommunityHealthWorker.init(),
    AuditLog.init(),
  ]);

  patientUser = await User.create({
    name: 'Owner Patient', email: 'owner@example.test', password: 'TestPassword123', role: 'patient',
  });
  otherPatientUser = await User.create({
    name: 'Other Patient', email: 'other@example.test', password: 'TestPassword123', role: 'patient',
  });
  doctorUser = await User.create({
    name: 'Assigned Doctor', email: 'doctor@example.test', password: 'TestPassword123', role: 'doctor',
  });
  adminUser = await User.create({
    name: 'System Admin', email: 'admin@example.test', password: 'TestPassword123', role: 'admin',
  });
  const doctor = await Doctor.create({ userId: doctorUser._id });
  patient = await Patient.create({ userId: patientUser._id, doctorId: doctor._id });
  otherPatient = await Patient.create({ userId: otherPatientUser._id });
  record = await HealthRecord.create({
    patientId: patient._id, bloodSugar: 111, recordedAt: new Date(),
  });
  tokens = {
    patient: await login(patientUser.email),
    otherPatient: await login(otherPatientUser.email),
    doctor: await login(doctorUser.email),
    admin: await login(adminUser.email),
  };
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  await HealthRecord.deleteMany({});
  await Alert.deleteMany({});
  await Notification.deleteMany({});
  await CommunityHealthWorker.deleteMany({});
  record = await HealthRecord.create({
    patientId: patient._id, bloodSugar: 111, recordedAt: new Date(),
  });
});

describe('authentication and authorization', () => {
  test('register ignores an injected role and creates a patient account', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Injected Admin',
      email: 'injected@example.test',
      password: 'TestPassword123',
      role: 'admin',
      isActive: false,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('patient');
    expect(response.body.data.user).not.toHaveProperty('password');
    const stored = await User.findOne({ email: 'injected@example.test' });
    expect(stored.role).toBe('patient');
    expect(stored.isActive).toBe(true);
    expect(await Patient.exists({ userId: stored._id })).toBeTruthy();
    const audit = await AuditLog.findOne({ action: 'auth.register', resourceId: stored._id }).lean();
    expect(audit).toMatchObject({ actorId: stored._id, resourceType: 'auth' });
    expect(audit).not.toHaveProperty('password');
    expect(audit).not.toHaveProperty('email');
    expect(audit).not.toHaveProperty('bloodSugar');
  });

  test('rejects wrong credentials and inactive users without distinguishing them', async () => {
    const wrongPassword = await request(app).post('/api/auth/login')
      .send({ email: patientUser.email, password: 'WrongPassword123' });
    expect(wrongPassword.status).toBe(401);
    const inactive = await User.create({
      name: 'Inactive User', email: 'inactive@example.test', password: 'TestPassword123', isActive: false,
    });
    const inactiveLogin = await request(app).post('/api/auth/login')
      .send({ email: inactive.email, password: 'TestPassword123' });
    expect(inactiveLogin.status).toBe(401);
    expect(inactiveLogin.body.message).toBe(wrongPassword.body.message);
  });

  test('rejects expired access tokens', async () => {
    process.env.JWT_EXPIRES_IN = '1ms';
    const expiredToken = await login(patientUser.email);
    process.env.JWT_EXPIRES_IN = '7d';
    await new Promise((resolve) => setTimeout(resolve, 20));

    const response = await request(app).get('/api/auth/profile')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(response.status).toBe(401);
  });

  test('rejects missing tokens and disallowed roles before record creation', async () => {
    const missing = await request(app).get('/api/health-records');
    expect(missing.status).toBe(401);

    for (const role of ['doctor', 'admin']) {
      const response = await request(app).post('/api/health-records')
        .set('Authorization', `Bearer ${tokens[role]}`)
        .send({ bloodSugar: 110 });
      expect(response.status).toBe(403);
    }
    const secondPatientCanCreateOwnReading = await request(app).post('/api/health-records')
      .set('Authorization', `Bearer ${tokens.otherPatient}`)
      .send({ bloodSugar: 110 });
    expect(secondPatientCanCreateOwnReading.status).toBe(201);
    expect(await HealthRecord.countDocuments()).toBe(2);
  });

  test('patient record reads are owner-scoped; assigned doctors and admins may read', async () => {
    const owner = await request(app).get(`/api/health-records/${record._id}`)
      .set('Authorization', `Bearer ${tokens.patient}`);
    const stranger = await request(app).get(`/api/health-records/${record._id}`)
      .set('Authorization', `Bearer ${tokens.otherPatient}`);
    const assignedDoctor = await request(app).get(`/api/health-records/${record._id}`)
      .set('Authorization', `Bearer ${tokens.doctor}`);
    const admin = await request(app).get(`/api/health-records/${record._id}`)
      .set('Authorization', `Bearer ${tokens.admin}`);

    expect(owner.status).toBe(200);
    expect(stranger.status).toBe(403);
    expect(assignedDoctor.status).toBe(200);
    expect(admin.status).toBe(200);
  });
});

describe('health-record validation and audit-triggering flows', () => {
  test.each([
    { bloodSugar: 19 },
    { bloodSugar: 801 },
    { systolic: 50, diastolic: 50 },
    { heartRate: 251 },
    { oxygenLevel: 49 },
  ])('rejects implausible or inconsistent reading payloads: %j', async (payload) => {
    const response = await request(app).post('/api/health-records')
      .set('Authorization', `Bearer ${tokens.patient}`)
      .send(payload);
    expect(response.status).toBe(400);
  });

  test('returns only own records and paginates the date-descending history', async () => {
    await HealthRecord.create([
      { patientId: patient._id, bloodSugar: 120, recordedAt: new Date(Date.now() - 1000) },
      { patientId: patient._id, bloodSugar: 130, recordedAt: new Date(Date.now() - 2000) },
      { patientId: otherPatient._id, bloodSugar: 200, recordedAt: new Date() },
    ]);
    const response = await request(app).get('/api/health-records?page=1&limit=2')
      .set('Authorization', `Bearer ${tokens.patient}`);

    expect(response.status).toBe(200);
    expect(response.body.data.records).toHaveLength(2);
    expect(response.body.data.records.every((item) => String(item.patientId) === String(patient._id))).toBe(true);
    expect(new Date(response.body.data.records[0].recordedAt).getTime())
      .toBeGreaterThan(new Date(response.body.data.records[1].recordedAt).getTime());
  });

  test('does not allow user-controlled ownership or Mongo operators in health input', async () => {
    const forgedOwner = await request(app).post('/api/health-records')
      .set('Authorization', `Bearer ${tokens.patient}`)
      .send({ patientId: otherPatient._id, bloodSugar: 120 });
    const operatorPayload = await request(app).post('/api/health-records')
      .set('Authorization', `Bearer ${tokens.patient}`)
      .send({ bloodSugar: { $gt: 1 } });
    expect(forgedOwner.status).toBe(400);
    expect(operatorPayload.status).toBe(400);
  });

  test('persists a reading and neutral alert when a configured demo threshold is crossed', async () => {
    const response = await request(app).post('/api/health-records')
      .set('Authorization', `Bearer ${tokens.patient}`)
      .send({ bloodSugar: 800 });

    expect(response.status).toBe(201);
    const alert = await Alert.findOne({ healthRecordId: response.body.data.record._id });
    expect(alert).toBeTruthy();
    expect(alert.message).toMatch(/needs clinical review/i);
    expect(alert.message).not.toMatch(/diagnos|disease|treatment/i);
    const audit = await AuditLog.findOne({
      action: 'healthRecord.create',
      resourceId: response.body.data.record._id,
    }).lean();
    expect(audit).toBeTruthy();
    expect(audit).not.toHaveProperty('bloodSugar');
    expect(audit).not.toHaveProperty('notes');
  });

  test('uses the offline idempotency key to avoid duplicate health records and alerts', async () => {
    const idempotencyKey = 'offline-record-request-0001';
    const first = await request(app).post('/api/health-records')
      .set('Authorization', `Bearer ${tokens.patient}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ bloodSugar: 450, recordedAt: new Date().toISOString() });
    const retry = await request(app).post('/api/health-records')
      .set('Authorization', `Bearer ${tokens.patient}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ bloodSugar: 450, recordedAt: new Date().toISOString() });

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.data.record._id).toBe(first.body.data.record._id);
    expect(await HealthRecord.countDocuments({ patientId: patient._id, clientRequestId: idempotencyKey })).toBe(1);
  });

  test('creates an idempotent SOS alert and assigned-doctor notification with optional location', async () => {
    const idempotencyKey = 'offline-sos-request-000001';
    const location = {
      latitude: 17.385,
      longitude: 78.4867,
      accuracy: 250,
      capturedAt: new Date().toISOString(),
    };
    const first = await request(app).post('/api/alerts/sos')
      .set('Authorization', `Bearer ${tokens.patient}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ location });
    const retry = await request(app).post('/api/alerts/sos')
      .set('Authorization', `Bearer ${tokens.patient}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ location });

    expect(first.status).toBe(201);
    expect(first.body.data.notifiedDoctor).toBe(true);
    expect(first.body.data.alert).toMatchObject({ source: 'sos', type: 'emergency', severity: 'critical' });
    expect(first.body.data.alert.emergencyLocation.latitude).toBe(location.latitude);
    expect(retry.body.data.alert._id).toBe(first.body.data.alert._id);
    expect(await Alert.countDocuments({ patientId: patient._id, source: 'sos' })).toBe(1);
    expect(await Notification.countDocuments({ eventKey: `emergency-sos:${patient._id}:${idempotencyKey}` })).toBe(1);
    const audit = await AuditLog.findOne({ resourceType: 'alert', resourceId: first.body.data.alert._id }).lean();
    expect(audit).not.toHaveProperty('emergencyLocation');
    expect(audit).not.toHaveProperty('latitude');
  });

  test('restricts SOS creation to the signed-in patient, validates location, and excludes forged fields', async () => {
    const noToken = await request(app).post('/api/alerts/sos')
      .set('Idempotency-Key', 'offline-sos-request-000002')
      .send({});
    const doctor = await request(app).post('/api/alerts/sos')
      .set('Authorization', `Bearer ${tokens.doctor}`)
      .set('Idempotency-Key', 'offline-sos-request-000003')
      .send({});
    const invalidLocation = await request(app).post('/api/alerts/sos')
      .set('Authorization', `Bearer ${tokens.patient}`)
      .set('Idempotency-Key', 'offline-sos-request-000004')
      .send({ location: { latitude: 200, longitude: 0, accuracy: 10, capturedAt: new Date().toISOString() } });
    const forgedMessage = await request(app).post('/api/alerts/sos')
      .set('Authorization', `Bearer ${tokens.patient}`)
      .set('Idempotency-Key', 'offline-sos-request-000005')
      .send({ message: 'Forged alert' });

    expect(noToken.status).toBe(401);
    expect(doctor.status).toBe(403);
    expect(invalidLocation.status).toBe(400);
    expect(forgedMessage.status).toBe(400);
  });

  test('lets patients search the admin-curated nearby worker directory without exposing exact worker coordinates', async () => {
    await CommunityHealthWorker.create({
      name: 'Local Health Worker',
      phone: '+1 202 555 0114',
      serviceArea: 'Demo rural district',
      languages: ['English', 'Telugu'],
      location: { type: 'Point', coordinates: [78.4867, 17.385] },
      createdBy: adminUser._id,
    });

    const nearby = await request(app).get('/api/community-health-workers/nearby')
      .set('Authorization', `Bearer ${tokens.patient}`)
      .query({ latitude: 17.385, longitude: 78.4867, radiusKm: 10 });
    const invalidRadius = await request(app).get('/api/community-health-workers/nearby')
      .set('Authorization', `Bearer ${tokens.patient}`)
      .query({ latitude: 17.385, longitude: 78.4867, radiusKm: 1000 });
    const doctor = await request(app).get('/api/community-health-workers/nearby')
      .set('Authorization', `Bearer ${tokens.doctor}`)
      .query({ latitude: 17.385, longitude: 78.4867, radiusKm: 10 });

    expect(nearby.status).toBe(200);
    expect(nearby.body.data.workers).toHaveLength(1);
    expect(nearby.body.data.workers[0]).toMatchObject({ name: 'Local Health Worker', serviceArea: 'Demo rural district' });
    expect(nearby.body.data.workers[0]).toHaveProperty('distanceKm', 0);
    expect(nearby.body.data.workers[0]).not.toHaveProperty('location');
    expect(nearby.body.data.workers[0]).not.toHaveProperty('coordinates');
    expect(invalidRadius.status).toBe(400);
    expect(doctor.status).toBe(403);
  });

  test('restricts worker-directory edits to admins and records only safe audit metadata', async () => {
    const payload = {
      name: 'Verified CHW',
      phone: '+1 202 555 0115',
      serviceArea: 'North demo area',
      languages: ['Telugu'],
      latitude: 17.385,
      longitude: 78.4867,
    };
    const forbidden = await request(app).post('/api/community-health-workers')
      .set('Authorization', `Bearer ${tokens.patient}`)
      .send(payload);
    const created = await request(app).post('/api/community-health-workers')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send(payload);

    expect(forbidden.status).toBe(403);
    expect(created.status).toBe(201);
    const audit = await AuditLog.findOne({
      action: 'communityHealthWorker.create',
      resourceId: created.body.data.worker._id,
    }).lean();
    expect(audit).toBeTruthy();
    expect(audit).not.toHaveProperty('phone');
    expect(audit).not.toHaveProperty('location');
  });

  test('logs health record updates and deletions without storing the reading values', async () => {
    const updated = await request(app).put(`/api/health-records/${record._id}`)
      .set('Authorization', `Bearer ${tokens.patient}`)
      .send({ bloodSugar: 125 });
    expect(updated.status).toBe(200);

    const removed = await request(app).delete(`/api/health-records/${record._id}`)
      .set('Authorization', `Bearer ${tokens.patient}`);
    expect(removed.status).toBe(200);

    const events = await AuditLog.find({
      resourceType: 'healthRecord',
      resourceId: record._id,
      action: { $in: ['healthRecord.update', 'healthRecord.delete'] },
    }).lean();
    expect(events.map(({ action }) => action).sort()).toEqual(['healthRecord.delete', 'healthRecord.update']);
    expect(events.every((event) => !Object.hasOwn(event, 'bloodSugar'))).toBe(true);
  });

  test('audits alert creation and lifecycle changes; patients cannot manually create alerts', async () => {
    const patientPost = await request(app).post('/api/alerts')
      .set('Authorization', `Bearer ${tokens.patient}`)
      .send({ patientId: patient._id, type: 'manual', severity: 'low' });
    expect(patientPost.status).toBe(403);

    const created = await request(app).post('/api/alerts')
      .set('Authorization', `Bearer ${tokens.doctor}`)
      .send({ patientId: patient._id, type: 'manual', severity: 'medium' });
    expect(created.status).toBe(201);
    const alertId = created.body.data.alert._id;

    expect((await request(app).put(`/api/alerts/${alertId}`)
      .set('Authorization', `Bearer ${tokens.doctor}`)
      .send({ status: 'acknowledged' })).status).toBe(200);
    expect((await request(app).put(`/api/alerts/${alertId}`)
      .set('Authorization', `Bearer ${tokens.doctor}`)
      .send({ status: 'resolved' })).status).toBe(200);
    expect((await request(app).delete(`/api/alerts/${alertId}`)
      .set('Authorization', `Bearer ${tokens.admin}`)).status).toBe(200);

    const actions = await AuditLog.find({ resourceType: 'alert', resourceId: alertId })
      .distinct('action');
    expect(actions.sort()).toEqual(['alert.create', 'alert.delete', 'alert.update']);
  });

  test('changing a password revokes previously issued access tokens', async () => {
    const oldToken = tokens.patient;
    const changed = await request(app).put('/api/auth/change-password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: 'TestPassword123', newPassword: 'NewTestPassword456' });

    expect(changed.status).toBe(200);
    const rejectedOldSession = await request(app).get('/api/auth/profile')
      .set('Authorization', `Bearer ${oldToken}`);
    expect(rejectedOldSession.status).toBe(401);
    tokens.patient = await login(patientUser.email, 'NewTestPassword456');
  });

  test('audits patient profile changes and deactivation without recording profile values', async () => {
    const updated = await request(app).put(`/api/patients/${patient._id}`)
      .set('Authorization', `Bearer ${tokens.patient}`)
      .send({ name: 'Updated Patient Name', role: 'admin', password: 'IgnoredPassword123' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.patient.userId.role).toBe('patient');

    const inactive = await request(app).delete(`/api/patients/${patient._id}`)
      .set('Authorization', `Bearer ${tokens.admin}`);
    expect(inactive.status).toBe(200);

    const events = await AuditLog.find({
      resourceType: 'patient',
      resourceId: patient._id,
      action: { $in: ['patient.update', 'patient.deactivate'] },
    }).lean();
    expect(events.map(({ action }) => action).sort()).toEqual(['patient.deactivate', 'patient.update']);
    expect(events.every((event) => !Object.hasOwn(event, 'name') && !Object.hasOwn(event, 'password'))).toBe(true);
  });
});
