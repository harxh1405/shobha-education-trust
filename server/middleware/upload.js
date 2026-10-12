import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'data/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomHex = crypto.randomBytes(12).toString('hex');
    const safeName = `set-${Date.now()}-${randomHex}${ext}`;
    cb(null, safeName);
  }
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`Invalid file extension "${ext}". Allowed types: PDF, JPG, PNG, WEBP.`), false);
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    return cb(new Error(`Invalid MIME type "${file.mimetype}". Allowed types: application/pdf, image/jpeg, image/png, image/webp.`), false);
  }

  cb(null, true);
}

const maxSizeBytes = (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 15) * 1024 * 1024;

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxSizeBytes,
    files: 2
  }
});
