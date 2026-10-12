import jwt from 'jsonwebtoken';
import { AdminUser } from '../models/AdminUser.js';

export async function requireAdminAuth(req, res, next) {
  try {
    let token = null;

    // Check HTTP-only cookie first
    if (req.cookies && req.cookies.admin_token) {
      token = req.cookies.admin_token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in to the Admin Portal.'
      });
    }

    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_shobha_education_trust_2026_dev_mode_change_in_prod';
    const decoded = jwt.verify(token, secret);

    const user = await AdminUser.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Admin account is inactive or not found.'
      });
    }

    req.admin = {
      id: user._id.toString(),
      username: user.username,
      name: user.name,
      role: user.role
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Admin session has expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication session.'
    });
  }
}
