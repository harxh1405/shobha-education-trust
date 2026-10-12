import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  adminId: {
    type: String,
    required: true,
    index: true
  },
  adminUsername: {
    type: String,
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  targetType: {
    type: String,
    required: true,
    index: true
  },
  targetId: {
    type: String,
    default: '',
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

AuditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
