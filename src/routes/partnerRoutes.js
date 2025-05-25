import { Router } from 'express';
import {
  registerPartner,
  loginPartner,
  logoutPartner,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentPartner,
  updateAccountDetails,
  updatePartnerAvatar,
  getAllPartnerWithStatus,
  getPartnerProfile,
  isAuthenticatedOrNot,
  Bookingstatic,
} from '../controllers/partnerController.js';
import { verifyJWTPartner } from '../middlewares/authPartnerMiddleware.js';
import { upload } from '../middlewares/multer.js';
import { verifyJWTAdmin } from '../middlewares/authAdminMiddleware.js';
import { verifyAdmin } from '../middlewares/adminVerificationMiddleware.js';

const router = Router();

router.route('/register').post(
  upload.fields([
    {
      name: 'avatar',
      maxCount: 1,
    },
  ]),
  registerPartner
);
router.route('/login').post(loginPartner);

// Secured routes
router.route('/loginOut').post(verifyJWTPartner, logoutPartner);
router.route('/refresh-token').post(verifyJWTPartner, refreshAccessToken);
router.route('/change-password').post(verifyJWTPartner, changeCurrentPassword);
router.route('/get-partner').get(verifyJWTPartner, getCurrentPartner);
router.route('/update-detail').patch(verifyJWTPartner, updateAccountDetails);

router
  .route('/update-avatar')
  .patch(upload.single('avatar'), verifyJWTPartner, updatePartnerAvatar); // Use `.single` for 'avatar' field

// admin
router.route('/all-partner').get(verifyJWTAdmin, getAllPartnerWithStatus);
router
  .route('/admin/partner/profile/:partnerId')
  .get(verifyJWTAdmin, verifyAdmin, getPartnerProfile);

router.route('/verify').get(verifyJWTPartner, isAuthenticatedOrNot);

router.route('/partner/stats').get(verifyJWTPartner, Bookingstatic);
export default router;
