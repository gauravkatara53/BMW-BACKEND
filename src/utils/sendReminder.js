import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'gauravkatara53@gmail.com', // Replace with your email
    pass: 'aect teqt wwac draz', // Replace with an App Password
  },
});

const sendReminder = async (to, message) => {
  try {
    await transporter.sendMail({
      from: '"BookMyWarehouse" <gauravkatara53@gmail.com>',
      to,
      subject: 'Payment Reminder',
      text: message,
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

export default sendReminder;
