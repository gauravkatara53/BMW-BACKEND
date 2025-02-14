import Queue from 'bull';
import mongoose from 'mongoose';
import { Order } from '../models/orderModel.js';
import { Transaction } from '../models/transactionModel.js';
import { ApiError } from '../utils/ApiError.js';

// Initialize the payment queue with dynamic Redis config
const redisConfig = {
  url: process.env.REDIS_URL,
  tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined, // Enable TLS for secure Redis connection
};

const rentPaymentQueue = new Queue('paymentQueue', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
// Process payment status update jobs
rentPaymentQueue.process(async (job) => {
  const { orderId, transactionId } = job.data;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Fetch order and transaction details
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new ApiError(404, `Order with ID ${orderId} not found`);

    const transaction =
      await Transaction.findById(transactionId).session(session);
    if (!transaction)
      throw new ApiError(400, `Transaction with ID ${transactionId} not found`);

    // If payment status is 'Pending' or 'Failed', revert the monthly payment status to 'Unpaid'
    if (
      transaction.paymentStatus === 'Pending' ||
      transaction.paymentStatus === 'Failed'
    ) {
      // Find the corresponding monthRentId in the order's monthlyPayment array
      const monthRentId = transaction.monthRentId;

      await Order.updateOne(
        { _id: orderId, 'monthlyPayment._id': monthRentId },
        { $set: { 'monthlyPayment.$.paymentStatus': 'Unpaid' } },
        { session }
      );

      await Transaction.findByIdAndUpdate(
        transactionId,
        { paymentStatus: 'Failed' },
        { session }
      );

      console.log(
        `Transaction ${transactionId} failed. MonthRent ${monthRentId} set to 'Unpaid' in Order ${orderId}.`
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

export { rentPaymentQueue };
