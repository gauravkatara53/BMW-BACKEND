import mongoose from 'mongoose';

const WarehouseSchema = new mongoose.Schema(
  {
    uniqueId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Warehouse name is required'],
      trim: true,
    },
    about: {
      type: String,
      required: [true, 'About section is required'],
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['Storage', 'Distribution', 'Fulfillment', 'Cold Storage'],
    },
    price: [
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
        isMonthly: {
          type: Boolean,
        },
      },
    ],

    WarehouseStatus: {
      type: String,
      enum: ['Sold', 'Rented', 'Available', 'Pending'],
      default: 'Pending',
    },
    numberOfBooking: {
      type: Number,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    pincode: {
      type: Number,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    rooms: [
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
    ],
    images: {
      type: [String],
      // validate: {
      //   validator: (array) => array.length > 0,
      //   message: 'At least one image is required',
      // },
    },
    thumbnail: {
      type: String,
    },
    facility: [
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
    ],
    nearestFacility: [
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
    ],
    areaSqFt: {
      type: String,
      required: true,
    },
    rentOrSell: {
      type: String,
      required: true,
      enum: ['Rent', 'Sell'],
    },
    paymentDueDays: {
      type: Number,
    },
    ratingDetails: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RatingDetail',
      },
    ],
    partnerName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
    },
    isSaved: {
      type: Boolean,
      default: false,
    },
    subTotalPrice: {
      type: Number,
      default: 0,
    },
    discount: {
      discountType: {
        type: String,
        enum: ['Percentage', 'Flat'],
        required: [true, 'Discount type is required'],
      },
      discountValue: {
        type: Number,
        required: [true, 'Discount value is required'],
        min: [0, 'Discount value must be positive'],
      },
      couponCode: {
        type: String,
        trim: true,
        required: [true, 'Coupon code is required'],
      },
    },
    totalDiscount: {
      type: Number,
      default: 0,
    },
    totalPrice: {
      type: Number,
      default: 0,
    },
    monthlyAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

// Geospatial index for location
WarehouseSchema.index({ location: '2dsphere' });

export const Warehouse = mongoose.model('Warehouse', WarehouseSchema);
