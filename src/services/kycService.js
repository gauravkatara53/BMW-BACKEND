import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { KYC } from '../models/kycModel.js';
import { Partner } from '../models/partnerModel.js';
import { ApiError } from '../utils/ApiError.js';

const uploadKycService = async (req) => {
  const { nameOnDocument, documentType, documentNumber } = req.body;

  // Validate required fields
  if (![nameOnDocument, documentType, documentNumber].every(Boolean)) {
    throw new ApiError(
      400,
      'All fields (name, document type, document number) are required.'
    );
  }
  console.log('Received KYC upload request:', {
    nameOnDocument,
    documentType,
    documentNumber,
  });
  // Check if KYC already exists for this partner
  const existingKyc = await KYC.findOne({ partner: req.partner._id });
  if (existingKyc) {
    throw new ApiError(
      409,
      'KYC details have already been uploaded for this partner.'
    );
  }

  // Validate image paths
  const frontImagePath = req.files?.frontImage?.[0]?.path;
  const backImagePath = req.files?.backImage?.[0]?.path;

  if (!frontImagePath || !backImagePath) {
    throw new ApiError(400, 'Both front and back images are required.');
  }

  // Upload images to Cloudinary
  const [frontImage, backImage] = await Promise.all([
    uploadOnCloudinary(frontImagePath),
    uploadOnCloudinary(backImagePath),
  ]);

  if (!frontImage || !backImage) {
    throw new ApiError(500, 'Failed to upload images to Cloudinary.');
  }

  // Create and save KYC record
  const uploadedKyc = await KYC.create({
    nameOnDocument,
    documentType,
    documentNumber,
    frontImage: frontImage.url,
    backImage: backImage.url,
    kycStatus: 'Processing',
    partner: req.partner._id,
  });

  // Update the partner's kycDocId with the newly created KYC record's _id
  const updatedPartner = await Partner.findByIdAndUpdate(
    req.partner._id,
    { kycDocId: uploadedKyc._id },
    { new: true } // Ensure the updated partner document is returned
  );

  if (!updatedPartner) {
    throw new ApiError(500, 'Failed to update partner with KYC document.');
  }

  // Populate the partner field for response
  const populatedKyc = await KYC.findById(uploadedKyc._id).populate(
    'partner',
    'partnerKYCId username name email avatar phone kycStatus'
  );

  if (!populatedKyc) {
    throw new ApiError(500, 'Error creating KYC record.');
  }

  return populatedKyc;
};

const getKycStatusService = async (partnerId) => {
  // Find the KYC record associated with the partner
  const kycRecord = await KYC.findOne({ partner: partnerId });

  if (!kycRecord) {
    throw new ApiError(404, 'KYC record not found for this partner.');
  }

  // Return both the KYC status and the message
  return {
    kycStatus: kycRecord.kycStatus || 'Pending', // Default to 'Pending' if undefined
    message: kycRecord.message || '', // Default to an empty string if undefined
  };
};

const verifyKycService = async (req) => {
  const { kycStatus, message } = req.body;

  // Validate kycStatus field
  if (!kycStatus || kycStatus.trim() === '') {
    throw new ApiError(400, 'KYC status is required');
  }

  // Validate message field (optional)
  if (message && message.trim() === '') {
    throw new ApiError(400, 'Message cannot be empty');
  }

  // Find the KYC record by ID
  const kycRecord = await KYC.findById(req.params.kycId);

  if (!kycRecord) {
    throw new ApiError(404, 'KYC record not found');
  }

  // Update KYC status and message
  kycRecord.kycStatus = kycStatus;
  kycRecord.message = message || ''; // If no message provided, it will default to an empty string

  // Save the updated KYC record
  await kycRecord.save();

  // Debugging: Check the partner ID stored in kycRecord
  console.log('KYC Partner ID:', kycRecord.partner);

  // Ensure partner ID exists before proceeding
  const partner = await Partner.findById(kycRecord.partner);

  if (!partner) {
    throw new ApiError(404, 'Partner not found');
  }

  // Update partner’s KYC status
  partner.kycStatus = kycStatus; // Sync partner status with KYC status
  await partner.save();

  return kycRecord; // Return the updated KYC record
};

const getKycDetailService = async (partnerId) => {
  try {
    console.log('Fetching KYC for Partner ID:', partnerId); // Debugging log
    const kycRecord = await KYC.findOne({ partner: partnerId });
    console.log('KYC Record:', kycRecord); // Debugging log

    if (!kycRecord) {
      throw new ApiError(404, 'KYC record not found for this partner.');
    }
    return kycRecord;
  } catch (error) {
    console.error('Error in getKycDetailService:', error.message);
    throw error;
  }
};

export {
  uploadKycService,
  getKycStatusService,
  verifyKycService,
  getKycDetailService,
};
