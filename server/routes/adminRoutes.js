import express from 'express';
import { ContentItem } from '../models/ContentItem.js';
import { PaymentOrder } from '../models/PaymentOrder.js';
import { PaymentTransaction } from '../models/PaymentTransaction.js';
import { AuditLog } from '../models/AuditLog.js';
import { FeeCategory } from '../models/FeeCategory.js';
import { requireAdminAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/admin/dashboard/stats
router.get('/dashboard/stats', requireAdminAuth, async (req, res) => {
  try {
    // 1. Total published content items
    const totalPublished = await ContentItem.countDocuments({ status: 'published' });

    // 2. Draft items awaiting publication
    const totalDrafts = await ContentItem.countDocuments({ status: 'draft' });

    // 3. Upcoming events (events starting today or in future and published)
    const now = new Date();
    const upcomingEvents = await ContentItem.find({
      contentType: 'events',
      status: 'published',
      $or: [
        { eventStartDate: { $gte: now } },
        { publicationDate: { $gte: new Date(now.getTime() - 7 * 86400000) } }
      ]
    })
      .sort({ eventStartDate: 1, publicationDate: -1 })
      .limit(5);

    // 4. Recently published announcements
    const recentNews = await ContentItem.find({
      contentType: { $in: ['news', 'notices'] },
      status: 'published'
    })
      .sort({ publicationDate: -1 })
      .limit(5);

    // 5. Recent payment transactions
    const recentTransactions = await PaymentTransaction.find()
      .populate('paymentOrderId')
      .sort({ createdAt: -1 })
      .limit(8);

    // 6. Payment totals based ONLY on verified successful transactions
    const verifiedTransactions = await PaymentTransaction.aggregate([
      {
        $match: {
          verificationStatus: 'verified',
          status: 'successful'
        }
      },
      {
        $group: {
          _id: null,
          totalAmountPaise: { $sum: '$amountPaise' },
          count: { $sum: 1 }
        }
      }
    ]);

    const verifiedTotals = verifiedTransactions[0] || { totalAmountPaise: 0, count: 0 };

    // Fee categories count
    const totalFeeCategories = await FeeCategory.countDocuments({ status: 'published', isActive: true });

    return res.json({
      success: true,
      stats: {
        totalPublished,
        totalDrafts,
        totalFeeCategories,
        verifiedCollectionsRupees: (verifiedTotals.totalAmountPaise / 100).toFixed(2),
        verifiedCollectionsPaise: verifiedTotals.totalAmountPaise,
        verifiedTransactionsCount: verifiedTotals.count,
        upcomingEvents,
        recentNews,
        recentTransactions
      }
    });
  } catch (err) {
    console.error('[Admin Dashboard] Stats error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve admin dashboard metrics.'
    });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', requireAdminAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const total = await AuditLog.countDocuments();
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      logs
    });
  } catch (err) {
    console.error('[Admin] Audit log fetch error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit trail.'
    });
  }
});

export default router;
