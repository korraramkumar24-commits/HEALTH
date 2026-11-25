import mongoose from 'mongoose';
import Alert from '../models/Alert.js';
import HealthRecord from '../models/HealthRecord.js';
import Medication from '../models/Medication.js';
import MedicationLog from '../models/MedicationLog.js';
import Note from '../models/Note.js';
import Patient from '../models/Patient.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HEALTH_MEASUREMENTS } from '../utils/healthRecordRules.js';
import { findAccessiblePatient } from '../utils/patientAccess.js';
import summarizeMedicationAdherence from '../utils/medicationAdherence.js';
import { getTrendLabel } from '../utils/trendRules.js';

const UNRESOLVED_STATUSES = ['unread', 'acknowledged'];
const respond = (res, status, message, data) =>
  res.status(status).json({ success: true, message, data });

const initializeSummary = () => Object.fromEntries(
  HEALTH_MEASUREMENTS.map((measurement) => [
    measurement,
    { min: null, max: null, average: null, count: 0, trend: 'needs review' },
  ]),
);

export const getPatientOverview = asyncHandler(async (req, res) => {
  const days = Number(req.query.days || 30);
  if (![7, 30, 90].includes(days)) {
    return res.status(400).json({
      success: false,
      message: 'days must be 7, 30, or 90.',
      data: null,
    });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid patient ID.', data: null });
  }

  const access = await findAccessiblePatient(req.user, req.params.id);
  if (access.error) {
    const status = access.error === 'notFound' ? 404 : access.error === 'invalid' ? 400 : 403;
    return res.status(status).json({
      success: false,
      message: access.error === 'notFound'
        ? 'Patient not found.'
        : access.error === 'invalid'
          ? 'Invalid patient ID.'
          : 'You do not have access to this patient.',
      data: null,
    });
  }

  const chartSince = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const summarySince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const adherenceSince = new Date();
  adherenceSince.setHours(0, 0, 0, 0);
  adherenceSince.setDate(adherenceSince.getDate() - 29);
  const measurementPairs = HEALTH_MEASUREMENTS.map((type) => ({ type, value: `$${type}` }));
  const [profile, latestReading, readings, summaryGroups, alerts, notes, medicationPlans] = await Promise.all([
    Patient.findById(access.patient._id)
      .populate({ path: 'userId', select: 'name email phone' })
      .populate({ path: 'disease', select: 'name description' })
      .populate({
        path: 'doctorId',
        select: 'specialization licenseNumber userId',
        populate: { path: 'userId', select: 'name email' },
      })
      .lean(),
    HealthRecord.findOne({ patientId: access.patient._id })
      .sort({ recordedAt: -1 })
      .lean(),
    HealthRecord.find({
      patientId: access.patient._id,
      recordedAt: { $gte: chartSince },
    })
      .select(`recordedAt ${HEALTH_MEASUREMENTS.join(' ')}`)
      .sort({ recordedAt: 1 })
      .lean(),
    HealthRecord.aggregate([
      { $match: { patientId: access.patient._id, recordedAt: { $gte: summarySince } } },
      { $sort: { recordedAt: 1 } },
      { $project: { recordedAt: 1, measurements: measurementPairs } },
      { $unwind: '$measurements' },
      { $match: { 'measurements.value': { $type: 'number' } } },
      {
        $group: {
          _id: '$measurements.type',
          min: { $min: '$measurements.value' },
          max: { $max: '$measurements.value' },
          average: { $avg: '$measurements.value' },
          count: { $sum: 1 },
          firstValue: { $first: '$measurements.value' },
          lastValue: { $last: '$measurements.value' },
        },
      },
    ]),
    Alert.find({
      patientId: access.patient._id,
      status: { $in: UNRESOLVED_STATUSES },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate({ path: 'doctorId', select: 'userId', populate: { path: 'userId', select: 'name' } })
      .lean(),
    Note.find({ patientId: access.patient._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate({ path: 'doctorId', select: 'userId', populate: { path: 'userId', select: 'name' } })
      .lean(),
    Medication.find({
      patientId: access.patient._id,
      startsAt: { $lte: new Date() },
      $or: [{ endsAt: null }, { endsAt: { $gte: adherenceSince } }],
    }).lean(),
  ]);

  const medicationsInWindow = medicationPlans.filter(
    (medication) => new Date(medication.startsAt) <= new Date(),
  );
  const doseLogs = medicationsInWindow.length
    ? await MedicationLog.find({
      medicationId: { $in: medicationsInWindow.map(({ _id }) => _id) },
      scheduledFor: { $gte: adherenceSince, $lte: new Date() },
    }).lean()
    : [];
  const medicationAdherence = summarizeMedicationAdherence(medicationsInWindow, doseLogs);
  const activeMedications = medicationsInWindow.filter(
    (medication) =>
      medication.isActive &&
      (!medication.endsAt || new Date(medication.endsAt) >= new Date()),
  );

  const summary30Days = initializeSummary();
  for (const group of summaryGroups) {
    summary30Days[group._id] = {
      min: group.min,
      max: group.max,
      average: Number(group.average.toFixed(2)),
      count: group.count,
      trend: getTrendLabel(group._id, group.firstValue, group.lastValue),
    };
  }

  return respond(res, 200, 'Patient overview fetched successfully.', {
    profile,
    latestReading: latestReading || null,
    summary30Days,
    readings,
    days,
    unresolvedAlerts: alerts,
    notes,
    activeMedications,
    medicationAdherence: medicationAdherence.percentage,
    medicationAdherenceDetails: medicationAdherence,
    medicationTrackingAvailable: true,
  });
});

export default getPatientOverview;
