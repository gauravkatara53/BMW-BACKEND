import { Order } from '../models/orderModel.js';
import { Transaction } from '../models/transactionModel.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import crypto from 'crypto';
import {
  getRecentTransactionsService,
  getAllTransactionsService,
  rentPaymentService,
  getAllTransactionsofPartnerService,
} from '../services/transactionService.js';
import { Warehouse } from '../models/warehouseModel.js';
import { BMWToPartnerPayment } from '../models/BMWToPartnerPayment.js';

export const verifyTransaction = asyncHandler(async (req, res) => {
  const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

  console.log(`🔍 Verifying payment for Razorpay Order ID: ${razorpayOrderId}`);

  // Verify Razorpay signature
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (generatedSignature !== razorpaySignature) {
    console.error(`❌ Invalid signature for order ${razorpayOrderId}`);

    await Transaction.findOneAndUpdate(
      { razorpayOrderId },
      { paymentStatus: 'Failed' },
      { new: true }
    );

    throw new ApiError(400, 'Invalid payment signature');
  }

  // ✅ Step 1: Find Transaction to get `orderId`
  const transaction = await Transaction.findOneAndUpdate(
    { razorpayOrderId },
    {
      paymentStatus: 'Completed',
      razorpayPaymentId,
      razorpaySignature,
    },
    { new: true }
  );

  if (!transaction) {
    throw new ApiError(404, 'Transaction not found');
  }

  const { orderId } = transaction; // Extract `orderId`
  if (!orderId) {
    throw new ApiError(400, 'Order ID not found in transaction');
  }

  console.log(`✅ Found Order ID: ${orderId} from Transaction`);

  // ✅ Step 2: Find the Order using `orderId`
  const order = await Order.findById(orderId);

  if (!order) {
    console.error(`❌ Order not found for orderId: ${orderId}`);
    throw new ApiError(404, 'Order not found');
  }

  console.log(`✅ Order found: ${order._id}`);

  // ✅ Step 3: Mark "Processing" month as "Paid"
  const unpaidMonth = order.monthlyPayment.find(
    (month) => month.paymentStatus === 'Processing'
  );

  if (unpaidMonth) {
    await Order.updateOne(
      { _id: order._id, 'monthlyPayment._id': unpaidMonth._id },
      { $set: { 'monthlyPayment.$.paymentStatus': 'Paid' } }
    );
  }

  // ✅ Step 4: Update order status to "Completed"
  await Order.findByIdAndUpdate(order._id, { orderStatus: 'Completed' });

  res.status(200).json({
    success: true,
    message: 'Payment verified successfully, order marked as Completed',
  });
});

// controller for recnt 10 transaction details
export const recentTransactionsController = asyncHandler(async (req, res) => {
  try {
    const transactions = await getRecentTransactionsService();

    // Respond with the fetched data
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          transactions,
          'Recent transactions fetched successfully.'
        )
      );
  } catch (error) {
    console.error('Error in recentTransactionsController:', error);

    // Handle errors gracefully
    return res
      .status(500)
      .json(new ApiResponse(500, null, 'Failed to fetch recent transactions.'));
  }
});

// controller for all transaction details
export const allTransactionsController = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'transactionDate',
    sortOrder = 'desc',
    search,
  } = req.query;

  try {
    const transactions = await getAllTransactionsService({
      page,
      limit,
      sortBy,
      sortOrder,
      search,
    });

    // Respond with the fetched data
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          transactions: transactions.transactions,
          currentPage: transactions.currentPage,
          limit: transactions.limit,
          totalPages: transactions.totalPages,
          totalTransactions: transactions.totalTransactions,
        },
        'Transactions fetched successfully'
      )
    );
  } catch (error) {
    // Handle errors gracefully
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, error.message));
    }
    console.error(error);
    return res.status(500).json(
      new ApiResponse(500, 'An unexpected error occurred', {
        error: error.message,
      })
    );
  }
});
export const transactionCardDetails = asyncHandler(async (req, res) => {
  try {
    console.log('Fetching transaction statistics...');

    // Current date for filters
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const startOfYear = new Date(today.getFullYear(), 0, 1); // Start of the current year
    const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999); // End of the current year

    // Today's earnings
    const todayEarningsResult = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          paymentStatus: 'Completed',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalPrice' },
        },
      },
    ]);
    const todayEarnings =
      todayEarningsResult.length > 0 ? todayEarningsResult[0].totalAmount : 0;

    // Weekly earnings
    const weeklyEarningsResult = await Transaction.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(today.setDate(today.getDate() - 7)),
            $lte: new Date(),
          },
          paymentStatus: 'Completed',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalPrice' },
        },
      },
    ]);
    const weeklyEarnings =
      weeklyEarningsResult.length > 0 ? weeklyEarningsResult[0].totalAmount : 0;

    // Monthly earnings
    const monthEarningsResult = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
          paymentStatus: 'Completed',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalPrice' },
        },
      },
    ]);
    const monthEarnings =
      monthEarningsResult.length > 0 ? monthEarningsResult[0].totalAmount : 0;

    // Yearly earnings
    const yearlyEarningsResult = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYear, $lte: endOfYear },
          paymentStatus: 'Completed',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalPrice' },
        },
      },
    ]);
    const yearlyEarnings =
      yearlyEarningsResult.length > 0 ? yearlyEarningsResult[0].totalAmount : 0;

    // Return statistics with ApiResponse
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          todayEarnings,
          weeklyEarnings,
          monthEarnings,
          yearlyEarnings,
        },
        'Transaction statistics fetched successfully.'
      )
    );
  } catch (error) {
    console.error('Error fetching transaction statistics:', error);

    // Handle errors gracefully with ApiError
    return res
      .status(500)
      .json(new ApiError(500, 'Failed to fetch transaction details', error));
  }
});

export const rentPayment = asyncHandler(async (req, res, next) => {
  try {
    const paymentData = await rentPaymentService(req);
    return res
      .status(200)
      .json(
        new ApiResponse(200, paymentData, 'Payment initiated successfully')
      );
  } catch (error) {
    next(error);
  }
});

export const verifyTransactionRent = asyncHandler(async (req, res) => {
  const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

  // Verify Razorpay signature
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (generatedSignature !== razorpaySignature) {
    await Transaction.findOneAndUpdate(
      { razorpayOrderId },
      { paymentStatus: 'Failed' },
      { new: true }
    );

    throw new ApiError(400, 'Invalid payment signature');
  }

  // Retrieve transaction details to get orderId and monthRentId
  const transaction = await Transaction.findOne({ razorpayOrderId });
  if (!transaction) throw new ApiError(404, 'Transaction not found');

  const { orderId, monthRentId } = transaction;

  // Update payment status in the transaction
  const payment = await Transaction.findOneAndUpdate(
    { razorpayOrderId },
    {
      paymentStatus: 'Completed',
      razorpayPaymentId,
      razorpaySignature,
    },
    { new: true }
  );

  // Update the order's monthly payment status
  await Order.findOneAndUpdate(
    { _id: orderId, 'monthlyPayment._id': monthRentId },
    { $set: { 'monthlyPayment.$.paymentStatus': 'Paid' } },
    { new: true }
  );

  // Retrieve warehouse details
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const warehouse = await Warehouse.findById(order.WarehouseDetail);
  if (!warehouse) throw new ApiError(404, 'Warehouse not found');

  // Calculate new payment day
  const rentRemainderDay = order.paymentDay + warehouse.paymentDueDays;

  // Update order with new payment day
  await Order.findOneAndUpdate(
    { _id: order._id },
    { paymentDay: rentRemainderDay },
    { new: true }
  );

  res.status(200).json({
    success: true,
    message: 'Payment verified successfully',
    payment,
  });
});

// controller for fetching all transactions to a partner
export const allTransactionsToPartnerController = asyncHandler(
  async (req, res) => {
    const {
      page = 1,
      limit = 10,
      sortBy = 'transactionDate',
      sortOrder = 'desc',
      search,
    } = req.query;

    try {
      const partnerId = req.partner?._id;
      if (!partnerId) {
        throw new ApiError(401, 'Unauthorized: Partner ID not found');
      }

      const transactions = await getAllTransactionsofPartnerService({
        partnerId,
        page,
        limit,
        sortBy,
        sortOrder,
        search,
      });

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            transactions,
            'Transactions fetched successfully'
          )
        );
    } catch (error) {
      if (error instanceof ApiError) {
        return res
          .status(error.statusCode)
          .json(new ApiResponse(error.statusCode, error.message));
      }
      console.error(error);
      return res.status(500).json(
        new ApiResponse(500, 'An unexpected error occurred', {
          error: error.message,
        })
      );
    }
  }
);

// eraning stats of partner

import dayjs from 'dayjs';

export const getEarningStatsService = asyncHandler(async (req, res) => {
  const partnerId = req.partner?._id;
  console.log(`Fetching earnings stats for partner ID: ${partnerId}`);
  try {
    // Fetch all partner payments
    const partnerPayments = await BMWToPartnerPayment.find({
      partner: partnerId,
    })
      .populate('warehouseId', 'name')
      .lean();

    // Current dates
    const now = dayjs();
    const startOfMonth = now.startOf('month');
    const startOfWeek = now.startOf('week');

    // Initialize totals
    let totalEarnings = 0;
    let thisMonthEarnings = 0;
    let thisWeekEarnings = 0;

    partnerPayments.forEach((payment) => {
      const amount = payment.totalPrice || 0;
      const paymentDate = dayjs(payment.createdAt); // assumes createdAt exists

      totalEarnings += amount;

      if (paymentDate.isAfter(startOfMonth)) {
        thisMonthEarnings += amount;
      }

      if (paymentDate.isAfter(startOfWeek)) {
        thisWeekEarnings += amount;
      }
    });

    return res.json({
      totalEarnings: Number(totalEarnings.toFixed(0)),
      thisMonthEarnings: Number(thisMonthEarnings.toFixed(0)),
      thisWeekEarnings: Number(thisWeekEarnings.toFixed(0)),
    });
  } catch (error) {
    throw new ApiError(500, error.message);
  }
});
