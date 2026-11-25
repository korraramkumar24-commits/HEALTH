import mongoose from 'mongoose';
import Alert from '../models/Alert.js';
import Doctor from '../models/Doctor.js';
import HealthRecord from '../models/HealthRecord.js';
import Notification from '../models/Notification.js';
import Patient from '../models/Patient.js';
import DEMO_THRESHOLDS from '../config/thresholds.js';
import asyncHandler from '../utils/asyncHandler.js';
import { evaluateRecord } from '../utils/alertEngine.js';
import { HEALTH_MEASUREMENTS, HEALTH_MEASUREMENT_RANGES } from '../utils/healthRecordRules.js';
import { getTrendLabel } from '../utils/trendRules.js';
import writeAuditLog from '../utils/writeAuditLog.js';

const MEASUREMENTS = HEALTH_MEASUREMENTS;
const ALLOWED_INPUT_FIELDS = new Set([...MEASUREMENTS, 'recordedAt', 'notes']);
const MAX_PAGE_SIZE = 50;

const respond = (res, status, message, data) =>
  res.status(status).json({ success: true, message, data });

const badRequest = (res, message, errors = undefined) =>
  res.status(400).json({ success: false, message, data: null, ...(errors && { errors }) });

const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const dateFromQuery = (value, field, errors) => {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    errors[field] = `${field} must be a valid date.`;
    return undefined;
  }
  if (field === 'to' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    parsed.setUTCHours(23, 59, 59, 999);
  }
  return parsed;
};

const validateInput = (body, { creating = false } = {}) => {
  const errors = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { body: 'Request body must be a JSON object.' };
  }

  if (Object.hasOwn(body, 'patientId')) {
    errors.patientId = 'patientId is assigned from your account and cannot be provided.';
  }

  for (const field of Object.keys(body)) {
    if (!ALLOWED_INPUT_FIELDS.has(field) && field !== 'patientId') {
      errors[field] = `${field} is not an allowed health-record field.`;
    }
  }

  for (const [field, [min, max]] of Object.entries(HEALTH_MEASUREMENT_RANGES)) {
    if (body[field] === undefined || body[field] === null || body[field] === '') continue;
    if (typeof body[field] !== 'number' || !Number.isFinite(body[field])) {
      errors[field] = `${field} must be a number.`;
    } else if (body[field] < min || body[field] > max) {
      errors[field] = `${field} must be between ${min} and ${max}.`;
    }
  }

  const hasMeasurement = MEASUREMENTS.some(
    (field) => body[field] !== undefined && body[field] !== null && body[field] !== '',
  );
  if (creating && !hasMeasurement) {
    errors.measurements = 'At least one measurement is required.';
  }

  if (body.systolic !== undefined && body.diastolic !== undefined) {
    if (
      typeof body.systolic === 'number' &&
      typeof body.diastolic === 'number' &&
      body.systolic <= body.diastolic
    ) {
      errors.systolic = 'Systolic must be greater than diastolic.';
    }
  }

  if (body.recordedAt !== undefined) {
    const date = new Date(body.recordedAt);
    if (body.recordedAt === null || body.recordedAt === '' || Number.isNaN(date.getTime())) {
      errors.recordedAt = 'recordedAt must be a valid date.';
    } else if (date > new Date()) {
      errors.recordedAt = 'recordedAt cannot be in the future.';
    }
  }

  if (body.notes !== undefined && typeof body.notes !== 'string') {
    errors.notes = 'notes must be text.';
  } else if (typeof body.notes === 'string' && body.notes.length > 2000) {
    errors.notes = 'notes cannot exceed 2000 characters.';
  }

  return errors;
};

const getPatientForUser = (userId) => Patient.findOne({ userId }).select('_id userId doctorId').lean();

const accessPatient = async (req, patientId, { allowAdmin = true } = {}) => {
  if (!mongoose.isValidObjectId(patientId)) return { error: 'invalid' };
  const patient = await Patient.findById(patientId).select('_id userId doctorId').lean();
  if (!patient) return { error: 'notFound' };

  if (allowAdmin && req.user.role === 'admin') return { patient };
  if (req.user.role === 'patient' && String(patient.userId) === String(req.user._id)) {
    return { patient };
  }
  if (req.user.role === 'doctor') {
    const doctor = await Doctor.findOne({ userId: req.user._id }).select('_id').lean();
    if (doctor && String(patient.doctorId) === String(doctor._id)) return { patient };
  }

  return { error: 'forbidden' };
};

const sendPatientAccessError = (res, error) => {
  if (error === 'invalid') return badRequest(res, 'Invalid patient ID.');
  if (error === 'notFound') {
    return res.status(404).json({ success: false, message: 'Patient not found.', data: null });
  }
  return res.status(403).json({
    success: false,
    message: 'You do not have access to this patient.',
    data: null,
  });
};

const recordAccess = async (req, recordId) => {
  if (!mongoose.isValidObjectId(recordId)) return { error: 'invalid' };
  const record = await HealthRecord.findById(recordId).lean();
  if (!record) return { error: 'notFound' };
  const access = await accessPatient(req, record.patientId);
  return access.error ? access : { record, patient: access.patient };
};

const sendRecordAccessError = (res, error) => {
  if (error === 'invalid') return badRequest(res, 'Invalid health record ID.');
  if (error === 'notFound') {
    return res.status(404).json({ success: false, message: 'Health record not found.', data: null });
  }
  return sendPatientAccessError(res, error);
};

const scopedPatientIdsForDoctor = async (userId) => {
  const doctor = await Doctor.findOne({ userId }).select('_id').lean();
  if (!doctor) return [];
  const patients = await Patient.find({ doctorId: doctor._id }).select('_id').lean();
  return patients.map(({ _id }) => _id);
};

export const createHealthRecord = asyncHandler(async (req, res) => {
  const errors = validateInput(req.body, { creating: true });
  if (Object.keys(errors).length) return badRequest(res, 'Please correct the health-record fields.', errors);

  const patient = await getPatientForUser(req.user._id);
  if (!patient) {
    return res.status(404).json({ success: false, message: 'Patient profile not found.', data: null });
  }

  const clientRequestId = req.get('Idempotency-Key');
  if (clientRequestId && !/^[\w-]{16,64}$/.test(clientRequestId)) {
    return badRequest(res, 'Idempotency-Key must contain 16 to 64 letters, numbers, underscores, or hyphens.');
  }
  if (clientRequestId) {
    const existing = await HealthRecord.findOne({ patientId: patient._id, clientRequestId }).lean();
    if (existing) return respond(res, 200, 'Health record was already synchronized.', { record: existing });
  }

  let record;
  try {
    record = await HealthRecord.create({
      ...Object.fromEntries(
        [...MEASUREMENTS, 'recordedAt', 'notes']
          .filter((field) => req.body[field] !== undefined && req.body[field] !== '')
          .map((field) => [field, req.body[field]]),
      ),
      patientId: patient._id,
      ...(clientRequestId && { clientRequestId }),
    });
  } catch (error) {
    if (clientRequestId && error.code === 11000) {
      const existing = await HealthRecord.findOne({ patientId: patient._id, clientRequestId }).lean();
      if (existing) return respond(res, 200, 'Health record was already synchronized.', { record: existing });
    }
    throw error;
  }
  await writeAuditLog({
    actorId: req.user._id,
    action: 'healthRecord.create',
    resourceType: 'healthRecord',
    resourceId: record._id,
    ip: req.ip,
  });

  const evaluatedAlerts = evaluateRecord(record.toObject(), DEMO_THRESHOLDS);
  if (evaluatedAlerts.length) {
    try {
      const alerts = await Alert.insertMany(
        evaluatedAlerts.map((evaluatedAlert) => ({
          ...evaluatedAlert,
          patientId: patient._id,
          doctorId: patient.doctorId || null,
          healthRecordId: record._id,
          source: 'automatic',
        })),
      );
      await Promise.all(alerts.map((alert) => writeAuditLog({
        actorId: req.user._id,
        action: 'alert.create',
        resourceType: 'alert',
        resourceId: alert._id,
        ip: req.ip,
      })));
      const notifications = [];
      if (patient.doctorId) {
        const doctor = await Doctor.findById(patient.doctorId).select('userId').lean();
        if (doctor) {
          notifications.push(
            ...alerts.map((alert) => ({
              recipientId: doctor.userId,
              alertId: alert._id,
              message: alert.message,
            })),
          );
        }
      }
      for (const alert of alerts) {
        if (['high', 'critical'].includes(alert.severity)) {
          notifications.push({
            recipientId: patient.userId,
            alertId: alert._id,
            message: alert.message,
          });
        }
      }
      if (notifications.length) await Notification.insertMany(notifications);
    } catch {
      console.error('Unable to persist demo health alerts or notifications for a reading.');
    }
  }

  return respond(res, 201, 'Health record created successfully.', { record });
});

export const listHealthRecords = asyncHandler(async (req, res) => {
  const errors = {};
  const from = dateFromQuery(req.query.from, 'from', errors);
  const to = dateFromQuery(req.query.to, 'to', errors);
  if (from && to && from > to) errors.to = 'to must be on or after from.';
  if (Object.keys(errors).length) return badRequest(res, 'Invalid date filter.', errors);

  const filter = {};
  if (from || to) {
    filter.recordedAt = {};
    if (from) filter.recordedAt.$gte = from;
    if (to) filter.recordedAt.$lte = to;
  }

  if (req.user.role === 'patient') {
    const patient = await getPatientForUser(req.user._id);
    if (!patient) {
      return respond(res, 200, 'Health records fetched successfully.', {
        records: [],
        page: 1,
        limit: 10,
        totalRecords: 0,
        totalPages: 0,
      });
    }
    if (req.query.patientId && !mongoose.isValidObjectId(req.query.patientId)) {
      return badRequest(res, 'Invalid patient ID.');
    }
    if (req.query.patientId && String(req.query.patientId) !== String(patient._id)) {
      return sendPatientAccessError(res, 'forbidden');
    }
    filter.patientId = patient._id;
  } else if (req.user.role === 'doctor') {
    const assignedPatientIds = await scopedPatientIdsForDoctor(req.user._id);
    filter.patientId = req.query.patientId
      ? { $in: assignedPatientIds.filter((id) => String(id) === String(req.query.patientId)) }
      : { $in: assignedPatientIds };
    if (req.query.patientId) {
      if (!mongoose.isValidObjectId(req.query.patientId)) return badRequest(res, 'Invalid patient ID.');
      if (!filter.patientId.$in.length) return sendPatientAccessError(res, 'forbidden');
    }
  } else if (req.query.patientId) {
    if (!mongoose.isValidObjectId(req.query.patientId)) return badRequest(res, 'Invalid patient ID.');
    filter.patientId = req.query.patientId;
  }

  const page = positiveInteger(req.query.page, 1);
  const limit = Math.min(MAX_PAGE_SIZE, positiveInteger(req.query.limit, 10));
  const [records, totalRecords] = await Promise.all([
    HealthRecord.find(filter)
      .sort({ recordedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    HealthRecord.countDocuments(filter),
  ]);

  return respond(res, 200, 'Health records fetched successfully.', {
    records,
    page,
    limit,
    totalRecords,
    totalPages: Math.ceil(totalRecords / limit),
  });
});

export const getLatestHealthRecord = asyncHandler(async (req, res) => {
  const access = await accessPatient(req, req.params.patientId);
  if (access.error) return sendPatientAccessError(res, access.error);
  const record = await HealthRecord.findOne({ patientId: access.patient._id })
    .sort({ recordedAt: -1 })
    .lean();
  return respond(res, 200, 'Latest health record fetched successfully.', { record });
});

export const getHealthRecord = asyncHandler(async (req, res) => {
  const access = await recordAccess(req, req.params.id);
  if (access.error) return sendRecordAccessError(res, access.error);
  return respond(res, 200, 'Health record fetched successfully.', { record: access.record });
});

export const updateHealthRecord = asyncHandler(async (req, res) => {
  const access = await recordAccess(req, req.params.id);
  if (access.error) return sendRecordAccessError(res, access.error);
  if (
    req.user.role !== 'patient' ||
    String(access.patient.userId) !== String(req.user._id)
  ) {
    return sendPatientAccessError(res, 'forbidden');
  }
  if (Date.now() - new Date(access.record.createdAt).getTime() > 24 * 60 * 60 * 1000) {
    return res.status(403).json({
      success: false,
      message: 'Health records can only be edited within 24 hours of creation.',
      data: null,
    });
  }

  const errors = validateInput(req.body);
  const mergedValues = Object.fromEntries(
    MEASUREMENTS.map((field) => [
      field,
      req.body[field] === '' || req.body[field] === null
        ? undefined
        : req.body[field] !== undefined
          ? req.body[field]
          : access.record[field],
    ]),
  );
  mergedValues.recordedAt = req.body.recordedAt ?? access.record.recordedAt;
  mergedValues.notes = req.body.notes ?? access.record.notes;
  Object.assign(errors, validateInput(mergedValues, { creating: true }));
  if (Object.keys(errors).length) return badRequest(res, 'Please correct the health-record fields.', errors);

  const record = await HealthRecord.findById(req.params.id);
  for (const field of [...MEASUREMENTS, 'recordedAt', 'notes']) {
    if (req.body[field] !== undefined) {
      record[field] = req.body[field] === '' ? undefined : req.body[field];
    }
  }
  await record.save();
  await writeAuditLog({
    actorId: req.user._id,
    action: 'healthRecord.update',
    resourceType: 'healthRecord',
    resourceId: record._id,
    ip: req.ip,
  });
  return respond(res, 200, 'Health record updated successfully.', { record });
});

export const deleteHealthRecord = asyncHandler(async (req, res) => {
  const access = await recordAccess(req, req.params.id);
  if (access.error) return sendRecordAccessError(res, access.error);
  const isOwner =
    req.user.role === 'patient' && String(access.patient.userId) === String(req.user._id);
  if (!isOwner && req.user.role !== 'admin') {
    return sendPatientAccessError(res, 'forbidden');
  }

  await HealthRecord.deleteOne({ _id: access.record._id });
  await writeAuditLog({
    actorId: req.user._id,
    action: 'healthRecord.delete',
    resourceType: 'healthRecord',
    resourceId: access.record._id,
    ip: req.ip,
  });
  return respond(res, 200, 'Health record deleted successfully.', null);
});

export const getHealthSummary = asyncHandler(async (req, res) => {
  const days = Number(req.query.days || 7);
  if (![7, 30].includes(days)) return badRequest(res, 'days must be 7 or 30.');

  const access = await accessPatient(req, req.params.patientId);
  if (access.error) return sendPatientAccessError(res, access.error);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const metrics = await Promise.all(
    MEASUREMENTS.map(async (measurement) => {
      const [result] = await HealthRecord.aggregate([
        { $match: { patientId: access.patient._id, recordedAt: { $gte: since } } },
        { $match: { [measurement]: { $type: 'number' } } },
        { $sort: { recordedAt: 1 } },
        {
          $group: {
            _id: null,
            min: { $min: `$${measurement}` },
            max: { $max: `$${measurement}` },
            average: { $avg: `$${measurement}` },
            count: { $sum: 1 },
            firstValue: { $first: `$${measurement}` },
            lastValue: { $last: `$${measurement}` },
          },
        },
      ]);

      return [
        measurement,
        {
          min: result?.min ?? null,
          max: result?.max ?? null,
          average: result ? Number(result.average.toFixed(2)) : null,
          count: result?.count ?? 0,
          trend: getTrendLabel(measurement, result?.firstValue, result?.lastValue),
        },
      ];
    }),
  );

  return respond(res, 200, 'Health summary fetched successfully.', {
    patientId: access.patient._id,
    days,
    since,
    summary: Object.fromEntries(metrics),
  });
});
