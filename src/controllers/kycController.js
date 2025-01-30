import { asyncHandler } from '../utils/asyncHandler.js';
import {
  uploadKycService,
  getKycStatusService,
  verifyKycService,
  getKycDetailService,
} from '../services/kycService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const uploadKyc = asyncHandler(async (req, res) => {
  const uploadedKyc = await uploadKycService(req);
  return res
    .status(201)
    .json(new ApiResponse(201, uploadedKyc, 'KYC uploaded successfully'));
});

const kycStatus = asyncHandler(async (req, res) => {
  const kycStatus = await getKycStatusService(req.partner._id);
  return res
    .status(200)
    .json(
      new ApiResponse(200, { kycStatus }, 'KYC status fetched successfully')
    );
});

const verifyKycController = async (req, res) => {
  try {
    // Call the service to verify and update KYC
    const updatedKyc = await verifyKycService(req);

    // Return response
    return res
      .status(200)
      .json(
        new ApiResponse(200, updatedKyc, 'KYC status updated successfully')
      );
  } catch (error) {
    // Log the error for debugging purposes
    console.error(error);

    return res.status(error.status || 500).json({
      message: error.message || 'An unexpected error occurred.',
    });
  }
};

const getKycDetailController = async (req, res) => {
  try {
    const partnerId = req.params.id; // Extracting partner ID from route parameter
    console.log('Partner ID:', partnerId); // Debugging log

    const kycRecord = await getKycDetailService(partnerId);

    res.status(200).json({
      status: 200,
      data: { kycRecord },
      message: 'KYC status fetched successfully',
    });
  } catch (error) {
    console.error('Error in getKycDetailController:', error.message);

    // Handle specific error
    if (error instanceof ApiError && error.status === 404) {
      return res.status(404).json({
        status: 404,
        message: error.message,
      });
    }

    res.status(500).json({
      status: 500,
      message: 'Internal Server Error',
    });
  }
};

export { uploadKyc, kycStatus, verifyKycController, getKycDetailController };
