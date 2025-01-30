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
} from '../controllers/userController.js';
import { verifyJWT } from '../middlewares/authUserMiddleware.js';
import { upload } from '../middlewares/multer.js';

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

export default router;
