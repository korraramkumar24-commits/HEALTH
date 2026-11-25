import mongoose from 'mongoose';
import Doctor from '../models/Doctor.js';
import Note from '../models/Note.js';
import Patient from '../models/Patient.js';
import asyncHandler from '../utils/asyncHandler.js';
import { findAccessiblePatient } from '../utils/patientAccess.js';

const respond = (res, status, message, data) =>
  res.status(status).json({ success: true, message, data });

const accessError = (res, error) => {
  if (error === 'invalid') return res.status(400).json({ success: false, message: 'Invalid patient ID.', data: null });
  if (error === 'notFound') return res.status(404).json({ success: false, message: 'Patient not found.', data: null });
  return res.status(403).json({ success: false, message: 'You do not have access to this patient.', data: null });
};

export const listNotes = asyncHandler(async (req, res) => {
  const query = {};
  if (req.user.role === 'patient') {
    const patient = await Patient.findOne({ userId: req.user._id }).select('_id').lean();
    if (!patient) return respond(res, 200, 'Recommendations fetched successfully.', { notes: [] });
    if (req.query.patientId && String(req.query.patientId) !== String(patient._id)) {
      return accessError(res, 'forbidden');
    }
    query.patientId = patient._id;
  } else if (req.user.role === 'doctor') {
    const doctor = await Doctor.findOne({ userId: req.user._id }).select('_id').lean();
    if (!doctor) return respond(res, 200, 'Notes fetched successfully.', { notes: [] });
    query.doctorId = doctor._id;
    if (req.query.patientId) {
      const access = await findAccessiblePatient(req.user, req.query.patientId);
      if (access.error) return accessError(res, access.error);
      query.patientId = access.patient._id;
    }
  } else if (req.query.patientId) {
    if (!mongoose.isValidObjectId(req.query.patientId)) return accessError(res, 'invalid');
    query.patientId = req.query.patientId;
  }

  const notes = await Note.find(query)
    .sort({ createdAt: -1 })
    .populate({ path: 'doctorId', select: 'userId', populate: { path: 'userId', select: 'name' } })
    .lean();
  return respond(res, 200, 'Recommendations fetched successfully.', { notes });
});

export const createNote = asyncHandler(async (req, res) => {
  const { patientId, content } = req.body;
  if (typeof patientId !== 'string' || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({
      success: false,
      message: 'patientId and recommendation content are required.',
      data: null,
    });
  }
  if (content.trim().length > 4000) {
    return res.status(400).json({ success: false, message: 'Recommendation cannot exceed 4000 characters.', data: null });
  }

  const access = await findAccessiblePatient(req.user, patientId);
  if (access.error) return accessError(res, access.error);
  if (!access.doctor) {
    return res.status(403).json({ success: false, message: 'Doctor assignment is required.', data: null });
  }

  const note = await Note.create({
    patientId: access.patient._id,
    doctorId: access.doctor._id,
    authorId: req.user._id,
    content: content.trim(),
  });
  return respond(res, 201, 'Recommendation added successfully.', { note });
});
