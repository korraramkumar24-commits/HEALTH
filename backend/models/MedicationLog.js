import mongoose from 'mongoose';

const medicationLogSchema = new mongoose.Schema(
  {
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication',
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    scheduledFor: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['taken', 'missed', 'skipped'],
      required: true,
    },
    loggedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

medicationLogSchema.index({ medicationId: 1, scheduledFor: 1 }, { unique: true });
medicationLogSchema.index({ patientId: 1, scheduledFor: -1 });

const MedicationLog = mongoose.model('MedicationLog', medicationLogSchema);

export default MedicationLog;
