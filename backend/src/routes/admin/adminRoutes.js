const express = require('express');
const router = express.Router();
const { auth, roleAccess } = require('../../middleware/auth');
const { profileUpload } = require('../../middleware/upload');
const adminController = require('../../controllers/admin/adminController');

// Dashboard
router.get('/dashboard', auth, roleAccess('admin'), adminController.getDashboard);

// Staff Management
router.get('/staff', auth, roleAccess('admin'), adminController.getStaff);

router.post('/staff', auth, roleAccess('admin'), adminController.createStaff);

router.put('/staff/:id', auth, roleAccess('admin'), adminController.updateStaff);

router.delete('/staff/:id', auth, roleAccess('admin'), adminController.deleteStaff);

// Customer Management
router.get('/customers', auth, roleAccess('admin'), adminController.getCustomers);

router.put('/customers/:id', auth, roleAccess('admin'), adminController.updateCustomer);

router.delete('/customers/:id', auth, roleAccess('admin'), adminController.deleteCustomer);

// Profile Management
router.get('/profile', auth, roleAccess('admin'), adminController.getProfile);

router.put('/profile', auth, roleAccess('admin'), adminController.updateProfile);

router.put('/change-password', auth, roleAccess('admin'), adminController.changePassword);

router.post('/profile/photo', auth, roleAccess('admin'), profileUpload.single('photo'), adminController.uploadProfilePhoto);

router.delete('/profile/photo', auth, roleAccess('admin'), adminController.deleteProfilePhoto);

module.exports = router;
