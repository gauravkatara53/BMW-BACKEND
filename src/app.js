import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import './Queue/cronJob.js';

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];

const corsOptions = {
  origin: allowedOrigins, // Allow only requests from this origin
  credentials: true, // Allow cookies and other credentials to be sent
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH'], // Allow GET, POST, and OPTIONS requests
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow Content-Type and Authorization headers
};

// Apply CORS middleware globally
app.use(cors(corsOptions));

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cookieParser());

// create routes for the app
import userRouter from './routes/userRoutes.js';
import partnerRouter from './routes/partnerRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import kycRouter from './routes/kycRouter.js';
import WarehouseRouter from './routes/warehouseRoutes.js';
import orderRouter from './routes/orderRoutes.js';
import transactionRouter from './routes/transactionRoutes.js';
// routes declarations for the app
app.use('/api/v1/user', userRouter);
app.use('/api/v1/partner', partnerRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/kyc', kycRouter);
app.use('/api/v1/warehouse', WarehouseRouter);
app.use('/api/v1/order', orderRouter);
app.use('/api/v1/transaction', transactionRouter);

export { app };
