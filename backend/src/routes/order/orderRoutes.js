const express = require('express');
const router = express.Router();
const { auth, roleAccess } = require('../../middleware/auth');
const { profileUpload } = require('../../middleware/upload');
const orderController = require('../../controllers/order/orderController');

// Customer order flow
router.get('/my', auth, roleAccess('customer'), orderController.getMyOrders);
router.get('/my-pending', auth, roleAccess('customer'), orderController.getMyPendingOrder);
router.post('/', auth, roleAccess('customer', 'order'), orderController.createOrder);
router.put('/:id', auth, roleAccess('customer', 'order'), orderController.updatePendingOrder);
router.put('/:id/void', auth, roleAccess('customer', 'order'), orderController.voidOrder);

// Staff order ops
router.get('/', auth, roleAccess('order', 'finance', 'admin'), orderController.getOrders);
router.get('/kitchen-display', auth, roleAccess('order', 'finance', 'admin'), orderController.getKitchenDisplay);
router.put('/:id/status', auth, roleAccess('order', 'finance', 'admin'), orderController.updateOrderStatus);

// Profile
router.get('/profile', auth, roleAccess('order'), orderController.getProfile);
router.put('/profile', auth, roleAccess('order'), orderController.updateProfile);
router.put('/change-password', auth, roleAccess('order'), orderController.changePassword);
router.post('/profile/photo', auth, roleAccess('order'), profileUpload.single('photo'), orderController.uploadProfilePhoto);
router.delete('/profile/photo', auth, roleAccess('order'), orderController.deleteProfilePhoto);

// ID-based order actions
router.get('/:id', auth, roleAccess('customer', 'order', 'finance', 'admin'), orderController.getOrderById);

module.exports = router;
