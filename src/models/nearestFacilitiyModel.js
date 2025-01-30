import mongoose from 'mongoose';

const nearestFacilitySchema = new mongoose.Schema(
  {
    icon: {
      type: String,
      required: [true, 'Nearest facility icon is required'],
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Nearest facility name is required'],
    },
    value: {
      type: String,
      required: [true, 'Nearest facility value is required'],
      default: 'N/A',
    },
  },
  { timestamps: true }
);

export const NearestFacility = mongoose.model(
  'NearestFacility',
  nearestFacilitySchema
);
