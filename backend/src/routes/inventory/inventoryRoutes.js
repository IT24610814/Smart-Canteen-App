const express = require('express');
const router = express.Router();
const { auth, roleAccess } = require('../../middleware/auth');
const { profileUpload } = require('../../middleware/upload');
const inventoryController = require('../../controllers/inventory/inventoryController');

// Dashboard
router.get('/dashboard', auth, roleAccess('inventory'), inventoryController.getDashboard);

// Stock Items
router.get('/menu-items', auth, roleAccess('inventory'), inventoryController.getMenuItems);
router.get('/stock', auth, roleAccess('inventory'), inventoryController.getStock);
router.get('/stock/:id', auth, roleAccess('inventory'), inventoryController.getStockItem);
router.post('/stock', auth, roleAccess('inventory'), inventoryController.createStockItem);
router.put('/stock/:id', auth, roleAccess('inventory'), inventoryController.updateStockItem);
router.delete('/stock/:id', auth, roleAccess('inventory'), inventoryController.deleteStockItem);

// Profile Management
router.get('/profile', auth, roleAccess('inventory'), inventoryController.getProfile);
router.put('/profile', auth, roleAccess('inventory'), inventoryController.updateProfile);
router.put('/change-password', auth, roleAccess('inventory'), inventoryController.changePassword);
router.post('/profile/photo', auth, roleAccess('inventory'), profileUpload.single('photo'), inventoryController.uploadProfilePhoto);
router.delete('/profile/photo', auth, roleAccess('inventory'), inventoryController.deleteProfilePhoto);

module.exports = router;
