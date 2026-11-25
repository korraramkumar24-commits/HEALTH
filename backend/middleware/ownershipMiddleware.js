import mongoose from 'mongoose';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';

const ownershipMiddleware = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.', data: null });
    }

    const patient = await Patient.findById(req.params.id).select('userId doctorId status').lean();
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.', data: null });
    }

    if (req.user.role === 'admin') {
      req.patient = patient;
      return next();
    }

    if (req.user.role === 'patient' && String(patient.userId) === String(req.user._id)) {
      req.patient = patient;
      return next();
    }

    if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ userId: req.user._id }).select('_id').lean();
      if (doctor && String(patient.doctorId) === String(doctor._id)) {
        req.patient = patient;
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: 'You do not have access to this patient.',
      data: null,
    });
  } catch (error) {
    return next(error);
  }
};

export default ownershipMiddleware;
