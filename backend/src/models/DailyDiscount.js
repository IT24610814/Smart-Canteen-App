const mongoose = require('mongoose');

const dailyDiscountSchema = new mongoose.Schema(
  {
    discountId: {
      type: String,
      unique: true
    },
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true
    },
    productName: String,
    originalPrice: {
      type: Number,
      required: true
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 1,
      max: 99
    },
    newPrice: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'expired'],
      default: 'active'
    },
    validDate: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DailyDiscount', dailyDiscountSchema);
