const express = require('express');
const router = express.Router();
const { auth, roleAccess } = require('../../middleware/auth');
const { complaintUpload, profileUpload } = require('../../middleware/upload');
const feedbackController = require('../../controllers/feedback/feedbackController');

// Feedback Management
router.get('/', auth, roleAccess('feedback'), feedbackController.getFeedback);
router.get('/my', auth, roleAccess('customer'), feedbackController.getMyFeedback);
router.post('/', auth, roleAccess('customer', 'feedback'), complaintUpload.single('image'), feedbackController.createFeedback);

// Profile
router.get('/profile', auth, roleAccess('feedback'), feedbackController.getProfile);
router.put('/profile', auth, roleAccess('feedback'), feedbackController.updateProfile);
router.put('/change-password', auth, roleAccess('feedback'), feedbackController.changePassword);
router.post('/profile/photo', auth, roleAccess('feedback'), profileUpload.single('photo'), feedbackController.uploadProfilePhoto);
router.delete('/profile/photo', auth, roleAccess('feedback'), feedbackController.deleteProfilePhoto);

// ID-based feedback actions
router.get('/:id', auth, roleAccess('feedback'), feedbackController.getFeedbackById);
router.put('/:id/status', auth, roleAccess('feedback'), feedbackController.updateFeedbackStatus);
router.put('/:id/reply', auth, roleAccess('feedback'), feedbackController.replyToFeedback);
router.delete('/:id', auth, roleAccess('feedback'), feedbackController.deleteFeedback);

module.exports = router;
