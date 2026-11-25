import mongoose from 'mongoose';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';
import Disease from '../models/Disease.js';
import asyncHandler from '../utils/asyncHandler.js';
import writeAuditLog from '../utils/writeAuditLog.js';

const patientProjection = {
  path: 'userId',
  select: 'name email phone role isActive',
};
const diseaseProjection = { path: 'disease', select: 'name description' };
const doctorProjection = {
  path: 'doctorId',
  select: 'specialization licenseNumber',
  populate: { path: 'userId', select: 'name email' },
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const positiveInteger = (value, fallback) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
};

const respond = (res, status, message, data) =>
  res.status(status).json({ success: true, message, data });

const populatedPatientQuery = (query) =>
  query.populate(patientProjection).populate(diseaseProjection).populate(doctorProjection).lean();

const validateReferences = async ({ disease, doctorId }) => {
  if (disease && !(await Disease.exists({ _id: disease }))) {
    return 'Disease not found.';
  }
  if (doctorId && !(await Doctor.exists({ _id: doctorId }))) {
    return 'Doctor not found.';
  }
  return null;
};

export const listPatients = asyncHandler(async (req, res) => {
  const page = positiveInteger(req.query.page, 1);
  const limit = Math.min(50, positiveInteger(req.query.limit, 10));
  const filter = {};

  if (req.user.role === 'patient') {
    filter.userId = req.user._id;
  } else if (req.user.role === 'doctor') {
    const doctor = await Doctor.findOne({ userId: req.user._id }).select('_id').lean();
    if (!doctor) {
      return respond(res, 200, 'Patients fetched successfully.', {
        patients: [],
        page,
        limit,
        totalPatients: 0,
        totalPages: 0,
      });
    }
    filter.doctorId = doctor._id;
  }

  if (req.query.disease) {
    if (!mongoose.isValidObjectId(req.query.disease)) {
      return res.status(400).json({ success: false, message: 'Invalid disease ID.', data: null });
    }
    filter.disease = req.query.disease;
  }
  if (req.query.status) {
    if (!['active', 'inactive'].includes(req.query.status)) {
      return res.status(400).json({ success: false, message: 'Invalid patient status.', data: null });
    }
    filter.status = req.query.status;
  }

  const search = String(req.query.search || '').trim();
  if (search) {
    const expression = new RegExp(escapeRegex(search), 'i');
    const matchingUsers = await User.find({
      $or: [{ name: expression }, { email: expression }],
    }).select('_id').lean();
    const searchConditions = [{ userId: { $in: matchingUsers.map((user) => user._id) } }];
    if (mongoose.isValidObjectId(search)) {
      searchConditions.push({ _id: search });
    }
    filter.$or = searchConditions;
  }

  const [patients, totalPatients] = await Promise.all([
    populatedPatientQuery(
      Patient.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ),
    Patient.countDocuments(filter),
  ]);

  return respond(res, 200, 'Patients fetched successfully.', {
    patients,
    page,
    limit,
    totalPatients,
    totalPages: Math.ceil(totalPatients / limit),
  });
});

export const getPatient = asyncHandler(async (req, res) => {
  const patient = await populatedPatientQuery(Patient.findById(req.patient._id));
  return respond(res, 200, 'Patient fetched successfully.', { patient });
});

export const getMyPatient = asyncHandler(async (req, res) => {
  const patient = await populatedPatientQuery(Patient.findOne({ userId: req.user._id }));
  if (!patient) {
    return res.status(404).json({ success: false, message: 'Patient profile not found.', data: null });
  }
  return respond(res, 200, 'Patient fetched successfully.', { patient });
});

export const createPatient = asyncHandler(async (req, res) => {
  const { name, email, password, phone, dateOfBirth, gender, disease, doctorId, emergencyContact } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required.', data: null });
  }

  const referenceError = await validateReferences({ disease, doctorId });
  if (referenceError) {
    return res.status(400).json({ success: false, message: referenceError, data: null });
  }

  const user = await User.create({ name, email, password, phone, role: 'patient' });
  try {
    const patient = await Patient.create({
      userId: user._id,
      dateOfBirth,
      gender,
      disease: disease || undefined,
      doctorId: doctorId || undefined,
      emergencyContact,
    });
    const hydrated = await populatedPatientQuery(Patient.findById(patient._id));
    await writeAuditLog({
      actorId: req.user._id,
      action: 'patient.create',
      resourceType: 'patient',
      resourceId: patient._id,
      ip: req.ip,
    });
    return respond(res, 201, 'Patient created successfully.', { patient: hydrated });
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }
});

export const updatePatient = asyncHandler(async (req, res) => {
  if (req.user.role === 'doctor') {
    return res.status(403).json({ success: false, message: 'Doctors cannot edit patient profiles.', data: null });
  }

  const { name, email, phone, dateOfBirth, gender, disease, emergencyContact, status } = req.body;
  if (status !== undefined && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Only administrators can change patient status.', data: null });
  }
  if (status !== undefined && !['active', 'inactive'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid patient status.', data: null });
  }
  const patient = await Patient.findById(req.patient._id);
  const user = await User.findById(patient.userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Patient account not found.', data: null });
  }

  if (disease && !(await Disease.exists({ _id: disease }))) {
    return res.status(400).json({ success: false, message: 'Disease not found.', data: null });
  }
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (phone !== undefined) user.phone = phone;
  await user.save();

  if (dateOfBirth !== undefined) patient.dateOfBirth = dateOfBirth || undefined;
  if (gender !== undefined) patient.gender = gender;
  if (disease !== undefined) patient.disease = disease || undefined;
  if (emergencyContact !== undefined) {
    patient.emergencyContact = {
      name: emergencyContact?.name || '',
      phone: emergencyContact?.phone || '',
    };
  }
  if (status !== undefined) patient.status = status;
  await patient.save();

  const hydrated = await populatedPatientQuery(Patient.findById(patient._id));
  await writeAuditLog({
    actorId: req.user._id,
    action: 'patient.update',
    resourceType: 'patient',
    resourceId: patient._id,
    ip: req.ip,
  });
  return respond(res, 200, 'Patient updated successfully.', { patient: hydrated });
});

export const deletePatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findByIdAndUpdate(
    req.patient._id,
    { $set: { status: 'inactive' } },
    { returnDocument: 'after' },
  ).lean();
  await writeAuditLog({
    actorId: req.user._id,
    action: 'patient.deactivate',
    resourceType: 'patient',
    resourceId: req.patient._id,
    ip: req.ip,
  });
  return respond(res, 200, 'Patient deactivated successfully.', { patient });
});

export const assignDoctor = asyncHandler(async (req, res) => {
  const doctorId = req.body.doctorId || null;
  if (doctorId && (!mongoose.isValidObjectId(doctorId) || !(await Doctor.exists({ _id: doctorId })))) {
    return res.status(400).json({ success: false, message: 'Doctor not found.', data: null });
  }
  const update = { $set: { doctorId } };
  const patient = await Patient.findByIdAndUpdate(req.params.id, update, {
    returnDocument: 'after',
    runValidators: true,
  });
  const hydrated = await populatedPatientQuery(Patient.findById(patient._id));
  await writeAuditLog({
    actorId: req.user._id,
    action: 'patient.update',
    resourceType: 'patient',
    resourceId: patient._id,
    ip: req.ip,
  });
  return respond(res, 200, 'Doctor assigned successfully.', { patient: hydrated });
});
