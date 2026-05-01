const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    paymentType: {
      type: String,
      enum: ['card', 'cash'],
      required: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    subtotal: {
      type: Number,
      default: 0
    },
    totalDiscount: {
      type: Number,
      default: 0
    },
    payableAmount: {
      type: Number,
      default: 0
    },
    itemsSummary: [
      {
        itemName: String,
        quantity: Number,
        unitPrice: Number,
        lineTotal: Number
      }
    ],
    amountReceived: Number,
    change: Number,
    cardDetails: {
      cardNumber: String,
      cardHolderName: String,
      expiryDate: String
    },
    stripePaymentIntentId: String,
    status: {
      type: String,
      enum: ['complete', 'refund', 'pending', 'failed'],
      default: 'complete'
    },
    refundedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
