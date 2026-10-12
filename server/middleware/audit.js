import { AuditLog } from '../models/AuditLog.js';

export async function logAuditEvent(req, { action, targetType, targetId = '', metadata = {} }) {
  try {
    const adminId = req.admin ? req.admin.id : 'system';
    const adminUsername = req.admin ? req.admin.username : 'system';

    const safeMetadata = { ...metadata };
    // Strip sensitive fields if present
    delete safeMetadata.password;
    delete safeMetadata.passwordHash;
    delete safeMetadata.token;
    delete safeMetadata.secret;
    delete safeMetadata.keySecret;

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    await AuditLog.create({
      adminId,
      adminUsername,
      action,
      targetType,
      targetId: String(targetId),
      metadata: safeMetadata,
      ipAddress: String(ipAddress),
      userAgent: String(userAgent).substring(0, 255)
    });
  } catch (err) {
    console.error('[AuditLog] Error recording audit event:', err.message);
  }
}
