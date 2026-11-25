import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    alertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert',
      default: null,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication',
      default: null,
    },
    kind: {
      type: String,
      enum: ['alert', 'appointment-reminder', 'medication-reminder'],
      default: 'alert',
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    readAt: {
      type: Date,
      default: null,
    },
    reminderKey: {
      type: String,
      default: undefined,
    },
    eventKey: {
      type: String,
      default: undefined,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index(
  { reminderKey: 1 },
  { unique: true, partialFilterExpression: { reminderKey: { $type: 'string' } } },
);
notificationSchema.index(
  { eventKey: 1 },
  { unique: true, partialFilterExpression: { eventKey: { $type: 'string' } } },
);

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
