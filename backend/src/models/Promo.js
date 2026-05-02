const mongoose = require('mongoose');

const promoSchema = new mongoose.Schema(
  {
    promoId: {
      type: String,
      unique: true
    },
    title: {
      type: String,
      required: true
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 1,
      max: 99
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'paused', 'expired'],
      default: 'scheduled'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Promo', promoSchema);
