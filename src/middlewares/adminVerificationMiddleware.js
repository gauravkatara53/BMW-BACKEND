import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Admin } from '../models/adminModel.js';

const verifyAdmin = asyncHandler(async (req, _, next) => {
  try {
    // Fetch admin using the admin's ID from the request (assumed to be added during authentication)
    const admin = await Admin.findById(req.admin?._id).select(
      '-password -refreshToken'
    );

    // If admin doesn't exist, throw an error
    if (!admin) {
      throw new ApiError(401, 'Invalid Access Token');
    }

    // Check if admin is verified or rejected
    if (admin.status === 'Rejected') {
      throw new ApiError(403, 'Admin is Rejected');
    }
    if (admin.status !== 'Approved') {
      throw new ApiError(403, 'Admin is not Approved');
    }

    // Proceed to the next middleware/route if verified
    next();
  } catch (error) {
    // Pass the error to the error handler
    next(new ApiError(401, error?.message || 'Authentication Error'));
  }
});

const verifyOtherAdminBySuperAdmin = asyncHandler(async (req, _, next) => {
  try {
    // Fetch admin using the admin's ID from the request (assumed to be added during authentication)
    const admin = await Admin.findById(req.admin?._id).select(
      '-password -refreshToken'
    );

    // If admin doesn't exist, throw an error
    if (!admin) {
      throw new ApiError(401, 'Invalid Access Token');
    }

    // Check if the admin is superadmin or not
    if (admin.role !== 'Super-Admin') {
      throw new ApiError(403, 'Admin is not super admin');
    }

    // Proceed to the next middleware/route if verified
    next();
  } catch (error) {
    // Handle error and pass it to error handler
    throw new ApiError(401, error?.message || 'Authentication Error');
  }
});

// KYC DETAILS

export { verifyAdmin, verifyOtherAdminBySuperAdmin };
