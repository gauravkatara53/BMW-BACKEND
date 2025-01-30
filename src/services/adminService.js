import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { Admin } from '../models/adminModel.js';
import { Order } from '../models/orderModel.js';
import { ApiError } from '../utils/ApiError.js';
import jwt from 'jsonwebtoken';
import { Warehouse } from '../models/warehouseModel.js';
import { Transaction } from '../models/transactionModel.js';

const generateAccessAndRefereshTokens = async (adminId) => {
  try {
    const admin = await Admin.findById(adminId);
    const accessToken = await admin.generateAccessToken();
    const refreshToken = await admin.generateRefreshToken();

    admin.refreshToken = refreshToken;
    await admin.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      'Something went wrong while generating referesh and access token'
    );
  }
};
const registerAdminService = async (req) => {
  const { name, email, password, phone, role } = req.body;

  if (
    [name, email, password, phone, role].some((field) => field?.trim() === '')
  ) {
    throw new ApiError(500, 'All fields are required');
  }

  // check if the partner already exists
  const existedAdmin = await Admin.findOne({
    $or: [{ phone }, { email }],
  });

  if (existedAdmin) {
    throw new ApiError(409, 'Admin with email or phone already exists');
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
  const admin = await Admin.create({
    name,
    email,
    password,
    phone,
    avatar: avatarUrl,
    role,
    isVerified: false,
  });

  // Ensure user was created successfully
  const createdAdmin = await Admin.findById(admin._id).select(
    '-password -refreshToken' // Exclude sensitive fields
  );
  if (!createdAdmin) {
    throw new ApiError(
      500,
      'Something went wrong while registering the Partner'
    );
  }

  return createdAdmin;
};

const loginAdminService = async (req, res) => {
  const { email, password } = req.body;

  console.log(email);

  if (!email) {
    throw new ApiError(500, 'Email is required');
  }

  const admin = await Admin.findOne({ email });

  if (!admin) {
    throw new ApiError(404, 'Admin not found');
  }

  const isPasswordValid = await admin.comparePassword(password);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    admin._id
  );

  // Set cookie options
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Set to true in production
    sameSite: 'None', // or 'Lax' depending on your needs
    path: '/', // Ensure the cookie is available on the entire site
  };
   // Set cookie options
  //  const options = {
  //   httpOnly: true,
  //   secure: false, // Local testing
  //   sameSite: 'Lax',
  //   path: '/',
  // };

  // Set cookies
  res.cookie('accessToken', accessToken, options);
  res.cookie('refreshToken', refreshToken, options);

  const loggedInAdmin = await Admin.findById(admin._id).select(
    '-password -refreshToken'
  );

  // Include tokens in the response
  return {
    admin: loggedInAdmin,
    accessToken,
    refreshToken,
  };
};

const logoutAdminService = async (adminId) => {
  // Unset the refreshToken in the user's document
  await Admin.findByIdAndUpdate(
    adminId,
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

    const admin = await Admin.findById(decodedToken?._id);

    if (!admin) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    if (incomingRefreshToken !== admin?.refreshToken) {
      throw new ApiError(401, 'Refresh token is expired or used');
    }

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefereshTokens(admin._id);

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

    const adminId = req.admin?._id;

    if (!adminId) {
      throw new ApiError(400, 'Admin ID is required');
    }

    const admin = await Admin.findById(adminId);

    if (!admin) {
      throw new ApiError(404, 'Admin not found');
    }

    const isPasswordCorrect = await admin.comparePassword(oldPassword);
    if (!isPasswordCorrect) {
      throw new ApiError(400, 'Invalid old password');
    }

    admin.password = newPassword; // Assuming pre-save hashing
    await admin.save({ validateBeforeSave: false });

    return admin;
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

  const admin = await Admin.findByIdAndUpdate(
    req.admin?._id,
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

  if (!admin) {
    throw new ApiError(404, 'Admin not found');
  }

  return admin; // Return the updated user details
};

const updateAdminAvatarService = async (adminId, avatarLocalPath) => {
  if (!avatarLocalPath) {
    throw new ApiError(400, 'Avatar file is missing');
  }

  // Upload new avatar to Cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, 'Error while uploading avatar');
  }

  // Update the user's avatar URL in the database
  const admin = await Admin.findByIdAndUpdate(
    adminId,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select('-password');

  if (!admin) {
    throw new ApiError(404, 'Partner not found');
  }

  return admin;
};

const verifyAdminKYC = async (req) => {
  const { status } = req.body;

  // Validate field
  if (!status) {
    throw new ApiError(400, 'Invalid or missing status');
  }

  // Find the admin record by the adminId from the request parameters
  const adminRecord = await Admin.findById(req.params.adminId);
  if (!adminRecord) {
    throw new ApiError(404, 'Admin not found');
  }

  // Update the admin's status and isVerified fields
  adminRecord.status = status;
  if (status === 'Approved') {
    adminRecord.isVerified = true;
  }

  await adminRecord.save();

  // Return the updated admin record
  return adminRecord;
};

const allAdmin = async ({
  page,
  limit,
  sortBy,
  sortOrder,
  status,
  role,
  search,
}) => {
  const filters = {};

  if (status) filters.status = status;
  if (role) filters.role = role;

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    const isNumeric = !isNaN(Number(search));
    filters.$or = [
      { name: { $regex: searchRegex } },
      { category: { $regex: searchRegex } },
      { address: { $regex: searchRegex } },
      { city: { $regex: searchRegex } },
      { state: { $regex: searchRegex } },
      { country: { $regex: searchRegex } },
      ...(isNumeric ? [{ pincode: search }] : []),
    ];
  }

  const skip = (page - 1) * limit;

  try {
    const admin = await Admin.find(filters)
      .select('-password -refreshToken')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(Number(limit));

    const totalAdmin = await Admin.countDocuments(filters);

    return { admin, totalAdmin };
  } catch (error) {
    console.error('Error in allAdmin:', error.message);
    throw error;
  }
};

const adminStaticService = async () => {
  try {
    // Fetch counts based on roles
    const complaintsSupport = await Admin.countDocuments({
      role: 'Complaints-Support',
    });
    console.log('Complaints Support:', complaintsSupport);

    const customerSupport = await Admin.countDocuments({
      role: 'Customer-Support',
    });
    console.log('Customer Support:', customerSupport);

    const warehouseSupport = await Admin.countDocuments({
      role: 'Warehouse-Support',
    });
    console.log('Warehouse Support:', warehouseSupport);

    const saleSupport = await Admin.countDocuments({
      role: 'Sale-Support',
    });
    console.log('Sale Support:', saleSupport);

    // Return distinct values
    return {
      complaintsSupport,
      customerSupport,
      warehouseSupport, // Correctly returning Warehouse-Support count
      saleSupport,
    };
  } catch (error) {
    console.error('Error fetching Admin statistics:', error);
    throw new Error('Failed to fetch Admin statistics');
  }
};

// dashboard
const DashboardStaticService = async () => {
  try {
    // Current date for filters
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    // Today's completed bookings
    const todayBooking = await Order.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      orderStatus: 'Completed',
    });

    // Month's completed bookings
    const monthBooking = await Order.countDocuments({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      orderStatus: 'Completed',
    });

    // Number of warehouses in the system
    const numberWarehouses = await Warehouse.countDocuments();

    // Number of available warehouses
    const availableWarehouses = await Warehouse.countDocuments({
      WarehouseStatus: 'Available',
    });

    // Today's earnings
    const todayEarningsResult = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          paymentStatus: 'Completed',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalPrice' },
        },
      },
    ]);
    const todayEarnings =
      todayEarningsResult.length > 0 ? todayEarningsResult[0].totalAmount : 0;

    // Monthly earnings
    const monthEarningsResult = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
          paymentStatus: 'Completed',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalPrice' },
        },
      },
    ]);
    const monthEarnings =
      monthEarningsResult.length > 0 ? monthEarningsResult[0].totalAmount : 0;

    // Return statistics
    return {
      todayBooking,
      monthBooking,
      numberWarehouses,
      availableWarehouses,
      todayEarnings,
      monthEarnings,
    };
  } catch (error) {
    console.error('Error fetching order statistics:', error);
    throw new Error('Failed to fetch order statistics');
  }
};

export {
  registerAdminService,
  loginAdminService,
  logoutAdminService,
  refreshAccessTokenService,
  changeCurrentPasswordService,
  updateAccountDetailsService,
  updateAdminAvatarService,
  verifyAdminKYC,
  allAdmin,
  adminStaticService,
  DashboardStaticService,
};
