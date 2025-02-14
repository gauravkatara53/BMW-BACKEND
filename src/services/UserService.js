import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { User } from '../models/userModel.js';
import { ApiError } from '../utils/ApiError.js';
import jwt from 'jsonwebtoken';

const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      'Something went wrong while generating referesh and access token'
    );
  }
};
const registerUserService = async (req) => {
  const { name, username, email, password, phone } = req.body;

  if (
    [name, username, email, password, phone].some(
      (field) => field?.trim() === ''
    )
  ) {
    throw new ApiError(500, 'All fields are required');
  }

  // check if the user already exists
  const existedUser = await User.findOne({
    $or: [{ username }, { phone }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, 'User with email or phone already exists');
  }

  // upload avatar if available
  let avatarUrl = 'https://cdn-icons-png.flaticon.com/128/1144/1144760.png'; // Default avatar
  const avatarLocalPath = req.files?.avatar?.[0]?.path; // Access file path from req.files

  console.log('Avatar file path:', avatarLocalPath); // Log to debug

  if (avatarLocalPath) {
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
      throw new ApiError(500, 'Failed to upload avatar to Cloudinary');
    }
    avatarUrl = avatar.url;
  }

  // create and store the user
  const user = await User.create({
    username,
    name,
    email,
    password,
    phone,
    avatar: avatarUrl,
  });

  // Ensure user was created successfully
  const createdUser = await User.findById(user._id).select(
    '-password -refreshToken' // Exclude sensitive fields
  );
  if (!createdUser) {
    throw new ApiError(500, 'Something went wrong while registering the user');
  }

  return createdUser;
};

const loginUserService = async (req, res) => {
  const { email, password } = req.body;
  console.log(email);

  if (!email) {
    throw new ApiError(500, 'Email is required');
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  // Set cookie options
  const options = {
    httpOnly: true,
    secure: true, // Always secure to allow cross-site cookies
    sameSite: 'None', // Required for cross-site requests
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  // Set cookies
  res.cookie('accessToken', accessToken, options);
  res.cookie('refreshToken', refreshToken, options);

  const loggedInUser = await User.findById(user._id).select(
    '-password -refreshToken'
  );

  return loggedInUser; // Return logged-in user to be used in the main controller
};

const logoutUserService = async (userId) => {
  // Unset the refreshToken in the user's document
  await User.findByIdAndUpdate(
    userId,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    { new: true }
  );
};
const refreshAccessTokenService = async (incomingRefreshToken) => {
  if (!incomingRefreshToken) {
    throw new ApiError(401, 'Unauthorized request');
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, 'Refresh token is expired or used');
    }

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefereshTokens(user._id);

    return { accessToken, newRefreshToken };
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid refresh token');
  }
};

const changeCurrentPasswordService = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user?._id;

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const isPasswordCorrect = await user.comparePassword(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, 'Invalid old password');
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return user; // Return updated user
};
const updateAccountDetailsService = async (req) => {
  const {
    name,
    email,
    phone,
    gender,
    address,
    city,
    pincode,
    state,
    country,
    bio,
  } = req.body;

  // Check if at least one field is provided
  if (
    !name &&
    !email &&
    !phone &&
    !gender &&
    !address &&
    !city &&
    !pincode &&
    !state &&
    !country &&
    !bio
  ) {
    throw new ApiError(400, 'At least one field is required to update');
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone && { phone }),
        ...(gender && { gender }),
        ...(address && { address }),
        ...(city && { city }),
        ...(pincode && { pincode }),
        ...(state && { state }),
        ...(country && { country }),
        ...(bio && { bio }),
      },
    },
    { new: true }
  ).select('-password');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return user; // Return the updated user details
};

const updateUserAvatarService = async (userId, avatarLocalPath) => {
  if (!avatarLocalPath) {
    throw new ApiError(400, 'Avatar file is missing');
  }

  // Upload new avatar to Cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, 'Error while uploading avatar');
  }

  // Update the user's avatar URL in the database
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select('-password');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return user;
};

export {
  registerUserService,
  loginUserService,
  logoutUserService,
  refreshAccessTokenService,
  changeCurrentPasswordService,
  updateAccountDetailsService,
  updateUserAvatarService,
};
