import mongoose from 'mongoose';

const UploadedFileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  sizeBytes: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  uploadedBy: {
    type: String,
    default: 'admin'
  }
}, {
  timestamps: true
});

export const UploadedFile = mongoose.models.UploadedFile || mongoose.model('UploadedFile', UploadedFileSchema);
