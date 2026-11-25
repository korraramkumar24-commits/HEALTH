import Alert from '../models/Alert.js';
import Appointment from '../models/Appointment.js';
import HealthRecord from '../models/HealthRecord.js';
import Medication from '../models/Medication.js';
import MedicationLog from '../models/MedicationLog.js';
import Note from '../models/Note.js';
import Notification from '../models/Notification.js';
import Patient from '../models/Patient.js';
import asyncHandler from '../utils/asyncHandler.js';
import { HEALTH_MEASUREMENTS } from '../utils/healthRecordRules.js';
import summarizeMedicationAdherence from '../utils/medicationAdherence.js';
import { getTrendLabel } from '../utils/trendRules.js';

const respond = (res, status, message, data) =>
  res.status(status).json({ success: true, message, data });

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const scheduledDateTime = (day, time) => {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(day);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

export const getPatientDashboard = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ userId: req.user._id }).select('_id').lean();
  if (!patient) {
    return res.status(404).json({ success: false, message: 'Patient profile not found.', data: null });
  }

  const now = new Date();
  const dayStart = startOfDay(now);
  const tomorrow = new Date(dayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const adherenceStart = startOfDay(now);
  adherenceStart.setDate(adherenceStart.getDate() - 29);
  const measurementPairs = HEALTH_MEASUREMENTS.map((type) => ({ type, value: `$${type}` }));

  const [
    latestReading,
    recentReadings,
    readings7Days,
    summaryGroups,
    unreadAlertsCount,
    alerts,
    medications,
    nextAppointment,
    latestRecommendation,
  ] = await Promise.all([
    HealthRecord.findOne({ patientId: patient._id }).sort({ recordedAt: -1 }).lean(),
    HealthRecord.find({ patientId: patient._id }).sort({ recordedAt: -1 }).limit(10).lean(),
    HealthRecord.find({
      patientId: patient._id,
      recordedAt: { $gte: sevenDaysAgo },
    })
      .select(`recordedAt ${HEALTH_MEASUREMENTS.join(' ')}`)
      .sort({ recordedAt: 1 })
      .limit(200)
      .lean(),
    HealthRecord.aggregate([
      { $match: { patientId: patient._id, recordedAt: { $gte: sevenDaysAgo } } },
      { $sort: { recordedAt: 1 } },
      { $project: { measurements: measurementPairs } },
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
    Alert.countDocuments({ patientId: patient._id, status: 'unread' }),
    Alert.find({ patientId: patient._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Medication.find({
      patientId: patient._id,
      isActive: true,
      startsAt: { $lte: now },
      $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
    })
      .sort({ name: 1 })
      .lean(),
    Appointment.findOne({
      patientId: patient._id,
      status: 'scheduled',
      startsAt: { $gte: now },
    })
      .sort({ startsAt: 1 })
      .populate({ path: 'doctorId', select: 'userId specialization', populate: { path: 'userId', select: 'name' } })
      .lean(),
    Note.findOne({ patientId: patient._id })
      .sort({ createdAt: -1 })
      .populate({ path: 'doctorId', select: 'userId', populate: { path: 'userId', select: 'name' } })
      .lean(),
  ]);

  const summary7Days = Object.fromEntries(
    HEALTH_MEASUREMENTS.map((measurement) => [
      measurement,
      { min: null, max: null, average: null, count: 0, trend: 'needs review' },
    ]),
  );
  for (const group of summaryGroups) {
    summary7Days[group._id] = {
      min: group.min,
      max: group.max,
      average: Number(group.average.toFixed(2)),
      count: group.count,
      trend: getTrendLabel(group._id, group.firstValue, group.lastValue),
    };
  }

  const startOfToday = startOfDay(now);
  const logs30Days = medications.length
    ? await MedicationLog.find({
      medicationId: { $in: medications.map(({ _id }) => _id) },
      scheduledFor: { $gte: adherenceStart, $lt: tomorrow },
    }).lean()
    : [];
  const adherence = summarizeMedicationAdherence(medications, logs30Days, now);
  const todayLogs = logs30Days.filter(
    (log) => log.scheduledFor >= startOfToday && log.scheduledFor < tomorrow,
  );
  const todayLogMap = new Map(
    todayLogs.map((log) => [`${log.medicationId}:${log.scheduledFor.getTime()}`, log]),
  );
  const medicationsWithTodayStatus = medications.map((medication) => ({
    ...medication,
    todayDoses: medication.scheduledTimes
      .map((time) => {
        const scheduledFor = scheduledDateTime(startOfToday, time);
        const log = todayLogMap.get(`${medication._id}:${scheduledFor.getTime()}`);
        return {
          time,
          scheduledFor,
          status: log?.status || 'pending',
          loggedAt: log?.loggedAt || null,
        };
      })
      .filter((dose) => dose.scheduledFor <= now),
  }));

  return respond(res, 200, 'Patient dashboard fetched successfully.', {
    latestReading: latestReading || null,
    summary7Days,
    recentReadings,
    readings7Days,
    unreadAlertsCount,
    alerts,
    medications: medicationsWithTodayStatus,
    medicationAdherence: adherence,
    nextAppointment: nextAppointment || null,
    latestRecommendation: latestRecommendation || null,
  });
});

export default getPatientDashboard;
