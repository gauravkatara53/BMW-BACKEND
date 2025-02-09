import { Router } from 'express';
import {
  verifyTransaction,
  rentPayment,
} from '../controllers/transactionController.js';
import { verifyJWT } from '../middlewares/authUserMiddleware.js';

const router = Router();

// Secured routes
router.route('/verify').post(verifyJWT, verifyTransaction);

// month rent route
router.route('/montly/rent/:id').post(verifyJWT, rentPayment);
export default router;
