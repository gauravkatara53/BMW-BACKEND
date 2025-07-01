import {
  createWarehouseService,
  uploadImageService,
  deleteWarehouseDetailService,
  getWarehouseDetail,
  changeWarehouseStatus,
  allWarehouse,
  getAllWarehousePartner,
  warehouseStaticService,
} from '../services/warehouseService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Warehouse } from '../models/warehouseModel.js';
import { Partner } from '../models/partnerModel.js';
import { User } from '../models/userModel.js';
import { Order } from '../models/orderModel.js';
import { getCache, setCache } from '../utils/cache.js';

const createWarehouse = asyncHandler(async (req, res) => {
  const createdWarehouse = await createWarehouseService(req); // Remove res from here
  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        createdWarehouse,
        'Warehouse registered successfully'
      )
    );
});

const uploadImageController = asyncHandler(async (req, res) => {
  await uploadImageService(req, res);
});

const deleteWarehouseDetailController = asyncHandler(async (req, res) => {
  const { id } = req.params; // Extract the ID from params

  const deletedWarehouse = await deleteWarehouseDetailService(id); // Call the service with the ID

  return res
    .status(200)
    .json(
      new ApiResponse(200, deletedWarehouse, 'Warehouse deleted successfully.')
    );
});

// get warehouse after adding cache
const getWarehouseDetailController = asyncHandler(async (req, res) => {
  const warehouseId = req.params.id || req.query.id || req.body.id;

  if (!warehouseId) {
    throw new ApiError(400, 'Warehouse ID is required.');
  }

  const cacheKey = `warehouse-detail-${warehouseId}`;

  // 1. Try cache
  let warehouseData = getCache(cacheKey);

  if (!warehouseData) {
    // 2. Fetch if not cached
    const warehouseDoc = await getWarehouseDetail(req); // Mongoose document

    // ✅ 3. Convert to plain object to prevent clone error
    warehouseData = warehouseDoc.toObject();

    // 4. Store in cache (10 min)
    setCache(cacheKey, warehouseData, 600);
  }

  // 5. Return response
  return res
    .status(200)
    .json(
      new ApiResponse(200, warehouseData, 'Warehouse fetched successfully.')
    );
});

const changeWarehouseStatusController = asyncHandler(async (req, res) => {
  // Call the service with the entire request object
  const updatedWarehouse = await changeWarehouseStatus(req);

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedWarehouse, 'Warehouse updated successfully.')
    );
});

const allWarehouseController = asyncHandler(async (req, res) => {
  let {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    category,
    WarehouseStatus,
    search, // Search query from the request
    startDate, // Start date for filtering from the request
    endDate, // End date for filtering from the request
    rentOrSell,
  } = req.query;

  // Parse `page` and `limit` as integers
  page = parseInt(page, 10);
  limit = parseInt(limit, 10);

  // Validate and log startDate and endDate
  const isValidDate = (date) => !isNaN(new Date(date).getTime());

  if (startDate && !isValidDate(startDate)) {
    return res.status(400).json({ message: 'Invalid startDate format' });
  }

  if (endDate && !isValidDate(endDate)) {
    return res.status(400).json({ message: 'Invalid endDate format' });
  }

  // Convert startDate and endDate to Date objects for filtering
  const start = startDate ? new Date(startDate) : undefined;
  const end = endDate ? new Date(endDate) : undefined;

  // Log the received parameters for debugging
  console.log('Request Query:', {
    page,
    limit,
    sortBy,
    sortOrder,
    category,
    WarehouseStatus,
    search,
    startDate,
    endDate,
    rentOrSell,
  });

  try {
    // Call the service to get the warehouses with filters and search functionality
    const { warehouses, totalWarehouses } = await allWarehouse({
      page,
      limit,
      sortBy,
      sortOrder,
      category,
      WarehouseStatus,
      search,
      start,
      end,
      rentOrSell,
    });

    // Log the filtered results and meta information
    // console.log('Filtered Warehouses:', warehouses);
    // console.log('Total Warehouses:', totalWarehouses);

    // Return the response with pagination metadata
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          warehouses,
          totalWarehouses,
          currentPage: page,
          limit,
          totalPages: Math.ceil(totalWarehouses / limit),
        },
        'Warehouses fetched successfully.'
      )
    );
  } catch (error) {
    console.error('Error fetching warehouses:', error.message);
    return res
      .status(500)
      .json({ message: 'Failed to fetch warehouses', error: error.message });
  }
});

const getAllPartnerWarehouseController = asyncHandler(async (req, res) => {
  try {
    const allWarehouses = await getAllWarehousePartner(req);
    return res.status(200).json(new ApiResponse(200, allWarehouses));
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

const getCardDetaiWarehouse = asyncHandler(async (req, res) => {
  try {
    // Call the service function to get statistics
    console.log('Fetching warehouse stats...');
    const {
      totalWarehouses,
      availableWarehouse,
      rentedWarehouse,
      soldWarehouse,
    } = await warehouseStaticService();

    // Respond with the data
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          totalWarehouses,
          availableWarehouse,
          rentedWarehouse,
          soldWarehouse,
        },
        'Warehouse stats fetched successfully.'
      )
    );
  } catch (error) {
    // Handle errors
    console.error('Error in getCardDetaiWarehouse:', error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, 'Failed to fetch Warehouse details.'));
  }
});

const featuredWarehouse = asyncHandler(async (req, res) => {
  try {
    // Get rentOrSell filter from query params, default to both Rent and Sell if not specified
    const rentOrSellFilter = req.query.rentOrSell
      ? [req.query.rentOrSell]
      : ['Rent', 'Sell'];

    // Find extra premium partners first
    const extraPremiumPartners = await Partner.find({
      status: 'extra premium',
    }).select('_id');

    // Find premium partners
    const premiumPartners = await Partner.find({
      status: 'premium',
    }).select('_id');

    // Get warehouse listings from extra premium partners
    const extraPremiumWarehouses = await Warehouse.find({
      partner: { $in: extraPremiumPartners.map((p) => p._id) },
      WarehouseStatus: 'Available',
      rentOrSell: { $in: rentOrSellFilter },
    })
      .populate('partnerName', 'name email phone status')
      .sort({ createdAt: -1 });

    // Get warehouse listings from premium partners
    const premiumWarehouses = await Warehouse.find({
      partner: { $in: premiumPartners.map((p) => p._id) },
      WarehouseStatus: 'Available',
      rentOrSell: { $in: rentOrSellFilter },
    })
      .populate('partnerName', 'name email phone status')
      .sort({ createdAt: -1 });

    // Combine the results with extra premium first
    const featuredWarehouses = [
      ...extraPremiumWarehouses,
      ...premiumWarehouses,
    ];

    // If no warehouses found, try getting all available warehouses
    if (!featuredWarehouses.length) {
      const allAvailableWarehouses = await Warehouse.find({
        WarehouseStatus: 'Available',
        rentOrSell: { $in: rentOrSellFilter },
      })
        .populate('partnerName', 'avatar name email phone status')
        .sort({ createdAt: -1 })
        .limit(10); // Limit to 10 warehouses as fallback

      if (allAvailableWarehouses.length) {
        return res
          .status(200)
          .json(
            new ApiResponse(
              200,
              allAvailableWarehouses,
              'Available warehouses fetched successfully'
            )
          );
      }
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          featuredWarehouses,
          'Featured warehouses fetched successfully'
        )
      );
  } catch (error) {
    console.error('Error in featuredWarehouse:', error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, 'Failed to fetch featured warehouses'));
  }
});

const checkCurrentUserWarehouse = async (req, res, next) => {
  try {
    const warehouseId = req.params.id;

    if (!warehouseId) {
      throw new ApiError(400, 'Warehouse ID is required.');
    }

    // Find all active orders for this warehouse (endDate > now)
    const activeOrders = await Order.find({
      WarehouseDetail: warehouseId,
      endDate: { $gt: new Date() }, // Active orders only
    });

    if (!activeOrders.length) {
      throw new ApiError(404, 'No active order found for the given warehouse.');
    }

    // Pick the first active order (or you can decide logic to pick)
    const order = activeOrders[0];

    if (!order.customerDetails) {
      throw new ApiError(404, 'Customer information not found in order.');
    }

    const customerDetail = await User.findById(order.customerDetails);

    if (!customerDetail) {
      throw new ApiError(404, 'Customer not found.');
    }

    // Remove sensitive info
    const { password, refreshToken, ...safeCustomer } =
      customerDetail.toObject();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          safeCustomer,
          'Active order customer details fetched successfully'
        )
      );
  } catch (error) {
    next(error);
  }
};

const historyListWarehouse = asyncHandler(async (req, res) => {
  const warehouseId = req.params.id;

  if (!warehouseId) {
    throw new ApiError(400, 'Warehouse ID is required.');
  }

  // Find all orders for the warehouse, populate customer details
  const orders = await Order.find({ WarehouseDetail: warehouseId })
    .populate('customerDetails', '-password -refreshToken') // exclude sensitive fields
    .select('customerDetails startDate endDate'); // only select these fields

  if (!orders.length) {
    throw new ApiError(404, 'No orders found for the given warehouse.');
  }

  // Format response: map to a simpler structure
  const history = orders.map((order) => ({
    customer: order.customerDetails,
    startDate: order.startDate,
    endDate: order.endDate,
  }));

  return res.status(200).json({
    status: 200,
    data: history,
    message: `Order history for warehouse ${warehouseId} fetched successfully`,
  });
});

export {
  createWarehouse,
  uploadImageController,
  deleteWarehouseDetailController,
  getWarehouseDetailController,
  changeWarehouseStatusController,
  allWarehouseController,
  getAllPartnerWarehouseController,
  getCardDetaiWarehouse,
  featuredWarehouse,
  checkCurrentUserWarehouse,
  historyListWarehouse,
};
