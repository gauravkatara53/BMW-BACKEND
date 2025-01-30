import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Constants for Enums
const GENDER_ENUM = ['Male', 'Female', 'Other'];
const ROLE_ENUM = [
  'Admin',
  'Super-Admin',
  'Customer-Support',
  'Warehouse-Support',
  'Sale-Support',
  'Complaints-Support',
];
const STATUS_ENUM = ['Approved', 'Pending', 'Rejected'];

// Admin Schema
const adminSchema = new mongoose.Schema(
  {
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
    role: {
      type: String,
      enum: ROLE_ENUM,
      default: 'Admin',
    },
    status: {
      type: String,
      enum: STATUS_ENUM,
      default: 'Pending',
    },
    isVerified: {
      type: Boolean,
      default: false,
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
    refreshToken: {
      type: String,
    },
  },
  { timestamps: true }
);

// Hash password before saving
adminSchema.pre('save', async function (next) {
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
adminSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

// Generate access token
adminSchema.methods.generateAccessToken = function () {
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
adminSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ _id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
  });
};

// Admin Model
export const Admin = mongoose.model('Admin', adminSchema);
