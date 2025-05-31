import mongoose from 'mongoose';

const bmwToPartnerPaymentSchema = new mongoose.Schema(
  {
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse', // Reference to the Warehouse model
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order', // Reference to the Order model
      required: true,
    },
    isDebited: {
      type: Boolean,
      default: true, // Indicates if this is a withdrawal transaction
      required: true, // Withdrawal status is required
    },
    monthRentId: {
      type: String,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['IMPS', 'UPI', 'NPTES', 'Other'], // Payment methods allowed
      required: true,
    },
    UTR: {
      type: String,
      trim: true, // Remove any extra spaces in UTR
      required: true, // UTR is required for tracking payments
      unique: true, // Ensure UTR is unique to prevent duplicate entries
    },
    transactionDate: {
      type: Date,
      default: Date.now, // Default to current date and time
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Reference to the User who created the transaction
      required: true,
    },
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner', // Reference to the Partner model
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Completed', 'Pending', 'Cancelled', 'Failed'], // Status of the transaction
      default: 'Pending',
    },
    notes: {
      type: String,
      trim: true, // Remove any extra spaces in notes
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
    versionKey: false, // Removes the __v field
  }
);

export const BMWToPartnerPayment = mongoose.model(
  'BMWToPartnerPayment',
  bmwToPartnerPaymentSchema
);
