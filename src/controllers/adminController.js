import { asyncHandler } from '../utils/asyncHandler.js'; // Import asyncHandler
import {
  loginAdminService,
  logoutAdminService,
  registerAdminService,
  refreshAccessTokenService,
  changeCurrentPasswordService,
  updateAccountDetailsService,
  updateAdminAvatarService,
  verifyAdminKYC,
  allAdmin,
  adminStaticService,
  DashboardStaticService,
} from '../services/adminService.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const registerAdmin = asyncHandler(async (req, res) => {
  const createdAdmin = await registerAdminService(req);
  return res
    .status(201)
    .json(
      new ApiResponse(200, createdAdmin, 'Partner registered successfully')
    );
});

const loginAdmin = asyncHandler(async (req, res) => {
  const loggedInAdmin = await loginAdminService(req, res); // Pass res to the service function
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        admin: loggedInAdmin,
      },
      'Admin logged in successfully'
    )
  );
});

const logoutAdmin = asyncHandler(async (req, res) => {
  const adminId = req.adminId; // Assuming userId is set somewhere (middleware or JWT)

  await logoutAdminService(adminId); // Call the service to handle logout logic

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Set to true in production
    sameSite: 'None', // or 'Lax' depending on your needs
    path: '/', // Ensure the cookie is available on the entire site
  };

  return res
    .status(200)
    .clearCookie('accessToken', options) // Clear the cookies
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'Admin logged out successfully')); // Send response in consistent format
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
  const updatedAdmin = await changeCurrentPasswordService(req, res); // Pass req and res to the service function
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { admin: updatedAdmin },
        'Password changed successfully'
      )
    );
});

const getCurrentAdmin = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.admin, 'Admin fetched successfully'));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const updatedAdmin = await updateAccountDetailsService(req); // Pass `req` to the service
  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedAdmin, 'Account details updated successfully')
    );
});

const updateAdminAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path; // Extract file path
  const adminId = req.admin?._id; // Extract user ID from request

  // Call the service to update the avatar
  const admin = await updateAdminAvatarService(adminId, avatarLocalPath);

  // Respond with success
  return res
    .status(200)
    .json(new ApiResponse(200, admin, 'Avatar image updated successfully'));
});
const verifyAdminBySuperAdmin = async (req, res) => {
  try {
    // Call the service to verify and update KYC
    const updatedAdmin = await verifyAdminKYC(req);

    // Return a success response
    return res
      .status(200)
      .json(
        new ApiResponse(200, updatedAdmin, 'Admin status updated successfully')
      );
  } catch (error) {
    // Log the error for debugging
    console.error(error);

    // Return the error response
    return res.status(error.status || 500).json({
      message: error.message || 'An unexpected error occurred.',
    });
  }
};

const allAdminController = asyncHandler(async (req, res) => {
  let {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    status,
    role,
    search,
  } = req.query;

  page = isNaN(page) || page < 1 ? 1 : parseInt(page, 10);
  limit = isNaN(limit) || limit < 1 ? 10 : parseInt(limit, 10);

  console.log('Request Query:', {
    page,
    limit,
    sortBy,
    sortOrder,
    status,
    role,
    search,
  });

  try {
    const { admin, totalAdmin } = await allAdmin({
      page,
      limit,
      sortBy,
      sortOrder,
      status,
      role,
      search,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          admin,
          totalAdmin,
          currentPage: page,
          limit,
          totalPages: Math.ceil(totalAdmin / limit),
        },
        'Admin fetched successfully.'
      )
    );
  } catch (error) {
    console.error('Error fetching Admin:', error.message);
    return res
      .status(500)
      .json({ message: 'Failed to fetch Admin', error: error.message });
  }
});

const getCardDetailAdmin = asyncHandler(async (req, res) => {
  try {
    // Log for debugging
    console.log('Fetching admin statistics...');

    // Call the service function
    const stats = await adminStaticService();

    // Respond with the fetched data
    return res
      .status(200)
      .json(
        new ApiResponse(200, stats, 'Admin statistics fetched successfully.')
      );
  } catch (error) {
    console.error('Error in getCardDetaiAdmin:', error);

    // Handle errors gracefully
    return res
      .status(500)
      .json(new ApiResponse(500, null, 'Failed to fetch Admin details.'));
  }
});

//  dashboard card details

const getCardDetailDashboard = asyncHandler(async (req, res) => {
  try {
    const stats = await DashboardStaticService();

    // Respond with the fetched data
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          stats,
          'dashboard card statistics fetched successfully.'
        )
      );
  } catch (error) {
    console.error('Error in getCardDetailDashboard:', error);

    // Handle errors gracefully
    return res
      .status(500)
      .json(new ApiResponse(500, null, 'Failed to fetch dashboard details.'));
  }
});

export {
  registerAdmin,
  loginAdmin,
  logoutAdmin,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentAdmin,
  updateAccountDetails,
  updateAdminAvatar,
  verifyAdminBySuperAdmin,
  allAdminController,
  getCardDetailAdmin,
  getCardDetailDashboard,
};
