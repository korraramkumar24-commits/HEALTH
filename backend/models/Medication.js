import mongoose from 'mongoose';

const medicationSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    prescribedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    instructions: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    scheduledTimes: {
      type: [String],
      required: true,
      validate: [
        {
          validator: (times) => times.length > 0,
          message: 'At least one scheduled dose time is required.',
        },
        {
          validator: (times) => new Set(times).size === times.length,
          message: 'Scheduled dose times must be unique.',
        },
        {
          validator: (times) => times.every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)),
          message: 'Dose times must use 24-hour HH:mm format.',
        },
      ],
    },
    startsAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endsAt: {
      type: Date,
      default: null,
      validate: {
        validator(value) {
          return value === null || value >= this.startsAt;
        },
        message: 'endsAt must be on or after startsAt.',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

medicationSchema.index({ patientId: 1, isActive: 1, startsAt: 1, endsAt: 1 });

const Medication = mongoose.model('Medication', medicationSchema);

export default Medication;
