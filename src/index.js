import dotenv from 'dotenv';
import connectDB from './config/db.js';
import { app } from './app.js';

// Load environment variables from .env file
dotenv.config({ path: './.env' });

// Connect to the database and start the server
connectDB()
  .then(() => {
    app.listen(process.env.PORT || 5000, () => {
      console.log(`⚙️ Server is running at port: ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed!', err);
  });
