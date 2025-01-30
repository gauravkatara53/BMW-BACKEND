import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true, // Ensures a review is always tied to a warehouse
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true, // Ensures a review is always tied to a user
    },
    feedback: {
      type: String,
      required: [true, 'Feedback is required'], // Adds a custom error message
      trim: true, // Removes unnecessary whitespace
      minlength: [10, 'Feedback must be at least 10 characters long'], // Sets minimum length
    },
    images: [
      {
        type: String,
        validate: {
          validator: function (url) {
            return /^https?:\/\/.+/i.test(url); // Validates image URLs
          },
          message: (props) => `${props.value} is not a valid URL!`,
        },
      },
    ],
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'], // Minimum rating
      max: [5, 'Rating cannot exceed 5'], // Maximum rating
    },
    isVerified: {
      type: Boolean,
      default: false, // Adds a field to mark if a review is verified by admins
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
    versionKey: false, // Removes the __v field
  }
);

export const Review = mongoose.model('Review', reviewSchema);
