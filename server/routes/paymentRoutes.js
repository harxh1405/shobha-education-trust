import express from 'express';
import crypto from 'crypto';
import { FeeCategory } from '../models/FeeCategory.js';
import { PaymentOrder } from '../models/PaymentOrder.js';
import { PaymentTransaction } from '../models/PaymentTransaction.js';
import { PaymentSettings } from '../models/PaymentSettings.js';
import {
  createGatewayOrder,
  verifyGatewaySignature,
  verifyWebhookSignature,
  fetchPaymentFromGateway
} from '../services/razorpayService.js';
import { paymentRateLimiter } from '../middleware/rateLimiter.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { logAuditEvent } from '../middleware/audit.js';

const router = express.Router();

function generateReference(prefix) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `SET-${prefix}-${dateStr}-${randomHex}`;
}

const processedWebhookEvents = new Set();

// -----------------------------------------------------------------------------
// PUBLIC FEE & QR PAYMENT ENDPOINTS
// -----------------------------------------------------------------------------

// GET /api/public/payments/qr-config and /api/payments/qr-config
router.get(['/qr-config', '/payments/qr-config', '/public/payments/qr-config'], async (req, res) => {
  try {
    let settings = await PaymentSettings.findOne();
    if (!settings) {
      settings = await PaymentSettings.create({
        qrImageUrl: '/assets/qr.png',
        upiId: 'shobhaeducationtrust@upi',
        accountName: 'Shobha Education Trust',
        bankName: 'State Bank of India',
        accountNumber: '39281029381',
        ifscCode: 'SBIN0001234',
        coursePrices: {
          deledPriceRupees: 41000,
          itiPriceRupees: 16000,
          baPriceRupees: 3000
        }
      });
    } else if (settings.qrImageUrl === '/assets/upi-qr.svg') {
      settings.qrImageUrl = '/assets/qr.png';
      await settings.save();
    }
    return res.json({ success: true, settings });
  } catch (err) {
    console.error('[QR Config] Error fetching settings:', err);
    return res.status(500).json({ success: false, error: 'Failed to load QR payment settings.' });
  }
});

// GET /api/payments/options and /api/public/fees/options
router.get(['/options', '/fees/options', '/public/fees/options'], async (req, res) => {
  try {
    const now = new Date();
    const categories = await FeeCategory.find({
      status: 'published',
      isActive: true,
      $or: [
        { effectiveFrom: null },
        { effectiveFrom: { $lte: now } }
      ],
      $and: [
        {
          $or: [
            { effectiveUntil: null },
            { effectiveUntil: { $gte: now } }
          ]
        }
      ]
    })
      .sort({ institution: 1, name: 1 })
      .select('name description institution programme academicSession amountPaise currency');

    const formatted = categories.map(cat => ({
      id: cat._id,
      name: cat.name,
      description: cat.description,
      institution: cat.institution,
      programme: cat.programme,
      academicSession: cat.academicSession,
      amountPaise: cat.amountPaise,
      amountRupees: (cat.amountPaise / 100).toLocaleString('en-IN'),
      currency: cat.currency
    }));

    return res.json({
      success: true,
      categories: formatted
    });
  } catch (err) {
    console.error('[Fee API] Options error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve available fee categories.' });
  }
});

// POST /api/payments/quote and /api/public/fees/quote
router.post(['/quote', '/fees/quote', '/public/fees/quote'], async (req, res) => {
  try {
    const { feeCategoryId } = req.body;
    if (!feeCategoryId) {
      return res.status(400).json({ success: false, error: 'Fee Category is required.' });
    }

    const category = await FeeCategory.findOne({
      _id: feeCategoryId,
      status: 'published',
      isActive: true
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'The selected fee category is no longer active or available for public payment.'
      });
    }

    return res.json({
      success: true,
      quote: {
        feeCategoryId: category._id,
        name: category.name,
        institution: category.institution,
        programme: category.programme,
        academicSession: category.academicSession,
        amountPaise: category.amountPaise,
        amountRupees: (category.amountPaise / 100).toLocaleString('en-IN'),
        currency: category.currency,
        description: category.description
      }
    });
  } catch (err) {
    console.error('[Fee API] Quote error:', err);
    return res.status(500).json({ success: false, error: 'Could not generate fee quote.' });
  }
});

// POST /api/payments/submit (Student submits payment details with Name, District, Phone, UPI ID/UTR)
router.post(['/submit', '/payments/submit'], paymentRateLimiter, async (req, res) => {
  try {
    const { feeCategoryId, course, studentDetails, utrNumber, upiId, screenshotUrl, paymentDate } = req.body;

    if (!studentDetails || !studentDetails.studentName || !studentDetails.studentName.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Student Full Name is required.'
      });
    }

    if (!studentDetails.phone || !studentDetails.phone.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Contact Mobile Phone Number is required.'
      });
    }

    const cleanDistrict = (studentDetails.district || 'Jaunpur').trim();
    const cleanUpiOrUtr = (utrNumber || upiId || studentDetails.upiId || '').trim();

    if (!cleanUpiOrUtr) {
      return res.status(400).json({
        success: false,
        error: 'UPI Reference (UTR Number) or Student UPI ID is required for verification.'
      });
    }

    // Determine target fee category
    let category = null;
    if (feeCategoryId) {
      category = await FeeCategory.findOne({ _id: feeCategoryId, status: 'published', isActive: true });
    }
    if (!category && course) {
      const regexMap = {
        deled: /D\.El\.Ed/i,
        btc: /D\.El\.Ed/i,
        iti: /ITI/i,
        ba: /B\.A/i
      };
      const queryPattern = regexMap[course.toLowerCase()] || new RegExp(course, 'i');
      category = await FeeCategory.findOne({ name: queryPattern, status: 'published', isActive: true });
    }
    if (!category) {
      category = await FeeCategory.findOne({ status: 'published', isActive: true });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Selected fee category is not active or available for payment.'
      });
    }

    const internalOrderId = generateReference('ORD');
    const referenceId = generateReference('PAY');

    const paymentOrder = await PaymentOrder.create({
      orderId: internalOrderId,
      referenceId,
      feeCategoryId: category._id,
      feeSnapshot: {
        name: category.name,
        institution: category.institution,
        programme: category.programme || '',
        academicSession: category.academicSession,
        amountPaise: category.amountPaise,
        currency: category.currency
      },
      studentDetails: {
        studentName: studentDetails.studentName.trim(),
        rollNumber: (studentDetails.rollNumber || '').trim(),
        district: cleanDistrict,
        email: (studentDetails.email || '').trim().toLowerCase(),
        phone: studentDetails.phone.trim(),
        notes: studentDetails.notes || ''
      },
      paymentProof: {
        utrNumber: (utrNumber || '').trim() || cleanUpiOrUtr,
        upiId: (upiId || studentDetails.upiId || '').trim(),
        screenshotUrl: screenshotUrl || '',
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        submittedAt: new Date()
      },
      amountPaise: category.amountPaise,
      currency: category.currency,
      status: 'pending' // Awaiting manual review by administrator!
    });

    return res.status(201).json({
      success: true,
      message: 'Payment submission received. Your transaction has been registered for manual verification by the institutional desk.',
      orderId: paymentOrder._id,
      id: paymentOrder._id,
      referenceId: paymentOrder.referenceId,
      amountRupees: (paymentOrder.amountPaise / 100).toLocaleString('en-IN'),
      feeName: paymentOrder.feeSnapshot.name,
      studentName: paymentOrder.studentDetails.studentName
    });
  } catch (err) {
    console.error('[Payment Submit] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to submit payment details.' });
  }
});

// GET /api/payments/status/:reference
router.get(['/status/:reference', '/payments/status/:reference', '/public/payments/status/:reference'], async (req, res) => {
  try {
    const { reference } = req.params;
    const cleanRef = reference.trim();

    const escapedRef = cleanRef.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const order = await PaymentOrder.findOne({
      $or: [
        { referenceId: { $regex: new RegExp(`^${escapedRef}$`, 'i') } },
        { orderId: { $regex: new RegExp(`^${escapedRef}$`, 'i') } }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Transaction reference number not found in institutional records. Please search using your official reference number (e.g. SET-PAY-...). Status lookup is strictly restricted to reference numbers and cannot be performed using UPI IDs or UTR numbers.'
      });
    }

    return res.json({
      success: true,
      order: {
        referenceId: order.referenceId,
        orderId: order.orderId,
        status: order.status,
        institution: order.feeSnapshot.institution,
        feeName: order.feeSnapshot.name,
        programme: order.feeSnapshot.programme,
        academicSession: order.feeSnapshot.academicSession,
        amountPaise: order.amountPaise,
        amount: order.amountPaise ? (order.amountPaise / 100) : 0,
        amountRupees: (order.amountPaise ? (order.amountPaise / 100) : 0).toLocaleString('en-IN'),
        currency: order.currency,
        studentName: order.studentDetails.studentName,
        rollNumber: order.studentDetails.rollNumber,
        email: order.studentDetails.email,
        phone: order.studentDetails.phone,
        utrNumber: order.paymentProof.utrNumber,
        screenshotUrl: order.paymentProof.screenshotUrl,
        submittedAt: order.paymentProof.submittedAt || order.createdAt,
        verifiedAt: order.verificationDetails.verifiedAt,
        verifiedBy: order.verificationDetails.verifiedBy,
        adminNotes: order.verificationDetails.adminNotes
      }
    });
  } catch (err) {
    console.error('[Payment API] Status error:', err);
    return res.status(500).json({ success: false, error: 'Could not fetch transaction status.' });
  }
});

// GET /api/payments/receipt/:reference
router.get(['/receipt/:reference', '/payments/receipt/:reference', '/public/payments/receipt/:reference'], async (req, res) => {
  try {
    const { reference } = req.params;
    const order = await PaymentOrder.findOne({ referenceId: reference.trim() });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Receipt not found.' });
    }

    const isVerified = order.status === 'verified' || order.status === 'successful';

    if (!isVerified) {
      return res.status(400).json({
        success: false,
        error: `Receipt is only generated after administrator verification. Current status: ${order.status.toUpperCase()}.`
      });
    }

    const verificationHash = crypto
      .createHash('sha256')
      .update(`${order.referenceId}|${order.amountPaise}|${order.paymentProof.utrNumber || ''}|${order.verificationDetails.verifiedAt || ''}`)
      .digest('hex')
      .slice(0, 16)
      .toUpperCase();

    return res.json({
      success: true,
      receipt: {
        receiptNumber: order.referenceId,
        transactionId: order.orderId,
        utrNumber: order.paymentProof.utrNumber || 'N/A',
        verificationHash,
        issuedAt: order.verificationDetails.verifiedAt || order.updatedAt,
        organization: 'Shobha Education Trust',
        institution: order.feeSnapshot.institution,
        feeName: order.feeSnapshot.name,
        programme: order.feeSnapshot.programme,
        academicSession: order.feeSnapshot.academicSession,
        studentName: order.studentDetails.studentName,
        rollNumber: order.studentDetails.rollNumber,
        email: order.studentDetails.email,
        phone: order.studentDetails.phone,
        amountPaise: order.amountPaise,
        amount: order.amountPaise ? (order.amountPaise / 100) : 0,
        amountRupees: (order.amountPaise ? (order.amountPaise / 100) : 0).toLocaleString('en-IN'),
        currency: order.currency,
        status: 'VERIFIED & PAID',
        verifiedBy: order.verificationDetails.verifiedBy || 'Administrative Desk',
        notes: order.verificationDetails.adminNotes || 'Official electronic institutional receipt issued under Shobha Education Trust.'
      }
    });
  } catch (err) {
    console.error('[Payment API] Receipt error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate receipt.' });
  }
});

// -----------------------------------------------------------------------------
// GATEWAY COMPATIBILITY (Razorpay order & verification fallback)
// -----------------------------------------------------------------------------

router.post(['/create-order', '/payments/create-order'], paymentRateLimiter, async (req, res) => {
  try {
    const { feeCategoryId, studentDetails, idempotentKey } = req.body;
    if (!feeCategoryId || !studentDetails) {
      return res.status(400).json({ success: false, error: 'Fee Category and Student Details are required.' });
    }

    const category = await FeeCategory.findOne({ _id: feeCategoryId, status: 'published', isActive: true });
    if (!category) {
      return res.status(400).json({ success: false, error: 'Category not found or inactive.' });
    }

    const internalOrderId = generateReference('ORD');
    const referenceId = generateReference('RCPT');

    const { razorpayOrderId } = await createGatewayOrder({
      amountPaise: category.amountPaise,
      receiptReference: referenceId.slice(0, 40)
    });

    const paymentOrder = await PaymentOrder.create({
      orderId: internalOrderId,
      referenceId,
      feeCategoryId: category._id,
      feeSnapshot: {
        name: category.name,
        institution: category.institution,
        programme: category.programme || '',
        academicSession: category.academicSession,
        amountPaise: category.amountPaise,
        currency: category.currency
      },
      studentDetails: {
        studentName: studentDetails.studentName.trim(),
        rollNumber: studentDetails.rollNumber.trim(),
        email: studentDetails.email.trim().toLowerCase(),
        phone: studentDetails.phone.trim(),
        notes: studentDetails.notes || ''
      },
      razorpayOrderId,
      amountPaise: category.amountPaise,
      currency: category.currency,
      status: 'initiated',
      idempotentKey: idempotentKey || null
    });

    return res.status(201).json({
      success: true,
      orderId: paymentOrder.orderId,
      referenceId: paymentOrder.referenceId,
      razorpayOrderId,
      amountPaise: paymentOrder.amountPaise,
      amountRupees: (paymentOrder.amountPaise / 100).toLocaleString('en-IN'),
      currency: paymentOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key_id',
      institution: paymentOrder.feeSnapshot.institution,
      feeName: paymentOrder.feeSnapshot.name
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Order creation failed.' });
  }
});

router.post(['/verify', '/payments/verify'], async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, error: 'Missing parameters.' });
    }

    const order = await PaymentOrder.findOne({ $or: [{ razorpayOrderId }, { orderId: razorpayOrderId }] });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    const isSigValid = verifyGatewaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });
    if (!isSigValid) {
      order.status = 'failed';
      await order.save();
      await PaymentTransaction.findOneAndUpdate(
        { razorpayPaymentId },
        {
          transactionId: generateReference('TXN'),
          paymentOrderId: order._id,
          referenceId: order.referenceId,
          razorpayPaymentId,
          razorpayOrderId,
          amountPaise: order.amountPaise,
          currency: order.currency,
          status: 'failed',
          captureStatus: 'failed',
          verificationStatus: 'failed',
          failureReason: 'Cryptographic signature mismatch'
        },
        { upsert: true, returnDocument: 'after' }
      );
      return res.status(400).json({ success: false, verified: false, error: 'Security Verification Failure: Payment signature could not be verified by server.' });
    }

    order.status = 'successful';
    order.verificationDetails.verifiedAt = new Date();
    order.verificationDetails.verifiedBy = 'Gateway';
    await order.save();

    const transaction = await PaymentTransaction.findOneAndUpdate(
      { razorpayPaymentId },
      {
        transactionId: generateReference('TXN'),
        paymentOrderId: order._id,
        referenceId: order.referenceId,
        razorpayPaymentId,
        razorpayOrderId,
        amountPaise: order.amountPaise,
        currency: order.currency,
        status: 'successful',
        captureStatus: 'captured',
        verificationStatus: 'verified',
        verifiedAt: new Date()
      },
      { upsert: true, returnDocument: 'after' }
    );

    return res.json({
      success: true,
      verified: true,
      referenceId: order.referenceId,
      receiptId: order.referenceId,
      transactionId: transaction.transactionId
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Verification failed.' });
  }
});

router.post(['/webhook', '/payments/webhook'], async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body;
    const isValid = verifyWebhookSignature({ rawBody: typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody), webhookSignature: signature });
    if (!isValid) return res.status(400).json({ success: false, error: 'Invalid signature.' });

    const eventData = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const eventId = eventData.id || `${eventData.event}-${Date.now()}`;
    if (processedWebhookEvents.has(eventId)) {
      return res.status(200).json({ success: true, message: 'Event already processed.' });
    }
    processedWebhookEvents.add(eventId);
    return res.status(200).json({ success: true, received: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Webhook error.' });
  }
});

// -----------------------------------------------------------------------------
// ADMIN PAYMENT MANAGEMENT (MANUAL VERIFICATION & RECONCILIATION)
// -----------------------------------------------------------------------------

// GET /api/admin/payments (Payment Logs with Approved / Disapproved / Pending filters)
router.get(['/payments', '/admin/payments'], requireAdminAuth, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      if (status === 'approved' || status === 'verified') {
        query.status = { $in: ['verified', 'successful'] };
      } else if (status === 'disapproved' || status === 'rejected') {
        query.status = { $in: ['rejected', 'disapproved'] };
      } else {
        query.status = status;
      }
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { referenceId: { $regex: s, $options: 'i' } },
        { orderId: { $regex: s, $options: 'i' } },
        { 'studentDetails.studentName': { $regex: s, $options: 'i' } },
        { 'studentDetails.district': { $regex: s, $options: 'i' } },
        { 'studentDetails.rollNumber': { $regex: s, $options: 'i' } },
        { 'studentDetails.phone': { $regex: s, $options: 'i' } },
        { 'paymentProof.utrNumber': { $regex: s, $options: 'i' } },
        { 'paymentProof.upiId': { $regex: s, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const total = await PaymentOrder.countDocuments(query);
    const submissions = await PaymentOrder.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Verified totals calculated strictly from verified / successful payments
    const verifiedAgg = await PaymentOrder.aggregate([
      { $match: { status: { $in: ['verified', 'successful'] } } },
      {
        $group: {
          _id: null,
          totalPaise: { $sum: '$amountPaise' },
          count: { $sum: 1 }
        }
      }
    ]);

    const verifiedTotals = verifiedAgg[0] || { totalPaise: 0, count: 0 };
    const pendingCount = await PaymentOrder.countDocuments({ status: 'pending' });
    const approvedCount = await PaymentOrder.countDocuments({ status: { $in: ['verified', 'successful'] } });
    const disapprovedCount = await PaymentOrder.countDocuments({ status: { $in: ['rejected', 'disapproved'] } });

    return res.json({
      success: true,
      submissions,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      verifiedCollectionsRupees: (verifiedTotals.totalPaise / 100).toFixed(2),
      verifiedTransactionsCount: verifiedTotals.count,
      pendingCount,
      approvedCount,
      disapprovedCount
    });
  } catch (err) {
    console.error('[Admin Payments] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve payments.' });
  }
});

// POST /api/admin/payments/:id/verify
router.post(['/payments/:id/verify', '/admin/payments/:id/verify'], requireAdminAuth, async (req, res) => {
  try {
    const { adminNotes } = req.body;
    const isOid = req.params.id && req.params.id.match(/^[0-9a-fA-F]{24}$/);
    const order = isOid ? await PaymentOrder.findById(req.params.id) : await PaymentOrder.findOne({ referenceId: req.params.id });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Payment submission not found.' });
    }

    order.status = 'verified';
    order.verificationDetails = {
      verifiedBy: req.admin.username,
      verifiedAt: new Date(),
      adminNotes: adminNotes || 'Verified against institutional bank account statement.'
    };
    await order.save();

    // Create or update verified transaction record
    await PaymentTransaction.findOneAndUpdate(
      { paymentOrderId: order._id },
      {
        transactionId: generateReference('TXN'),
        paymentOrderId: order._id,
        razorpayPaymentId: order.razorpayPaymentId || `UPI-${order.referenceId}`,
        utrNumber: order.paymentProof.utrNumber || '',
        razorpayOrderId: order.orderId,
        amountPaise: order.amountPaise,
        currency: order.currency,
        status: 'successful',
        captureStatus: 'captured',
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        method: 'UPI-MANUAL'
      },
      { upsert: true, returnDocument: 'after' }
    );

    await logAuditEvent(req, {
      action: 'PAYMENT_MANUAL_VERIFIED',
      targetType: 'PaymentOrder',
      targetId: order._id.toString(),
      metadata: {
        referenceId: order.referenceId,
        studentName: order.studentDetails.studentName,
        rollNumber: order.studentDetails.rollNumber,
        amountRupees: order.amountPaise / 100,
        utrNumber: order.paymentProof.utrNumber
      }
    });

    return res.json({
      success: true,
      message: `Payment ${order.referenceId} has been manually approved and verified. Official receipt is now issued.`,
      order
    });
  } catch (err) {
    console.error('[Admin Payment Verify] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to verify payment.' });
  }
});

// POST /api/admin/payments/:id/reject
router.post(['/payments/:id/reject', '/admin/payments/:id/reject'], requireAdminAuth, async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required.' });
    }

    const isOid = req.params.id && req.params.id.match(/^[0-9a-fA-F]{24}$/);
    const order = isOid ? await PaymentOrder.findById(req.params.id) : await PaymentOrder.findOne({ referenceId: req.params.id });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Payment submission not found.' });
    }

    order.status = 'rejected';
    order.verificationDetails = {
      verifiedBy: req.admin.username,
      verifiedAt: new Date(),
      adminNotes: rejectionReason.trim()
    };
    order.rejectionDetails = {
      rejectedBy: req.admin.username,
      rejectedAt: new Date(),
      rejectionReason: rejectionReason.trim()
    };
    await order.save();

    await logAuditEvent(req, {
      action: 'PAYMENT_MANUAL_REJECTED',
      targetType: 'PaymentOrder',
      targetId: order._id.toString(),
      metadata: {
        referenceId: order.referenceId,
        rejectionReason: rejectionReason.trim()
      }
    });

    return res.json({
      success: true,
      message: `Payment ${order.referenceId} has been rejected.`,
      order
    });
  } catch (err) {
    console.error('[Admin Payment Reject] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reject payment.' });
  }
});

// DELETE /api/admin/payments/approved (Batch delete all approved / verified payments)
router.delete(['/payments/approved', '/admin/payments/approved'], requireAdminAuth, async (req, res) => {
  try {
    const approvedOrders = await PaymentOrder.find({ status: { $in: ['verified', 'successful'] } });
    const orderIds = approvedOrders.map(o => o._id);
    const count = approvedOrders.length;

    await PaymentOrder.deleteMany({ _id: { $in: orderIds } });
    await PaymentTransaction.deleteMany({ paymentOrderId: { $in: orderIds } });

    await logAuditEvent(req, {
      action: 'PAYMENTS_APPROVED_BATCH_DELETED',
      targetType: 'PaymentOrder',
      targetId: 'batch',
      metadata: { deletedCount: count }
    });

    return res.json({
      success: true,
      message: `Successfully deleted ${count} approved payment record${count === 1 ? '' : 's'}.`,
      deletedCount: count
    });
  } catch (err) {
    console.error('[Admin Delete Approved Payments] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete approved payments.' });
  }
});

// POST /api/admin/payments/qr-config and /api/admin/payments/settings (Updates QR, UPI and Synchronizes Course Prices)
router.post(['/payments/qr-config', '/admin/payments/qr-config', '/payments/settings', '/admin/payments/settings'], requireAdminAuth, async (req, res) => {
  try {
    const { qrImageUrl, upiId, accountName, bankName, accountNumber, ifscCode, instructions, deledPriceRupees, itiPriceRupees, baPriceRupees } = req.body;

    let settings = await PaymentSettings.findOne();
    if (!settings) {
      settings = new PaymentSettings();
    }

    if (qrImageUrl) settings.qrImageUrl = qrImageUrl.trim();
    if (upiId) settings.upiId = upiId.trim();
    if (accountName) settings.accountName = accountName.trim();
    if (bankName) settings.bankName = bankName.trim();
    if (accountNumber) settings.accountNumber = accountNumber.trim();
    if (ifscCode) settings.ifscCode = ifscCode.trim();
    if (instructions) settings.instructions = instructions.trim();

    if (!settings.coursePrices) {
      settings.coursePrices = { deledPriceRupees: 41000, itiPriceRupees: 16000, baPriceRupees: 3000 };
    }

    if (deledPriceRupees && !isNaN(deledPriceRupees)) {
      const deledNum = Math.round(Number(deledPriceRupees));
      settings.coursePrices.deledPriceRupees = deledNum;
      await FeeCategory.updateMany(
        { $or: [{ programme: /D\.El\.Ed/i }, { name: /\bD\.?El\.?Ed\b/i }] },
        { amountPaise: deledNum * 100 }
      );
    }

    if (itiPriceRupees && !isNaN(itiPriceRupees)) {
      const itiNum = Math.round(Number(itiPriceRupees));
      settings.coursePrices.itiPriceRupees = itiNum;
      await FeeCategory.updateMany(
        { $or: [{ programme: /ITI/i }, { name: /\bITI\b/i }] },
        { amountPaise: itiNum * 100 }
      );
    }

    if (baPriceRupees && !isNaN(baPriceRupees)) {
      const baNum = Math.round(Number(baPriceRupees));
      settings.coursePrices.baPriceRupees = baNum;
      await FeeCategory.updateMany(
        { $or: [{ programme: /Bachelor of Arts|B\.A/i }, { name: /\bB\.?A\.?\b/i }] },
        { amountPaise: baNum * 100 }
      );
    }

    settings.updatedBy = req.admin.username;
    await settings.save();

    await logAuditEvent(req, {
      action: 'PAYMENT_SETTINGS_UPDATE',
      targetType: 'PaymentSettings',
      targetId: settings._id.toString(),
      metadata: {
        qrImageUrl: settings.qrImageUrl,
        upiId: settings.upiId,
        coursePrices: settings.coursePrices
      }
    });

    return res.json({
      success: true,
      message: 'UPI settings and course pricings updated successfully and synchronized with public programmes.',
      settings
    });
  } catch (err) {
    console.error('[Admin QR Config] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update QR & pricing settings.' });
  }
});

// GET /api/admin/payments/export
router.get(['/payments/export', '/admin/payments/export'], requireAdminAuth, async (req, res) => {
  try {
    const orders = await PaymentOrder.find().sort({ createdAt: -1 }).limit(1000);

    const headers = [
      'Reference ID',
      'Date',
      'Student Name',
      'Roll Number',
      'Phone',
      'Email',
      'Institution',
      'Fee Category',
      'Academic Session',
      'Amount INR',
      'UPI UTR Reference',
      'Status',
      'Verified By',
      'Verified Date',
      'Admin Notes'
    ];

    const rows = orders.map(o => [
      `"${o.referenceId}"`,
      `"${new Date(o.createdAt).toISOString()}"`,
      `"${(o.studentDetails.studentName || '').replace(/"/g, '""')}"`,
      `"${(o.studentDetails.rollNumber || '').replace(/"/g, '""')}"`,
      `"${o.studentDetails.phone || ''}"`,
      `"${o.studentDetails.email || ''}"`,
      `"${(o.feeSnapshot.institution || '').replace(/"/g, '""')}"`,
      `"${(o.feeSnapshot.name || '').replace(/"/g, '""')}"`,
      `"${o.feeSnapshot.academicSession || ''}"`,
      (o.amountPaise / 100).toFixed(2),
      `"${o.paymentProof.utrNumber || ''}"`,
      `"${o.status}"`,
      `"${o.verificationDetails.verifiedBy || ''}"`,
      `"${o.verificationDetails.verifiedAt ? new Date(o.verificationDetails.verifiedAt).toISOString() : ''}"`,
      `"${(o.verificationDetails.adminNotes || '').replace(/"/g, '""')}"`
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="set-fee-submissions-${Date.now()}.csv"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Export failed.' });
  }
});

// Admin Fee endpoints
router.get(['/fees', '/admin/fees'], requireAdminAuth, async (req, res) => {
  try {
    const fees = await FeeCategory.find().sort({ institution: 1, createdAt: -1 });
    return res.json({ success: true, fees });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve fees.' });
  }
});

router.post(['/fees', '/admin/fees'], requireAdminAuth, async (req, res) => {
  try {
    const { name, description, institution, programme, academicSession, amountRupees, amountPaise, status = 'draft', isActive = true } = req.body;
    let finalPaise = amountPaise ? parseInt(amountPaise, 10) : Math.round(parseFloat(amountRupees) * 100);

    const fee = await FeeCategory.create({
      name: name.trim(),
      description: description || '',
      institution: institution.trim(),
      programme: programme ? programme.trim() : '',
      academicSession: academicSession.trim(),
      amountPaise: finalPaise,
      currency: 'INR',
      status: ['draft', 'published', 'archived'].includes(status) ? status : 'draft',
      isActive: Boolean(isActive),
      createdBy: req.admin.username
    });

    await logAuditEvent(req, {
      action: 'FEE_CREATE',
      targetType: 'FeeCategory',
      targetId: fee._id.toString(),
      metadata: { name: fee.name, amountPaise: fee.amountPaise }
    });

    return res.status(201).json({ success: true, message: `Fee "${fee.name}" created.`, fee });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to create fee.' });
  }
});

router.put(['/fees/:id', '/admin/fees/:id'], requireAdminAuth, async (req, res) => {
  try {
    const fee = await FeeCategory.findById(req.params.id);
    if (!fee) return res.status(404).json({ success: false, error: 'Fee not found.' });

    const { name, description, institution, programme, academicSession, amountRupees, amountPaise, status, isActive } = req.body;
    if (name) fee.name = name.trim();
    if (description !== undefined) fee.description = description;
    if (institution) fee.institution = institution.trim();
    if (programme !== undefined) fee.programme = programme.trim();
    if (academicSession) fee.academicSession = academicSession.trim();

    if (amountPaise || amountRupees) {
      fee.amountPaise = amountPaise ? parseInt(amountPaise, 10) : Math.round(parseFloat(amountRupees) * 100);
    }
    if (status) fee.status = status;
    if (isActive !== undefined) fee.isActive = Boolean(isActive);

    await fee.save();
    return res.json({ success: true, message: `Fee "${fee.name}" updated.`, fee });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update fee.' });
  }
});

router.post(['/fees/:id/publish', '/admin/fees/:id/publish'], requireAdminAuth, async (req, res) => {
  try {
    const fee = await FeeCategory.findById(req.params.id);
    if (!fee) return res.status(404).json({ success: false, error: 'Fee not found.' });
    fee.status = 'published';
    fee.isActive = true;
    await fee.save();
    return res.json({ success: true, message: `"${fee.name}" published.`, fee });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to publish fee.' });
  }
});

export default router;
