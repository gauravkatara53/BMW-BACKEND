import Queue from 'bull';
import mongoose from 'mongoose';
import { Order } from '../models/orderModel.js';
import { Warehouse } from '../models/warehouseModel.js';
import { Transaction } from '../models/transactionModel.js';
import { ApiError } from '../utils/ApiError.js';

// Initialize the payment queue with dynamic Redis config
const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

const paymentQueue = new Queue('paymentQueue', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times before marking failed
    backoff: { type: 'exponential', delay: 5000 }, // Exponential backoff for retries
    removeOnComplete: true,
    removeOnFail: false, // Keep failed jobs for debugging
  },
});

// Process payment status update jobs
paymentQueue.process(async (job) => {
  const { orderId, warehouseId, transactionId } = job.data;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Fetch order, warehouse, and transaction details
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new ApiError(404, `Order with ID ${orderId} not found`);

    const warehouse = await Warehouse.findById(warehouseId).session(session);
    if (!warehouse)
      throw new ApiError(404, `Warehouse with ID ${warehouseId} not found`);

    const transaction =
      await Transaction.findById(transactionId).session(session);
    if (!transaction)
      throw new ApiError(400, `Transaction with ID ${transactionId} not found`);

    // If payment status is 'Pending' or 'Failed', update order and transaction status
    if (
      transaction.paymentStatus === 'Pending' ||
      transaction.paymentStatus === 'Failed'
    ) {
      await Order.findByIdAndUpdate(
        orderId,
        { orderStatus: 'Failed' },
        { _id: orderId, 'monthlyPayment._id': monthRentId },
        { $set: { 'monthlyPayment.$.paymentStatus': 'Unpaid' } },
        { session }
      );

      await Warehouse.findByIdAndUpdate(
        warehouseId,
        { WarehouseStatus: 'Available' },

        { session }
      );

      await Transaction.findByIdAndUpdate(
        transactionId,
        { paymentStatus: 'Failed' },
        { session }
      );

      console.log(
        `Order ${orderId} and Payment ${transactionId} marked as failed.`
      );
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();

    console.error(
      `Error processing payment status for Order ${orderId}:`,
      error
    );

    // If all retries fail, consider sending an alert or moving job to a dead-letter queue
    if (job.attemptsMade >= 3) {
      console.error(
        `Job ${job.id} failed after multiple retries. Consider manual intervention.`
      );
      // Send alert to monitoring system (e.g., Sentry, Datadog, Slack)
    }

    throw error; // Let Bull retry automatically
  } finally {
    session.endSession();
  }
});

export { paymentQueue };
