import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { Partner } from '../models/partnerModel.js';
import { ApiError } from '../utils/ApiError.js';
import jwt from 'jsonwebtoken';
import { Warehouse } from '../models/warehouseModel.js';

const generateAccessAndRefereshTokens = async (partnerId) => {
  try {
    const partner = await Partner.findById(partnerId);
    const accessToken = await partner.generateAccessToken();
    const refreshToken = await partner.generateRefreshToken();

    partner.refreshToken = refreshToken;
    await partner.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      'Something went wrong while generating referesh and access token'
    );
  }
};
const registerPartnerService = async (req) => {
  const { name, username, email, password, phone } = req.body;

  if (
    [name, username, email, password, phone].some(
      (field) => field?.trim() === ''
    )
  ) {
    throw new ApiError(500, 'All fields are required');
  }

  // check if the partner already exists
  const existedPartner = await Partner.findOne({
    $or: [{ username }, { phone }, { email }],
  });

  if (existedPartner) {
    throw new ApiError(
      409,
      'Partner with email or phone or username already exists'
    );
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
  const partner = await Partner.create({
    username,
    name,
    email,
    password,
    phone,
    avatar: avatarUrl,
    kyc: 'Pending',
  });

  // Ensure user was created successfully
  const createdPartner = await Partner.findById(partner._id).select(
    '-password -refreshToken' // Exclude sensitive fields
  );
  if (!createdPartner) {
    throw new ApiError(
      500,
      'Something went wrong while registering the Partner'
    );
  }

  return createdPartner;
};

const loginPartnerService = async (req, res) => {
  const { email, password } = req.body;
  console.log(email);

  if (!email) {
    throw new ApiError(500, 'Email is required');
  }

  const partner = await Partner.findOne({ email });

  if (!partner) {
    throw new ApiError(404, 'Partner not found');
  }

  const isPasswordValid = await partner.comparePassword(password);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    partner._id
  );

  // Set cookie options
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Set to true in production
    sameSite: 'None', // or 'Lax' depending on your needs
    path: '/', // Ensure the cookie is available on the entire site
  };

  // Set cookies
  res.cookie('accessToken', accessToken, options);
  res.cookie('refreshToken', refreshToken, options);

  const loggedInPartner = await Partner.findById(partner._id).select(
    '-password -refreshToken'
  );

  return loggedInPartner; // Return logged-in user to be used in the main controller
};

const logoutPartnerService = async (partnerId) => {
  // Unset the refreshToken in the user's document
  await Partner.findByIdAndUpdate(
    partnerId,
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

    const partner = await Partner.findById(decodedToken?._id);

    if (!partner) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    if (incomingRefreshToken !== partner?.refreshToken) {
      throw new ApiError(401, 'Refresh token is expired or used');
    }

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefereshTokens(partner._id);

    return { accessToken, newRefreshToken };
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid refresh token');
  }
};

const changeCurrentPasswordService = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      throw new ApiError(400, 'Both oldPassword and newPassword are required');
    }

    const partnerId = req.partner?._id;

    if (!partnerId) {
      throw new ApiError(400, 'Partner ID is required');
    }

    const partner = await Partner.findById(partnerId);

    if (!partner) {
      throw new ApiError(404, 'Partner not found');
    }

    const isPasswordCorrect = await partner.comparePassword(oldPassword);
    if (!isPasswordCorrect) {
      throw new ApiError(400, 'Invalid old password');
    }

    partner.password = newPassword; // Assuming pre-save hashing
    await partner.save({ validateBeforeSave: false });

    return partner;
  } catch (error) {
    throw error; // Re-throw to be handled by error middleware
  }
};

const updateAccountDetailsService = async (req) => {
  const { name, email, phone, gender, address, city, pincode, state, country } =
    req.body;

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
    !country
  ) {
    throw new ApiError(400, 'At least one field is required to update');
  }

  const partner = await Partner.findByIdAndUpdate(
    req.partner?._id,
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
      },
    },
    { new: true }
  ).select('-password');

  if (!partner) {
    throw new ApiError(404, 'Partner not found');
  }

  return partner; // Return the updated user details
};

const updatePartnerAvatarService = async (partnerId, avatarLocalPath) => {
  if (!avatarLocalPath) {
    throw new ApiError(400, 'Avatar file is missing');
  }

  // Upload new avatar to Cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, 'Error while uploading avatar');
  }

  // Update the user's avatar URL in the database
  const partner = await Partner.findByIdAndUpdate(
    partnerId,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select('-password');

  if (!partner) {
    throw new ApiError(404, 'Partner not found');
  }

  return partner;
};

const getAllPartnersWithStatus = async ({
  page,
  limit,
  sortBy,
  sortOrder,
  category,
  kycStatus,
  search, // New search parameter
}) => {
  // Construct filters based on query parameters
  const filters = {};
  if (category) filters.category = category;
  if (kycStatus) filters.kycStatus = kycStatus; // Use kycStatus for filtering

  // Add search filter (if provided)
  if (search) {
    const searchRegex = new RegExp(search, 'i'); // Case-insensitive search
    filters.$or = [
      { name: { $regex: searchRegex } },
      { username: { $regex: searchRegex } },
      { email: { $regex: searchRegex } },
      { phone: { $regex: searchRegex } },
    ];
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Fetch partners with filters, sorting, and pagination
  const partners = await Partner.find(filters)
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(Number(limit));

  // Fetch total count for pagination metadata
  const totalPartners = await Partner.countDocuments(filters);

  return {
    partners,
    totalPartners,
  };
};

const partnerStaticService = async () => {
  // Ensure Partner is imported correctly
  const totalPartners = await Partner.countDocuments();

  // Use the correct query to filter active partners
  const activePartner = await Partner.countDocuments({ kycStatus: 'Verified' });

  // Return the computed values
  return { totalPartners, activePartner };
};

const getPartnerProfileService = async (partnerId) => {
  try {
    // Fetch the partner using the ID
    console.log(partnerId);
    const partner = await Partner.findById(partnerId);

    // Return the partner data
    return partner;
  } catch (error) {
    // Handle any database errors
    throw new Error('Error fetching partner details.');
  }
};

export {
  registerPartnerService,
  loginPartnerService,
  logoutPartnerService,
  refreshAccessTokenService,
  changeCurrentPasswordService,
  updateAccountDetailsService,
  updatePartnerAvatarService,
  getAllPartnersWithStatus,
  partnerStaticService,
  getPartnerProfileService,
};
