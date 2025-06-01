import { Order } from '../models/orderModel.js';
import { BMWToPartnerPayment } from '../models/BMWToPartnerPayment.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Warehouse } from '../models/warehouseModel.js';

const BMWToPartnerPaymentController = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  if (!orderId) throw new ApiError(400, 'Order ID is required');

  const orderDetail = await Order.findById(orderId);
  if (!orderDetail) throw new ApiError(404, 'Order not found');

  const { paymentMethod, UTR, notes } = req.body;
  if (!paymentMethod || !UTR) {
    throw new ApiError(400, 'Missing required fields: paymentMethod or UTR');
  }

  const warehouseDetail = await Warehouse.findById(orderDetail.WarehouseDetail);
  if (!warehouseDetail) throw new ApiError(404, 'Warehouse not found');

  const isRent = warehouseDetail.rentOrSell === 'Rent';

  let totalPrice = 0;
  let paymentRecord = null;

  if (isRent) {
    // ✅ RENT flow
    const unpaidMonth = orderDetail.monthlyPayment?.find(
      (item) => item.paymentForPartnerByBMW === 'Unpaid'
    );

    if (!unpaidMonth) {
      throw new ApiError(400, 'No unpaid monthly payment found for partner');
    }

    totalPrice = orderDetail.monthlyAmount;

    paymentRecord = await BMWToPartnerPayment.create({
      warehouseId: orderDetail.WarehouseDetail,
      orderId,
      totalPrice,
      user: orderDetail.customerDetails,
      partner: orderDetail.partnerDetails,
      paymentMethod,
      paymentStatus: 'Completed',
      UTR,
      notes,
      isDebited: true, // This is a payment to the partner,
    });

    const updateResult = await Order.updateOne(
      { _id: orderId, 'monthlyPayment._id': unpaidMonth._id },
      {
        $set: {
          'monthlyPayment.$.paymentForPartnerByBMW': 'Paid',
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      throw new ApiError(500, 'Failed to update order monthly payment status');
    }
  } else {
    // ✅ SELL flow
    if (orderDetail.paymentFromBMWSold === 'Paid') {
      throw new ApiError(400, 'This sold payment is already marked as paid');
    }

    totalPrice = orderDetail.totalPrice;

    paymentRecord = await BMWToPartnerPayment.create({
      warehouseId: orderDetail.WarehouseDetail,
      orderId,
      totalPrice,
      user: orderDetail.customerDetails,
      partner: orderDetail.partnerDetails,
      paymentMethod,
      UTR,
      notes,
      isDebited: true, // This is a payment to the partner,
    });
    const updateResult = await Order.updateOne(
      { _id: orderId },
      {
        $set: {
          paymentFromBMWSold: 'Paid',
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      throw new ApiError(500, 'Failed to update order sold payment status');
    }
  }

  res
    .status(201)
    .json(new ApiResponse(201, paymentRecord, 'Payment created successfully'));
});

export default BMWToPartnerPaymentController;
