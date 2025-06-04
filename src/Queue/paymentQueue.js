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
    console.log(`📌 Starting job for OrderID: ${orderId}`);

    const order = await Order.findById(orderId).session(session);
    if (!order) throw new ApiError(404, `Order with ID ${orderId} not found`);

    const warehouse = await Warehouse.findById(warehouseId).session(session);
    if (!warehouse)
      throw new ApiError(404, `Warehouse with ID ${warehouseId} not found`);

    const transaction =
      await Transaction.findById(transactionId).session(session);
    if (!transaction)
      throw new ApiError(400, `Transaction with ID ${transactionId} not found`);

    console.log(`🧾 Transaction Status: ${transaction.paymentStatus}`);
    console.log(
      `🏢 Order Type: ${order.monthlyPayment?.length > 0 ? 'Rent' : 'Sell'}`
    );

    if (
      transaction.paymentStatus === 'Pending' ||
      transaction.paymentStatus === 'Failed'
    ) {
      // ✅ Always mark order as failed
      await Order.findByIdAndUpdate(
        orderId,
        { orderStatus: 'Failed' },
        { session }
      );
      console.log(`❗ Order ${orderId} marked as Failed`);

      // ✅ Conditionally update monthly payment for Rent orders
      if (order.monthlyPayment?.length > 0 && transaction.monthRentId) {
        const paymentUpdateResult = await Order.updateOne(
          { _id: orderId, 'monthlyPayment._id': transaction.monthRentId },
          { $set: { 'monthlyPayment.$.paymentStatus': 'Unpaid' } },
          { session }
        );
        console.log(
          `💰 Monthly payment status updated to Unpaid:`,
          paymentUpdateResult.modifiedCount
        );
      } else {
        console.log(
          'ℹ️ Skipping monthly payment update: Not a rent order or no monthRentId'
        );
      }

      // ✅ Update warehouse status
      await Warehouse.findByIdAndUpdate(
        warehouseId,
        { WarehouseStatus: 'Available' },
        { session }
      );
      console.log(`📦 Warehouse ${warehouseId} marked as Available`);

      // ✅ Update transaction status
      await Transaction.findByIdAndUpdate(
        transactionId,
        { paymentStatus: 'Failed' },
        { session }
      );
      console.log(`💳 Transaction ${transactionId} marked as Failed`);
    } else {
      console.log(
        `✅ Transaction status is already ${transaction.paymentStatus}, no action taken.`
      );
    }

    await session.commitTransaction();
    console.log(`✅ Job completed successfully for OrderID: ${orderId}`);
  } catch (error) {
    await session.abortTransaction();
    console.error(
      `❌ Error processing payment status for Order ${orderId}:`,
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
  await agenda.schedule('in 1 minute', 'processPaymentStatus', {
    orderId,
    warehouseId,
    transactionId,
  });
};
