import cron from 'node-cron';
import { Order } from '../models/orderModel.js';
import { User } from '../models/userModel.js'; // Import User model
import sendReminder from '../utils/sendReminder.js'; // Function to send emails/SMS

// Run cron job every day at midnight
cron.schedule('* * * * *', async () => {
  console.log('🔄 Running daily payment reminder cron job...');

  try {
    // Step 1: Decrement `paymentDay` for all rented warehouses
    console.log('⚙️ Updating paymentDay for rented warehouses...');
    const updateResult = await Order.updateMany(
      { paymentDay: { $gt: 0 } }, // Ensure `paymentDay` exists
      { $inc: { paymentDay: -1 } }
    );

    console.log(
      `✅ Updated ${updateResult.modifiedCount} orders' payment days.`
    );

    // Step 2: Find orders that need reminders (when paymentDay is 4, 3, 2, 1)
    console.log('🔍 Searching for orders with paymentDay <= 4...');
    const ordersToRemind = await Order.find({
      paymentDay: { $lte: 4, $gt: 0 }, // Get orders where paymentDay is 4, 3, 2, 1
    });

    console.log(`📌 Found ${ordersToRemind.length} orders needing reminders.`);

    if (ordersToRemind.length === 0) {
      console.log('⚠️ No orders found for reminder. Exiting cron job.');
      return;
    }

    for (const order of ordersToRemind) {
      console.log(`📦 Processing Order ID: ${order.orderId}`);

      const userId = order.customerDetails; // Extract customerDetails (user ID)
      console.log(`👤 Extracted User ID: ${userId}`);

      if (!userId) {
        console.log(`⚠️ Skipping order ${order.orderId}, no user ID found.`);
        continue; // Skip if userId is missing
      }

      // Fetch user details from User collection
      console.log(`🔎 Searching for user in database with ID: ${userId}`);
      const user = await User.findById(userId);

      if (user) {
        console.log(`✅ User found: ${user.email}`);
      } else {
        console.log(`❌ User with ID ${userId} not found in the database.`);
        continue;
      }

      if (user?.email) {
        console.log(`📤 Sending email to: ${user.email}`);

        try {
          await sendReminder(
            user.email,
            `Dear ${user.name}, this is a gentle reminder that your warehouse rental payment of ₹${order.monthlyAmount} is due in ${order.paymentDay} days. To ensure uninterrupted service, kindly complete the payment on time. If you have already made the payment, please disregard this message. Thank you for your prompt attention.
`
          );

          console.log(
            `✅ Email successfully sent to ${user.email} for Order ID: ${order.orderId}`
          );
        } catch (emailError) {
          console.error(
            `❌ Failed to send email to ${user.email}:`,
            emailError
          );
        }
      } else {
        console.log(`⚠️ User with ID ${userId} has no email.`);
      }
    }
  } catch (error) {
    console.error('❌ Error in daily cron job:', error);
  }
});
