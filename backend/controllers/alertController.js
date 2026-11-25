import mongoose from 'mongoose';
import Alert from '../models/Alert.js';
import Doctor from '../models/Doctor.js';
import Notification from '../models/Notification.js';
import Patient from '../models/Patient.js';
import asyncHandler from '../utils/asyncHandler.js';
import { findAccessiblePatient } from '../utils/patientAccess.js';
import writeAuditLog from '../utils/writeAuditLog.js';

const respond = (res, status, message, data) =>
  res.status(status).json({ success: true, message, data });

const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const sendPatientAccessError = (res, error) => {
  if (error === 'invalid') {
    return res.status(400).json({ success: false, message: 'Invalid patient ID.', data: null });
  }
  if (error === 'notFound') {
    return res.status(404).json({ success: false, message: 'Patient not found.', data: null });
  }
  return res.status(403).json({
    success: false,
    message: 'You do not have access to this patient.',
    data: null,
  });
};

const populatedAlertQuery = (query) =>
  query
    .populate({
      path: 'patientId',
      select: 'userId',
      populate: { path: 'userId', select: 'name' },
    })
    .populate({ path: 'doctorId', select: 'userId' })
    .sort({ createdAt: -1 })
    .lean();

export const listAlerts = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.severity) {
    if (!['low', 'medium', 'high', 'critical'].includes(req.query.severity)) {
      return res.status(400).json({ success: false, message: 'Invalid severity.', data: null });
    }
    filter.severity = req.query.severity;
  }
  if (req.query.status) {
    if (!['unread', 'acknowledged', 'resolved'].includes(req.query.status)) {
      return res.status(400).json({ success: false, message: 'Invalid alert status.', data: null });
    }
    filter.status = req.query.status;
  }

  if (req.user.role === 'patient') {
    const patient = await Patient.findOne({ userId: req.user._id }).select('_id').lean();
    if (!patient) return respond(res, 200, 'Alerts fetched successfully.', { alerts: [], page: 1, limit: 10, totalAlerts: 0, totalPages: 0 });
    if (req.query.patientId && String(req.query.patientId) !== String(patient._id)) {
      return sendPatientAccessError(res, 'forbidden');
    }
    filter.patientId = patient._id;
  } else if (req.user.role === 'doctor') {
    const doctor = await Doctor.findOne({ userId: req.user._id }).select('_id').lean();
    if (!doctor) return respond(res, 200, 'Alerts fetched successfully.', { alerts: [], page: 1, limit: 10, totalAlerts: 0, totalPages: 0 });
    filter.doctorId = doctor._id;
    if (req.query.patientId) {
      const access = await findAccessiblePatient(req.user, req.query.patientId);
      if (access.error) return sendPatientAccessError(res, access.error);
      filter.patientId = access.patient._id;
    }
  } else if (req.query.patientId) {
    if (!mongoose.isValidObjectId(req.query.patientId)) return sendPatientAccessError(res, 'invalid');
    filter.patientId = req.query.patientId;
  }

  const page = positiveInteger(req.query.page, 1);
  const limit = Math.min(50, positiveInteger(req.query.limit, 10));
  const [alerts, totalAlerts] = await Promise.all([
    populatedAlertQuery(
      Alert.find(filter).skip((page - 1) * limit).limit(limit),
    ),
    Alert.countDocuments(filter),
  ]);

  return respond(res, 200, 'Alerts fetched successfully.', {
    alerts,
    page,
    limit,
    totalAlerts,
    totalPages: Math.ceil(totalAlerts / limit),
  });
});

export const createManualAlert = asyncHandler(async (req, res) => {
  const { patientId, type, severity } = req.body;
  if (!patientId || !type || !severity) {
    return res.status(400).json({
      success: false,
      message: 'patientId, type, and severity are required.',
      data: null,
    });
  }
  if (!['systolic', 'diastolic', 'bloodSugar', 'heartRate', 'weight', 'oxygenLevel', 'manual'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid alert type.', data: null });
  }
  if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
    return res.status(400).json({ success: false, message: 'Invalid severity.', data: null });
  }

  const access = await findAccessiblePatient(req.user, patientId);
  if (access.error) return sendPatientAccessError(res, access.error);
  if (!access.doctor) {
    return res.status(403).json({ success: false, message: 'Doctor assignment is required.', data: null });
  }
  const label = type === 'bloodSugar' ? 'blood sugar' : type;
  const alert = await Alert.create({
    patientId: access.patient._id,
    doctorId: access.doctor._id,
    createdBy: req.user._id,
    type,
    severity,
    source: 'manual',
    message: `Doctor review requested for ${label} - needs clinical review.`,
  });
  await writeAuditLog({
    actorId: req.user._id,
    action: 'alert.create',
    resourceType: 'alert',
    resourceId: alert._id,
    ip: req.ip,
  });
  return respond(res, 201, 'Alert created successfully.', { alert });
});

export const createEmergencySOS = asyncHandler(async (req, res) => {
  const allowedFields = new Set(['location']);
  if (Object.keys(req.body || {}).some((field) => !allowedFields.has(field))) {
    return res.status(400).json({ success: false, message: 'Only an optional location may be included with an SOS.', data: null });
  }
  const clientRequestId = req.get('Idempotency-Key');
  if (!clientRequestId || !/^[\w-]{16,64}$/.test(clientRequestId)) {
    return res.status(400).json({ success: false, message: 'A valid Idempotency-Key is required.', data: null });
  }

  let location;
  if (req.body.location !== undefined) {
    const candidate = req.body.location;
    const latitude = candidate?.latitude;
    const longitude = candidate?.longitude;
    const accuracy = candidate?.accuracy;
    const capturedAt = new Date(candidate?.capturedAt);
    if (
      !candidate || typeof candidate !== 'object' || Array.isArray(candidate)
      || typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
      || typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000
      || Number.isNaN(capturedAt.getTime()) || capturedAt > new Date()
    ) {
      return res.status(400).json({ success: false, message: 'Optional location data is invalid.', data: null });
    }
    if (Date.now() - capturedAt.getTime() <= 24 * 60 * 60 * 1000) {
      location = { latitude, longitude, accuracy, capturedAt };
    }
  }

  const patient = await Patient.findOne({ userId: req.user._id }).select('_id doctorId').lean();
  if (!patient) {
    return res.status(404).json({ success: false, message: 'Patient profile not found.', data: null });
  }

  let alert = await Alert.findOne({ patientId: patient._id, clientRequestId });
  if (!alert) {
    try {
      alert = await Alert.create({
        patientId: patient._id,
        doctorId: patient.doctorId || null,
        createdBy: req.user._id,
        type: 'emergency',
        severity: 'critical',
        message: 'Patient requested urgent assistance. Review this request promptly.',
        source: 'sos',
        clientRequestId,
        ...(location && { emergencyLocation: location }),
      });
      await writeAuditLog({
        actorId: req.user._id,
        action: 'alert.create',
        resourceType: 'alert',
        resourceId: alert._id,
        ip: req.ip,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      alert = await Alert.findOne({ patientId: patient._id, clientRequestId });
      if (!alert) throw error;
    }
  }

  let notifiedDoctor = false;
  if (patient.doctorId) {
    const doctor = await Doctor.findById(patient.doctorId).select('userId').lean();
    if (doctor) {
      const eventKey = `emergency-sos:${patient._id}:${clientRequestId}`;
      await Notification.updateOne(
        { eventKey },
        {
          $setOnInsert: {
            recipientId: doctor.userId,
            alertId: alert._id,
            kind: 'alert',
            message: 'A patient has requested urgent assistance. Sign in to review the request.',
            eventKey,
          },
        },
        { upsert: true, runValidators: true },
      );
      notifiedDoctor = true;
    }
  }

  return res.status(201).json({
    success: true,
    message: notifiedDoctor
      ? 'Emergency request recorded and assigned doctor notified.'
      : 'Emergency request recorded, but no assigned doctor was available to notify.',
    data: { alert, notifiedDoctor },
  });
});

export const updateAlert = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid alert ID.', data: null });
  }
  if (!['acknowledged', 'resolved'].includes(req.body.status)) {
    return res.status(400).json({
      success: false,
      message: 'status must be acknowledged or resolved.',
      data: null,
    });
  }

  const alert = await Alert.findById(req.params.id);
  if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.', data: null });
  if (req.user.role === 'doctor') {
    const doctor = await Doctor.findOne({ userId: req.user._id }).select('_id').lean();
    if (!doctor || String(alert.doctorId) !== String(doctor._id)) {
      return res.status(403).json({ success: false, message: 'You cannot update this alert.', data: null });
    }
  }

  const validTransition =
    (alert.status === 'unread' && req.body.status === 'acknowledged') ||
    (alert.status === 'acknowledged' && req.body.status === 'resolved');
  if (!validTransition) {
    return res.status(409).json({
      success: false,
      message: 'Alerts must transition from unread to acknowledged, then to resolved.',
      data: null,
    });
  }

  alert.status = req.body.status;
  await alert.save();
  await writeAuditLog({
    actorId: req.user._id,
    action: 'alert.update',
    resourceType: 'alert',
    resourceId: alert._id,
    ip: req.ip,
  });
  return respond(res, 200, 'Alert updated successfully.', { alert });
});

export const deleteAlert = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid alert ID.', data: null });
  }
  const result = await Alert.deleteOne({ _id: req.params.id });
  if (!result.deletedCount) {
    return res.status(404).json({ success: false, message: 'Alert not found.', data: null });
  }
  await writeAuditLog({
    actorId: req.user._id,
    action: 'alert.delete',
    resourceType: 'alert',
    resourceId: req.params.id,
    ip: req.ip,
  });
  return respond(res, 200, 'Alert deleted successfully.', null);
});
