import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse', // Reference to the Warehouse model
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order', // Reference to the Product model
      required: true,
    },
    monthRentId: {
      type: String,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    transactionDate: {
      type: Date,
      default: Date.now, // Default to current date and time
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Reference to the User who created the transaction
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
    razorpayOrderId: {
      type: String,
      required: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
    versionKey: false, // Removes the __v field
  }
);

export const Transaction = mongoose.model('Transaction', transactionSchema);
