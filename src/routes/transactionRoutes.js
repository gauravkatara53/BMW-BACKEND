import { Router } from 'express';
import {
  verifyTransaction,
  rentPayment,
  verifyTransactionRent,
} from '../controllers/transactionController.js';
import { verifyJWT } from '../middlewares/authUserMiddleware.js';

const router = Router();

// Secured routes
router.route('/verify').post(verifyJWT, verifyTransaction);

// month rent route
router.route('/montly/rent/:orderId').post(verifyJWT, rentPayment);
export default router;

// verify the monthly rent
router.route('/verify/rent').post(verifyJWT, verifyTransactionRent);
