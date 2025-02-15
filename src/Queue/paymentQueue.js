import { agenda } from './agenda.js';
import mongoose from 'mongoose';
import { Order } from '../models/orderModel.js';
import { Warehouse } from '../models/warehouseModel.js';
import { Transaction } from '../models/transactionModel.js';
import { ApiError } from '../utils/ApiError.js';

agenda.define('processPaymentStatus', async (job) => {
  const { orderId, warehouseId, transactionId } = job.attrs.data;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const order = await Order.findById(orderId).session(session);
    if (!order) throw new ApiError(404, `Order with ID ${orderId} not found`);

    const warehouse = await Warehouse.findById(warehouseId).session(session);
    if (!warehouse)
      throw new ApiError(404, `Warehouse with ID ${warehouseId} not found`);

    const transaction =
      await Transaction.findById(transactionId).session(session);
    if (!transaction)
      throw new ApiError(400, `Transaction with ID ${transactionId} not found`);

    if (
      transaction.paymentStatus === 'Pending' ||
      transaction.paymentStatus === 'Failed'
    ) {
      await Order.updateOne(
        { _id: orderId, 'monthlyPayment._id': transaction.monthRentId },
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
    throw error;
  } finally {
    session.endSession();
  }
});

export const schedulePaymentJob = async (
  orderId,
  warehouseId,
  transactionId
) => {
  await agenda.schedule('in 10 minute', 'processPaymentStatus', {
    orderId,
    warehouseId,
    transactionId,
  });
};
