import mongoose from 'mongoose';

const EnquirySchema = new mongoose.Schema({
  referenceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 150
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    maxlength: 25
  },
  category: {
    type: String,
    required: true,
    trim: true,
    default: 'General Enquiry'
  },
  institutionOrProgramme: {
    type: String,
    trim: true,
    maxlength: 200,
    default: ''
  },
  // Maintained for backward compatibility
  programme: {
    type: String,
    trim: true,
    default: 'General Admission'
  },
  district: {
    type: String,
    trim: true,
    default: 'Jaunpur'
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 3000
  },
  emailSubject: {
    type: String,
    default: ''
  },
  emailBody: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'resolved'],
    default: 'new',
    index: true
  },
  deliveryStatus: {
    type: String,
    enum: ['accepted', 'delivered', 'failed', 'mocked'],
    default: 'accepted'
  },
  provider: {
    type: String,
    default: ''
  },
  messageId: {
    type: String,
    default: ''
  },
  deliveryError: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

EnquirySchema.index({ createdAt: -1 });

export const Enquiry = mongoose.models.Enquiry || mongoose.model('Enquiry', EnquirySchema);
