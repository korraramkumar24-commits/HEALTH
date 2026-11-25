import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startsAt: {
      type: Date,
      required: true,
    },
    endsAt: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return value > this.startsAt;
        },
        message: 'endsAt must be after startsAt.',
      },
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
  },
  { timestamps: true },
);

appointmentSchema.index(
  { doctorId: 1, startsAt: 1 },
  { unique: true, partialFilterExpression: { status: 'scheduled' } },
);
appointmentSchema.index({ patientId: 1, startsAt: 1, status: 1 });
appointmentSchema.index({ doctorId: 1, startsAt: 1, status: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
