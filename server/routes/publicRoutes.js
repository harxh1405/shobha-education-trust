import express from 'express';
import { ContentItem } from '../models/ContentItem.js';
import { UploadedFile } from '../models/UploadedFile.js';
import { Enquiry } from '../models/Enquiry.js';
import { publicApiRateLimiter } from '../middleware/rateLimiter.js';
import { sendAdmissionEnquiryEmail } from '../services/mailService.js';

const router = express.Router();

router.use(publicApiRateLimiter);

// Helper to normalize and ensure full file attachment metadata
function normalizeItemAttachments(item) {
  const obj = item && item.toObject ? item.toObject() : { ...item };
  const fileUrl = (obj.fileAttachment && obj.fileAttachment.url) ? obj.fileAttachment.url : (obj.documentUrl || '');
  const fileName = (obj.fileAttachment && obj.fileAttachment.originalName) ? obj.fileAttachment.originalName : (obj.documentName || (fileUrl ? fileUrl.split('/').pop() : ''));

  obj.documentUrl = fileUrl;
  obj.documentName = fileName;
  obj.fileAttachment = {
    url: fileUrl,
    originalName: fileName,
    filename: (obj.fileAttachment && obj.fileAttachment.filename) ? obj.fileAttachment.filename : (fileUrl ? fileUrl.split('/').pop() : ''),
    sizeBytes: (obj.fileAttachment && obj.fileAttachment.sizeBytes) ? obj.fileAttachment.sizeBytes : 0,
    mimeType: (obj.fileAttachment && obj.fileAttachment.mimeType) ? obj.fileAttachment.mimeType : ''
  };

  return obj;
}

// Helper to query published items
async function getPublishedContent(contentType, req, res) {
  try {
    const { institution, programme, session, search, page = 1, limit = 40 } = req.query;

    const query = {
      status: 'published'
    };

    if (contentType === 'uploads') {
      query.$or = [
        { 'fileAttachment.url': { $exists: true, $ne: '' } },
        { documentUrl: { $exists: true, $ne: '' } }
      ];
    } else if (contentType !== 'all') {
      query.contentType = contentType;
    }

    // Strict privacy requirement for results
    if (contentType === 'results') {
      query.authorizedForPublicRelease = true;
    }

    if (institution && institution !== 'all') {
      query.institution = institution;
    }

    if (programme && programme !== 'all') {
      query.programme = { $regex: programme, $options: 'i' };
    }

    if (session && session !== 'all') {
      query.academicSession = session;
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { title: { $regex: s, $options: 'i' } },
        { summary: { $regex: s, $options: 'i' } },
        { description: { $regex: s, $options: 'i' } },
        { noticeNumber: { $regex: s, $options: 'i' } },
        { subject: { $regex: s, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(60, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Determine sort
    let sortObj = { publicationDate: -1, createdAt: -1 };
    if (contentType === 'events') {
      sortObj = { eventStartDate: 1, publicationDate: -1 };
    }

    const total = await ContentItem.countDocuments(query);
    const rawItems = await ContentItem.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .select('-__v -createdBy -updatedBy');

    let formattedItems = rawItems.map(normalizeItemAttachments);

    // If viewing all resources or uploads on page 1, seamlessly merge any standalone admin uploaded files
    if ((contentType === 'all' || contentType === 'uploads') && pageNum === 1) {
      try {
        const standaloneFiles = await UploadedFile.find({ isPublic: true })
          .sort({ createdAt: -1 })
          .limit(15);

        const existingUrls = new Set(formattedItems.map(i => i.documentUrl).filter(Boolean));

        for (const file of standaloneFiles) {
          if (!existingUrls.has(file.url)) {
            const prettyTitle = (file.originalName || 'Institutional Circular')
              .replace(/\.[^/.]+$/, '')
              .replace(/[-_]+/g, ' ')
              .trim();

            formattedItems.push({
              _id: file._id,
              contentType: 'notices',
              title: prettyTitle.charAt(0).toUpperCase() + prettyTitle.slice(1),
              category: 'Official Upload',
              summary: `Official institutional upload (${file.originalName}) verified on server.`,
              description: `Uploaded official document for student and public verification. File: ${file.originalName}`,
              institution: 'Sarveshwaree Mahavidyalaya',
              programme: 'All Programmes',
              academicSession: '2026-2027',
              publicationDate: file.createdAt,
              documentUrl: file.url,
              documentName: file.originalName,
              fileAttachment: {
                url: file.url,
                originalName: file.originalName,
                filename: file.filename,
                sizeBytes: file.sizeBytes || 0,
                mimeType: file.mimeType || 'application/pdf'
              },
              status: 'published'
            });
            existingUrls.add(file.url);
          }
        }

        // Keep sorted by newest publication date / creation date
        formattedItems.sort((a, b) => new Date(b.publicationDate || b.createdAt) - new Date(a.publicationDate || a.createdAt));
      } catch (err) {
        console.warn('[Public API] Non-critical standalone upload merge error:', err.message);
      }
    }

    return res.json({
      success: true,
      items: formattedItems,
      total: Math.max(total, formattedItems.length),
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(Math.max(total, formattedItems.length) / limitNum)
    });
  } catch (err) {
    console.error(`[Public API] Error fetching ${contentType}:`, err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while fetching public academic resources.'
    });
  }
}

// 0. Aggregated All & Recent Uploads
router.get(['/all', '/resources'], (req, res) => getPublishedContent('all', req, res));
router.get(['/recent-uploads', '/uploads'], (req, res) => getPublishedContent('uploads', req, res));

// Lightweight sync status check for high-performance auto-polling
router.get('/sync-status', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const [totalContent, latestItem, totalUploads, latestUpload] = await Promise.all([
      ContentItem.countDocuments({ status: 'published' }),
      ContentItem.findOne({ status: 'published' }).sort({ updatedAt: -1, createdAt: -1 }).select('updatedAt createdAt title'),
      UploadedFile.countDocuments(),
      UploadedFile.findOne().sort({ createdAt: -1 }).select('createdAt filename')
    ]);

    const latestContentTs = latestItem ? new Date(latestItem.updatedAt || latestItem.createdAt).getTime() : 0;
    const latestUploadTs = latestUpload ? new Date(latestUpload.createdAt).getTime() : 0;
    const syncHash = `${totalContent}_${totalUploads}_${Math.max(latestContentTs, latestUploadTs)}`;

    return res.json({
      success: true,
      syncHash,
      lastUpdated: Math.max(latestContentTs, latestUploadTs),
      totalPublished: totalContent,
      totalUploads
    });
  } catch (err) {
    return res.json({ success: true, syncHash: String(Date.now()), lastUpdated: Date.now() });
  }
});

// 1. News
router.get('/news', (req, res) => getPublishedContent('news', req, res));

// Individual news article by slug or ID
router.get('/news/:slugOrId', async (req, res) => {
  try {
    const { slugOrId } = req.params;
    const query = {
      contentType: 'news',
      status: 'published',
      $or: [
        { slug: slugOrId },
        { _id: slugOrId.match(/^[0-9a-fA-F]{24}$/) ? slugOrId : null }
      ]
    };

    const article = await ContentItem.findOne(query).select('-__v -createdBy -updatedBy');
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found or not published.' });
    }

    // Increment view count quietly
    ContentItem.findByIdAndUpdate(article._id, { $inc: { views: 1 } }).exec();

    return res.json({ success: true, article });
  } catch (err) {
    console.error('[Public API] Error fetching news article:', err);
    return res.status(500).json({ success: false, error: 'Could not fetch article.' });
  }
});

// 2. Notices
router.get('/notices', (req, res) => getPublishedContent('notices', req, res));

// 3. Events
router.get('/events', (req, res) => getPublishedContent('events', req, res));

// 4. Timetables
router.get('/timetables', (req, res) => getPublishedContent('timetables', req, res));

// 5. Syllabus
router.get('/syllabus', (req, res) => getPublishedContent('syllabus', req, res));

// 6. Examinations
router.get('/examinations', (req, res) => getPublishedContent('examinations', req, res));

// 7. Results
router.get('/results', (req, res) => getPublishedContent('results', req, res));

// 8. Downloads / Forms
router.get(['/downloads', '/forms'], (req, res) => getPublishedContent('downloads', req, res));

// Unified News & Events bracket (News, Notices, Events)
router.get('/news-and-events', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 30 } = req.query;
    const query = {
      contentType: { $in: ['news', 'notices', 'events'] },
      status: 'published'
    };

    if (category && category !== 'all') {
      if (category === 'notices') {
        query.contentType = { $in: ['notices', 'news'] };
      } else if (['news', 'events'].includes(category)) {
        query.contentType = category;
      } else {
        query.category = category;
      }
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { title: { $regex: s, $options: 'i' } },
        { summary: { $regex: s, $options: 'i' } },
        { description: { $regex: s, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const total = await ContentItem.countDocuments(query);
    const rawItems = await ContentItem.find(query)
      .sort({ publicationDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const items = rawItems.map(item => ({
      _id: item._id,
      contentType: item.contentType,
      title: item.title,
      slug: item.slug,
      category: item.category,
      summary: item.summary,
      description: item.description,
      institution: item.institution,
      programme: item.programme,
      academicSession: item.academicSession,
      publicationDate: item.publicationDate,
      eventStartDate: item.eventStartDate,
      eventEndDate: item.eventEndDate,
      venue: item.venue,
      eventVenue: item.venue,
      noticeNumber: item.noticeNumber,
      coverImageUrl: item.coverImage ? item.coverImage.url : '',
      fileAttachment: item.fileAttachment,
      documentUrl: (item.fileAttachment && item.fileAttachment.url) ? item.fileAttachment.url : '',
      documentName: (item.fileAttachment && item.fileAttachment.originalName) ? item.fileAttachment.originalName : '',
      status: item.status
    }));

    return res.json({ success: true, items, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error('[Public API] Error in news-and-events:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch news and events.' });
  }
});

// POST /api/public/enquiry — Creates workable admission enquiry with formatted email template
router.post('/enquiry', async (req, res) => {
  try {
    const { name, phone, email, district, programme, message } = req.body;
    if (!name || !name.trim() || !phone || !phone.trim()) {
      return res.status(400).json({ success: false, error: 'Full Name and Phone Number are required.' });
    }

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanDistrict = (district || 'Jaunpur').trim();
    const cleanProgramme = (programme || 'General Admission 2026-27').trim();
    const cleanMsg = (message || '').trim();

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const emailSubject = `[Admission Enquiry 2026–27] ${cleanName} — ${cleanProgramme} (${cleanDistrict})`;
    const emailBody = `Respected Admissions Desk / Shobha Education Trust,

A new admission inquiry has been submitted through the institutional portal.

--------------------------------------------------
APPLICANT INQUIRY DETAILS
--------------------------------------------------
Candidate Name      : ${cleanName}
Contact Phone Number: ${cleanPhone}
Email Address       : ${cleanEmail || 'Not Provided'}
Home District       : ${cleanDistrict}
Programme of Choice : ${cleanProgramme}
Inquiry Message     : ${cleanMsg || 'Seeking general admission counseling and seat availability details.'}
Submission Time     : ${timestamp} IST

--------------------------------------------------
OFFICIAL CAMPUS ADMISSION CELL ACTION CHECKLIST
--------------------------------------------------
[ ] Verify academic prerequisites (10th/12th/Graduation)
[ ] Contact candidate on ${cleanPhone}
[ ] Share fee schedule & prospectus for ${cleanProgramme}
[ ] Provide campus visit and physical document reporting instructions

Institutional Admissions Cell
Shobha Education Trust
Kamruddinpur, Post Dilshadpur, Jaunpur, Uttar Pradesh
Helplines: +91 8318784268 | +91 8765926859
Website: https://shobhaeducationtrust.in`;

    const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const referenceId = `SET-ENQ-${dateCode}-${randomHex}`;

    const enquiry = await Enquiry.create({
      referenceId,
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail || 'not-provided@example.com',
      district: cleanDistrict,
      category: 'Admissions',
      institutionOrProgramme: cleanProgramme,
      programme: cleanProgramme,
      subject: `Admission Enquiry: ${cleanProgramme}`,
      message: cleanMsg || 'General Admission Enquiry',
      emailSubject,
      emailBody
    });

    const mailStatus = await sendAdmissionEnquiryEmail({
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      district: cleanDistrict,
      programme: cleanProgramme,
      message: cleanMsg,
      emailSubject,
      emailBody
    });

    const mailtoUrl = `mailto:harsh.singh.2003dydt@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    return res.status(201).json({
      success: true,
      message: 'Your admission enquiry has been submitted. Our campus admissions office will contact you shortly.',
      enquiryId: enquiry._id,
      mailStatus,
      emailTemplate: {
        to: 'harsh.singh.2003dydt@gmail.com',
        subject: emailSubject,
        body: emailBody,
        mailtoUrl
      }
    });
  } catch (err) {
    console.error('[Public API] Enquiry submission error:', err);
    return res.status(500).json({ success: false, error: 'Could not process admission enquiry.' });
  }
});

export default router;
