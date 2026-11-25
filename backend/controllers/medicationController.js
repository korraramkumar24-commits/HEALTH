import mongoose from 'mongoose';
import Doctor from '../models/Doctor.js';
import Medication from '../models/Medication.js';
import MedicationLog from '../models/MedicationLog.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import summarizeMedicationAdherence from '../utils/medicationAdherence.js';
import { findAccessiblePatient } from '../utils/patientAccess.js';

const respond = (res, status, message, data) =>
  res.status(status).json({ success: true, message, data });

const accessError = (res, error) => {
  const status = error === 'notFound' ? 404 : error === 'invalid' ? 400 : 403;
  const message = error === 'notFound'
    ? 'Patient not found.'
    : error === 'invalid'
      ? 'Invalid patient ID.'
      : 'You do not have access to this patient.';
  return res.status(status).json({ success: false, message, data: null });
};

const localDateAt = (dateValue, time) => {
  const date = new Date(dateValue);
  const [hours, minutes] = time.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const isActiveOn = (medication, now) =>
  medication.isActive &&
  new Date(medication.startsAt) <= now &&
  (!medication.endsAt || new Date(medication.endsAt) >= now);

export const createMedication = asyncHandler(async (req, res) => {
  const { patientId, name, instructions, scheduledTimes, startsAt, endsAt } = req.body;
  if (
    typeof patientId !== 'string' ||
    typeof name !== 'string' ||
    !name.trim() ||
    typeof instructions !== 'string' ||
    !instructions.trim() ||
    !Array.isArray(scheduledTimes) ||
    scheduledTimes.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'patientId, name, instructions entered by the clinician, and scheduledTimes are required.',
      data: null,
    });
  }

  const access = await findAccessiblePatient(req.user, patientId);
  if (access.error) return accessError(res, access.error);

  let prescriber;
  if (req.user.role === 'doctor') {
    if (!access.doctor) {
      return res.status(403).json({ success: false, message: 'Doctor assignment is required.', data: null });
    }
    prescriber = req.user._id;
  } else {
    if (!access.patient.doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Assign a doctor before creating a medication plan.',
        data: null,
      });
    }
    const doctor = await Doctor.findById(access.patient.doctorId).select('userId').lean();
    if (!doctor || !(await User.exists({ _id: doctor.userId, role: 'doctor', isActive: true }))) {
      return res.status(400).json({ success: false, message: 'The assigned doctor is unavailable.', data: null });
    }
    prescriber = doctor.userId;
  }

  const medication = await Medication.create({
    patientId: access.patient._id,
    prescribedBy: prescriber,
    name: name.trim(),
    instructions: instructions.trim(),
    scheduledTimes,
    startsAt: startsAt || new Date(),
    endsAt: endsAt || null,
  });
  return respond(res, 201, 'Medication plan created successfully.', { medication });
});

export const listMedications = asyncHandler(async (req, res) => {
  let patientIds;
  if (req.user.role === 'patient') {
    const patient = await Patient.findOne({ userId: req.user._id }).select('_id').lean();
    patientIds = patient ? [patient._id] : [];
    if (req.query.patientId && (!patient || String(patient._id) !== String(req.query.patientId))) {
      return accessError(res, 'forbidden');
    }
  } else if (req.user.role === 'doctor') {
    const doctor = await Doctor.findOne({ userId: req.user._id }).select('_id').lean();
    if (!doctor) return respond(res, 200, 'Medications fetched successfully.', { medications: [] });
    if (req.query.patientId) {
      const access = await findAccessiblePatient(req.user, req.query.patientId);
      if (access.error) return accessError(res, access.error);
      patientIds = [access.patient._id];
    } else {
      patientIds = await Patient.find({ doctorId: doctor._id }).distinct('_id');
    }
  } else if (req.query.patientId) {
    if (!mongoose.isValidObjectId(req.query.patientId)) return accessError(res, 'invalid');
    patientIds = [new mongoose.Types.ObjectId(req.query.patientId)];
  }

  const filter = {};
  if (patientIds) filter.patientId = { $in: patientIds };
  const medications = await Medication.find(filter)
    .sort({ isActive: -1, startsAt: -1, createdAt: -1 })
    .populate({ path: 'patientId', select: 'userId', populate: { path: 'userId', select: 'name' } })
    .populate({ path: 'prescribedBy', select: 'name' })
    .lean();
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const logs = medications.length
    ? await MedicationLog.find({
      medicationId: { $in: medications.map(({ _id }) => _id) },
      scheduledFor: { $gte: startOfDay, $lt: endOfDay },
    }).lean()
    : [];
  const adherenceStart = new Date(startOfDay);
  adherenceStart.setDate(adherenceStart.getDate() - 29);
  const logs30Days = medications.length
    ? await MedicationLog.find({
      medicationId: { $in: medications.map(({ _id }) => _id) },
      scheduledFor: { $gte: adherenceStart, $lt: endOfDay },
    }).lean()
    : [];
  const logMap = new Map(logs.map((log) => [`${log.medicationId}:${log.scheduledFor.getHours()}:${log.scheduledFor.getMinutes()}`, log]));
  const logsByMedication = new Map();
  for (const log of logs30Days) {
    const key = String(log.medicationId);
    const entries = logsByMedication.get(key) || [];
    entries.push(log);
    logsByMedication.set(key, entries);
  }

  const withTodayStatus = medications.map((medication) => ({
    ...medication,
    activeToday: isActiveOn(medication, today),
    adherence30Days: summarizeMedicationAdherence(
      [medication],
      logsByMedication.get(String(medication._id)) || [],
      today,
    ),
    todayDoses: medication.scheduledTimes.map((time) => {
      const scheduledFor = localDateAt(startOfDay, time);
      const log = logMap.get(`${medication._id}:${scheduledFor.getHours()}:${scheduledFor.getMinutes()}`);
      return {
        time,
        scheduledFor,
        status: log?.status || 'pending',
        loggedAt: log?.loggedAt || null,
      };
    }),
  }));

  return respond(res, 200, 'Medications fetched successfully.', { medications: withTodayStatus });
});

export const logMedicationDose = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid medication ID.', data: null });
  }
  const { status, scheduledFor } = req.body;
  if (!['taken', 'missed', 'skipped'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'status must be taken, missed, or skipped.',
      data: null,
    });
  }
  const medication = await Medication.findById(req.params.id);
  if (!medication) return res.status(404).json({ success: false, message: 'Medication not found.', data: null });
  const patient = await Patient.findById(medication.patientId).select('_id userId').lean();
  if (!patient || String(patient.userId) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'You can only log your own doses.', data: null });
  }
  if (!isActiveOn(medication, new Date())) {
    return res.status(400).json({ success: false, message: 'This medication plan is not active today.', data: null });
  }
  if (typeof scheduledFor !== 'string' || Number.isNaN(new Date(scheduledFor).getTime())) {
    return res.status(400).json({ success: false, message: 'A valid scheduledFor date is required.', data: null });
  }
  const scheduledDate = new Date(scheduledFor);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  if (scheduledDate < startOfDay || scheduledDate >= endOfDay) {
    return res.status(400).json({ success: false, message: 'Doses can only be logged for today.', data: null });
  }
  const scheduledTime = `${String(scheduledDate.getHours()).padStart(2, '0')}:${String(scheduledDate.getMinutes()).padStart(2, '0')}`;
  if (!medication.scheduledTimes.includes(scheduledTime)) {
    return res.status(400).json({ success: false, message: 'scheduledFor must match a scheduled dose time.', data: null });
  }
  try {
    const log = await MedicationLog.create({
      medicationId: medication._id,
      patientId: patient._id,
      scheduledFor: scheduledDate,
      status,
    });
    return respond(res, 201, 'Medication dose logged successfully.', { log });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A status has already been logged for this scheduled dose.',
        data: null,
      });
    }
    throw error;
  }
});

export const getMedicationLogs = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid medication ID.', data: null });
  }
  const medication = await Medication.findById(req.params.id).select('patientId').lean();
  if (!medication) return res.status(404).json({ success: false, message: 'Medication not found.', data: null });
  const access = await findAccessiblePatient(req.user, medication.patientId);
  if (access.error) return accessError(res, access.error);
  const logs = await MedicationLog.find({ medicationId: medication._id })
    .sort({ scheduledFor: -1 })
    .limit(100)
    .lean();
  return respond(res, 200, 'Medication logs fetched successfully.', { logs });
});
