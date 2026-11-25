import mongoose from 'mongoose';
import Alert from '../models/Alert.js';
import Doctor from '../models/Doctor.js';
import HealthRecord from '../models/HealthRecord.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';

const HIGH_SEVERITIES = ['high', 'critical'];
const UNRESOLVED_STATUSES = ['unread', 'acknowledged'];
const PAGE_SIZE_MAX = 50;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const respond = (res, status, message, data) =>
  res.status(status).json({ success: true, message, data });

const patientDashboardLookupStages = [
  {
    $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: '_id',
      pipeline: [{ $project: { name: 1, email: 1 } }],
      as: 'userId',
    },
  },
  { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: 'diseases',
      localField: 'disease',
      foreignField: '_id',
      pipeline: [{ $project: { name: 1 } }],
      as: 'disease',
    },
  },
  { $unwind: { path: '$disease', preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: 'healthrecords',
      let: { patientId: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$patientId', '$$patientId'] } } },
        { $sort: { recordedAt: -1 } },
        { $limit: 1 },
        {
          $project: {
            recordedAt: 1,
            systolic: 1,
            diastolic: 1,
            bloodSugar: 1,
            heartRate: 1,
            weight: 1,
            oxygenLevel: 1,
          },
        },
      ],
      as: 'latestReading',
    },
  },
  { $unwind: { path: '$latestReading', preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: 'alerts',
      let: { patientId: '$_id' },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ['$patientId', '$$patientId'] },
            severity: { $in: HIGH_SEVERITIES },
            status: { $in: UNRESOLVED_STATUSES },
          },
        },
        { $project: { severity: 1 } },
      ],
      as: 'attentionAlerts',
    },
  },
  {
    $lookup: {
      from: 'alerts',
      let: { patientId: '$_id' },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ['$patientId', '$$patientId'] },
            status: { $in: UNRESOLVED_STATUSES },
          },
        },
        { $project: { severity: 1 } },
      ],
      as: 'patientAlerts',
    },
  },
];

const alertSeverityNumber = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const getDoctorDashboard = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findOne({ userId: req.user._id }).select('_id').lean();
  if (!doctor) {
    return respond(res, 200, 'Doctor dashboard fetched successfully.', {
      totalPatients: 0,
      activePatients: 0,
      needsAttention: 0,
      criticalAlerts: 0,
      recentAlerts: [],
      readingsStatusBreakdown: { normal: 0, warning: 0, critical: 0 },
      patients: [],
      page: 1,
      limit: 10,
      totalFilteredPatients: 0,
      totalPages: 0,
    });
  }

  const page = positiveInteger(req.query.page, 1);
  const limit = Math.min(PAGE_SIZE_MAX, positiveInteger(req.query.limit, 10));
  const patientMatch = { doctorId: doctor._id };
  if (req.query.disease) {
    if (!mongoose.isValidObjectId(req.query.disease)) {
      return res.status(400).json({ success: false, message: 'Invalid disease ID.', data: null });
    }
    patientMatch.disease = new mongoose.Types.ObjectId(req.query.disease);
  }
  if (req.query.status) {
    if (!['active', 'inactive'].includes(req.query.status)) {
      return res.status(400).json({ success: false, message: 'Invalid patient status.', data: null });
    }
    patientMatch.status = req.query.status;
  }
  if (req.query.alertSeverity && !['low', 'medium', 'high', 'critical'].includes(req.query.alertSeverity)) {
    return res.status(400).json({ success: false, message: 'Invalid alert severity.', data: null });
  }
  const search = String(req.query.search || '').trim();
  const assignedPatientIds = await Patient.find({ doctorId: doctor._id }).distinct('_id');
  const patientFilters = [];
  if (search) {
    const expression = new RegExp(escapeRegex(search), 'i');
    patientFilters.push({ $or: [{ 'userId.name': expression }, { 'userId.email': expression }] });
    if (mongoose.isValidObjectId(search)) {
      patientFilters[patientFilters.length - 1].$or.push({
        _id: new mongoose.Types.ObjectId(search),
      });
    }
  }
  if (req.query.alertSeverity) {
    patientFilters.push({ 'patientAlerts.severity': req.query.alertSeverity });
  }

  const [dashboardResults, criticalAlerts, recentAlerts, readingsStatus] = await Promise.all([
    Patient.aggregate([
      { $match: patientMatch },
      ...patientDashboardLookupStages,
      {
        $facet: {
          statistics: [
            {
              $group: {
                _id: null,
                totalPatients: { $sum: 1 },
                activePatients: {
                  $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
                },
                needsAttention: {
                  $sum: { $cond: [{ $gt: [{ $size: '$attentionAlerts' }, 0] }, 1, 0] },
                },
              },
            },
          ],
          patients: [
            ...(patientFilters.length ? [{ $match: { $and: patientFilters } }] : []),
            { $sort: { 'userId.name': 1, _id: 1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                userId: 1,
                disease: 1,
                status: 1,
                latestReading: 1,
                needsAttention: { $gt: [{ $size: '$attentionAlerts' }, 0] },
                highestAlertSeverity: { $arrayElemAt: ['$patientAlerts.severity', 0] },
              },
            },
          ],
          filteredCount: [
            ...(patientFilters.length ? [{ $match: { $and: patientFilters } }] : []),
            { $count: 'total' },
          ],
        },
      },
    ]),
    Alert.countDocuments({
      doctorId: doctor._id,
      severity: 'critical',
      status: { $in: UNRESOLVED_STATUSES },
    }),
    Alert.aggregate([
      { $match: { doctorId: doctor._id } },
      { $sort: { createdAt: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'patients',
          localField: 'patientId',
          foreignField: '_id',
          pipeline: [
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                pipeline: [{ $project: { name: 1 } }],
                as: 'userId',
              },
            },
            { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
            { $project: { userId: 1 } },
          ],
          as: 'patientId',
        },
      },
      { $unwind: { path: '$patientId', preserveNullAndEmptyArrays: true } },
    ]),
    HealthRecord.aggregate([
      {
        $match: {
          patientId: {
            $in: assignedPatientIds,
          },
          recordedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $lookup: {
          from: 'alerts',
          let: { recordId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$healthRecordId', '$$recordId'] },
              },
            },
            {
              $project: {
                severityRank: {
                  $switch: {
                    branches: Object.entries(alertSeverityNumber).map(([severity, rank]) => ({
                      case: { $eq: ['$severity', severity] },
                      then: rank,
                    })),
                    default: 0,
                  },
                },
              },
            },
          ],
          as: 'recordAlerts',
        },
      },
      {
        $addFields: {
          severityRank: { $max: '$recordAlerts.severityRank' },
        },
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $gte: ['$severityRank', 4] }, then: 'critical' },
                { case: { $gte: ['$severityRank', 3] }, then: 'critical' },
                { case: { $gte: ['$severityRank', 1] }, then: 'warning' },
              ],
              default: 'normal',
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const dashboard = dashboardResults[0] || {};
  const statistics = dashboard.statistics?.[0] || {};
  const counts = dashboard.filteredCount?.[0]?.total || 0;
  const breakdown = { normal: 0, warning: 0, critical: 0 };
  for (const item of readingsStatus) breakdown[item._id] = item.count;

  return respond(res, 200, 'Doctor dashboard fetched successfully.', {
    totalPatients: statistics.totalPatients || 0,
    activePatients: statistics.activePatients || 0,
    needsAttention: statistics.needsAttention || 0,
    criticalAlerts,
    recentAlerts,
    readingsStatusBreakdown: breakdown,
    patients: dashboard.patients || [],
    page,
    limit,
    totalFilteredPatients: counts,
    totalPages: Math.ceil(counts / limit),
  });
});

export const getAdminDashboard = asyncHandler(async (_req, res) => {
  const now = new Date();
  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  firstDay.setUTCDate(firstDay.getUTCDate() - 13);

  const [roleCounts, patientsPerDoctor, patientsPerDisease, alertBreakdown, readingCounts] = await Promise.all([
    User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    Patient.aggregate([
      {
        $lookup: {
          from: 'doctors',
          localField: 'doctorId',
          foreignField: '_id',
          as: 'doctor',
        },
      },
      { $unwind: { path: '$doctor', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'doctor.userId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: 'doctorUser',
        },
      },
      { $unwind: { path: '$doctorUser', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$doctor._id',
          doctorName: { $first: { $ifNull: ['$doctorUser.name', 'Unassigned'] } },
          patientCount: { $sum: 1 },
        },
      },
      { $sort: { patientCount: -1, doctorName: 1 } },
      { $project: { _id: 0, doctorId: '$_id', doctorName: 1, patientCount: 1 } },
    ]),
    Patient.aggregate([
      {
        $lookup: {
          from: 'diseases',
          localField: 'disease',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: 'disease',
        },
      },
      { $unwind: { path: '$disease', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$disease._id',
          diseaseName: { $first: { $ifNull: ['$disease.name', 'No disease assigned'] } },
          patientCount: { $sum: 1 },
        },
      },
      { $sort: { patientCount: -1, diseaseName: 1 } },
      { $project: { _id: 0, diseaseId: '$_id', diseaseName: 1, patientCount: 1 } },
    ]),
    Alert.aggregate([
      {
        $facet: {
          bySeverity: [
            { $group: { _id: '$severity', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]),
    HealthRecord.aggregate([
      { $match: { createdAt: { $gte: firstDay, $lte: now } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const usersByRole = { patient: 0, doctor: 0, admin: 0 };
  for (const item of roleCounts) usersByRole[item._id] = item.count;
  const readingCountByDate = new Map(readingCounts.map((item) => [item._id, item.count]));
  const readingsSubmittedPerDay = Array.from({ length: 14 }, (_value, index) => {
    const day = new Date(firstDay);
    day.setUTCDate(firstDay.getUTCDate() + index);
    const date = day.toISOString().slice(0, 10);
    return { date, count: readingCountByDate.get(date) || 0 };
  });
  const alerts = alertBreakdown[0] || { bySeverity: [], byStatus: [] };

  return res.status(200).json({
    success: true,
    message: 'Admin dashboard fetched successfully.',
    data: {
      totalUsers: Object.values(usersByRole).reduce((total, count) => total + count, 0),
      usersByRole,
      patientsPerDoctor,
      patientsPerDisease,
      alerts: {
        bySeverity: alerts.bySeverity.map(({ _id, count }) => ({ severity: _id, count })),
        byStatus: alerts.byStatus.map(({ _id, count }) => ({ status: _id, count })),
      },
      readingsSubmittedPerDay,
    },
  });
});

export default getDoctorDashboard;
