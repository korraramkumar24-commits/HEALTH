import AuditLog from '../models/AuditLog.js';

const writeAuditLog = async ({ actorId = null, action, resourceType, resourceId = null, ip = '' }) => {
  try {
    await AuditLog.create({ actorId, action, resourceType, resourceId, ip });
  } catch {
    console.error('Audit log write failed.');
  }
};

export default writeAuditLog;
