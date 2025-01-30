import cron from 'node-cron';
import { Order } from '../models/orderModel.js';

// Cron job to run every day at midnight and directly decrement paymentDueDays
cron.schedule('0 0 * * *', async () => {
  try {
    // Fetch all orders that have paymentDueDays and warehouse status 'rent'
    const orders = await Order.find({
      'WarehouseDetail.paymentDueDays': { $gt: 0 },
      'WarehouseDetail.rentOrSell': 'Rent',
    });

    // Process each order and decrement paymentDueDays
    for (const order of orders) {
      // Check if the paymentDueDays is greater than 0
      let paymentDueDays = order.WarehouseDetail.paymentDueDays;
      if (paymentDueDays > 0) {
        // Decrement the paymentDueDays
        paymentDueDays -= 1;

        // Update the paymentDueDays in the database
        await Order.findByIdAndUpdate(
          order._id,
          {
            'WarehouseDetail.paymentDueDays': paymentDueDays,
          },
          { new: true }
        );

        console.log(
          `Payment due days for order ${order._id} updated to ${paymentDueDays}`
        );
      } else {
        console.log(`Order ${order._id} already has 0 payment due days.`);
      }
    }
  } catch (error) {
    console.error('Error scheduling daily payment due days decrement:', error);
  }
});
