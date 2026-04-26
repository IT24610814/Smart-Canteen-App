const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    feedbackId: {
      type: String,
      unique: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    type: {
      type: String,
      enum: ['complaint', 'review'],
      required: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      required: true
    },
    imageUrl: String,
    status: {
      type: String,
      enum: ['pending', 'resolved'],
      default: 'pending'
    },
    reply: {
      type: String,
      default: null
    },
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    repliedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
