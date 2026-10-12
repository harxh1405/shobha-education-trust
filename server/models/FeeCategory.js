import mongoose from 'mongoose';

const FeeCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
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
    index: true
  },
  programme: {
    type: String,
    trim: true,
    default: ''
  },
  academicSession: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  amountPaise: {
    type: Number,
    required: true,
    min: 100, // minimum ₹1
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer paise value'
    }
  },
  currency: {
    type: String,
    required: true,
    default: 'INR',
    uppercase: true
  },
  effectiveFrom: {
    type: Date,
    default: null
  },
  effectiveUntil: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true
});

// Compound index for active public listings
FeeCategorySchema.index({ status: 1, isActive: 1, institution: 1 });

export const FeeCategory = mongoose.models.FeeCategory || mongoose.model('FeeCategory', FeeCategorySchema);
