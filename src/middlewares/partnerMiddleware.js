import { Partner } from '../models/partnerModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
const verifyPartnerKyc = asyncHandler(async (req, _, next) => {
  try {
    // Fetch admin using the admin's ID from the request (assumed to be added during authentication)
    const partner = await Partner.findById(req.partner?._id).select(
      '-password -refreshToken'
    );

    // If partner doesn't exist, throw an error
    if (!partner) {
      throw new ApiError(401, 'Invalid Access Token');
    }

    // Check if the admin is superadmin or not
    if (partner.kycStatus !== 'Verified') {
      throw new ApiError(403, 'partner is not Verified');
    }

    // Proceed to the next middleware/route if verified
    next();
  } catch (error) {
    // Handle error and pass it to error handler
    throw new ApiError(401, error?.message || 'Authentication Error');
  }
});

export { verifyPartnerKyc };
