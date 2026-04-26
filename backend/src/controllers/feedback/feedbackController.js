const Feedback = require('../../models/Feedback');
const User = require('../../models/User');
const Counter = require('../../models/Counter');
const fs = require('fs');
const path = require('path');
const { createProfileHandlers } = require('../../utils/profileHandlers');

const profileHandlers = createProfileHandlers({ minAge: 16 });
const FEEDBACK_SEQUENCE_KEY = 'feedback-sequence';

const ensureFeedbackCounter = async () => {
  await Counter.findByIdAndUpdate(
    FEEDBACK_SEQUENCE_KEY,
    { $setOnInsert: { seq: 0 } },
    { new: true, upsert: true }
  );
};

// Generate unique feedbackId (FB001, FB002...)
const generateFeedbackId = async () => {
  await ensureFeedbackCounter();

  const counter = await Counter.findByIdAndUpdate(
    FEEDBACK_SEQUENCE_KEY,
    { $inc: { seq: 1 } },
    { new: true }
  );

  return `FB${String(counter.seq).padStart(3, '0')}`;
};

// Get all feedback
exports.getFeedback = async (req, res) => {
  try {
    const { type, status, userId } = req.query;
    let query = {};

    if (type) query.type = type;
    if (status) query.status = status;
    if (userId) query.userId = userId;

    const feedback = await Feedback.find(query)
      .populate('userId', 'userId staffId fullName username email role')
      .populate('repliedBy', 'staffId fullName username')
      .sort({ createdAt: -1 });
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get logged-in customer's feedback
exports.getMyFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('repliedBy', 'staffId fullName username');

    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single feedback
exports.getFeedbackById = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id)
      .populate('userId', 'userId staffId fullName username email role')
      .populate('repliedBy', 'staffId fullName username');

    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    if (req.user.role === 'customer' && String(feedback.userId?._id || feedback.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Forbidden: You can only view your own feedback' });
    }

    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create feedback
exports.createFeedback = async (req, res) => {
  try {
    const { type, rating, comment, orderId } = req.body;
    const userId = req.user.id;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const feedbackType = type && ['complaint', 'review'].includes(type) ? type : 'complaint';

    if (feedbackType === 'review' && rating && (Number(rating) < 1 || Number(rating) > 5)) {
      return res.status(400).json({ message: 'Valid rating (1-5) is required for reviews' });
    }

    const feedbackId = await generateFeedbackId();

    let imageUrl = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase() || path.extname(req.file.filename).toLowerCase() || '.jpg';
      const newFilename = `${feedbackId}${ext}`;
      const oldPath = req.file.path;
      const newPath = path.join(path.dirname(oldPath), newFilename);
      fs.renameSync(oldPath, newPath);
      imageUrl = `/uploads/complaints/${newFilename}`;
    }

    const newFeedback = new Feedback({
      feedbackId,
      userId,
      orderId: orderId || null,
      type: feedbackType,
      rating: feedbackType === 'review' ? Number(rating) || null : null,
      comment,
      imageUrl,
      status: 'pending'
    });

    await newFeedback.save();
    res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback: newFeedback
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reply to feedback
exports.replyToFeedback = async (req, res) => {
  try {
    const { reply, status } = req.body;
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    if (!reply || !String(reply).trim()) {
      return res.status(400).json({ message: 'Reply message is required' });
    }

    if (status && !['pending', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    feedback.reply = String(reply).trim();
    feedback.repliedBy = req.user.id;
    feedback.repliedAt = new Date();
    feedback.status = status || 'resolved';

    await feedback.save();

    const updatedFeedback = await Feedback.findById(feedback._id)
      .populate('userId', 'userId staffId fullName username email role')
      .populate('repliedBy', 'staffId fullName username');

    res.json({
      message: 'Reply added successfully',
      feedback: updatedFeedback
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update feedback status
exports.updateFeedbackStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    if (!['pending', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    feedback.status = status;
    await feedback.save();

    res.json({
      message: 'Feedback status updated',
      feedback
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete feedback
exports.deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    if (feedback.imageUrl) {
      const relativeImagePath = feedback.imageUrl.replace(/^\//, '');
      const imagePath = path.join(__dirname, '../../../', relativeImagePath);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Feedback.findByIdAndDelete(req.params.id);

    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfile = profileHandlers.getProfile;
exports.updateProfile = profileHandlers.updateProfile;
exports.changePassword = profileHandlers.changePassword;
exports.uploadProfilePhoto = profileHandlers.uploadProfilePhoto;
exports.deleteProfilePhoto = profileHandlers.deleteProfilePhoto;
