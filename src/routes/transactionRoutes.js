import { Router } from 'express';
import {
  verifyTransaction,
  rentPayment,
  verifyTransactionRent,
} from '../controllers/transactionController.js';
import { verifyJWT } from '../middlewares/authUserMiddleware.js';
import { verifyJWTPartner } from '../middlewares/authPartnerMiddleware.js';
import {
  getBankDetailData,
  getBankDetailDataforAdmin,
  partnerBankDetailController,
} from '../controllers/partnerBankDetailController.js';
import { get } from 'mongoose';
import { verifyJWTAdmin } from '../middlewares/authAdminMiddleware.js';

const router = Router();

// Secured routes
router.route('/verify').post(verifyJWT, verifyTransaction);

// month rent route
router.route('/montly/rent/:orderId').post(verifyJWT, rentPayment);

// verify the monthly rent
router.route('/verify/rent').post(verifyJWT, verifyTransactionRent);

// FOR THE BANK DETAILS OF PARTNER
router
  .route('/bank/detail')
  .post(verifyJWTPartner, partnerBankDetailController);

router.route('/get/bank/detail').get(verifyJWTPartner, getBankDetailData);
router
  .route('/get/bank/detail/:partnerId')
  .get(verifyJWTAdmin, getBankDetailDataforAdmin);

export default router;
