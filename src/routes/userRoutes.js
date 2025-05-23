import { Router } from 'express';
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  isAuthenticatedOrNot,
} from '../controllers/userController.js';
import { verifyJWT } from '../middlewares/authUserMiddleware.js';
import { upload } from '../middlewares/multer.js';
import {
  allWarehouseController,
  getWarehouseDetailController,
} from '../controllers/warehouseController.js';

const router = Router();

router.route('/register').post(
  upload.fields([
    {
      name: 'avatar',
      maxCount: 1,
    },
  ]),
  registerUser
);
router.route('/login').post(loginUser);

// Secured routes
router.route('/loginOut').post(verifyJWT, logoutUser);
router.route('/refresh-token').post(verifyJWT, refreshAccessToken);
router.route('/change-password').post(verifyJWT, changeCurrentPassword);
router.route('/get-user').get(verifyJWT, getCurrentUser);
router.route('/update-detail').patch(verifyJWT, updateAccountDetails);

router
  .route('/update-avatar')
  .patch(verifyJWT, upload.single('avatar'), updateUserAvatar); // Use `.single` for 'avatar' field

//  user side api
router.route('/home/warehouse').get(allWarehouseController); // Use `.single` for 'avatar' field
router.route('/get/warehouse-details/:id').get(getWarehouseDetailController);
router.route('/verify').get(verifyJWT, isAuthenticatedOrNot);

export default router;
