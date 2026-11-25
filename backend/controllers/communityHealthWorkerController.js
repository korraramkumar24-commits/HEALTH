import mongoose from 'mongoose';
import CommunityHealthWorker from '../models/CommunityHealthWorker.js';
import asyncHandler from '../utils/asyncHandler.js';
import writeAuditLog from '../utils/writeAuditLog.js';

const allowedFields = new Set(['name', 'phone', 'serviceArea', 'languages', 'latitude', 'longitude']);

const invalid = (res, message) =>
  res.status(400).json({ success: false, message, data: null });

const parseCoordinates = (body) => {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (
    body.latitude === undefined || body.longitude === undefined
    || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) return null;
  return [longitude, latitude];
};

const validateFields = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Request body must be an object.';
  if (Object.keys(body).some((field) => !allowedFields.has(field))) return 'One or more fields are not allowed.';
  if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 100) {
    return 'Name must contain 2 to 100 characters.';
  }
  if (typeof body.phone !== 'string' || !/^\+?[0-9 .()-]{7,24}$/.test(body.phone.trim())) {
    return 'Enter a valid phone number.';
  }
  if (typeof body.serviceArea !== 'string' || !body.serviceArea.trim() || body.serviceArea.length > 160) {
    return 'Service area is required and must not exceed 160 characters.';
  }
  if (body.languages !== undefined && (
    !Array.isArray(body.languages)
    || body.languages.length > 10
    || body.languages.some((language) => typeof language !== 'string' || !language.trim() || language.length > 40)
  )) return 'Languages must be a list of up to 10 names, each no longer than 40 characters.';
  if (!parseCoordinates(body)) return 'Valid latitude and longitude are required.';
  return '';
};

const workerFields = (body) => ({
  name: body.name.trim(),
  phone: body.phone.trim(),
  serviceArea: body.serviceArea.trim(),
  languages: (body.languages || []).map((language) => language.trim()),
  location: { type: 'Point', coordinates: parseCoordinates(body) },
});

export const listNearbyCommunityHealthWorkers = asyncHandler(async (req, res) => {
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  const radiusKm = req.query.radiusKm === undefined ? 25 : Number(req.query.radiusKm);
  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    || !Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 100
  ) return invalid(res, 'Valid coordinates and a radius from 1 to 100 km are required.');

  const workers = await CommunityHealthWorker.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [longitude, latitude] },
        key: 'location',
        distanceField: 'distanceMeters',
        maxDistance: radiusKm * 1000,
        spherical: true,
        query: { isActive: true },
      },
    },
    { $limit: 30 },
    {
      $project: {
        _id: 1,
        name: 1,
        phone: 1,
        serviceArea: 1,
        languages: 1,
        distanceKm: { $round: [{ $divide: ['$distanceMeters', 1000] }, 1] },
      },
    },
  ]);
  return res.status(200).json({
    success: true,
    message: 'Nearby community health workers fetched.',
    data: { workers, radiusKm },
  });
});

export const listCommunityHealthWorkers = asyncHandler(async (_req, res) => {
  const workers = await CommunityHealthWorker.find()
    .select('name phone serviceArea languages location isActive createdAt')
    .sort({ isActive: -1, serviceArea: 1, name: 1 })
    .lean();
  return res.status(200).json({ success: true, message: 'Community health workers fetched.', data: { workers } });
});

export const createCommunityHealthWorker = asyncHandler(async (req, res) => {
  const error = validateFields(req.body);
  if (error) return invalid(res, error);
  const worker = await CommunityHealthWorker.create({
    ...workerFields(req.body),
    createdBy: req.user._id,
  });
  await writeAuditLog({
    actorId: req.user._id,
    action: 'communityHealthWorker.create',
    resourceType: 'communityHealthWorker',
    resourceId: worker._id,
    ip: req.ip,
  });
  return res.status(201).json({ success: true, message: 'Community health worker added.', data: { worker } });
});

export const updateCommunityHealthWorker = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalid(res, 'Invalid community health worker ID.');
  const error = validateFields(req.body);
  if (error) return invalid(res, error);
  const worker = await CommunityHealthWorker.findByIdAndUpdate(
    req.params.id,
    { $set: workerFields(req.body) },
    { new: true, runValidators: true },
  );
  if (!worker) return res.status(404).json({ success: false, message: 'Community health worker not found.', data: null });
  await writeAuditLog({
    actorId: req.user._id,
    action: 'communityHealthWorker.update',
    resourceType: 'communityHealthWorker',
    resourceId: worker._id,
    ip: req.ip,
  });
  return res.status(200).json({ success: true, message: 'Community health worker updated.', data: { worker } });
});

export const deactivateCommunityHealthWorker = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalid(res, 'Invalid community health worker ID.');
  const worker = await CommunityHealthWorker.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: false } },
    { new: true, runValidators: true },
  );
  if (!worker) return res.status(404).json({ success: false, message: 'Community health worker not found.', data: null });
  await writeAuditLog({
    actorId: req.user._id,
    action: 'communityHealthWorker.deactivate',
    resourceType: 'communityHealthWorker',
    resourceId: worker._id,
    ip: req.ip,
  });
  return res.status(200).json({ success: true, message: 'Community health worker deactivated.', data: { worker } });
});
