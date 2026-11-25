import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      trim: true,
      default: '',
    },
    disease: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Disease',
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
    },
    emergencyContact: {
      name: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true },
);

patientSchema.index({ doctorId: 1, status: 1, disease: 1 });
patientSchema.index({ disease: 1 });

const Patient = mongoose.model('Patient', patientSchema);

export default Patient;
