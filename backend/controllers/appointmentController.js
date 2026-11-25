import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import Doctor from '../models/Doctor.js';
import Patient from '../models/Patient.js';
import asyncHandler from '../utils/asyncHandler.js';
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

const appointmentPopulation = (query) =>
  query
    .populate({ path: 'patientId', select: 'userId', populate: { path: 'userId', select: 'name email' } })
    .populate({
      path: 'doctorId',
      select: 'userId specialization',
      populate: { path: 'userId', select: 'name email' },
    })
    .lean();

export const createAppointment = asyncHandler(async (req, res) => {
  const { patientId, doctorId: requestedDoctorId, startsAt, endsAt, reason } = req.body;
  if (!patientId || !startsAt || !endsAt) {
    return res.status(400).json({
      success: false,
      message: 'patientId, startsAt, and endsAt are required.',
      data: null,
    });
  }
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start <= new Date() ||
    end <= start
  ) {
    return res.status(400).json({ success: false, message: 'Provide a valid appointment time range.', data: null });
  }

  const access = await findAccessiblePatient(req.user, patientId);
  if (access.error) return accessError(res, access.error);

  let doctorId;
  if (req.user.role === 'doctor') {
    if (!access.doctor) {
      return res.status(403).json({ success: false, message: 'Doctor assignment is required.', data: null });
    }
    doctorId = access.doctor._id;
    if (requestedDoctorId && String(requestedDoctorId) !== String(doctorId)) {
      return res.status(403).json({ success: false, message: 'Doctors can only book appointments with themselves.', data: null });
    }
  } else if (req.user.role === 'admin') {
    doctorId = requestedDoctorId || access.patient.doctorId;
    if (!doctorId || !mongoose.isValidObjectId(doctorId)) {
      return res.status(400).json({ success: false, message: 'A valid doctorId is required.', data: null });
    }
    if (String(doctorId) !== String(access.patient.doctorId)) {
      return res.status(400).json({ success: false, message: 'Appointments must use the patient’s assigned doctor.', data: null });
    }
    if (!(await Doctor.exists({ _id: doctorId }))) {
      return res.status(400).json({ success: false, message: 'Doctor not found.', data: null });
    }
  } else {
    return res.status(403).json({ success: false, message: 'Only doctors and administrators can create appointments.', data: null });
  }

  try {
    const appointment = await Appointment.create({
      patientId: access.patient._id,
      doctorId,
      createdBy: req.user._id,
      startsAt: start,
      endsAt: end,
      reason: typeof reason === 'string' ? reason.trim() : '',
    });
    const hydrated = await appointmentPopulation(Appointment.findById(appointment._id));
    return respond(res, 201, 'Appointment created successfully.', { appointment: hydrated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This doctor already has a scheduled appointment starting at that time.',
        data: null,
      });
    }
    throw error;
  }
});

export const listAppointments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role === 'patient') {
    const patient = await Patient.findOne({ userId: req.user._id }).select('_id').lean();
    if (!patient) return respond(res, 200, 'Appointments fetched successfully.', { appointments: [] });
    filter.patientId = patient._id;
  } else if (req.user.role === 'doctor') {
    const doctor = await Doctor.findOne({ userId: req.user._id }).select('_id').lean();
    if (!doctor) return respond(res, 200, 'Appointments fetched successfully.', { appointments: [] });
    filter.doctorId = doctor._id;
    if (req.query.patientId) {
      const access = await findAccessiblePatient(req.user, req.query.patientId);
      if (access.error) return accessError(res, access.error);
      filter.patientId = access.patient._id;
    }
  } else {
    if (req.query.patientId) {
      if (!mongoose.isValidObjectId(req.query.patientId)) return accessError(res, 'invalid');
      filter.patientId = req.query.patientId;
    }
    if (req.query.doctorId) {
      if (!mongoose.isValidObjectId(req.query.doctorId)) {
        return res.status(400).json({ success: false, message: 'Invalid doctor ID.', data: null });
      }
      filter.doctorId = req.query.doctorId;
    }
  }
  if (req.query.status) {
    if (!['scheduled', 'completed', 'cancelled'].includes(req.query.status)) {
      return res.status(400).json({ success: false, message: 'Invalid appointment status.', data: null });
    }
    filter.status = req.query.status;
  }

  const appointments = await appointmentPopulation(
    Appointment.find(filter).sort({ startsAt: 1 }),
  );
  return respond(res, 200, 'Appointments fetched successfully.', { appointments });
});

export const cancelAppointment = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid appointment ID.', data: null });
  }
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.', data: null });
  if (req.user.role === 'patient') {
    const patient = await Patient.findOne({ userId: req.user._id }).select('_id').lean();
    if (!patient || String(appointment.patientId) !== String(patient._id)) {
      return res.status(403).json({ success: false, message: 'You can only cancel your own appointments.', data: null });
    }
  } else if (req.user.role === 'doctor') {
    const doctor = await Doctor.findOne({ userId: req.user._id }).select('_id').lean();
    if (!doctor || String(appointment.doctorId) !== String(doctor._id)) {
      return res.status(403).json({ success: false, message: 'You cannot cancel this appointment.', data: null });
    }
  }
  if (appointment.status !== 'scheduled') {
    return res.status(409).json({ success: false, message: 'Only scheduled appointments can be cancelled.', data: null });
  }
  appointment.status = 'cancelled';
  await appointment.save();
  return respond(res, 200, 'Appointment cancelled successfully.', { appointment });
});
