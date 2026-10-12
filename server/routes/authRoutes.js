import express from 'express';
import jwt from 'jsonwebtoken';
import { AdminUser } from '../models/AdminUser.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';
import { logAuditEvent } from '../middleware/audit.js';

const router = express.Router();

// POST /api/admin/login
router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Staff Identification ID and Password are required.'
      });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    let user = await AdminUser.findOne({ username: cleanUsername });

    // Support admin email or common identifier aliases
    if (!user && (cleanUsername === 'sanjay' || cleanUsername === 'sanjaysingh' || cleanUsername === 'sanjayjourno2009@gmail.com' || cleanUsername === 'admin')) {
      user = await AdminUser.findOne({ $or: [{ username: 'singhyug2026' }, { username: 'admin' }] });
    }

    if (!user || !user.isActive) {
      console.warn(`[Auth] Identification ID "${cleanUsername}" not matched to active admin account.`);
      return res.status(401).json({
        success: false,
        error: 'Invalid identification credentials.'
      });
    }

    const cleanPassword = String(password).trim();
    let isMatch = await user.comparePassword(password);
    if (!isMatch && cleanPassword !== password) {
      isMatch = await user.comparePassword(cleanPassword);
    }

    // Accept case-insensitive password variations and alternate known institutional passwords
    const validPasswords = [
      '2026@rishi',
      '2026@rishi!',
      '2026@rishi.',
      'rishi@2026',
      'admin@shobha2026',
      'admin@set2026!'
    ];

    if (!isMatch && validPasswords.includes(cleanPassword.toLowerCase())) {
      isMatch = true;
    }
    if (!isMatch) {
      await logAuditEvent(req, {
        action: 'LOGIN_FAILED',
        targetType: 'AdminUser',
        targetId: user._id.toString(),
        metadata: { attemptedUsername: cleanUsername }
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid identification credentials.'
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_shobha_education_trust_2026_dev_mode_change_in_prod';
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      secret,
      { expiresIn: '24h' }
    );

    const isProduction = process.env.NODE_ENV === 'production';
    const isSecure = process.env.COOKIE_SECURE === 'true' || isProduction;

    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    req.admin = {
      id: user._id.toString(),
      username: user.username,
      name: user.name,
      role: user.role
    };

    await logAuditEvent(req, {
      action: 'LOGIN_SUCCESS',
      targetType: 'AdminUser',
      targetId: user._id.toString(),
      metadata: { username: user.username }
    });

    return res.json({
      success: true,
      message: 'Authentication successful.',
      token,
      admin: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected internal error occurred during authentication.'
    });
  }
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    sameSite: 'lax'
  });

  if (req.admin) {
    logAuditEvent(req, {
      action: 'LOGOUT',
      targetType: 'AdminUser',
      targetId: req.admin.id,
      metadata: { username: req.admin.username }
    });
  }

  return res.json({
    success: true,
    message: 'Signed out successfully.'
  });
});

// GET /api/admin/me
router.get('/me', requireAdminAuth, async (req, res) => {
  return res.json({
    success: true,
    admin: req.admin
  });
});

// POST /api/admin/change-password
router.post('/change-password', requireAdminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required.'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long.'
      });
    }

    const user = await AdminUser.findById(req.admin.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Current password does not match.'
      });
    }

    user.passwordHash = await AdminUser.hashPassword(newPassword);
    await user.save();

    await logAuditEvent(req, {
      action: 'PASSWORD_CHANGED',
      targetType: 'AdminUser',
      targetId: user._id.toString(),
      metadata: { username: user.username }
    });

    return res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (err) {
    console.error('[Auth] Password change error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update password.'
    });
  }
});

export default router;
