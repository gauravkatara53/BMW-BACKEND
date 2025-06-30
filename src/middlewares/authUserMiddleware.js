import jwt from 'jsonwebtoken';
import { User } from '../models/userModel.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getCache, setCache } from '../utils/cache.js';

export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new ApiError(401, 'Unauthorized request');
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const userId = decodedToken?._id;

    // Try to get cached user
    let user = getCache(`auth-user-${userId}`);

    if (!user) {
      // If not in cache, fetch from DB
      user = await User.findById(userId).select('-password -refreshToken');

      if (!user) {
        throw new ApiError(401, 'Invalid Access Token');
      }

      // Cache user for 7 days (TTL in seconds)
      setCache(`auth-user-${userId}`, user, 7 * 24 * 60 * 60);
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid access token');
  }
});
