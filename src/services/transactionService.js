import { Transaction } from '../models/transactionModel.js';
// import { BookOrder } from '../models/bookOrder.js';
import crypto from 'crypto';
// import { Razorpay } from '../config/razorpayConfig.js';
import { Order } from '../models/orderModel.js';
import { scheduleRentPaymentJob } from '../Queue/RentPayment.js';
import { ApiError } from '../utils/ApiError.js';
import Razorpay from 'razorpay';
import { BMWToPartnerPayment } from '../models/BMWToPartnerPayment.js';
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
// export const getRecentTransactionsService = async () => {
//   try {
//     const transactions = await Transaction.find()
//       .sort({ transactionDate: -1 }) // Ascending order
//       .limit(10)
//       .populate('orderId', 'orderStatus')
//       .populate('createdBy', 'name')
//       .populate('warehouseId', 'name');

//     return transactions;
//   } catch (error) {
//     console.error('Error fetching recent transactions:', error);
//     throw new Error('Failed to fetch recent transactions');
//   }
// };
export const getRecentTransactionsService = async () => {
  try {
    // Fetch recent transactions
    const transactions = await Transaction.find()
      .sort({ transactionDate: -1 })
      .limit(10)
      .populate('orderId', 'orderStatus')
      .populate('createdBy', 'name')
      .populate('warehouseId', 'name')
      .lean();

    // Normalize order transactions
    const normalizedTransactions = transactions.map((t) => ({
      _id: t._id,
      type: 'order',
      transactionDate: t.transactionDate,
      orderId: t.orderId?._id || null,
      orderStatus: t.orderId?.orderStatus || null,
      paymentMethod: t.paymentMethod,
      paymentStatus: t.paymentStatus,
      createdBy: t.createdBy?.name || 'Unknown',
      nameWarehouse: t.warehouseId?.name || 'Unknown',
      amount: t.totalPrice || 0,
      isdebited: t.isDebited || false,
    }));

    // Fetch recent partner payments
    const partnerPayments = await BMWToPartnerPayment.find()
      .sort({ transactionDate: -1 })
      .limit(10)
      .populate('warehouseId', 'name')
      .lean();

    // Normalize partner payments
    const normalizedPartnerPayments = partnerPayments.map((p) => ({
      _id: p._id,
      type: 'partnerPayment',
      transactionDate: p.transactionDate,
      orderId: p.orderId || null,
      orderStatus: null,
      paymentMethod: p.paymentMethod || 'Manual/Auto',
      paymentStatus: p.status,
      createdBy: 'Admin',
      nameWarehouse: p.warehouseId?.name || 'Unknown',
      amount: p.totalPrice || 0,
      isdebited: p.isDebited ?? true, // Default to debited if not defined
    }));

    // Combine and sort by transactionDate
    const combined = [...normalizedTransactions, ...normalizedPartnerPayments]
      .sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate))
      .slice(0, 10); // Keep only recent 10

    return combined;
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
  const filter = {};
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    filter.$or = [
      { orderId: searchRegex },
      { paymentMethod: searchRegex },
      { paymentStatus: searchRegex },
    ];
  }

  // Fetch transactions from Transaction collection
  const transactions = await Transaction.find(filter)
    .populate('orderId', 'orderStatus')
    .populate('createdBy', 'name')
    .populate('warehouseId', 'name')
    .lean();

  // Fetch partner payments from BMWToPartnerPayment collection
  const partnerPayments = await BMWToPartnerPayment.find({})
    .populate('warehouseId', 'name')
    .lean();

  // Normalize both datasets to the same format
  const normalizedTransactions = transactions.map((t) => ({
    _id: t._id,
    type: 'order', // label for frontend
    transactionDate: t.transactionDate,
    orderId: t.orderId?._id || null,
    orderStatus: t.orderId?.orderStatus || null,
    paymentMethod: t.paymentMethod,
    paymentStatus: t.paymentStatus,
    createdBy: t.createdBy?.name || 'Unknown',
    warehouseName: t.warehouseId?.name || 'Unknown',
    amount: t.totalPrice || 0,
    isdebited: t.isDebited || false,
  }));

  const normalizedPartnerPayments = partnerPayments.map((p) => ({
    _id: p._id,
    type: 'partnerPayment',
    transactionDate: p.transactionDate,
    orderId: p.orderId,
    orderStatus: null,
    paymentMethod: p.paymentMethod || 'Manual/Auto',
    paymentStatus: p.status,
    createdBy: 'Admin',
    warehouseName: p.warehouseId || 'Unknown',
    amount: p.totalPrice || 0,
    isdebited: p.isDebited || true,
  }));

  // Combine both arrays
  const combined = [...normalizedTransactions, ...normalizedPartnerPayments];

  // Filter by search (if applicable)
  let filtered = combined;
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    filtered = combined.filter(
      (item) =>
        searchRegex.test(item.paymentMethod) ||
        searchRegex.test(item.paymentStatus) ||
        (item.orderId && searchRegex.test(item.orderId.toString()))
    );
  }

  if (!filtered.length)
    throw new ApiError(404, 'No transactions match the given criteria');

  // Sort
  const sorted = filtered.sort((a, b) => {
    if (sortOrder === 'desc') {
      return new Date(b[sortBy]) - new Date(a[sortBy]);
    } else {
      return new Date(a[sortBy]) - new Date(b[sortBy]);
    }
  });

  // Paginate manually
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const totalTransactions = sorted.length;
  const totalPages = Math.ceil(totalTransactions / limitNumber);
  const paginated = sorted.slice(
    (pageNumber - 1) * limitNumber,
    pageNumber * limitNumber
  );

  return {
    transactions: paginated,
    currentPage: pageNumber,
    limit: limitNumber,
    totalPages,
    totalTransactions,
  };
};
// export const getAllTransactionsService = async ({
//   page = 1,
//   limit = 10,
//   sortBy = 'transactionDate',
//   sortOrder = 'desc',
//   search,
// }) => {
//   // Construct filter based on query parameters
//   const filter = {};
//   if (search) {
//     const searchRegex = new RegExp(search, 'i');
//     filter.$or = [
//       { orderId: searchRegex },
//       { paymentMethod: searchRegex },
//       { paymentStatus: searchRegex },
//     ];
//   }

//   // Calculate pagination
//   const pageNumber = parseInt(page, 10);
//   const limitNumber = parseInt(limit, 10);
//   const skip = (pageNumber - 1) * limitNumber;

//   // Fetch total count of transactions
//   const totalTransactions = await Transaction.countDocuments(filter);
//   if (totalTransactions === 0) throw new ApiError(404, 'No transactions found');

//   // Calculate total pages
//   const totalPages = Math.ceil(totalTransactions / limitNumber);

//   // Fetch transactions with filter, sorting, and pagination
//   const transactions = await Transaction.find(filter)
//     .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
//     .skip(skip)
//     .limit(limitNumber)
//     .populate('orderId', 'orderStatus')
//     .populate('createdBy', 'name')
//     .populate('warehouseId', 'name');

//   if (!transactions.length)
//     throw new ApiError(404, 'No transactions match the given criteria');

//   return {
//     transactions,
//     currentPage: pageNumber,
//     limit: limitNumber,
//     totalPages,
//     totalTransactions,
//   };
// };

// monthy payment of rent
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const rentPaymentService = async (req) => {
  try {
    const { orderId } = req.params;
    const user = req.user; // Assuming user is stored in req.user from authentication middleware
    console.log('order ID:', orderId);

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

    await scheduleRentPaymentJob(order._id, transaction._id);

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

// transaction for the partner payment

export const getAllTransactionsofPartnerService = async ({
  partnerId,
  page = 1,
  limit = 10,
  sortBy = 'transactionDate',
  sortOrder = 'desc',
  search,
}) => {
  const filter = { partner: partnerId };

  // Step 1: MongoDB-level filtering on direct fields only
  if (search) {
    const searchRegex = new RegExp(search, 'i');

    const orFilters = [{ paymentMethod: searchRegex }, { status: searchRegex }];

    if (mongoose.Types.ObjectId.isValid(search)) {
      orFilters.push({ _id: new mongoose.Types.ObjectId(search) });
    }

    filter.$or = orFilters;
  }

  // Step 2: Query DB with safe filters
  const partnerPayments = await BMWToPartnerPayment.find(filter)
    .populate('warehouseId', 'name')
    .populate('orderId', 'orderId')
    .lean();

  // Step 3: Normalize populated and computed fields
  const normalized = partnerPayments.map((p) => ({
    _id: p._id.toString(),
    type: 'partnerPayment',
    transactionDate: p.transactionDate,
    orderId: p.orderId?.orderId || '',
    paymentMethod: p.paymentMethod || 'Manual/Auto',
    UTR: p.UTR || '',
    paymentStatus: p.status,
    createdBy: 'Admin',
    warehouseName: p.warehouseId?.name || 'Unknown',
    amount: p.totalPrice || 0,
    isdebited: p.isDebited ?? true,
  }));

  // Step 4: In-memory filtering on populated fields like orderId, warehouseName
  let filtered = normalized;
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    filtered = normalized.filter(
      (item) =>
        searchRegex.test(item._id) ||
        searchRegex.test(item.paymentMethod) ||
        searchRegex.test(item.paymentStatus) ||
        searchRegex.test(item.orderId) ||
        searchRegex.test(item.warehouseName)
    );
  }

  // Step 5: Handle no results
  if (!filtered.length) {
    throw new ApiError(404, 'No transactions match the given criteria');
  }

  // Step 6: Sort
  const sorted = filtered.sort((a, b) => {
    return sortOrder === 'desc'
      ? new Date(b[sortBy]) - new Date(a[sortBy])
      : new Date(a[sortBy]) - new Date(b[sortBy]);
  });

  // Step 7: Paginate
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const totalTransactions = sorted.length;
  const totalPages = Math.ceil(totalTransactions / limitNumber);
  const paginated = sorted.slice(
    (pageNumber - 1) * limitNumber,
    pageNumber * limitNumber
  );

  // Step 8: Return result
  return {
    transactions: paginated,
    currentPage: pageNumber,
    limit: limitNumber,
    totalPages,
    totalTransactions,
  };
};

