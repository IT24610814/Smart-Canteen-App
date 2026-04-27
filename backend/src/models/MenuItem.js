const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
      unique: true
    },
    name: {
      type: String,
      required: true,
      unique: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    description: String,
    image: String,
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('MenuItem', menuItemSchema);
