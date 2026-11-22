const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const ApiError = require('./utils/ApiError');

const app = express();

// Global middleware chain
app.use(cors());
app.use(express.json());
app.use(logger);
app.use(express.static(path.join(__dirname, '..', 'public'))); // socket demo page

// Routes
app.get('/api/health', (req, res) => res.json({ success: true, message: 'API is running' }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/coupons', require('./routes/couponRoutes'));
app.use('/api/wishlist', require('./routes/wishlistRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

// 404 + centralized error handler (must be last)
app.use((req, res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`)));
app.use(errorHandler);

module.exports = app;
