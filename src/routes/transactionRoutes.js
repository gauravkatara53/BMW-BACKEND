import { Router } from 'express';
import { verifyTransaction } from '../controllers/transactionController.js';
import { verifyJWT } from '../middlewares/authUserMiddleware.js';

const router = Router();

// Secured routes
router.route('/verify').post(verifyJWT, verifyTransaction);
