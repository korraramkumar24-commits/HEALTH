import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
    },
    healthRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HealthRecord',
      default: null,
    },
    emergencyLocation: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
      accuracy: { type: Number, min: 0, max: 100000 },
      capturedAt: { type: Date },
    },
    clientRequestId: {
      type: String,
      trim: true,
      maxlength: 64,
      select: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    status: {
      type: String,
      enum: ['unread', 'acknowledged', 'resolved'],
      default: 'unread',
      index: true,
    },
    source: {
      type: String,
      enum: ['automatic', 'manual', 'sos'],
      default: 'automatic',
    },
  },
  { timestamps: true },
);

alertSchema.index({ doctorId: 1, createdAt: -1 });
alertSchema.index({ doctorId: 1, severity: 1, status: 1, createdAt: -1 });
alertSchema.index({ patientId: 1, createdAt: -1 });
alertSchema.index(
  { patientId: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } },
);

const Alert = mongoose.model('Alert', alertSchema);

export default Alert;
