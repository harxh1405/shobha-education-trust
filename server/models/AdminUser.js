import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const AdminUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'editor'],
    default: 'admin'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  lastLoginAt: {
    type: Date
  }
}, {
  timestamps: true
});

AdminUserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

AdminUserSchema.statics.hashPassword = async function(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

export const AdminUser = mongoose.models.AdminUser || mongoose.model('AdminUser', AdminUserSchema);
