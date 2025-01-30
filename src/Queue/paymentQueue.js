import Queue from 'bull';
import { Order } from '../models/orderModel.js';
import { Warehouse } from '../models/warehouseModel.js';
import { Transaction } from '../models/transactionModel.js';
import { ApiError } from '../utils/ApiError.js';

// Initialize the payment queue with dynamic Redis config
const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

const paymentQueue = new Queue('paymentQueue', { redis: redisConfig });

// Process payment status update jobs
paymentQueue.process(async (job) => {
  const { orderId, warehouseId, transactionId } = job.data;

  try {
    // Fetch order, warehouse, and transaction details
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, `Order with ID ${orderId} not found`);
    }

    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) {
      throw new ApiError(404, `Warehouse with ID ${warehouseId} not found`);
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      throw new ApiError(400, `Transaction with ID ${transactionId} not found`);
    }

    // If payment status is still pending, mark both order and transaction as failed
    if (transaction.paymentStatus === 'Pending' || 'Failed') {
      // Update Booking status to 'Failed'
      await Order.findByIdAndUpdate(
        orderId,
        { orderStatus: 'Failed' },
        { new: true }
      );
      await Warehouse.findByIdAndUpdate(
        warehouseId,
        {
          WarehouseStatus: 'Available',
        },
        { new: true }
      );

      // Update Payment status to 'Failed'
      await Transaction.findByIdAndUpdate(
        transactionId,
        { paymentStatus: 'Failed' },
        { new: true }
      );

      console.log(
        `order ${orderId} and Payment ${transactionId} marked as failed`
      );
    }
  } catch (error) {
    console.error(
      `Error processing payment status for Order ${orderId}:`,
      error
    );

    // Optionally retry the job if necessary (up to 3 attempts)
    if (job.attemptsMade < 3) {
      throw error; // Fail the job and it will retry
    }

    // If retry limit is reached, consider logging or notifying the failure
  }
});

// Export the payment queue for other modules to use
export { paymentQueue };
