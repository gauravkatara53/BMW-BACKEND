import { agenda } from './agenda.js';
import mongoose from 'mongoose';
import { Order } from '../models/orderModel.js';
import { Transaction } from '../models/transactionModel.js';
import { ApiError } from '../utils/ApiError.js';

agenda.define('processRentPayment', async (job) => {
  const { orderId, transactionId } = job.attrs.data;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const order = await Order.findById(orderId).session(session);
    if (!order) throw new ApiError(404, `Order with ID ${orderId} not found`);

    const transaction =
      await Transaction.findById(transactionId).session(session);
    if (!transaction)
      throw new ApiError(400, `Transaction with ID ${transactionId} not found`);

    if (
      transaction.paymentStatus === 'Pending' ||
      transaction.paymentStatus === 'Failed'
    ) {
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
    throw error;
  } finally {
    session.endSession();
  }
});

export const scheduleRentPaymentJob = async (orderId, transactionId) => {
  await agenda.schedule('in 5 minutes', 'processRentPayment', {
    orderId,
    transactionId,
  });
};
