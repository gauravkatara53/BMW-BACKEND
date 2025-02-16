import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import jwt from 'jsonwebtoken';
import { User } from '../models/userModel.js';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // Cache for 10 mins

export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new ApiError(401, 'Unauthorized request');
    }

    const cacheKey = `token_${token}`;
    let decodedToken = cache.get(cacheKey);

    if (!decodedToken) {
      decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      cache.set(cacheKey, decodedToken);
    }

    const userCacheKey = `user_${decodedToken?._id}`;
    let user = cache.get(userCacheKey);

    if (!user) {
      user = await User.findById(decodedToken?._id).select(
        '-password -refreshToken'
      );
      if (!user) {
        throw new ApiError(401, 'Invalid Access Token');
      }
      cache.set(userCacheKey, user);
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid access token');
  }
});
