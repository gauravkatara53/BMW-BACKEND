import { Warehouse } from '../models/warehouseModel.js';
import { Partner } from '../models/partnerModel.js';
import { ApiError } from '../utils/ApiError.js'; // assuming you have a custom error handling class
import { ApiResponse } from '../utils/ApiResponse.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import crypto from 'crypto';
// import { Order } from '../models/orderModel.js';

const createWarehouseService = async (req) => {
  try {
    console.log('Request body received:', req.body);

    // Destructure and validate request body
    const {
      name,
      about,
      category,
      price,
      location,
      address,
      city,
      pincode,
      state,
      country,
      rooms,
      facility,
      nearestFacility,
      areaSqFt,
      rentOrSell,
      paymentDueDays,
    } = req.body;

    // Step 1: Generate Unique ID
    let coordinates = [];
    try {
      console.log('Raw location:', location);
      coordinates = JSON.parse(location).coordinates;
      console.log('Parsed coordinates:', coordinates);
    } catch (error) {
      console.error('Error parsing location:', error);
      throw new ApiError(400, 'Invalid location format.');
    }

    const uniqueString = `${name}${address}${city}${pincode}${coordinates.join(',')}${state}${country}`;
    const uniqueId = crypto
      .createHash('md5')
      .update(uniqueString)
      .digest('hex');

    // Step 2: Check for existing warehouse
    const existingWarehouse = await Warehouse.findOne({ uniqueId });
    if (existingWarehouse) {
      throw new ApiError(
        409,
        'A warehouse with similar details already exists.'
      );
    }

    // Step 3: Validate Price
    if (!Array.isArray(price)) {
      console.error('Price validation failed:', price);
      throw new ApiError(400, 'Price should be an array of objects.');
    }

    price.forEach((item, index) => {
      if (typeof item !== 'object' || !item.title || !item.amount) {
        console.error(`Invalid price item at index ${index}:`, item);
        throw new ApiError(
          400,
          `Price item at index ${index} must be an object with "title" and "amount" properties.`
        );
      }
    });

    // Step 5: Validate Rent-specific Rules
    if (rentOrSell === 'Rent' && (!paymentDueDays || paymentDueDays <= 30)) {
      console.error(
        'Payment due days validation failed for rent:',
        paymentDueDays
      );
      throw new ApiError(
        400,
        'Payment due days must be more than 30 for rent.'
      );
    }

    // Step 6: Calculate Prices
    let monthlyAmount = 0;
    let total = 0;

    if (rentOrSell === 'Rent') {
      monthlyAmount = price.reduce(
        (sum, priceItem) => sum + (priceItem.isMonthly ? priceItem.amount : 0),
        0
      );
    } else {
      total = price.reduce((sum, priceItem) => sum + priceItem.amount, 0);
    }
    let oneTimeAmount = 0;
    if (rentOrSell === 'Rent') {
      oneTimeAmount = price.reduce(
        (sum, priceItem) => sum + (!priceItem.isMonthly ? priceItem.amount : 0),
        0
      );
    }

    let subTotalPrice =
      rentOrSell === 'Rent' ? monthlyAmount + oneTimeAmount : total;
    let totalDiscount = 0;
    let totalPrice = subTotalPrice - totalDiscount;

    console.log('Prices calculated:', {
      subTotalPrice,
      totalDiscount,
      totalPrice,
    });

    // Step 7: Create Warehouse
    const partnerId = req.partner?._id || null;

    const warehouseData = {
      name,
      about,
      category,
      price,
      WarehouseStatus: 'Available',
      location: {
        type: 'Point',
        coordinates,
      },
      address,
      city,
      pincode,
      state,
      country,
      rooms,
      facility,
      nearestFacility,
      areaSqFt,
      rentOrSell,
      subTotalPrice,
      totalDiscount,
      totalPrice,
      paymentDueDays,
      partnerName: partnerId,
      uniqueId,
      monthlyAmount: rentOrSell === 'Rent' ? monthlyAmount : null,
      oneTimeAmount: rentOrSell == 'Rent' ? oneTimeAmount : null,
    };

    console.log('Warehouse data to create:', warehouseData);

    const warehouse = await Warehouse.create(warehouseData);

    console.log('Warehouse created successfully:', warehouse);

    // Step 8: Populate Partner Data
    const populatedWarehouse = await Warehouse.findById(warehouse._id).populate(
      'partnerName',
      '-refreshToken -password'
    );

    console.log('Populated warehouse:', populatedWarehouse);

    return populatedWarehouse;
  } catch (error) {
    console.error('Error in createWarehouseService:', error.message, error);
    throw new ApiError(
      error.statusCode || 500,
      error.message || 'Something went wrong while listing the warehouse'
    );
  }
};

const uploadImageService = async (req, res) => {
  try {
    // Fetch and update the warehouse using ID from the route
    const warehouseId = req.params.id;
    if (!warehouseId) {
      throw new ApiError(400, 'Warehouse ID is required.');
    }

    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) {
      throw new ApiError(404, 'Warehouse not found.');
    }

    // Upload thumbnail (if provided)
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;
    let thumbnail;
    if (thumbnailLocalPath) {
      thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
      if (!thumbnail) {
        throw new ApiError(500, 'Failed to upload thumbnail.');
      }
      // Update the thumbnail in the warehouse if it was uploaded
      warehouse.thumbnail = thumbnail.url;
    }

    // Upload images (if provided)
    const imagesLocalPaths = req.files?.images?.map((file) => file.path);
    let images = [];
    if (imagesLocalPaths && imagesLocalPaths.length > 0) {
      for (const imagePath of imagesLocalPaths) {
        const uploadedImage = await uploadOnCloudinary(imagePath);
        if (!uploadedImage) {
          throw new ApiError(500, `Failed to upload image: ${imagePath}`);
        }
        images.push(uploadedImage);
      }
      // Add the new images to the existing ones in the warehouse
      warehouse.images = [...warehouse.images, ...images.map((img) => img.url)];
    }

    // Save the updated warehouse
    await warehouse.save();

    return res
      .status(200)
      .json(new ApiResponse(200, warehouse, 'Images updated successfully.'));
  } catch (error) {
    console.error('Error in uploadImageService:', error.message);
    throw new ApiError(error.statusCode || 500, error.message);
  }
};

const deleteWarehouseDetailService = async (id) => {
  if (!id) {
    throw new ApiError(400, 'Warehouse ID is required');
  }

  const warehouse = await Warehouse.findById(id);

  if (!warehouse) {
    throw new ApiError(404, 'Warehouse not found');
  }

  // Delete the warehouse
  await Warehouse.findByIdAndDelete(id);

  return warehouse;
};

const getWarehouseDetail = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new ApiError(400, 'Warehouse ID is required.');
  }

  // Await the findById call to fetch the warehouse
  const warehouse = await Warehouse.findById(id).populate(
    'partnerName',
    '-refreshToken -password'
  );

  // If no warehouse is found, throw an error
  if (!warehouse) {
    throw new ApiError(404, 'Warehouse not found.');
  }

  return warehouse;
};

const changeWarehouseStatus = async (req) => {
  const { id } = req.params;
  if (!id) {
    throw new ApiError(400, 'Warehouse ID is required.');
  }

  const { WarehouseStatus } = req.body;
  if (!WarehouseStatus) {
    throw new ApiError(400, 'At least one field is required to update');
  }

  // Update the warehouse status
  const warehouse = await Warehouse.findByIdAndUpdate(
    id,
    {
      $set: {
        WarehouseStatus: WarehouseStatus,
      },
    },
    { new: true }
  ).select('-password');

  if (!warehouse) {
    throw new ApiError(404, 'Warehouse not found');
  }

  return warehouse;
};

const getAllWarehousePartner = async (req) => {
  const partnerId = req.partner?._id;
  if (!partnerId) {
    throw new ApiError(400, 'Partner ID is required');
  }

  const partner = await Partner.findById(partnerId);
  if (!partner) {
    throw new ApiError(404, 'Partner not found');
  }

  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    category,
    WarehouseStatus,
  } = req.query;

  // Construct filter based on query parameters
  const filter = {
    partnerName: partnerId, // Ensure filtering by signed-in partner
  };

  if (category) filter.category = category;
  if (WarehouseStatus) filter.WarehouseStatus = WarehouseStatus;

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  const totalWarehouses = await Warehouse.countDocuments(filter);
  const totalPages = Math.ceil(totalWarehouses / limitNumber);

  const warehouses = await Warehouse.find(filter)
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(limitNumber)
    .populate('partnerName', '-refreshToken -password');

  return {
    warehouses,
    currentPage: pageNumber,
    totalPages,
    totalWarehouses,
  };
};

const allWarehouse = async ({
  page,
  limit,
  sortBy,
  sortOrder,
  category,
  WarehouseStatus,
  search, // Enhanced search parameter
  start, // Start date for filtering
  end, // End date for filtering
  rentOrSell, // Rent or Sell filter
}) => {
  // Construct filters based on query parameters
  const filters = {};
  if (category) filters.category = category;
  if (WarehouseStatus) filters.WarehouseStatus = WarehouseStatus;
  if (rentOrSell) filters.rentOrSell = rentOrSell; // Adding Rent or Sell filter

  // Enhanced search logic
  if (search) {
    const searchTerms = search.split(' ').filter(Boolean); // Split input into words

    filters.$and = searchTerms.map((term) => {
      const regex = new RegExp(term, 'i'); // Case-insensitive regex
      return {
        $or: [
          { name: { $regex: regex } },
          { category: { $regex: regex } },
          { address: { $regex: regex } },
          { city: { $regex: regex } },
          { state: { $regex: regex } },
          { country: { $regex: regex } },
          { uniqueId: { $regex: regex } },
          { discount: { $regex: regex } },
          { 'partnerName.name': { $regex: regex } },
          { 'partnerName.email': { $regex: regex } },
          { 'partnerName.username': { $regex: regex } },
          { 'facility.name': { $regex: regex } },
          { 'nearestFacility.name': { $regex: regex } },
          { 'nearestFacility.value': { $regex: regex } },
          { 'rooms.name': { $regex: regex } },
          ...(isNaN(Number(term))
            ? []
            : [{ pincode: Number(term) }, { 'price.amount': Number(term) }]),
        ],
      };
    });
  }

  // Add date range filter (if provided)
  if (start || end) {
    filters.createdAt = {};
    if (start) filters.createdAt.$gte = new Date(start);
    if (end) filters.createdAt.$lte = new Date(end);
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Fetch warehouses with filters, sorting, and pagination
  const warehouses = await Warehouse.find(filters)
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(Number(limit))
    .populate('partnerName', '-refreshToken -password');

  // Fetch total count for pagination metadata
  const totalWarehouses = await Warehouse.countDocuments(filters);

  return {
    warehouses,
    totalWarehouses,
    currentPage: page,
    limit,
    totalPages: Math.ceil(totalWarehouses / limit),
  };
};

const warehouseStaticService = async () => {
  try {
    // Ensure Warehouse model is imported correctly
    const totalWarehouses = await Warehouse.countDocuments();
    console.log('Total Warehouses:', totalWarehouses);

    // Use the correct query to filter active Warehouse
    const availableWarehouse = await Warehouse.countDocuments({
      WarehouseStatus: 'Available',
    });
    console.log('Available Warehouses:', availableWarehouse);

    const rentedWarehouse = await Warehouse.countDocuments({
      WarehouseStatus: 'Rented',
    });
    console.log('Rented Warehouses:', rentedWarehouse);

    const soldWarehouse = await Warehouse.countDocuments({
      WarehouseStatus: 'Sold',
    });
    console.log('Sold Warehouses:', soldWarehouse);

    // Return the computed values
    return {
      totalWarehouses,
      availableWarehouse,
      rentedWarehouse,
      soldWarehouse,
    };
  } catch (error) {
    console.error('Error fetching warehouse statistics:', error);
    throw new Error('Failed to fetch warehouse statistics');
  }
};




export {
  createWarehouseService,
  uploadImageService,
  deleteWarehouseDetailService,
  getWarehouseDetail,
  changeWarehouseStatus,
  allWarehouse,
  getAllWarehousePartner,
  warehouseStaticService,
};
