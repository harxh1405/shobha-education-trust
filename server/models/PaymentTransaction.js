import mongoose from 'mongoose';

const PaymentTransactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  paymentOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentOrder',
    required: true,
    index: true
  },
  referenceId: {
    type: String,
    required: true,
    index: true
  },
  razorpayPaymentId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  razorpayOrderId: {
    type: String,
    required: true,
    index: true
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
  status: {
    type: String,
    enum: ['successful', 'pending', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  captureStatus: {
    type: String,
    enum: ['captured', 'authorized', 'failed', 'refunded'],
    default: 'authorized'
  },
  method: {
    type: String,
    default: 'gateway'
  },
  verificationStatus: {
    type: String,
    enum: ['verified', 'unverified', 'failed'],
    default: 'unverified',
    index: true
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  failureReason: {
    type: String,
    default: ''
  },
  paymentTimestamp: {
    type: Date,
    default: Date.now
  },
  safeMetadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

PaymentTransactionSchema.index({ createdAt: -1, status: 1 });
PaymentTransactionSchema.index({ paymentTimestamp: -1 });

export const PaymentTransaction = mongoose.models.PaymentTransaction || mongoose.model('PaymentTransaction', PaymentTransactionSchema);
