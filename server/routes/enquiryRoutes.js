import express from 'express';
import rateLimit from 'express-rate-limit';
import { Enquiry } from '../models/Enquiry.js';
import { sendEnquiryEmail } from '../services/mailService.js';

const router = express.Router();

export const ALLOWED_CATEGORIES = [
  'General Enquiry',
  'Admissions',
  'Courses and Eligibility',
  'Fee Enquiry',
  'Campus and Facilities',
  'Other'
];

// 1. Dedicated Rate Limiter (bypassed in automated tests)
export const enquiryRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit to 15 enquiries per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' || req.headers['x-bypass-rate-limit'] === 'test',
  message: {
    success: false,
    error: 'Too many enquiry requests from this IP address. Please try again after 15 minutes.'
  }
});

// Helper to validate and normalize email
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
  return regex.test(email) && email.length <= 150;
}

// Helper to validate mobile number (at least 10 digits)
function isValidMobile(phone) {
  if (typeof phone !== 'string') return false;
  const digitsOnly = phone.replace(/[^0-9]/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

// 2. Controller for Enquiry Submission
export async function handleEnquirySubmission(req, res) {
  try {
    const {
      name,
      email,
      phone,
      category,
      institutionOrProgramme,
      subject,
      message,
      // Spam honeypot fields
      _hp_address,
      website,
      honeypot
    } = req.body || {};

    // A. Spam Honeypot Protection
    if (_hp_address || website || honeypot) {
      console.warn('[Enquiry API] Bot honeypot triggered by remote IP:', req.ip);
      return res.status(400).json({
        success: false,
        error: 'Spam submission detected.'
      });
    }

    // B. Required Fields Presence Check
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Full Name is required.' });
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email Address is required.' });
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({ success: false, error: 'Mobile Number is required.' });
    }
    if (!category || typeof category !== 'string' || !category.trim()) {
      return res.status(400).json({ success: false, error: 'Enquiry Category is required.' });
    }
    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ success: false, error: 'Subject is required.' });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required.' });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    const cleanInstProg = (institutionOrProgramme || req.body.programme || '').trim();

    // C. Field Length and Format Constraints
    if (cleanName.length < 2 || cleanName.length > 100) {
      return res.status(400).json({ success: false, error: 'Full Name must be between 2 and 100 characters.' });
    }
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }
    if (!isValidMobile(cleanPhone)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid mobile number with at least 10 digits.' });
    }

    // Validate Category against allowed list
    const matchedCategory = ALLOWED_CATEGORIES.find(
      cat => cat.toLowerCase() === category.trim().toLowerCase()
    );
    if (!matchedCategory) {
      return res.status(400).json({
        success: false,
        error: `Invalid enquiry category. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}`
      });
    }

    if (cleanSubject.length < 3 || cleanSubject.length > 200) {
      return res.status(400).json({ success: false, error: 'Subject must be between 3 and 200 characters.' });
    }
    if (cleanMessage.length < 10) {
      return res.status(400).json({ success: false, error: 'Message must be at least 10 characters.' });
    }
    if (cleanMessage.length > 3000) {
      return res.status(400).json({ success: false, error: 'Message cannot exceed 3,000 characters.' });
    }
    if (cleanInstProg.length > 200) {
      return res.status(400).json({ success: false, error: 'Institution / Programme cannot exceed 200 characters.' });
    }

    // D. Generate Unique Reference ID
    const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const referenceId = `SET-ENQ-${dateCode}-${randomHex}`;

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const emailSubject = `New Website Enquiry — [${matchedCategory}] — [${cleanName}]`;
    const emailBody = `Reference: ${referenceId}\nSender: ${cleanName} (${cleanEmail}, ${cleanPhone})\nCategory: ${matchedCategory}\nSubject: ${cleanSubject}\n\n${cleanMessage}`;

    // E. Persist Enquiry Record in Database
    const enquiry = await Enquiry.create({
      referenceId,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      category: matchedCategory,
      institutionOrProgramme: cleanInstProg,
      programme: cleanInstProg || 'General Admission',
      district: req.body.district || 'Jaunpur',
      subject: cleanSubject,
      message: cleanMessage,
      emailSubject,
      emailBody,
      status: 'new',
      deliveryStatus: 'accepted',
      ipAddress: req.ip || ''
    });

    // F. Dispatch Notification Email to Official Recipient
    const mailResult = await sendEnquiryEmail({
      referenceId,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      category: matchedCategory,
      institutionOrProgramme: cleanInstProg,
      subject: cleanSubject,
      message: cleanMessage,
      timestamp
    });

    // Update delivery metadata
    if (mailResult && mailResult.sent) {
      enquiry.deliveryStatus = 'delivered';
      enquiry.provider = mailResult.provider || '';
      enquiry.messageId = mailResult.messageId || '';
      await enquiry.save();

      return res.status(201).json({
        success: true,
        message: 'Your enquiry has been successfully submitted and forwarded to our official administration office.',
        referenceId: enquiry.referenceId,
        enquiryId: enquiry._id,
        deliveryStatus: 'delivered',
        provider: mailResult.provider,
        recipient: mailResult.recipient
      });
    } else {
      enquiry.deliveryStatus = 'failed';
      enquiry.deliveryError = mailResult?.error || 'Email dispatch failed';
      await enquiry.save();

      console.error('[Enquiry API] Email provider failure for reference:', referenceId, mailResult?.error);
      return res.status(502).json({
        success: false,
        error: 'We received your enquiry, but the notification email could not be delivered at this time. Please contact our campus helpline directly.',
        referenceId: enquiry.referenceId
      });
    }

  } catch (err) {
    console.error('[Enquiry API] Unexpected server error:', err);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while processing your enquiry.'
    });
  }
}

// 3. Mount Routes
router.post('/', enquiryRateLimiter, handleEnquirySubmission);

export default router;
