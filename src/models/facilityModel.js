import mongoose from 'mongoose';

const facilitySchema = new mongoose.Schema(
  {
    icon: {
      type: String,
      required: [true, 'Facility icon is required'],
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Facility name is required'],
    },
    value: {
      type: String,
      required: [true, 'Facility value is required'],
      default: 'N/A',
    },
  },
  { timestamps: true }
);

export const Facility = mongoose.model('Facility', facilitySchema);
