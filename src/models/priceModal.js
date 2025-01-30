import mongoose from 'mongoose';

const priceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Price title is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Price amount is required'],
      min: [0, 'Amount must be positive'],
    },
  },
  { timestamps: true }
);

export const Price = mongoose.model('Price', priceSchema);
