// sendBookingConfirmationEmails.ts or .js (depending on your setup)

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// ✅ Use environment variable for email too
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'gauravkatara53@gmail.com', // ✅ Now both email and pass are from .env
    pass: process.env.passApp,
  },
});

// ✅ Main function to send booking confirmation to user and partner
const sendBookingConfirmationEmails = async (bookingDetails) => {
  const {
    user,
    partner,
    warehouse,
    bookingId,
    bookingDate,
    duration,
    totalPrice,
  } = bookingDetails;

  const subjectUser = `Booking Confirmation - ${bookingId}`;
  const subjectPartner = `New Booking Received - ${bookingId}`;

  // ✅ Reusable email content
  const htmlContent = `
    <h2 style="color: #4B0082;">Booking Confirmation - BOOKMYWAREHOUSE</h2>
    <p><strong>Booking ID:</strong> ${bookingId}</p>
    <p><strong>Warehouse:</strong> ${warehouse.name}</p>
    <p><strong>Address:</strong> ${warehouse.address}</p>
    <p><strong>Booking Date:</strong> ${bookingDate}</p>
    <p><strong>Duration:</strong> ${duration} days</p>
    <p><strong>Total Price:</strong> ₹${totalPrice}</p>
    <hr/>
    <p><strong>User:</strong> ${user.name} (${user.email})</p>
    <p><strong>Partner:</strong> ${partner.name} (${partner.email})</p>
    <p style="color: gray; font-size: 12px;">Thank you for using BOOKMYWAREHOUSE</p>
  `;

  try {
    // ✅ Send to User
    await transporter.sendMail({
      from: `"BookMyWarehouse" <${process.env.BMW_EMAIL}>`,
      to: user.email,
      subject: subjectUser,
      html: htmlContent,
    });

    // ✅ Send to Partner
    await transporter.sendMail({
      from: `"BookMyWarehouse" <${process.env.BMW_EMAIL}>`,
      to: partner.email,
      subject: subjectPartner,
      html: htmlContent,
    });

    console.log('✅ Booking confirmation emails sent successfully.');
  } catch (error) {
    console.error('❌ Error sending booking emails:', error.message || error);
  }
};

export default sendBookingConfirmationEmails; // ✅ Use ES6 export if using `import`
