const express = require('express');
const router = express.Router();
const { auth, roleAccess } = require('../../middleware/auth');
const { profileUpload } = require('../../middleware/upload');
const financeController = require('../../controllers/finance/financeController');

// Dashboard
router.get('/dashboard', auth, roleAccess('finance'), financeController.getDashboard);

// Transactions
router.get('/transactions', auth, roleAccess('finance'), financeController.getTransactions);
router.get('/transactions/:id', auth, roleAccess('finance'), financeController.getTransactionById);
router.post('/transactions', auth, roleAccess('finance', 'customer'), financeController.createTransaction);
router.post('/transactions/:id/refund', auth, roleAccess('finance'), financeController.refundTransaction);
router.delete('/transactions/:id', auth, roleAccess('finance'), financeController.deleteTransaction);

// Profile
router.get('/profile', auth, roleAccess('finance'), financeController.getProfile);
router.put('/profile', auth, roleAccess('finance'), financeController.updateProfile);
router.put('/change-password', auth, roleAccess('finance'), financeController.changePassword);
router.post('/profile/photo', auth, roleAccess('finance'), profileUpload.single('photo'), financeController.uploadProfilePhoto);
router.delete('/profile/photo', auth, roleAccess('finance'), financeController.deleteProfilePhoto);

module.exports = router;
