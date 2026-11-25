import mongoose from 'mongoose';
import Doctor from '../models/Doctor.js';
import Patient from '../models/Patient.js';

export const findAccessiblePatient = async (user, patientId) => {
  if (!mongoose.isValidObjectId(patientId)) return { error: 'invalid' };
  const patient = await Patient.findById(patientId).select('_id userId doctorId').lean();
  if (!patient) return { error: 'notFound' };

  if (user.role === 'admin') return { patient };
  if (user.role === 'patient' && String(patient.userId) === String(user._id)) {
    return { patient };
  }
  if (user.role === 'doctor') {
    const doctor = await Doctor.findOne({ userId: user._id }).select('_id').lean();
    if (doctor && String(patient.doctorId) === String(doctor._id)) {
      return { patient, doctor };
    }
  }

  return { error: 'forbidden' };
};
