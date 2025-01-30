import { Order } from '../models/orderModel.js';
import { Transaction } from '../models/transactionModel.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import crypto from 'crypto';
import {
  getRecentTransactionsService,
  getAllTransactionsService,
} from '../services/transactionService.js';
export const verifyTransaction = asyncHandler(async (req, res) => {
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

    await Order.findOneAndUpdate(
      { razorpayOrderId }, // Make sure you're targeting the order by razorpayOrderId
      { orderStatus: 'Failed' },
      { new: true }
    );

    throw new ApiError(400, 'Invalid payment signature');
  }

  // Update payment status to completed
  const payment = await Transaction.findOneAndUpdate(
    { razorpayOrderId },
    {
      paymentStatus: 'Completed',
      razorpayPaymentId,
      razorpaySignature,
    },
    { new: true }
  );

  // Update booking payment status
  await Order.findByIdAndUpdate(payment.orderId, {
    orderStatus: 'Completed',
  });

  res.status(200).json({
    success: true,
    message: 'Payment verified successfully',
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
