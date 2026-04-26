const express = require('express');
const router = express.Router();
const { auth, roleAccess } = require('../../middleware/auth');
const { profileUpload } = require('../../middleware/upload');
const customerController = require('../../controllers/customer/customerController');

// Browse Menu
router.get('/menu', auth, roleAccess('customer'), customerController.browseMenu);
router.get('/promotions/active', auth, roleAccess('customer'), customerController.getActivePromotions);

// My Orders
router.get('/orders', auth, roleAccess('customer'), customerController.getMyOrders);

// Profile
router.get('/profile', auth, roleAccess('customer'), customerController.getProfile);
router.put('/profile', auth, roleAccess('customer'), customerController.updateProfile);
router.put('/change-password', auth, roleAccess('customer'), customerController.changePassword);
router.post('/profile/photo', auth, roleAccess('customer'), profileUpload.single('photo'), customerController.uploadProfilePhoto);
router.delete('/profile/photo', auth, roleAccess('customer'), customerController.deleteProfilePhoto);

module.exports = router;
