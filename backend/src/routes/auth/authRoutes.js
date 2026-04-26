const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const authController = require('../../controllers/auth/authController');

// Login Route
router.post('/login', authController.login);

// Register Route (for customers only)
router.post('/register', authController.registerCustomer);

// Verify Token Route
router.get('/verify', auth, authController.verify);

// Logout Route
router.post('/logout', auth, authController.logout);

module.exports = router;
