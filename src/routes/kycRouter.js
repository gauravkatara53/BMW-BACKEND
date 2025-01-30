import { Router } from 'express';
import {
  getKycDetailController,
  kycStatus,
  uploadKyc,
  verifyKycController,
} from '../controllers/kycController.js';
import { verifyJWTPartner } from '../middlewares/authPartnerMiddleware.js';
import { upload } from '../middlewares/multer.js';
import { verifyJWTAdmin } from '../middlewares/authAdminMiddleware.js';
import { verifyAdmin } from '../middlewares/adminVerificationMiddleware.js';

const router = Router();

router.route('/upload').post(
  upload.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'backImage', maxCount: 1 },
  ]),
  verifyJWTPartner,
  uploadKyc
);

router.route('/status').get(verifyJWTPartner, kycStatus);
router
  .route('/verify/:kycId')
  .put(verifyJWTAdmin, verifyAdmin, verifyKycController);

// KYC DETAILS

router
  .route('/admin/kyc/detail/:id')
  .get(verifyJWTAdmin, verifyAdmin, getKycDetailController);

export default router;
