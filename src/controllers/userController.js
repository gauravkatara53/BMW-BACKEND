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
  res.status(200).json({ message: 'User is authenticated', user: req.user });
});

const logoutUser = asyncHandler(async (req, res) => {
  const userId = req.userId; // Assuming userId is set somewhere (middleware or JWT)

  await logoutUserService(userId); // Call the service to handle logout logic

  // const options = {
  //   httpOnly: true,
  //   secure: process.env.NODE_ENV === 'production', // Set to true in production
  //   sameSite: 'None', // or 'Lax' depending on your needs
  //   path: '/', // Ensure the cookie is available on the entire site
  // };
  const options = {
    httpOnly: false, // Useful for testing and accessing cookies in the frontend
    secure: false, // Should be false in local development; use true in production
    sameSite: 'Lax', // Change to 'None' if your frontend and backend are on different domains/ports
    path: '/', // Available for the entire domain
  };

  return res
    .status(200)
    .clearCookie('accessToken', options) // Clear the cookies
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'User logged out successfully')); // Send response in consistent format
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
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, 'User fetched successfully'));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const updatedUser = await updateAccountDetailsService(req); // Pass `req` to the service
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
};
