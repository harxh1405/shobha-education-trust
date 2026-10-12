import mongoose from 'mongoose';

const PaymentOrderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  referenceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  feeCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeCategory',
    required: true,
    index: true
  },
  feeSnapshot: {
    name: { type: String, required: true },
    institution: { type: String, required: true },
    programme: { type: String, default: '' },
    academicSession: { type: String, required: true },
    amountPaise: { type: Number, required: true },
    currency: { type: String, default: 'INR' }
  },
  studentDetails: {
    studentName: { type: String, required: true, trim: true },
    rollNumber: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    notes: { type: String, default: '' }
  },
  paymentProof: {
    utrNumber: { type: String, trim: true, default: '' },
    screenshotUrl: { type: String, default: '' },
    paymentDate: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: Date.now }
  },
  razorpayOrderId: {
    type: String,
    sparse: true,
    index: true
  },
  status: {
    type: String,
    enum: ['initiated', 'pending', 'verified', 'successful', 'failed', 'cancelled', 'rejected', 'refunded'],
    default: 'pending',
    index: true
  },
  verificationDetails: {
    verifiedBy: { type: String, default: '' },
    verifiedAt: { type: Date, default: null },
    adminNotes: { type: String, default: '' }
  },
  rejectionDetails: {
    rejectedBy: { type: String, default: '' },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' }
  },
  amountPaise: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer paise value'
    }
  },
  currency: {
    type: String,
    default: 'INR'
  },
  idempotentKey: {
    type: String,
    sparse: true,
    index: true
  }
}, {
  timestamps: true
});

PaymentOrderSchema.index({ createdAt: -1, status: 1 });
PaymentOrderSchema.index({ 'studentDetails.rollNumber': 1, 'studentDetails.email': 1 });
PaymentOrderSchema.index({ 'paymentProof.utrNumber': 1 });

export const PaymentOrder = mongoose.models.PaymentOrder || mongoose.model('PaymentOrder', PaymentOrderSchema);
