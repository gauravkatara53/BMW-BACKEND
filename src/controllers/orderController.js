import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Warehouse } from '../models/warehouseModel.js';
import {
  createOrderService,
  getAllUserOrdersService,
  getOrderDetailService,
  getAllPartnerOrdersService,
  getAllWarehouseOrdersService,
  orderStaticService,
  getRecentOrderService,
} from '../services/orderService.js';
import { Order } from '../models/orderModel.js';

const createOrder = asyncHandler(async (req, res) => {
  const { id: warehouseId } = req.params;
  console.log('Warehouse ID:', req.params.id);

  const { duration } = req.body || {}; // Safely destructure duration

  const session = await mongoose.startSession();
  session.startTransaction();
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
  let transactionCommitted = false;

  try {
    // Fetch the warehouse to check its rentOrSell status
    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) throw new ApiError(404, 'Warehouse not found');

    // Enforce rules for rentOrSell status
    if (warehouse.rentOrSell === 'Rent' && (!duration || duration <= 0)) {
      throw new ApiError(
        400,
        'Duration is required and must be greater than 0 for renting a warehouse'
      );
    }

    if (warehouse.rentOrSell === 'Sell' && duration) {
      throw new ApiError(
        400,
        'Duration is not allowed for selling a warehouse'
      );
    }

    // Call the service to create the order
    const { order, razorpayOrder, transaction } = await createOrderService(
      warehouseId,
      warehouse.rentOrSell === 'Rent' ? duration : null, // Pass duration only for Rent
      req.user,
      session
    );

    // Commit transaction
    await session.commitTransaction();
    transactionCommitted = true;

    const populatedOrder = await Order.findById(order._id)
      .populate('WarehouseDetail', 'name location paymentDueDays')
      .populate('customerDetails', 'name email phone address')
      .populate('partnerDetails', 'name email phone address');

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          order: populatedOrder,
          payment: {
            razorpayOrderId: razorpayOrder.id,
            transactionId: transaction._id,
          },
        },
        'Order created successfully'
      )
    );
  } catch (error) {
    if (!transactionCommitted) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    session.endSession();
  }
});

const getAllOrderUser = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      searchTerm,
      orderStatus,
      warehouseId,
      startDate,
      endDate,
      rentOrSell,
    } = req.query;
    const { _id: userId } = req.user;

    // Call the service function and pass parameters
    const { orders, currentPage, totalPages, totalOrders } =
      await getAllUserOrdersService({
        userId,
        page,
        limit,
        sortBy,
        sortOrder,
        orderStatus,
        warehouseId,
        searchTerm,
        startDate,
        endDate,
        rentOrSell,
      });

    // Send success response
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          orders,
          currentPage,
          limit,
          totalPages,
          totalOrders,
        },
        'Orders fetched successfully'
      )
    );
  } catch (error) {
    next(error); // Pass to error-handling middleware
  }
};

const getOrderDetail = async (req, res, next) => {
  try {
    const { orderId } = req.params; // Extract orderId from request parameters
    console.log(orderId);
    // Fetch order details using the service
    const order = await getOrderDetailService(orderId);

    // Send success response
    return res
      .status(200)
      .json(
        new ApiResponse(200, { order }, 'Order details fetched successfully')
      );
  } catch (error) {
    next(error); // Pass errors to the error-handling middleware
  }
};

const getAllWarehouseOrdersController = async (req, res) => {
  try {
    const { warehouseId } = req.params; // Assuming warehouseId is passed in the URL params
    const { page, limit, sortBy, sortOrder, orderStatus } = req.query; // Optional query parameters

    // Call the service to get orders for the warehouse
    const result = await getAllWarehouseOrdersService({
      warehouseId,
      page,
      limit,
      sortBy,
      sortOrder,
      orderStatus,
    });

    // Return the orders as the response

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          orders: result.orders,
          pagination: {
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            totalOrders: result.totalOrders,
          },
        },
        'Orders fetched successfully'
      )
    );
  } catch (error) {
    // Handle errors and send appropriate response
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

const getAllPartnerOrdersController = async (req, res) => {
  try {
    const { partnerId } = req.partner; // Assuming partnerId is passed in the URL params
    const { page, limit, sortBy, sortOrder, orderStatus } = req.query; // Optional query parameters

    // Call the service to get orders for the partner
    const result = await getAllPartnerOrdersService({
      partnerId,
      page,
      limit,
      sortBy,
      sortOrder,
      orderStatus,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          orders: result.orders,
          pagination: {
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            totalOrders: result.totalOrders,
          },
        },
        'Orders fetched successfully'
      )
    );
  } catch (error) {
    // Handle errors and send appropriate response
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};
const getAllOrders = async (req, res) => {
  const {
    warehouseId,
    page = 1,
    limit = 10,
    sortBy = 'orderDate',
    sortOrder = 'desc',
    orderStatus,
    search,
  } = req.query;

  try {
    const filter = {};
    if (warehouseId) filter.WarehouseDetail = warehouseId;
    if (orderStatus) filter.orderStatus = orderStatus;

    // Add search functionality
    if (search) {
      const searchRegex = new RegExp(search, 'i'); // Case-insensitive search
      filter.$or = [
        { orderId: searchRegex },
        { 'partnerDetails.name': searchRegex },
        { 'customerDetails.name': searchRegex },
        { 'WarehouseDetail.name': searchRegex },
      ];
    }

    console.log('Executing search for:', search);
    console.log('Filter:', JSON.stringify(filter, null, 2));

    // Pagination logic
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Fetch total count of orders
    const totalOrders = await Order.countDocuments(filter);
    if (totalOrders === 0) {
      throw new ApiError(404, 'No orders found for this warehouse');
    }

    // Fetch orders with filter, sorting, and pagination
    const orders = await Order.find(filter)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(limitNumber)
      .populate(
        'WarehouseDetail',
        'name location partnerName WarehouseStatus address city pincode state country'
      )
      .populate('transactionDetails', 'paymentStatus transactionDate')
      .populate('partnerDetails', 'name phone')
      .populate('customerDetails', 'name phone');

    if (!orders.length) {
      throw new ApiError(404, 'No orders match the given criteria');
    }

    // Return paginated response with orders
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          orders,
          currentPage: pageNumber,
          limit,
          totalPages: Math.ceil(totalOrders / limitNumber),
          totalOrders,
        },
        'Orders fetched successfully'
      )
    );
  } catch (error) {
    // Catch any errors and return with ApiError
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
};

const getCardDetailOrder = asyncHandler(async (req, res) => {
  try {
    console.log('Fetching order statistics...');

    // Call the service function
    const stats = await orderStaticService();

    // Respond with the fetched data
    return res
      .status(200)
      .json(
        new ApiResponse(200, stats, 'Order statistics fetched successfully.')
      );
  } catch (error) {
    console.error('Error in getCardDetailOrder:', error);

    // Handle errors gracefully
    return res
      .status(500)
      .json(new ApiResponse(500, null, 'Failed to fetch order details.'));
  }
});

const recentOdersController = asyncHandler(async (req, res) => {
  try {
    const orders = await getRecentOrderService();

    // Respond with the fetched data
    return res
      .status(200)
      .json(
        new ApiResponse(200, orders, 'Recent orders fetched successfully.')
      );
  } catch (error) {
    console.error('Error in recentOrdersController:', error);

    // Handle errors gracefully
    return res
      .status(500)
      .json(new ApiResponse(500, null, 'Failed to fetch recent orders.'));
  }
});

const allOrderOfPartner = asyncHandler(async (req, res) => {
  const { partnerId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!partnerId) {
    throw new ApiError(400, 'Partner ID is required');
  }

  const skip = (page - 1) * limit;

  // Fetch orders with pagination and sorting by most recent
  const orders = await Order.find({ partnerDetails: partnerId })
    .populate('WarehouseDetail', 'name location paymentDueDays rentOrSell ')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalOrders = await Order.countDocuments({ partnerDetails: partnerId });

  if (!orders || orders.length === 0) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, 'No orders found for this partner'));
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orders,
        totalOrders,
        page,
        limit,
        totalPages: Math.ceil(totalOrders / limit),
      },
      'Orders fetched successfully'
    )
  );
});

const allOrderOfUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!userId) {
    throw new ApiError(400, 'Partner ID is required');
  }

  const skip = (page - 1) * limit;

  // Fetch orders with pagination and sorting by most recent
  const orders = await Order.find({ customerDetails: userId })
    .populate('WarehouseDetail', 'name location paymentDueDays rentOrSell ')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalOrders = await Order.countDocuments({ customerDetails: userId });

  if (!orders || orders.length === 0) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, 'No orders found for this partner'));
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orders,
        totalOrders,
        page,
        limit,
        totalPages: Math.ceil(totalOrders / limit),
      },
      'Orders fetched successfully'
    )
  );
});
const allOrderOfWarehouse = asyncHandler(async (req, res) => {
  const { warehouseId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!warehouseId) {
    throw new ApiError(400, 'Partner ID is required');
  }

  const skip = (page - 1) * limit;

  // Fetch orders with pagination and sorting by most recent
  const orders = await Order.find({ WarehouseDetail: warehouseId })
    .populate('WarehouseDetail', 'name location paymentDueDays rentOrSell ')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalOrders = await Order.countDocuments({
    WarehouseDetail: warehouseId,
  });

  if (!orders || orders.length === 0) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, 'No orders found for this partner'));
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orders,
        totalOrders,
        page,
        limit,
        totalPages: Math.ceil(totalOrders / limit),
      },
      'Orders fetched successfully'
    )
  );
});

export {
  createOrder,
  getAllOrderUser,
  getOrderDetail,
  getAllWarehouseOrdersController,
  getAllPartnerOrdersController,
  getAllOrders,
  getCardDetailOrder,
  recentOdersController,
  allOrderOfPartner,
  allOrderOfUser,
  allOrderOfWarehouse,
};
