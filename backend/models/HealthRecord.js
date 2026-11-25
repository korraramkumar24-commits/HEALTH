import mongoose from 'mongoose';
import { HEALTH_MEASUREMENT_RANGES } from '../utils/healthRecordRules.js';

const measurementSchema = Object.fromEntries(
  Object.entries(HEALTH_MEASUREMENT_RANGES).map(([field, [min, max]]) => [
    field,
    {
      type: Number,
      min: [min, `${field} must be at least ${min}.`],
      max: [max, `${field} must be no more than ${max}.`],
    },
  ]),
);

const healthRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    clientRequestId: {
      type: String,
      trim: true,
      maxlength: 64,
      select: false,
    },
    ...measurementSchema,
    recordedAt: {
      type: Date,
      required: true,
      default: Date.now,
      validate: {
        validator: (value) => value <= new Date(),
        message: 'recordedAt cannot be in the future.',
      },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes cannot exceed 2000 characters.'],
      default: '',
    },
  },
  { timestamps: true },
);

healthRecordSchema.pre('validate', function validateMeasurements() {
  const hasMeasurement = Object.keys(HEALTH_MEASUREMENT_RANGES).some(
    (field) => this[field] !== undefined && this[field] !== null,
  );

  if (!hasMeasurement) {
    this.invalidate('measurements', 'At least one measurement is required.');
  }

  if (
    this.systolic !== undefined &&
    this.diastolic !== undefined &&
    this.systolic <= this.diastolic
  ) {
    this.invalidate('systolic', 'Systolic must be greater than diastolic.');
  }
});

healthRecordSchema.index({ patientId: 1, recordedAt: -1 });
healthRecordSchema.index({ createdAt: -1 });
healthRecordSchema.index(
  { patientId: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } },
);

const HealthRecord = mongoose.model('HealthRecord', healthRecordSchema);

export default HealthRecord;
