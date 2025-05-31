import mongoose from 'mongoose';

const partnerBankDetailSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
    },
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true,
      minlength: [3, 'Bank name must be at least 3 characters long'],
    },
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      unique: true,
      trim: true,
      match: [/^\d{9,18}$/, 'Account number must be between 9 to 18 digits'], // ✅ Custom validation
    },
    ifscCode: {
      type: String,
      required: [true, 'IFSC code is required'],
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'], // ✅ Valid IFSC format
    },
    accountHolderName: {
      type: String,
      required: [true, 'Account holder name is required'],
      trim: true,
      minlength: [3, 'Account holder name must be at least 3 characters long'],
    },
    branchName: {
      type: String,
      trim: true,
      minlength: [3, 'Branch name must be at least 3 characters long'],
    },
  },
  { timestamps: true }
);

const PartnerBankDetail = mongoose.model(
  'PartnerBankDetail',
  partnerBankDetailSchema
);

export default PartnerBankDetail;
