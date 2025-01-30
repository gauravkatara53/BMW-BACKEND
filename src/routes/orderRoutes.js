import { Router } from 'express';
import {
  createOrder,
  getAllOrderUser,
  getOrderDetail,
  getAllPartnerOrdersController,
  getAllWarehouseOrdersController,
  getAllOrders,
  getCardDetailOrder,
} from '../controllers/orderController.js';
import { verifyJWT } from '../middlewares/authUserMiddleware.js';
import { verifyJWTPartner } from '../middlewares/authPartnerMiddleware.js';
import { verifyJWTAdmin } from '../middlewares/authAdminMiddleware.js';
import { verifyAdmin } from '../middlewares/adminVerificationMiddleware.js';
const router = Router();

// Secured routes

// user only
router.route('/create/:id').post(verifyJWT, createOrder);
router.route('/all/orders').get(verifyJWT, getAllOrderUser);
router.route('/deatil/:orderId').get(verifyJWT, getOrderDetail);

// only for partner
router
  .route('/warehouse/:warehouseId')
  .get(verifyJWTPartner, getAllWarehouseOrdersController);
router.route('/partner').get(verifyJWTPartner, getAllPartnerOrdersController);

// admin only
router.route('/all/order').get(verifyJWTAdmin, verifyAdmin, getAllOrders);
router
  .route('/admin/deatil/:orderId')
  .get(verifyJWTAdmin, verifyAdmin, getOrderDetail);

router
  .route('/admin/order/card')
  .get(verifyJWTAdmin, verifyAdmin, getCardDetailOrder);
export default router;
