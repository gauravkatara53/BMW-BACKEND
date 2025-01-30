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
const getWarehouseDetailController = asyncHandler(async (req, res) => {
  const getWarehouse = await getWarehouseDetail(req); // Call the service with the ID

  return res
    .status(200)
    .json(
      new ApiResponse(200, getWarehouse, 'Warehouse feteched successfully.')
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

export {
  createWarehouse,
  uploadImageController,
  deleteWarehouseDetailController,
  getWarehouseDetailController,
  changeWarehouseStatusController,
  allWarehouseController,
  getAllPartnerWarehouseController,
  getCardDetaiWarehouse,
};
