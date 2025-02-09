import Razorpay from 'razorpay';
import { Order } from '../models/orderModel.js';
import { Warehouse } from '../models/warehouseModel.js';
import { Transaction } from '../models/transactionModel.js';
import { ApiError } from '../utils/ApiError.js';
import { paymentQueue } from '../Queue/paymentQueue.js';
import mongoose from 'mongoose';
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createOrderService = async (warehouseId, duration, user, session) => {
  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse) throw new ApiError(404, 'Warehouse not found');

  if (['Rented', 'Sold'].includes(warehouse.WarehouseStatus)) {
    throw new ApiError(400, 'Warehouse is not available');
  }

  // Calculate the base price and non-monthly price
  const basePrice = warehouse.monthlyAmount * duration;
  const nonMonthlyPrice = warehouse.subTotalPrice - warehouse.monthlyAmount;

  const subTotalPriceForRent = basePrice + nonMonthlyPrice;

  // Apply discount to total price
  const totalPriceForRent = subTotalPriceForRent;

  const totalPrice =
    warehouse.rentOrSell === 'Rent' ? totalPriceForRent : warehouse.totalPrice;

  // Generate monthly payment breakdown for rent orders
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
        month: ordinalMonths[i], // Use ordinal month names
        amount: monthlyAmount,
        paymentStatus: 'Unpaid',
      });
    }
  }

  const uniqueOrderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  // Create the order
  const order = await Order.create([
    {
      orderId: uniqueOrderId,
      orderStatus: 'Pending',
      orderDate: new Date(),
      duration,
      startDate: new Date(),
      endDate: duration
        ? new Date().setMonth(new Date().getMonth() + duration)
        : null,
      subTotalPrice:
        warehouse.rentOrSell == 'Rent'
          ? totalPriceForRent
          : warehouse.subTotalPrice,
      totalPrice:
        warehouse.rentOrSell == 'Rent'
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
      paymentDay: 5,
    },
  ]);

  const monthlyAmount = parseFloat((totalPrice / duration).toFixed(2));
  const transactionAmount =
    warehouse.rentOrSell === 'Rent' ? monthlyAmount : warehouse.totalPrice;

  const options = {
    amount: transactionAmount * 100, // Convert to paise (INR)
    currency: 'INR',
    receipt: `receipt_${Date.now()}`,
  };

  const razorpayOrder = await razorpay.orders.create(options);

  const transaction = await Transaction.create([
    {
      warehouseId,
      orderId: order[0]._id,
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

  await paymentQueue.add(
    {
      orderId: order[0]._id,
      warehouseId,
      transactionId: transaction[0]._id,
    },
    { delay: 300000 }
  );

};

const getAllUserOrdersService = async ({
  userId,
  page = 1,
  limit = 10,
  sortBy = 'orderDate',
  sortOrder = 'desc',
  orderStatus,
  warehouseId,
}) => {
  // Construct filter based on query parameters
  const filter = { customerDetails: userId };
  if (orderStatus) filter.orderStatus = orderStatus;
  if (warehouseId) filter.WarehouseDetail = warehouseId;

  // Calculate pagination
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  // Fetch total count of orders
  const totalOrders = await Order.countDocuments(filter);
  if (!totalOrders) throw new ApiError(404, 'No orders found');

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

const getOrderDetailService = async (orderId) => {
  // Log the incoming Order ID
  console.log('Received Order ID:', orderId);

  // Validate the Order ID format
  const isValidObjectId = mongoose.Types.ObjectId.isValid(orderId);
  if (!isValidObjectId) {
    throw new ApiError(400, 'Invalid Order ID format');
  }

  // Fetch the order with populated WarehouseDetail
  const order = await Order.findById(orderId)
    .populate(
      'WarehouseDetail',
      ' name location partnerName areaSqFt price discount WarehouseStatus paymentDueDays address city pincode state country'
      // 'name location partnerName WarehouseStatus address city pincode state country'
    )
    .populate('transactionDetails', 'paymentStatus transactionDate')
    .populate('partnerDetails', 'name')
    .populate('customerDetails', 'name phone');

  // Log the fetched order details for debugging
  console.log('Fetched Order:', order);

  // Handle case when the order is not found
  if (!order) {
    console.error(`Order not found for ID: ${orderId}`);
    throw new ApiError(404, 'Order not found');
  }

  // Handle case when referenced details are missing
  if (!order.WarehouseDetail) {
    console.error(`Warehouse details not found for Order ID: ${orderId}`);
    throw new ApiError(404, 'Warehouse details not found');
  }

  // Fetch the transaction details using the orderId
  const transaction = await Transaction.findOne({ orderId }).select(
    'transactionId transactionDate totalPrice paymentStatus razorpayOrderId razorpayPaymentId razorpaySignature'
  );

  // Handle case when transaction details are missing
  if (!transaction) {
    console.error(`Transaction details not found for Order ID: ${orderId}`);
    throw new ApiError(404, 'Transaction details not found');
  }

  // Return the order along with transaction details
  return { order, transaction };
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
