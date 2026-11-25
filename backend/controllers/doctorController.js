import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import asyncHandler from '../utils/asyncHandler.js';

const respond = (res, status, message, data) =>
  res.status(status).json({ success: true, message, data });
const doctorQuery = (query) =>
  query.populate({ path: 'userId', select: 'name email phone role isActive' }).lean();

export const listDoctors = asyncHandler(async (req, res) => {
  const doctors = await doctorQuery(Doctor.find().sort({ createdAt: -1 }));
  return respond(res, 200, 'Doctors fetched successfully.', { doctors });
});

export const createDoctor = asyncHandler(async (req, res) => {
  const { name, email, password, phone, specialization, licenseNumber } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required.', data: null });
  }
  const user = await User.create({ name, email, password, phone, role: 'doctor' });
  try {
    const doctor = await Doctor.create({ userId: user._id, specialization, licenseNumber });
    const hydrated = await doctorQuery(Doctor.findById(doctor._id));
    return respond(res, 201, 'Doctor created successfully.', { doctor: hydrated });
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }
});

export const updateDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found.', data: null });
  }
  const user = await User.findById(doctor.userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Doctor account not found.', data: null });
  }
  const { name, email, phone, specialization, licenseNumber, isActive } = req.body;
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive must be a boolean.', data: null });
  }
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (isActive !== undefined) user.isActive = isActive;
  if (specialization !== undefined) doctor.specialization = specialization;
  if (licenseNumber !== undefined) doctor.licenseNumber = licenseNumber;
  await Promise.all([user.save(), doctor.save()]);
  const hydrated = await doctorQuery(Doctor.findById(doctor._id));
  return respond(res, 200, 'Doctor updated successfully.', { doctor: hydrated });
});

export const deleteDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).select('userId').lean();
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found.', data: null });
  }
  await User.findByIdAndUpdate(doctor.userId, { $set: { isActive: false } });
  return respond(res, 200, 'Doctor deactivated successfully.', null);
});
