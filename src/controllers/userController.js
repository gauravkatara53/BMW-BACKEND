import { asyncHandler } from '../utils/asyncHandler.js'; // Import asyncHandler
import {
  loginUserService,
  logoutUserService,
  registerUserService,
  refreshAccessTokenService,
  changeCurrentPasswordService,
  updateAccountDetailsService,
  updateUserAvatarService,
  getAllUsersService,
} from '../services/UserService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { User } from '../models/userModel.js';
import { getCache, setCache, deleteCache } from '../utils/cache.js'; // adjust the path if needed

const registerUser = asyncHandler(async (req, res) => {
  const createdUser = await registerUserService(req);
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, 'User registered successfully'));
});

const loginUser = asyncHandler(async (req, res) => {
  const loggedInUser = await loginUserService(req, res); // Pass res to the service function
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: loggedInUser,
      },
      'User logged in successfully'
    )
  );
});

const isAuthenticatedOrNot = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const cacheKey = `auth-user-${userId}`;

  let userData = getCache(cacheKey);

  if (!userData) {
    userData = req.user;
    setCache(cacheKey, userData, 7 * 24 * 60 * 60); // 7 days TTL in seconds
  }

  res.status(200).json({
    message: 'User is authenticated',
    user: userData,
  });
});

const logoutUser = asyncHandler(async (req, res) => {
  const userId = req.userId; // Make sure this is set from JWT middleware

  await logoutUserService(userId); // Any backend session/token cleanup

  // 🧹 Invalidate all user-related caches
  deleteCache(`auth-user-${userId}`);
  deleteCache(`profile-user-${userId}`);

  // Clear cookies
  const options = {
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
    path: '/',
  };

  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'User logged out successfully'));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  const { accessToken, newRefreshToken } =
    await refreshAccessTokenService(incomingRefreshToken);

  // const options = {
  //   httpOnly: true,
  //   secure: true, // Ensure it's true in production
  // };
  const options = {
    httpOnly: false,
    secure: false, // Local testing
    sameSite: 'Lax',
    path: '/',
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
  const updatedUser = await changeCurrentPasswordService(req, res); // Pass req and res to the service function
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: updatedUser,
      },
      'Password changed successfully'
    )
  );
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const cacheKey = `profile-user-${userId}`;

  let user = getCache(cacheKey);

  if (!user) {
    // Only cache safe user data (like what req.user contains)
    user = req.user;
    setCache(cacheKey, user, 7 * 24 * 60 * 60); // Cache for 7 days
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'User fetched successfully'));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const updatedUser = await updateAccountDetailsService(req);

  // Invalidate both auth and profile caches
  const userId = req.user?._id || updatedUser?._id;
  deleteCache(`profile-user-${userId}`);
  deleteCache(`auth-user-${userId}`);

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedUser, 'Account details updated successfully')
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path; // Extract file path
  const userId = req.user?._id; // Extract user ID from request

  // Call the service to update the avatar
  const user = await updateUserAvatarService(userId, avatarLocalPath);

  // Invalidate both auth and profile caches
  deleteCache(`profile-user-${userId}`);
  deleteCache(`auth-user-${userId}`);
  // Respond with success
  return res
    .status(200)
    .json(new ApiResponse(200, user, 'Avatar image updated successfully'));
});

const getAllUser = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    search,
    status,
  } = req.query;

  const result = await getAllUsersService({
    page: parseInt(page),
    limit: parseInt(limit),
    sortBy,
    sortOrder,
    search,
    status,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, 'Users fetched successfully'));
});

const getCardDetailUserCustomer = asyncHandler(async (req, res) => {
  try {
    const now = new Date();

    // Start of the current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Start of the current year
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Call the service function to get statistics
    const totalUser = await User.countDocuments();

    const thisMonthUser = await User.countDocuments({
      createdAt: { $gte: startOfMonth },
    });

    const thisYearUser = await User.countDocuments({
      createdAt: { $gte: startOfYear },
    });

    const membershipNotPaid = await User.countDocuments({
      status: 'normal', // Adjust this condition based on your status schema
    });

    // Respond with the data
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          totalUser,
          thisMonthUser,
          thisYearUser,
          membershipNotPaid,
        },
        'User statistics fetched successfully.'
      )
    );
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, 'Failed to fetch user statistics.'));
  }
});

const getUserDataById = asyncHandler(async (req, res) => {
  const { userId } = req.params; // Get user ID from request parameters

  // Fetch user data by ID
  const user = await User.findById(userId).select('-password -refreshToken'); // Exclude password field

  if (!user) {
    return res.status(404).json(new ApiResponse(404, null, 'User not found'));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'User data fetched successfully'));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  isAuthenticatedOrNot,
  getAllUser,
  getCardDetailUserCustomer,
  getUserDataById,
};
