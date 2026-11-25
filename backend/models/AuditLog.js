import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    action: {
      type: String,
      enum: [
        'auth.register',
        'auth.login.success',
        'auth.login.failure',
        'patient.create',
        'patient.update',
        'patient.deactivate',
        'healthRecord.create',
        'healthRecord.update',
        'healthRecord.delete',
        'alert.create',
        'alert.update',
        'alert.delete',
        'communityHealthWorker.create',
        'communityHealthWorker.update',
        'communityHealthWorker.deactivate',
      ],
      required: true,
    },
    resourceType: {
      type: String,
      enum: ['auth', 'patient', 'healthRecord', 'alert', 'communityHealthWorker'],
      required: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    ip: {
      type: String,
      maxlength: 45,
      default: '',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
