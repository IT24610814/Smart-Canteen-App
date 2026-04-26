const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const config = require('./config/config');
const connectDB = require('./config/database');
const { ensureUploadDirs, receiptUpload } = require('./middleware/upload');

// Initialize Express App
const app = express();

// Connect Database
connectDB();

// Ensure upload directories exist
ensureUploadDirs();

// Middleware
const allowedOrigins = new Set([
  config.server.clientUrl,
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8082',
  'http://127.0.0.1:8083',
  'http://10.18.130.68:8081', // Expo development server
  'exp://10.18.130.68:8081', // Expo client
  'http://10.18.130.68:3000', // Alternative web port
  'http://192.168.56.1:8081', // Ethernet IP
  'exp://192.168.56.1:8081' // Ethernet Expo client
]);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g., Postman/cURL) and known local dev origins.
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static('uploads'));

// Test Route
app.get('/', (req, res) => {
  res.json({
    message: 'Smart Canteen Backend API',
    version: '1.0.0',
    status: 'Running'
  });
});

// Health Check Route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// ==================== AUTH ROUTES ====================
app.use('/api/auth', require('./routes/auth/authRoutes'));

// ==================== ADMIN ROUTES ====================
app.use('/api/admin', require('./routes/admin/adminRoutes'));

// ==================== FOOD MASTER ROUTES ====================
app.use('/api/foodmaster', require('./routes/foodmaster/foodmasterRoutes'));

// ==================== INVENTORY ROUTES ====================
app.use('/api/inventory', require('./routes/inventory/inventoryRoutes'));

// ==================== PROMOTION ROUTES ====================
app.use('/api/promotion', require('./routes/promotion/promotionRoutes'));

// ==================== ORDER ROUTES ====================
app.use('/api/order', require('./routes/order/orderRoutes'));

// ==================== FINANCE ROUTES ====================
app.use('/api/finance', require('./routes/finance/financeRoutes'));

// ==================== FEEDBACK ROUTES ====================
app.use('/api/feedback', require('./routes/feedback/feedbackRoutes'));

// ==================== CUSTOMER ROUTES ====================
app.use('/api/customer', require('./routes/customer/customerRoutes'));

// ==================== RECEIPT UPLOAD ====================
app.post('/api/save-receipt', receiptUpload.single('receipt'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No receipt file provided' });
    }

    const receiptPath = `/uploads/receipts/${req.file.filename}`;
    res.json({
      message: 'Receipt saved successfully',
      filename: req.file.filename,
      path: receiptPath,
      transactionId: req.body.transactionId,
      orderId: req.body.orderId
    });
  } catch (err) {
    console.error('Receipt upload error:', err);
    res.status(500).json({ message: 'Failed to save receipt', error: err.message });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: config.server.nodeEnv === 'development' ? err : {}
  });
});

// Start Server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`\n🚀 Smart Canteen Backend Server Running on Port ${PORT}`);
  console.log(`📍 Environment: ${config.server.nodeEnv}`);
  console.log(`🌍 Client URL: ${config.server.clientUrl}\n`);
});

module.exports = app;
