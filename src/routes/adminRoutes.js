import { Router } from 'express';
import {
  registerAdmin,
  loginAdmin,
  logoutAdmin,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentAdmin,
  updateAccountDetails,
  updateAdminAvatar,
  verifyAdminBySuperAdmin,
  allAdminController,
  getCardDetailAdmin,
  getCardDetailDashboard,
} from '../controllers/adminController.js';
import { verifyJWTAdmin } from '../middlewares/authAdminMiddleware.js';
import { upload } from '../middlewares/multer.js';
import {
  verifyAdmin,
  verifyOtherAdminBySuperAdmin,
} from '../middlewares/adminVerificationMiddleware.js';
import {
  getCardDetailPartner,
  getCardDetailPartnerCustomer,
} from '../controllers/partnerController.js';
import {
  recentTransactionsController,
  allTransactionsController,
  transactionCardDetails,
} from '../controllers/transactionController.js';
import { recentOdersController } from '../controllers/orderController.js';
import {
  getAllUser,
  getCardDetailUserCustomer,
} from '../controllers/userController.js';
const router = Router();

router.route('/register').post(
  upload.fields([
    {
      name: 'avatar',
      maxCount: 1,
    },
  ]),
  registerAdmin
);
router.route('/login').post(loginAdmin);

// Secured routes
router.route('/loginOut').post(verifyJWTAdmin, logoutAdmin);
router.route('/refresh-token').post(verifyJWTAdmin, refreshAccessToken);
router.route('/change-password').post(verifyJWTAdmin, changeCurrentPassword);
router.route('/get-admin').get(verifyJWTAdmin, getCurrentAdmin);
router.route('/update-detail').patch(verifyJWTAdmin, updateAccountDetails);

router
  .route('/update-avatar')
  .patch(upload.single('avatar'), verifyJWTAdmin, updateAdminAvatar); // Use `.single` for 'avatar' field

router
  .route('/verify-admin/:adminId')
  .post(
    verifyJWTAdmin,
    verifyAdmin,
    verifyOtherAdminBySuperAdmin,
    verifyAdminBySuperAdmin
  );

router
  .route('/partner/Static')
  .get(verifyJWTAdmin, verifyAdmin, getCardDetailPartner);

// all admin

router.route('/all/admin').get(verifyJWTAdmin, verifyAdmin, allAdminController);
router
  .route('/card/details')
  .get(verifyJWTAdmin, verifyAdmin, getCardDetailAdmin);

// dashboard card
router
  .route('/card/dashboard/details')
  .get(verifyJWTAdmin, verifyAdmin, getCardDetailDashboard);

// dashboard recent trabsaction route
router
  .route('/dashboard/recent/transaction')
  .get(verifyJWTAdmin, verifyAdmin, recentTransactionsController);

// recent Booking
router
  .route('/dashboard/recent/booking')
  .get(verifyJWTAdmin, verifyAdmin, recentOdersController);

// all transactions route
router
  .route('/all/transactions')
  .get(verifyJWTAdmin, verifyAdmin, allTransactionsController);
router
  .route('/card/transactions')
  .get(verifyJWTAdmin, verifyAdmin, transactionCardDetails);

router.route('/get/all/user').get(verifyJWTAdmin, verifyAdmin, getAllUser);
router
  .route('/get/partner/customer/data')
  .get(verifyJWTAdmin, verifyAdmin, getCardDetailPartnerCustomer);

router
  .route('/get/user/customer/data')
  .get(verifyJWTAdmin, verifyAdmin, getCardDetailUserCustomer);
getCardDetailUserCustomer;
export default router;
