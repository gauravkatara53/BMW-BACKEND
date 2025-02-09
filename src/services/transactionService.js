import { Transaction } from '../models/transactionModel.js';
// import { BookOrder } from '../models/bookOrder.js';
import crypto from 'crypto';
// import { Razorpay } from '../config/razorpayConfig.js';
import { Order } from '../models/orderModel.js';
import { rentPaymentQueue } from '../Queue/RentPayment.js';
import { ApiError } from '../utils/ApiError.js';
import Razorpay from 'razorpay';
export const createRazorpayOrder = async (amount) => {
  const options = {
    amount: amount * 100, // Convert to smallest currency unit
    currency: 'INR',
    receipt: `receipt_${Date.now()}`,
  };
  return await razorpay.orders.create(options);
};

export const saveTransaction = async ({
  orderId,
  amount,
  paymentMethod,
  userId,
  razorpayOrderId,
}) => {
  return await Transaction.create({
    methodDetails: `receipt_${Date.now()}`,
    amount,
    paymentMethod,
    paymentStatus: 'Pending',
    userId,
    orderId,
    razorpayOrderId,
  });
};

export const verifyRazorpaySignature = (
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  secretKey
) => {
  const generatedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  return generatedSignature === razorpaySignature;
};

export const updateTransactionStatus = async (
  razorpayOrderId,
  status,
  additionalFields = {}
) => {
  return await Transaction.findOneAndUpdate(
    { razorpayOrderId },
    { paymentStatus: status, ...additionalFields },
    { new: true }
  );
};

export const updateOrderPaymentStatus = async (orderId, status) => {
  return await BookOrder.findByIdAndUpdate(orderId, { paymentStatus: status });
};

// recent 10 Transactions
export const getRecentTransactionsService = async () => {
  try {
    const transactions = await Transaction.find()
      .sort({ transactionDate: -1 }) // Ascending order
      .limit(10)
      .populate('orderId', 'orderStatus')
      .populate('createdBy', 'name')
      .populate('warehouseId', 'name');

    return transactions;
  } catch (error) {
    console.error('Error fetching recent transactions:', error);
    throw new Error('Failed to fetch recent transactions');
  }
};

// all transaction
export const getAllTransactionsService = async ({
  page = 1,
  limit = 10,
  sortBy = 'transactionDate',
  sortOrder = 'desc',
  search,
}) => {
  // Construct filter based on query parameters
  const filter = {};
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    filter.$or = [
      { orderId: searchRegex },
      { paymentMethod: searchRegex },
      { paymentStatus: searchRegex },
    ];
  }

  // Calculate pagination
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  // Fetch total count of transactions
  const totalTransactions = await Transaction.countDocuments(filter);
  if (totalTransactions === 0) throw new ApiError(404, 'No transactions found');

  // Calculate total pages
  const totalPages = Math.ceil(totalTransactions / limitNumber);

  // Fetch transactions with filter, sorting, and pagination
  const transactions = await Transaction.find(filter)
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(limitNumber)
    .populate('orderId', 'orderStatus')
    .populate('createdBy', 'name')
    .populate('warehouseId', 'name');

  if (!transactions.length)
    throw new ApiError(404, 'No transactions match the given criteria');

  return {
    transactions,
    currentPage: pageNumber,
    limit: limitNumber,
    totalPages,
    totalTransactions,
  };
};

// monthy payment of rent
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const rentPaymentService = async (req) => {
  try {
    const { orderId } = req.params;
    const user = req.user; // Assuming user is stored in req.user from authentication middleware
    console.log('Warehouse ID:', orderId);

    const order = await Order.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    // Find first unpaid month and get its _id
    const unpaidMonth = order.monthlyPayment.find(
      (month) => month.paymentStatus === 'Unpaid'
    );
    if (!unpaidMonth) throw new ApiError(400, 'No unpaid monthly rent found');

    const monthRentId = unpaidMonth._id;

    // Update the payment status to 'Processing'
    await Order.updateOne(
      { _id: orderId, 'monthlyPayment._id': monthRentId },
      { $set: { 'monthlyPayment.$.paymentStatus': 'Processing' } }
    );

    // Fetch updated order after update
    const updatedOrder = await Order.findById(orderId);

    const options = {
      amount: updatedOrder.monthlyAmount * 100, // Convert to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    const transaction = await Transaction.create({
      warehouseId: updatedOrder.WarehouseDetail,
      orderId: updatedOrder._id,
      monthRentId,
      totalPrice: updatedOrder.monthlyAmount,
      transactionDate: new Date(),
      paymentStatus: 'Pending',
      createdBy: user._id,
      razorpayOrderId: razorpayOrder.id,
      razorpayPaymentId: null,
      razorpaySignature: null,
    });

    await rentPaymentQueue.add(
      {
        orderId: updatedOrder._id,
        transactionId: transaction._id,
      },
      { delay: 300000 } // 5 minutes delay
    );

    return { updatedOrder, razorpayOrder, transaction };
  } catch (error) {
    throw new ApiError(500, error.message);
  }
};

export const verifyRazorpaySignatureRent = (
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  secretKey
) => {
  const generatedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  return generatedSignature === razorpaySignature;
};
