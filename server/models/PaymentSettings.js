import mongoose from 'mongoose';

const PaymentSettingsSchema = new mongoose.Schema({
  qrImageUrl: {
    type: String,
    default: '/assets/upi-qr.svg'
  },
  upiId: {
    type: String,
    default: 'shobhaeducationtrust@upi'
  },
  accountName: {
    type: String,
    default: 'Shobha Education Trust'
  },
  bankName: {
    type: String,
    default: 'State Bank of India'
  },
  accountNumber: {
    type: String,
    default: '39281029381'
  },
  ifscCode: {
    type: String,
    default: 'SBIN0001234'
  },
  instructions: {
    type: String,
    default: 'Scan this official QR using Google Pay, PhonePe, Paytm, BHIM, or any UPI banking app. After completing the payment, note down the 12-digit UPI Reference / UTR Number and submit it below for manual verification.'
  },
  coursePrices: {
    deledPriceRupees: { type: Number, default: 41000 },
    itiPriceRupees: { type: Number, default: 16000 },
    baPriceRupees: { type: Number, default: 3000 }
  },
  updatedBy: {
    type: String,
    default: 'admin'
  }
}, {
  timestamps: true
});

export const PaymentSettings = mongoose.models.PaymentSettings || mongoose.model('PaymentSettings', PaymentSettingsSchema);
