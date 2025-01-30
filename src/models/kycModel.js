import mongoose from 'mongoose';
import validator from 'validator';

const DOCUMENT_TYPES = ['Aadhar', 'PAN', 'Passport', 'Driving License'];
const KYC_STATUSES = [
  'Pending',
  'Verified',
  'Failed',
  'Cancelled',
  'Processing',
  'Rejected',
];

const kycSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      required: [true, 'Partner ID is required'],
      index: true,
    },
    nameOnDocument: {
      type: String,
      required: [true, 'Name on the document is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
    },
    documentType: {
      type: String,
      required: [true, 'Document type is required'],
      enum: {
        values: DOCUMENT_TYPES,
        message:
          'Invalid document type. Valid types: Aadhar, PAN, Passport, Driving License',
      },
    },
    documentNumber: {
      type: String,
      required: [true, 'Document number is required'],
      trim: true,
      match: [/^[A-Za-z0-9-]+$/, 'Document number contains invalid characters'],
    },
    frontImage: {
      type: String,
      required: [true, 'Front image URL is required'],
      validate: {
        validator: (value) => validator.isURL(value),
        message: 'Invalid URL for front image',
      },
    },
    backImage: {
      type: String,
      required: [true, 'Back image URL is required'],
      validate: {
        validator: (value) => validator.isURL(value),
        message: 'Invalid URL for back image',
      },
    },
    kycStatus: {
      type: String,
      required: [true, 'KYC status is required'],
      enum: {
        values: KYC_STATUSES,
        message:
          'Invalid KYC status. Valid statuses: Pending, Verified, Failed, Cancelled',
      },
      default: 'Pending',
    },
    message: {
      type: String,
      trim: true,
      default: '', // Optional: Default to an empty string
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

kycSchema.virtual('documentDetails').get(function () {
  return `${this.documentType}: ${this.documentNumber}`;
});

// Compound index for uniqueness
kycSchema.index({ partner: 1, documentType: 1 }, { unique: true });

// Middleware to sync KYC status with the partner model
kycSchema.post('findOneAndUpdate', async function (doc) {
  if (doc) {
    const { kycStatus, partner } = doc;
    await mongoose.model('Partner').findByIdAndUpdate(partner, { kycStatus });
  }
});

kycSchema.post('save', async function () {
  const { kycStatus, partner } = this;
  await mongoose.model('Partner').findByIdAndUpdate(partner, { kycStatus });
});

export const KYC = mongoose.model('KYC', kycSchema);
