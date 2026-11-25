import Disease from '../models/Disease.js';
import Patient from '../models/Patient.js';
import asyncHandler from '../utils/asyncHandler.js';

const respond = (res, status, message, data) =>
  res.status(status).json({ success: true, message, data });

export const listDiseases = asyncHandler(async (_req, res) => {
  const diseases = await Disease.find().sort({ name: 1 }).lean();
  return respond(res, 200, 'Diseases fetched successfully.', { diseases });
});

export const createDisease = asyncHandler(async (req, res) => {
  const disease = await Disease.create({
    name: req.body.name,
    description: req.body.description,
  });
  return respond(res, 201, 'Disease created successfully.', { disease });
});

export const updateDisease = asyncHandler(async (req, res) => {
  const disease = await Disease.findByIdAndUpdate(
    req.params.id,
    { $set: { name: req.body.name, description: req.body.description } },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!disease) {
    return res.status(404).json({ success: false, message: 'Disease not found.', data: null });
  }
  return respond(res, 200, 'Disease updated successfully.', { disease });
});

export const deleteDisease = asyncHandler(async (req, res) => {
  if (await Patient.exists({ disease: req.params.id })) {
    return res.status(409).json({ success: false, message: 'Disease is assigned to patients and cannot be deleted.', data: null });
  }
  const disease = await Disease.findByIdAndDelete(req.params.id).lean();
  if (!disease) {
    return res.status(404).json({ success: false, message: 'Disease not found.', data: null });
  }
  return respond(res, 200, 'Disease deleted successfully.', null);
});
