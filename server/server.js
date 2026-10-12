import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

import { connectDB } from './db.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import enquiryRoutes from './routes/enquiryRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Ensure upload directory exists
const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'data/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 1. CORS Configuration (Supports credentials for cookie authentication)
const defaultDevOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175'
];

const allowedOrigins = [
  ...defaultDevOrigins,
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (process.env.NODE_ENV === 'production') {
      return callback(new Error('CORS origin unauthorized by policy'));
    }
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin unauthorized by policy'));
  },
  credentials: true
}));

// 2. Body Parsers with Raw Body retention for Webhook HMAC verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
  limit: '10mb'
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 3. Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// 4. Serve uploaded files statically with security headers
app.use('/uploads', express.static(uploadDir, {
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
  }
}));

// 5. Mount API Routes
// Admin Auth & Profile
app.use('/api/admin', authRoutes);
app.use('/api/admin', adminRoutes);

// Admin Content Management
app.use('/api/admin/content', contentRoutes);

// File Upload
app.use('/api/admin/upload', uploadRoutes);

// Payment & Fees (Admin + Public)
app.use('/api/admin', paymentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/public/fees', paymentRoutes); // alias for public fee quotes/options
app.use('/api/public/payments', paymentRoutes); // alias for public QR config and payment status

// Public Student Corner & Content
app.use('/api/public', publicRoutes);

// Dedicated Enquiries API (POST /api/v1/enquiries and alias /api/public/enquiries)
app.use('/api/v1/enquiries', enquiryRoutes);
app.use('/api/public/enquiries', enquiryRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    organization: 'Shobha Education Trust'
  });
});

// 6. Serve Compiled Production Frontend (for single-container deployments)
const distDir = path.resolve('dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    const directPath = path.join(distDir, req.path.endsWith('.html') ? req.path : `${req.path}.html`);
    if (fs.existsSync(directPath)) {
      return res.sendFile(directPath);
    }
    const subIndexPath = path.join(distDir, req.path, 'index.html');
    if (fs.existsSync(subIndexPath)) {
      return res.sendFile(subIndexPath);
    }
    const rootIndexPath = path.join(distDir, 'index.html');
    if (fs.existsSync(rootIndexPath)) {
      return res.sendFile(rootIndexPath);
    }
    next();
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'An internal server error occurred.'
  });
});

// Start Database and HTTP Server
async function startServer() {
  try {
    await connectDB();
    try {
      const { seedAdmin } = await import('../scripts/seedAdmin.js');
      const { seedFeeCategories } = await import('../scripts/seedFeeCategories.js');
      await seedAdmin();
      await seedFeeCategories();
    } catch (seedErr) {
      console.warn('[Server Startup] Auto-seeding notice:', seedErr.message);
    }
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  SHOBHA EDUCATION TRUST — BACKEND API SERVER RUNNING  `);
      console.log(`  Port: ${PORT} | Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Health Check: http://localhost:${PORT}/api/health    `);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// If run directly
const isMain = process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('server'));
if (isMain) {
  startServer();
}

export default app;

