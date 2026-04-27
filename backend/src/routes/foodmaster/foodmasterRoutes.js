const express = require('express');
const router = express.Router();
const { auth, roleAccess } = require('../../middleware/auth');
const { menuItemUpload, profileUpload } = require('../../middleware/upload');
const foodmasterController = require('../../controllers/foodmaster/foodmasterController');

// Menu Catalog
router.get('/menu', auth, roleAccess('foodmaster'), foodmasterController.getMenu);
router.get('/menu/:id', auth, roleAccess('foodmaster'), foodmasterController.getMenuItemById);
router.post('/menu', auth, roleAccess('foodmaster'), menuItemUpload.single('image'), foodmasterController.createMenuItem);
router.put('/menu/:id', auth, roleAccess('foodmaster'), menuItemUpload.single('image'), foodmasterController.updateMenuItem);
router.delete('/menu/:id', auth, roleAccess('foodmaster'), foodmasterController.deleteMenuItem);

// Profile Management
router.get('/profile', auth, roleAccess('foodmaster'), foodmasterController.getProfile);
router.put('/profile', auth, roleAccess('foodmaster'), foodmasterController.updateProfile);
router.put('/change-password', auth, roleAccess('foodmaster'), foodmasterController.changePassword);
router.post('/profile/photo', auth, roleAccess('foodmaster'), profileUpload.single('photo'), foodmasterController.uploadProfilePhoto);
router.delete('/profile/photo', auth, roleAccess('foodmaster'), foodmasterController.deleteProfilePhoto);

module.exports = router;
