import { Router } from 'express';
import {
  createOrder,
  getAllOrderUser,
  getOrderDetail,
  getAllPartnerOrdersController,
  getAllWarehouseOrdersController,
  getAllOrders,
  getCardDetailOrder,
  allOrderOfPartner,
  allOrderOfUser,
  allOrderOfWarehouse,
} from '../controllers/orderController.js';
import { verifyJWT } from '../middlewares/authUserMiddleware.js';
import { verifyJWTPartner } from '../middlewares/authPartnerMiddleware.js';
import { verifyJWTAdmin } from '../middlewares/authAdminMiddleware.js';
import { verifyAdmin } from '../middlewares/adminVerificationMiddleware.js';
import BMWToPartnerPaymentController from '../controllers/BMWToPartnerPaymentController.js';
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

// all partner order history
router
  .route('/partner/all/order/history/:partnerId')
  .get(verifyJWTAdmin, allOrderOfPartner);

// route for the payment of BMW to partner
router
  .route('/payment/bmw/partner/:orderId')
  .post(verifyJWTAdmin, BMWToPartnerPaymentController);

// order history for the user
router
  .route('/user/order/history/:userId')
  .get(verifyJWTAdmin, verifyAdmin, allOrderOfUser);

// order history of the warehouse
router
  .route('/warehouse/order/history/:warehouseId')
  .get(verifyJWTAdmin, verifyAdmin, allOrderOfWarehouse);
export default router;
