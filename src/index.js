// import dotenv from 'dotenv';
// import connectDB from './config/db.js';
// import { app } from './app.js';

// // Load environment variables from .env file
// dotenv.config({ path: './.env' });

// // Connect to the database and start the server
// connectDB()
//   .then(() => {
//     app.listen(process.env.PORT || 5000, () => {
//       console.log(`⚙️ Server is running at port: ${process.env.PORT || 5000}`);
//     });
//   })
//   .catch((err) => {
//     console.error('❌ MongoDB connection failed!', err);
//   });

import dotenv from 'dotenv';
import connectDB from './config/db.js';
import { app } from './app.js';
import http from 'http';
import { Server } from 'socket.io';

// Load environment variables
dotenv.config({ path: './.env' });

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000', // Your frontend URL(s)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
});

// Listen for socket connections
io.on('connection', (socket) => {
  console.log('User connected: ', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected: ', socket.id);
  });
});

// Export io so you can use it in controllers
export { io };

// Connect to DB and start server
connectDB()
  .then(() => {
    server.listen(process.env.PORT || 5000, () => {
      console.log(`⚙️ Server is running at port: ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed!', err);
  });
