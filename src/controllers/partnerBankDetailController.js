import PartnerBankDetail from '../models/PartnerBankDetail.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const partnerBankDetailController = asyncHandler(async (req, res) => {
  const partner = req.partner;
  const partnerId = partner?._id;

  if (!partnerId) {
    return res.status(400).json({ message: 'Partner ID is required' });
  }

  const { bankName, accountNumber, ifscCode, accountHolderName, branchName } =
    req.body;

  if (!bankName || !accountNumber || !ifscCode || !accountHolderName) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Check if account number already exists
  const existingBankDetail = await PartnerBankDetail.findOne({ accountNumber });
  if (existingBankDetail) {
    return res.status(409).json({ message: 'Account number already exists' });
  }

  const bankDetail = await PartnerBankDetail.create({
    partnerId,
    bankName,
    accountNumber,
    ifscCode,
    accountHolderName,
    branchName,
  });

  const bankDetailData = await bankDetail.populate('partnerId', 'name email');

  res
    .status(201)
    .json(
      new ApiResponse(201, bankDetailData, 'Bank details created successfully')
    );
});

const getBankDetailData = asyncHandler(async (req, res) => {
  const partner = req.partner;
  console.log('Partner:', partner);
  const partnerId = partner._id;

  console.log('Partner ID:', partnerId);
  if (!partnerId) {
    return res.status(400).json({ message: 'Partner ID is required' });
  }

  const bankDetail = await PartnerBankDetail.findOne({ partnerId }).populate(
    'partnerId',
    'name email'
  );

  if (!bankDetail) {
    return res.status(404).json({ message: 'Bank details not found' });
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, bankDetail, 'Bank details fetched successfully')
    );
});
const getBankDetailDataforAdmin = asyncHandler(async (req, res) => {
  const { partnerId } = req.params;

  console.log('Partner ID:', partnerId);
  if (!partnerId) {
    return res.status(400).json({ message: 'Partner ID is required' });
  }

  const bankDetail = await PartnerBankDetail.findOne({ partnerId }).populate(
    'partnerId',
    'name email'
  );

  if (!bankDetail) {
    return res.status(404).json({ message: 'Bank details not found' });
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, bankDetail, 'Bank details fetched successfully')
    );
});

export {
  partnerBankDetailController,
  getBankDetailData,
  getBankDetailDataforAdmin,
};
