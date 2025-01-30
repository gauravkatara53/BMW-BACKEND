import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
    },
    units: {
      type: Number,
      required: [true, 'Number of units is required'],
      default: 1,
      min: [1, 'Units must be at least 1'],
    },
  },
  { timestamps: true }
);

export const Rooms = mongoose.model('Rooms', roomSchema);
