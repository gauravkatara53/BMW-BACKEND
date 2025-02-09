import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      required: true, // Keep this required
    },
    orderStatus: {
      type: String,
      enum: ['Pending', 'Processing', 'Completed', 'Cancelled', 'Failed'],
      required: true,
      default: 'Pending', // Default value
    },
    duration: {
      type: Number,
    },
    orderDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    totalPaid: {
      type: Number,
      required: true,
    },
    monthlyPayment: [
      {
        month: {
          type: String,
          required: [true, 'Month name is required'],
          trim: true,
        },
        amount: {
          type: Number,
          required: [true, 'Payment amount is required'],
          min: [0, 'Amount must be positive'],
        },
        paymentStatus: {
          type: String,
          enum: ['Paid', 'Unpaid','Processing'],
          default: 'Unpaid',
        },
      },
    ],

    unpaidAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    WarehouseDetail: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    customerDetails: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    partnerDetails: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
    },
    transactionDetails: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    paymentDay: {
      type: Number,
    },
    subTotalPrice: {
      type: Number,
      default: 0,
    },

    monthlyAmount: {
      type: Number,
      default: 0,
    },
    totalPrice: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

// Middleware to generate unique orderId
orderSchema.pre('save', async function (next) {
  if (!this.orderId) {
    // Create a unique orderId, e.g., "ORD-{timestamp}-{randomNumber}"
    this.orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }
  next();
});

export const Order = mongoose.model('Order', orderSchema);
