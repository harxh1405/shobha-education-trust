import mongoose from 'mongoose';

const ContentItemSchema = new mongoose.Schema({
  contentType: {
    type: String,
    required: true,
    enum: [
      'news',
      'notices',
      'events',
      'timetables',
      'syllabus',
      'examinations',
      'results',
      'downloads'
    ],
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  slug: {
    type: String,
    trim: true,
    lowercase: true,
    index: true
  },
  category: {
    type: String,
    trim: true,
    default: 'General'
  },
  summary: {
    type: String,
    trim: true,
    default: ''
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  institution: {
    type: String,
    required: true,
    trim: true,
    default: 'Sarveshwaree Mahavidyalaya',
    index: true
  },
  programme: {
    type: String,
    trim: true,
    default: ''
  },
  semester: {
    type: String,
    trim: true,
    default: ''
  },
  academicSession: {
    type: String,
    trim: true,
    default: '2026-2027',
    index: true
  },
  publicationDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  effectiveDate: {
    type: Date,
    default: null
  },
  // Specific to events
  eventStartDate: {
    type: Date,
    default: null
  },
  eventEndDate: {
    type: Date,
    default: null
  },
  venue: {
    type: String,
    trim: true,
    default: ''
  },
  registrationInfo: {
    type: String,
    trim: true,
    default: ''
  },
  // Specific to notices
  noticeNumber: {
    type: String,
    trim: true,
    default: ''
  },
  expiryDate: {
    type: Date,
    default: null
  },
  // Specific to syllabus
  subject: {
    type: String,
    trim: true,
    default: ''
  },
  // Specific to examinations
  examinationType: {
    type: String,
    trim: true,
    default: ''
  },
  examinationDates: {
    type: String,
    trim: true,
    default: ''
  },
  // Specific to results (PRIVACY requirement)
  authorizedForPublicRelease: {
    type: Boolean,
    default: false
  },
  // Attachments
  coverImage: {
    url: { type: String, default: '' },
    filename: { type: String, default: '' },
    caption: { type: String, default: '' }
  },
  fileAttachment: {
    url: { type: String, default: '' },
    filename: { type: String, default: '' },
    originalName: { type: String, default: '' },
    sizeBytes: { type: Number, default: 0 },
    mimeType: { type: String, default: '' }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  views: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: String,
    default: 'admin'
  },
  updatedBy: {
    type: String,
    default: 'admin'
  }
}, {
  timestamps: true
});

ContentItemSchema.index({ contentType: 1, status: 1, publicationDate: -1 });
ContentItemSchema.index({ contentType: 1, status: 1, institution: 1 });
ContentItemSchema.index({ contentType: 1, status: 1, academicSession: 1 });

export const ContentItem = mongoose.models.ContentItem || mongoose.model('ContentItem', ContentItemSchema);
