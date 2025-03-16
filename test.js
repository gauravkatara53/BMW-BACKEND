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
