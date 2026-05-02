const express = require('express');
const router = express.Router();
const { auth, roleAccess } = require('../../middleware/auth');
const { profileUpload } = require('../../middleware/upload');
const promotionController = require('../../controllers/promotion/promotionController');

// Seasonal Promotions
router.get('/menu-items', auth, roleAccess('promotion'), promotionController.getPromotionMenuItems);
router.get('/active-summary', auth, roleAccess('promotion'), promotionController.getActivePromotionSummary);
router.get('/seasonal', auth, roleAccess('promotion'), promotionController.getSeasonalPromos);
router.get('/seasonal/:id', auth, roleAccess('promotion'), promotionController.getSeasonalPromoById);
router.post('/seasonal', auth, roleAccess('promotion'), promotionController.createSeasonalPromo);
router.put('/seasonal/:id', auth, roleAccess('promotion'), promotionController.updateSeasonalPromo);
router.delete('/seasonal/:id', auth, roleAccess('promotion'), promotionController.deleteSeasonalPromo);

// Daily Discounts
router.get('/daily', auth, roleAccess('promotion'), promotionController.getDailyDiscounts);
router.get('/daily/:id', auth, roleAccess('promotion'), promotionController.getDailyDiscountById);
router.post('/daily', auth, roleAccess('promotion'), promotionController.createDailyDiscount);
router.put('/daily/:id', auth, roleAccess('promotion'), promotionController.updateDailyDiscount);
router.delete('/daily/:id', auth, roleAccess('promotion'), promotionController.deleteDailyDiscount);

// Profile Management
router.get('/profile', auth, roleAccess('promotion'), promotionController.getProfile);
router.put('/profile', auth, roleAccess('promotion'), promotionController.updateProfile);
router.put('/change-password', auth, roleAccess('promotion'), promotionController.changePassword);
router.post('/profile/photo', auth, roleAccess('promotion'), profileUpload.single('photo'), promotionController.uploadProfilePhoto);
router.delete('/profile/photo', auth, roleAccess('promotion'), promotionController.deleteProfilePhoto);

module.exports = router;
