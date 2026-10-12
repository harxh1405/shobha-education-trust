import express from 'express';
import { ContentItem } from '../models/ContentItem.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { logAuditEvent } from '../middleware/audit.js';

const router = express.Router();

const VALID_TYPES = new Set([
  'news',
  'notices',
  'events',
  'timetables',
  'syllabus',
  'examinations',
  'results',
  'downloads'
]);

// Helper to generate a slug
function generateSlug(title) {
  return String(title)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .concat('-', Date.now().toString().slice(-4));
}

// GET /api/admin/content (List content items for admin with full filters)
router.get('/', requireAdminAuth, async (req, res) => {
  try {
    const { type, status, institution, search, page = 1, limit = 20 } = req.query;

    const query = {};
    if (type && VALID_TYPES.has(type)) {
      query.contentType = type;
    }
    if (status) {
      query.status = status;
    }
    if (institution) {
      query.institution = institution;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { noticeNumber: { $regex: search, $options: 'i' } },
        { programme: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const total = await ContentItem.countDocuments(query);
    const items = await ContentItem.find(query)
      .sort({ publicationDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    return res.json({
      success: true,
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (err) {
    console.error('[Admin Content] List error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve content list.' });
  }
});

// GET /api/admin/content/:id
router.get('/:id', requireAdminAuth, async (req, res) => {
  try {
    const item = await ContentItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Content item not found.' });
    }
    return res.json({ success: true, item });
  } catch (err) {
    console.error('[Admin Content] Get error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch content item.' });
  }
});

// POST /api/admin/content (Create new content item)
router.post('/', requireAdminAuth, async (req, res) => {
  try {
    const {
      contentType,
      title,
      category,
      summary,
      description,
      institution,
      programme,
      semester,
      academicSession,
      publicationDate,
      effectiveDate,
      eventStartDate,
      eventEndDate,
      venue,
      registrationInfo,
      noticeNumber,
      expiryDate,
      subject,
      examinationType,
      examinationDates,
      authorizedForPublicRelease,
      coverImage,
      fileAttachment,
      status = 'draft'
    } = req.body;

    if (!contentType || !VALID_TYPES.has(contentType)) {
      return res.status(400).json({
        success: false,
        error: `Valid contentType is required. Allowed: ${Array.from(VALID_TYPES).join(', ')}`
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required.' });
    }

    // Special validation for results
    if (contentType === 'results' && status === 'published' && !authorizedForPublicRelease) {
      return res.status(400).json({
        success: false,
        error: 'Privacy Compliance: Administrator must explicitly confirm that this official result publication is authorized for public release.'
      });
    }

    const slug = generateSlug(title);

    const newItem = await ContentItem.create({
      contentType,
      title: title.trim(),
      slug,
      category: category || 'General',
      summary: summary || '',
      description: description || '',
      institution: institution || 'Sarveshwaree Mahavidyalaya',
      programme: programme || '',
      semester: semester || '',
      academicSession: academicSession || '2026-2027',
      publicationDate: publicationDate ? new Date(publicationDate) : new Date(),
      effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
      eventStartDate: eventStartDate ? new Date(eventStartDate) : null,
      eventEndDate: eventEndDate ? new Date(eventEndDate) : null,
      venue: venue || '',
      registrationInfo: registrationInfo || '',
      noticeNumber: noticeNumber || '',
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      subject: subject || '',
      examinationType: examinationType || '',
      examinationDates: examinationDates || '',
      authorizedForPublicRelease: Boolean(authorizedForPublicRelease),
      coverImage: coverImage || { url: '', filename: '', caption: '' },
      fileAttachment: fileAttachment || { url: '', filename: '', originalName: '', sizeBytes: 0, mimeType: '' },
      status: ['draft', 'published', 'archived'].includes(status) ? status : 'draft',
      createdBy: req.admin.username,
      updatedBy: req.admin.username
    });

    await logAuditEvent(req, {
      action: 'CONTENT_CREATE',
      targetType: contentType,
      targetId: newItem._id.toString(),
      metadata: { title: newItem.title, status: newItem.status, institution: newItem.institution }
    });

    return res.status(201).json({
      success: true,
      message: `Content item "${newItem.title}" created successfully.`,
      item: newItem
    });
  } catch (err) {
    console.error('[Admin Content] Create error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create content item.' });
  }
});

// PUT /api/admin/content/:id (Update content item)
router.put('/:id', requireAdminAuth, async (req, res) => {
  try {
    const item = await ContentItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Content item not found.' });
    }

    const updateFields = [
      'title',
      'category',
      'summary',
      'description',
      'institution',
      'programme',
      'semester',
      'academicSession',
      'publicationDate',
      'effectiveDate',
      'eventStartDate',
      'eventEndDate',
      'venue',
      'registrationInfo',
      'noticeNumber',
      'expiryDate',
      'subject',
      'examinationType',
      'examinationDates',
      'authorizedForPublicRelease',
      'coverImage',
      'fileAttachment',
      'status'
    ];

    for (const field of updateFields) {
      if (req.body[field] !== undefined) {
        item[field] = req.body[field];
      }
    }

    if (req.body.title && req.body.title.trim() && (!item.slug || item.isModified('title'))) {
      item.slug = generateSlug(item.title);
    }

    // Special validation for results
    if (item.contentType === 'results' && item.status === 'published' && !item.authorizedForPublicRelease) {
      return res.status(400).json({
        success: false,
        error: 'Privacy Compliance: Administrator must explicitly confirm that this official result publication is authorized for public release.'
      });
    }

    item.updatedBy = req.admin.username;
    await item.save();

    await logAuditEvent(req, {
      action: 'CONTENT_UPDATE',
      targetType: item.contentType,
      targetId: item._id.toString(),
      metadata: { title: item.title, status: item.status }
    });

    return res.json({
      success: true,
      message: `Content item "${item.title}" updated successfully.`,
      item
    });
  } catch (err) {
    console.error('[Admin Content] Update error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update content item.' });
  }
});

// POST /api/admin/content/:id/publish
router.post('/:id/publish', requireAdminAuth, async (req, res) => {
  try {
    const item = await ContentItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Content item not found.' });
    }

    if (item.contentType === 'results' && !item.authorizedForPublicRelease) {
      return res.status(400).json({
        success: false,
        error: 'Privacy Compliance: You must confirm authorization for public release before publishing results.'
      });
    }

    item.status = 'published';
    item.publicationDate = new Date();
    item.updatedBy = req.admin.username;
    await item.save();

    await logAuditEvent(req, {
      action: 'CONTENT_PUBLISH',
      targetType: item.contentType,
      targetId: item._id.toString(),
      metadata: { title: item.title }
    });

    return res.json({
      success: true,
      message: `"${item.title}" is now published and live on the public website.`,
      item
    });
  } catch (err) {
    console.error('[Admin Content] Publish error:', err);
    return res.status(500).json({ success: false, error: 'Failed to publish content item.' });
  }
});

// POST /api/admin/content/:id/unpublish
router.post('/:id/unpublish', requireAdminAuth, async (req, res) => {
  try {
    const item = await ContentItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Content item not found.' });
    }

    item.status = 'draft';
    item.updatedBy = req.admin.username;
    await item.save();

    await logAuditEvent(req, {
      action: 'CONTENT_UNPUBLISH',
      targetType: item.contentType,
      targetId: item._id.toString(),
      metadata: { title: item.title }
    });

    return res.json({
      success: true,
      message: `"${item.title}" has been unpublished and moved to drafts.`,
      item
    });
  } catch (err) {
    console.error('[Admin Content] Unpublish error:', err);
    return res.status(500).json({ success: false, error: 'Failed to unpublish content item.' });
  }
});

// POST /api/admin/content/:id/archive
router.post('/:id/archive', requireAdminAuth, async (req, res) => {
  try {
    const item = await ContentItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Content item not found.' });
    }

    item.status = 'archived';
    item.updatedBy = req.admin.username;
    await item.save();

    await logAuditEvent(req, {
      action: 'CONTENT_ARCHIVE',
      targetType: item.contentType,
      targetId: item._id.toString(),
      metadata: { title: item.title }
    });

    return res.json({
      success: true,
      message: `"${item.title}" has been archived.`,
      item
    });
  } catch (err) {
    console.error('[Admin Content] Archive error:', err);
    return res.status(500).json({ success: false, error: 'Failed to archive content item.' });
  }
});

// DELETE /api/admin/content/:id
router.delete('/:id', requireAdminAuth, async (req, res) => {
  try {
    const item = await ContentItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Content item not found.' });
    }

    await ContentItem.findByIdAndDelete(req.params.id);

    await logAuditEvent(req, {
      action: 'CONTENT_DELETE',
      targetType: item.contentType,
      targetId: req.params.id,
      metadata: { title: item.title }
    });

    return res.json({
      success: true,
      message: `Content item "${item.title}" has been deleted.`
    });
  } catch (err) {
    console.error('[Admin Content] Delete error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete content item.' });
  }
});

export default router;
