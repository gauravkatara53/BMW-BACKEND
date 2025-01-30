import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Constants for Enums
const GENDER_ENUM = ['Male', 'Female', 'Other'];
const STATUS_ENUM = ['normal', 'premium', 'extra premium'];
const KYC_ENUM = [
  'Pending',
  'Verified',
  'Failed',
  'Cancelled',
  'Processing',
  'Rejected',
];

// Partner Schema
const partnerSchema = new mongoose.Schema(
  {
    partnerDocId: {
      type: String,
      trim: true,
      default: '', // after kyc it generate
    },
    kycDocId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KYC',
      index: true,
    },
    username: {
      type: String,
      unique: true,
      required: [true, 'Username is required'],
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      validate: {
        validator: validator.isEmail,
        message: (props) => `${props.value} is not a valid email address!`,
      },
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
    },
    phone: {
      type: String,
      unique: true,
      required: [true, 'Phone number is required'],
      validate: {
        validator: (v) => validator.isMobilePhone(v, 'any'),
        message: (props) => `${props.value} is not a valid phone number!`,
      },
    },
    gender: {
      type: String,
      enum: GENDER_ENUM,
    },
    avatar: {
      type: String,
      default: 'default_profile_image.png',
    },
    status: {
      type: String,
      enum: STATUS_ENUM,
      default: 'normal',
    },
    kycStatus: {
      type: String,
      enum: KYC_ENUM,
      default: 'Pending',
    },
    address: {
      type: String,
    },
    city: {
      type: String,
    },
    pincode: {
      type: Number,
    },
    state: {
      type: String,
    },
    country: {
      type: String,
    },
    bookings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
      },
    ],
    paymentMethods: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
      },
    ],
    refreshToken: {
      type: String,
    },
  },
  { timestamps: true }
);

// Hash password before saving
partnerSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    try {
      const saltRounds = 10;
      this.password = await bcrypt.hash(this.password, saltRounds);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Compare password method
partnerSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

// Generate access token
partnerSchema.methods.generateAccessToken = function () {
  const payload = {
    _id: this._id,
    email: this.email,
    name: this.name,
    phone: this.phone,
  };
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
  });
};

// Generate refresh token
partnerSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ _id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
  });
};

// Export Partner model
export const Partner = mongoose.model('Partner', partnerSchema);
