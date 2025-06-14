import { asyncHandler } from '../utils/asyncHandler.js'; // Import asyncHandler
import {
  loginPartnerService,
  logoutPartnerService,
  registerPartnerService,
  refreshAccessTokenService,
  changeCurrentPasswordService,
  updateAccountDetailsService,
  updatePartnerAvatarService,
  getAllPartnersWithStatus,
  partnerStaticService,
  getPartnerProfileService,
} from '../services/partnerService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Partner } from '../models/partnerModel.js';
import { Warehouse } from '../models/warehouseModel.js';

const registerPartner = asyncHandler(async (req, res) => {
  const createdPartner = await registerPartnerService(req);
  return res
    .status(201)
    .json(
      new ApiResponse(200, createdPartner, 'Partner registered successfully')
    );
});

const loginPartner = asyncHandler(async (req, res) => {
  const loggedInPartner = await loginPartnerService(req, res); // Pass res to the service function
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        partner: loggedInPartner,
      },
      'Partner logged in successfully'
    )
  );
});

const logoutPartner = asyncHandler(async (req, res) => {
  const partnerId = req.partnerId; // Assuming userId is set somewhere (middleware or JWT)

  await logoutPartnerService(partnerId); // Call the service to handle logout logic

  const options = {
    httpOnly: false,
    secure: false, // Set to true in production
    sameSite: 'Lax', // or 'Lax' depending on your needs
    path: '/', // Ensure the cookie is available on the entire site
  };

  return res
    .status(200)
    .clearCookie('accessToken', options) // Clear the cookies
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'Partner logged out successfully')); // Send response in consistent format
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  const { accessToken, newRefreshToken } =
    await refreshAccessTokenService(incomingRefreshToken);

  const options = {
    httpOnly: true,
    secure: true, // Ensure it's true in production
  };

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', newRefreshToken, options)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken: newRefreshToken },
        'Access token refreshed successfully'
      )
    );
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const updatedPartner = await changeCurrentPasswordService(req, res); // Pass req and res to the service function
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { partner: updatedPartner },
        'Password changed successfully'
      )
    );
});

const getCurrentPartner = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.partner, 'Partner fetched successfully'));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const updatedPartner = await updateAccountDetailsService(req); // Pass `req` to the service
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedPartner,
        'Account details updated successfully'
      )
    );
});

const updatePartnerAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path; // Extract file path
  const partnerId = req.partner?._id; // Extract user ID from request

  // Call the service to update the avatar
  const partner = await updatePartnerAvatarService(partnerId, avatarLocalPath);

  // Respond with success
  return res
    .status(200)
    .json(new ApiResponse(200, partner, 'Avatar image updated successfully'));
});

const getAllPartnerWithStatus = asyncHandler(async (req, res) => {
  let {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    category,
    kycStatus,
    search, // Search query from the request
  } = req.query;

  // Parse `page` and `limit` as integers
  page = parseInt(page, 10);
  limit = parseInt(limit, 10);

  // Validate kycStatus if provided
  const validKycStatuses = [
    'Pending',
    'Verified',
    'Failed',
    'Cancelled',
    'Processing',
    'Rejected',
  ];
  if (kycStatus && !validKycStatuses.includes(kycStatus)) {
    return res.status(400).json({
      message:
        'Invalid kycStatus value. Valid values are: Pending, Verified, Failed, Cancelled, Processing, Rejected.',
    });
  }

  // Call the service to get the partners with status and search functionality
  const { partners, totalPartners } = await getAllPartnersWithStatus({
    page,
    limit,
    sortBy,
    sortOrder,
    category,
    kycStatus,
    search, // Pass the search term to the service function
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        partners,
        totalPartners,
        currentPage: page,
        limit,
        totalPages: Math.ceil(totalPartners / limit),
      },
      'Partners fetched successfully.'
    )
  );
});

const getCardDetailPartner = asyncHandler(async (req, res) => {
  try {
    // Call the service function to get statistics
    const { totalPartners, activePartner } = await partnerStaticService();

    // Respond with the data
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          totalPartners,
          activePartner,
        },
        'Partners fetched successfully.'
      )
    );
  } catch (error) {
    // Handle errors
    return res
      .status(500)
      .json(new ApiResponse(500, null, 'Failed to fetch partner details.'));
  }
});

const getPartnerProfile = asyncHandler(async (req, res) => {
  try {
    const { partnerId } = req.params;

    // Call the service function with the partner ID
    const profile = await getPartnerProfileService(partnerId);

    if (!profile) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, 'Partner not found.'));
    }

    // Respond with the data
    return res
      .status(200)
      .json(new ApiResponse(200, profile, 'Partner fetched successfully.'));
  } catch (error) {
    // Handle errors
    return res
      .status(500)
      .json(new ApiResponse(500, null, 'Failed to fetch partner details.'));
  }
});

const getCardDetailPartnerCustomer = asyncHandler(async (req, res) => {
  try {
    // Call the service function to get statistics
    const totalPartners = await Partner.countDocuments();
    const activePartner = await Partner.countDocuments({
      kycStatus: 'Verified',
    });

    const kycNotUploaded = await Partner.countDocuments({
      kycStatus: 'Pending',
    });
    const membershipNotPaid = await Partner.countDocuments({
      status: 'normal',
    });
    // Respond with the data
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          totalPartners,
          activePartner,
          kycNotUploaded,
          membershipNotPaid,
        },
        'Partners fetched successfully.'
      )
    );
  } catch (error) {
    // Handle errors
    return res
      .status(500)
      .json(new ApiResponse(500, null, 'Failed to fetch partner details.'));
  }
});

const isAuthenticatedOrNot = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json({ message: 'Partner is authenticated', partner: req.partner });
});

const Bookingstatic = asyncHandler(async (req, res) => {
  const partnerId = req.partner?._id; // Extract partner ID from request
  if (!partnerId) {
    throw new ApiError(400, 'Partner ID is required');
  }

  const partner = await Partner.findById(partnerId);
  if (!partner) {
    throw new ApiError(404, 'Partner not found');
  }

  try {
    const totalRented = await Warehouse.countDocuments({
      WarehouseStatus: 'Rented',
      partnerName: partnerId, // Filter by this partner
    });

    const totalSold = await Warehouse.countDocuments({
      WarehouseStatus: 'Sold',
      partnerName: partnerId,
    });

    const totalAvailable = await Warehouse.countDocuments({
      WarehouseStatus: 'Available',
      partnerName: partnerId,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          totalRented,
          totalSold,
          totalAvailable,
        },
        'Warehouse booking statistics fetched successfully'
      )
    );
  } catch (error) {
    throw new ApiError(500, 'Failed to fetch warehouse booking statistics');
  }
});

// const Earningstatic = asyncHandler(async (req, res) => {
//   const partnerId = req.partner?._id; // Extract partner ID from request
//   if (!partnerId) {
//     throw new ApiError(400, 'Partner ID is required');
//   }

//   const partner = await Partner.findById(partnerId);
//   if (!partner) {
//     throw new ApiError(404, 'Partner not found');
//   }

//   try {
//     const totalRented = await Warehouse.countDocuments({
//       WarehouseStatus: 'Rented',
//       partnerName: partnerId, // Filter by this partner
//     });

//     const totalSold = await Warehouse.countDocuments({
//       WarehouseStatus: 'Sold',
//       partnerName: partnerId,
//     });

//     const totalAvailable = await Warehouse.countDocuments({
//       WarehouseStatus: 'Available',
//       partnerName: partnerId,
//     });

//     res.json({
//       totalRented,
//       totalSold,
//       totalAvailable,
//     });
//   } catch (error) {
//     throw new ApiError(500, 'Failed to fetch warehouse booking statistics');
//   }
// });

export {
  registerPartner,
  loginPartner,
  logoutPartner,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentPartner,
  updateAccountDetails,
  updatePartnerAvatar,
  getAllPartnerWithStatus,
  getCardDetailPartner,
  getPartnerProfile,
  getCardDetailPartnerCustomer,
  isAuthenticatedOrNot,
  Bookingstatic,
};
