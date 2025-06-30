import Razorpay from 'razorpay';
import { Order } from '../models/orderModel.js';
import { Warehouse } from '../models/warehouseModel.js';
import { Transaction } from '../models/transactionModel.js';
import { ApiError } from '../utils/ApiError.js';
import { schedulePaymentJob } from '../Queue/paymentQueue.js';
import mongoose from 'mongoose';
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
import { getCache, setCache, deleteCache } from '../utils/cache.js'; // adjust the path if needed

const createOrderService = async (warehouseId, duration, user, session) => {
  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse) throw new ApiError(404, 'Warehouse not found');

  if (['Rented', 'Sold'].includes(warehouse.WarehouseStatus)) {
    throw new ApiError(400, 'Warehouse is not available');
  }

  const basePrice = warehouse.monthlyAmount * duration;
  const nonMonthlyPrice = warehouse.subTotalPrice - warehouse.monthlyAmount;
  const subTotalPriceForRent = basePrice + nonMonthlyPrice;
  const totalPriceForRent = subTotalPriceForRent;
  const totalPrice =
    warehouse.rentOrSell === 'Rent' ? totalPriceForRent : warehouse.totalPrice;

  const ordinalMonths = [
    'First',
    'Second',
    'Third',
    'Fourth',
    'Fifth',
    'Sixth',
    'Seventh',
    'Eighth',
    'Ninth',
    'Tenth',
    'Eleventh',
    'Twelfth',
  ];

  let monthlyPayment = [];
  if (duration) {
    const monthlyAmount = parseFloat((totalPrice / duration).toFixed(2));
    const startDate = new Date();

    for (let i = 0; i < duration; i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + i);

      monthlyPayment.push({
        month: ordinalMonths[i],
        amount: monthlyAmount,
        paymentStatus: 'Unpaid',
      });
    }
  }
  // Generate a unique order ID
  const userName = String(user?.username || user?.name || 'UnknownUser');
  const warehouseName = String(warehouse?.name || 'UnknownWarehouse');
  const partnerName = String(warehouse?.partnerName || 'UnknownPartner');

  // Use last 3 digits of timestamp for semi-unique 3-digit number
  const threeDigitNumber = Date.now().toString().slice(-3);

  const getNameMix = (a, b, c) => {
    const clean = (str) =>
      String(str).replace(/\s+/g, '').slice(0, 3).toUpperCase();
    return `${clean(a)}${clean(b)}${clean(c)}`;
  };

  const uniqueOrderId = `BMW${threeDigitNumber}${getNameMix(partnerName, userName, warehouseName)}`;

  const [order] = await Order.create([
    {
      orderId: uniqueOrderId,
      orderStatus: 'Pending',
      orderDate: new Date(),
      duration,
      startDate: new Date(),
      endDate: duration
        ? new Date(new Date().setMonth(new Date().getMonth() + duration))
        : null,
      subTotalPrice:
        warehouse.rentOrSell === 'Rent'
          ? totalPriceForRent
          : warehouse.subTotalPrice,
      totalPrice:
        warehouse.rentOrSell === 'Rent'
          ? totalPriceForRent
          : warehouse.totalPrice,
      totalPaid: 0,
      unpaidAmount: totalPrice,
      WarehouseDetail: warehouseId,
      customerDetails: user._id,
      partnerDetails: warehouse.partnerName,
      monthlyPayment,
      monthlyAmount: duration
        ? parseFloat((totalPrice / duration).toFixed(2))
        : 0,
      paymentDay: warehouse.paymentDueDays,
    },
  ]);

  const monthlyAmount = duration
    ? parseFloat((totalPrice / duration).toFixed(2))
    : 0;
  const transactionAmount =
    warehouse.rentOrSell === 'Rent' ? monthlyAmount : warehouse.totalPrice;

  const options = {
    amount: transactionAmount * 100, // Convert to paise (INR)
    currency: 'INR',
    receipt: `receipt_${Date.now()}`,
  };

  let monthRentId = null;
  if (warehouse.rentOrSell === 'Rent') {
    const unpaidMonth = order.monthlyPayment.find(
      (month) => month.paymentStatus === 'Unpaid'
    );
    if (!unpaidMonth) throw new ApiError(400, 'No unpaid monthly rent found');

    monthRentId = unpaidMonth._id;
  }

  const razorpayOrder = await razorpay.orders.create(options);

  const [transaction] = await Transaction.create([
    {
      warehouseId,
      orderId: order._id,
      monthRentId: warehouse.rentOrSell === 'Rent' ? monthRentId : null,
      totalPrice: transactionAmount,
      transactionDate: new Date(),
      paymentStatus: 'Pending',
      createdBy: user._id,
      razorpayOrderId: razorpayOrder.id,
      razorpayPaymentId: null,
      razorpaySignature: null,
    },
  ]);

  const newStatus = warehouse.rentOrSell === 'Rent' ? 'Rented' : 'Sold';
  await Warehouse.findByIdAndUpdate(
    warehouseId,
    { WarehouseStatus: newStatus },
    { new: true }
  );

  if (warehouse.rentOrSell === 'Rent') {
    await Order.updateOne(
      { _id: order._id, 'monthlyPayment._id': monthRentId },
      { $set: { 'monthlyPayment.$.paymentStatus': 'Processing' } }
    );
  }

  await schedulePaymentJob(order._id, warehouseId, transaction._id);

  return {
    order,
    razorpayOrder,
    transaction,
  };
};

const getAllUserOrdersService = async ({
  userId,
  page = 1,
  limit = 10,
  sortBy = 'orderDate',
  sortOrder = 'desc',
  orderStatus,
  warehouseId,
  searchTerm,
  startDate,
  endDate,
  rentOrSell, // Added rentOrSell filter
}) => {
  // Construct base filter
  const baseFilter = { customerDetails: userId };

  if (orderStatus) baseFilter.orderStatus = orderStatus;
  if (warehouseId) baseFilter.WarehouseDetail = warehouseId;

  // Date range filter
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  // Aggregation pipeline
  const pipeline = [
    { $match: { ...baseFilter, ...dateFilter } },
    // Join WarehouseDetail
    {
      $lookup: {
        from: 'warehouses',
        localField: 'WarehouseDetail',
        foreignField: '_id',
        as: 'WarehouseDetail',
      },
    },
    { $unwind: { path: '$WarehouseDetail', preserveNullAndEmptyArrays: true } },
    // Join partnerDetails
    {
      $lookup: {
        from: 'partners',
        localField: 'partnerDetails',
        foreignField: '_id',
        as: 'partnerDetails',
      },
    },
    { $unwind: { path: '$partnerDetails', preserveNullAndEmptyArrays: true } },
  ];

  // Apply rentOrSell filter
  if (rentOrSell) {
    pipeline.push({
      $match: { 'WarehouseDetail.rentOrSell': rentOrSell },
    });
  }

  // Add search filter if searchTerm exists
  if (searchTerm) {
    const searchRegex = new RegExp(searchTerm, 'i');
    pipeline.push({
      $match: {
        $or: [
          { 'WarehouseDetail.name': searchRegex },
          { 'WarehouseDetail.address': searchRegex },
          { 'WarehouseDetail.city': searchRegex },
          { 'WarehouseDetail.state': searchRegex },
          { 'WarehouseDetail.country': searchRegex },
          { 'WarehouseDetail.pincode': searchRegex },
          { 'partnerDetails.username': searchRegex },
          { 'partnerDetails.name': searchRegex },
          { 'partnerDetails.email': searchRegex },
          { 'partnerDetails.phone': searchRegex },
          { orderId: searchRegex },
        ],
      },
    });
  }

  // Add sorting
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  pipeline.push({ $sort: { [sortBy]: sortDirection } });

  // Clone pipeline for count
  const countPipeline = [...pipeline];
  countPipeline.push({ $count: 'total' });

  // Execute count query
  const [totalResult] = await Order.aggregate(countPipeline);
  const totalOrders = totalResult?.total || 0;
  if (!totalOrders) throw new ApiError(404, 'No orders found');

  // Pagination
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const totalPages = Math.ceil(totalOrders / limitNumber);

  // Add pagination
  pipeline.push(
    { $skip: (pageNumber - 1) * limitNumber },
    { $limit: limitNumber }
  );

  // Execute aggregation for orders
  const orders = await Order.aggregate(pipeline);

  if (!orders.length)
    throw new ApiError(404, 'No orders match the given criteria');

  // Populate transactionDetails if needed
  const populatedOrders = await Order.populate(orders, [
    { path: 'transactionDetails', select: 'paymentStatus transactionDate' },
  ]);

  return {
    orders: populatedOrders,
    currentPage: pageNumber,
    totalPages,
    limit: limitNumber,
    totalOrders,
  };
};

const getOrderDetailService = async (orderId) => {
  console.log('Received Order ID:', orderId);

  const cacheKey = `order-detail-${orderId}`;

  // ✅ 1. Check if data is in cache
  const cached = getCache(cacheKey);
  if (cached) {
    console.log('✅ Order detail returned from cache');
    return cached;
  }

  // ✅ 2. Validate ObjectId
  const isValidObjectId = mongoose.Types.ObjectId.isValid(orderId);
  if (!isValidObjectId) {
    throw new ApiError(400, 'Invalid Order ID format');
  }

  // ✅ 3. Fetch order with all necessary population
  const orderDoc = await Order.findById(orderId)
    .populate('WarehouseDetail')
    .populate('transactionDetails', 'paymentStatus transactionDate')
    .populate('partnerDetails', 'name avatar')
    .populate('customerDetails', 'name phone');

  if (!orderDoc) {
    throw new ApiError(404, 'Order not found');
  }

  if (!orderDoc.WarehouseDetail) {
    throw new ApiError(404, 'Warehouse details not found');
  }

  // ✅ 4. Fetch transaction
  const transactionDoc = await Transaction.findOne({ orderId }).select(
    'transactionId transactionDate totalPrice paymentStatus razorpayOrderId razorpayPaymentId razorpaySignature'
  );

  if (!transactionDoc) {
    throw new ApiError(404, 'Transaction details not found');
  }

  // ✅ 5. Convert to plain JS objects
  const order = orderDoc.toObject();
  const transaction = transactionDoc.toObject();

  const responseData = { order, transaction };

  // ✅ 6. Save to cache (TTL: 10 minutes)
  setCache(cacheKey, responseData, 600);

  // ✅ 7. Return data
  return responseData;
};

const getAllWarehouseOrdersService = async ({
  warehouseId,
  page = 1,
  limit = 10,
  sortBy = 'orderDate',
  sortOrder = 'desc',
  orderStatus,
}) => {
  // Construct filter based on query parameters
  const filter = { WarehouseDetail: warehouseId };
  if (orderStatus) filter.orderStatus = orderStatus;

  // Calculate pagination
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  // Fetch total count of orders
  const totalOrders = await Order.countDocuments(filter);
  if (!totalOrders)
    throw new ApiError(404, 'No orders found for this warehouse');

  // Calculate total pages
  const totalPages = Math.ceil(totalOrders / limitNumber);

  // Fetch orders with filter, sorting, and pagination
  const orders = await Order.find(filter)
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(limitNumber)
    .populate(
      'WarehouseDetail',
      'name location partnerName WarehouseStatus paymentDueDays'
    )
    .populate('transactionDetails', 'paymentStatus transactionDate');

  if (!orders.length)
    throw new ApiError(404, 'No orders match the given criteria');

  return {
    orders,
    currentPage: pageNumber,
    totalPages,
    totalOrders,
  };
};

const getAllPartnerOrdersService = async ({
  partnerId,
  page = 1,
  limit = 10,
  sortBy = 'orderDate',
  sortOrder = 'desc',
  orderStatus,
}) => {
  // Construct filter based on query parameters
  const filter = { partnerId };
  if (orderStatus) filter.orderStatus = orderStatus;

  // Calculate pagination
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  // Fetch total count of orders
  const totalOrders = await Order.countDocuments(filter);
  if (!totalOrders) throw new ApiError(404, 'No orders found for this partner');

  // Calculate total pages
  const totalPages = Math.ceil(totalOrders / limitNumber);

  // Fetch orders with filter, sorting, and pagination
  const orders = await Order.find(filter)
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(limitNumber)
    .populate(
      'WarehouseDetail',
      'name location partnerName WarehouseStatus paymentDueDays'
    )
    .populate('transactionDetails', 'paymentStatus transactionDate');

  if (!orders.length)
    throw new ApiError(404, 'No orders match the given criteria');

  return {
    orders,
    currentPage: pageNumber,
    totalPages,
    totalOrders,
  };
};

const orderStaticService = async () => {
  try {
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

    // Today's completed bookings
    const todayBooking = await Order.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      orderStatus: 'Completed', // Filter by completed status
    });

    // Month's completed bookings
    const monthBooking = await Order.countDocuments({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      orderStatus: 'Completed', // Filter by completed status
    });

    // Weekly completed bookings (completed status)
    const weeklyBooking = await Order.countDocuments({
      orderStatus: 'Completed', // Filter by completed status
    });

    // Yearly completed bookings (completed status)
    const yearlyBooking = await Order.countDocuments({
      createdAt: { $gte: startOfYear, $lte: endOfYear },
      orderStatus: 'Completed', // Filter by completed status
    });

    // Return statistics
    return {
      todayBooking,
      monthBooking,
      weeklyBooking,
      yearlyBooking,
    };
  } catch (error) {
    console.error('Error fetching order statistics:', error);
    throw new Error('Failed to fetch order statistics');
  }
};

const getRecentOrderService = async () => {
  try {
    const orders = await Order.find()
      .sort({ orderDate: -1 }) // Ascending order
      .limit(10)
      .populate(
        'WarehouseDetail',
        'name location partnerName WarehouseStatus paymentDueDays'
      )
      .populate('customerDetails', 'name phone');

    return orders;
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    throw new Error('Failed to fetch recent orders');
  }
};

export {
  createOrderService,
  getAllUserOrdersService,
  getOrderDetailService,
  getAllWarehouseOrdersService,
  getAllPartnerOrdersService,
  orderStaticService,
  getRecentOrderService,
};
