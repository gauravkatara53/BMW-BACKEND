import { Router } from 'express';
import {
  createWarehouse,
  uploadImageController,
  deleteWarehouseDetailController,
  getWarehouseDetailController,
  changeWarehouseStatusController,
  allWarehouseController,
  getAllPartnerWarehouseController,
  getCardDetaiWarehouse,
  featuredWarehouse,
} from '../controllers/warehouseController.js';
import { verifyJWTPartner } from '../middlewares/authPartnerMiddleware.js';
import { verifyPartnerKyc } from '../middlewares/partnerMiddleware.js';
import { upload } from '../middlewares/multer.js';
import { verifyAdmin } from '../middlewares/adminVerificationMiddleware.js';
import { verifyJWTAdmin } from '../middlewares/authAdminMiddleware.js';

const router = Router();

// Route to create a warehouse
router
  .route('/create')
  .post(verifyJWTPartner, verifyPartnerKyc, createWarehouse);

// Route to upload images for a warehouse
router.route('/upload/:id').post(
  verifyJWTPartner,
  verifyPartnerKyc,
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 5 },
  ]),
  uploadImageController
);
router
  .route('/delete/:id')
  .post(verifyJWTPartner, verifyPartnerKyc, deleteWarehouseDetailController);

router
  .route('/get/detail/:id')
  .get(verifyJWTPartner, verifyPartnerKyc, getWarehouseDetailController);

router
  .route('/update/status/:id')
  .post(verifyJWTPartner, verifyPartnerKyc, changeWarehouseStatusController);
router
  .route('/all/partner')
  .get(verifyJWTPartner, verifyPartnerKyc, getAllPartnerWarehouseController);

// for admin only
router
  .route('/all/warehouse')
  .get(verifyJWTAdmin, verifyAdmin, allWarehouseController);

router
  .route('/admin/get/detail/:id')
  .get(verifyJWTAdmin, verifyAdmin, getWarehouseDetailController);

router
  .route('/admin/get/warehouse/card')
  .get(verifyJWTAdmin, verifyAdmin, getCardDetaiWarehouse);

  // for all 
router.route('/user/get/warehouse/featured').get(featuredWarehouse);

export default router;
