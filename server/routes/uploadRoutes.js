import express from 'express';
import { uploadMiddleware } from '../middleware/upload.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { UploadedFile } from '../models/UploadedFile.js';
import { logAuditEvent } from '../middleware/audit.js';

const router = express.Router();

// POST /api/admin/upload
router.post('/', requireAdminAuth, (req, res) => {
  uploadMiddleware.single('file')(req, res, async (err) => {
    if (err) {
      console.warn('[Upload] Validation/processing error:', err.message);
      return res.status(400).json({
        success: false,
        error: err.message || 'File upload rejected by server security policy.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file was provided for upload.'
      });
    }

    try {
      const fileUrl = `/uploads/${req.file.filename}`;

      const uploadedRecord = await UploadedFile.create({
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        path: req.file.path,
        url: fileUrl,
        isPublic: true,
        uploadedBy: req.admin.username
      });

      await logAuditEvent(req, {
        action: 'FILE_UPLOAD',
        targetType: 'UploadedFile',
        targetId: uploadedRecord._id.toString(),
        metadata: { filename: req.file.filename, originalName: req.file.originalname, size: req.file.size }
      });

      return res.status(201).json({
        success: true,
        message: 'File uploaded and validated successfully.',
        file: {
          url: fileUrl,
          filename: req.file.filename,
          originalName: req.file.originalname,
          sizeBytes: req.file.size,
          mimeType: req.file.mimetype
        }
      });
    } catch (saveErr) {
      console.error('[Upload] Database save error:', saveErr);
      return res.status(500).json({
        success: false,
        error: 'File saved but failed to register file metadata in database.'
      });
    }
  });
});

export default router;
