const Order = require('../../models/Order');
const Transaction = require('../../models/Transaction');
const Counter = require('../../models/Counter');
const MenuItem = require('../../models/MenuItem');
const StockItem = require('../../models/StockItem');
const axios = require('axios');
const { createProfileHandlers } = require('../../utils/profileHandlers');

const profileHandlers = createProfileHandlers({ minAge: 16 });
const TRANSACTION_SEQUENCE_KEY = 'transaction-sequence';

const resolveStockStatus = (currentQty, minQty, maxQty) => {
  if (currentQty < minQty) return 'low_stock';
  if (currentQty > maxQty) return 'over_stock';
  return 'good';
};

const ensureTransactionCounter = async () => {
  await Counter.findByIdAndUpdate(
    TRANSACTION_SEQUENCE_KEY,
    { $setOnInsert: { seq: 0 } },
    { new: true, upsert: true }
  );
};

const generateTransactionId = async () => {
  await ensureTransactionCounter();
  const counter = await Counter.findByIdAndUpdate(
    TRANSACTION_SEQUENCE_KEY,
    { $inc: { seq: 1 } },
    { new: true }
  );

  return `TRX${String(counter.seq).padStart(3, '0')}`;
};

const getStockForMenuItem = async (menuItem) => {
  let stockItem = await StockItem.findOne({ itemId: menuItem._id });
  if (!stockItem) {
    stockItem = await StockItem.findOne({ itemName: menuItem.name });
  }
  return stockItem;
};

const reduceStockFromOrder = async (order) => {
  for (const item of order.items) {
    const menuItem = await MenuItem.findById(item.menuItemId).select('_id name');
    if (!menuItem) {
      throw new Error(`Menu item missing for ${item.itemName}`);
    }

    const stockItem = await getStockForMenuItem(menuItem);
    if (!stockItem) {
      throw new Error(`Stock record missing for ${item.itemName}`);
    }

    if (stockItem.currentQty < item.quantity) {
      throw new Error(`Insufficient stock for ${item.itemName}`);
    }

    stockItem.currentQty -= item.quantity;
    stockItem.status = resolveStockStatus(stockItem.currentQty, stockItem.minQty, stockItem.maxQty);
    await stockItem.save();
  }
};

const restoreStockFromOrder = async (order) => {
  for (const item of order.items) {
    const menuItem = await MenuItem.findById(item.menuItemId).select('_id name');
    if (!menuItem) {
      continue;
    }

    const stockItem = await getStockForMenuItem(menuItem);
    if (!stockItem) {
      continue;
    }

    stockItem.currentQty += item.quantity;
    stockItem.status = resolveStockStatus(stockItem.currentQty, stockItem.minQty, stockItem.maxQty);
    await stockItem.save();
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const totalRevenue = await Transaction.aggregate([
      { $match: { status: 'complete' } },
      { $group: { _id: null, total: { $sum: '$payableAmount' } } }
    ]);

    const totalOrders = await Order.countDocuments({ status: 'completed' });
    const totalTransactions = await Transaction.countDocuments({ status: 'complete' });
    const refundedAmount = await Transaction.aggregate([
      { $match: { status: 'refund' } },
      { $group: { _id: null, total: { $sum: '$payableAmount' } } }
    ]);

    res.json({
      totalRevenue: totalRevenue[0]?.total || 0,
      totalOrders,
      totalTransactions,
      refundedAmount: refundedAmount[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { status, paymentType, startDate, endDate } = req.query;
    const query = {};

    if (status) query.status = status;
    if (paymentType) query.paymentType = paymentType;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const transactions = await Transaction.find(query)
      .populate('orderId', 'orderId status')
      .populate('customerId', 'userId fullName username')
      .sort({ createdAt: -1 });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('orderId')
      .populate('customerId', 'userId fullName username');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createTransaction = async (req, res) => {
  try {
    const { orderId, paymentType, amountReceived, cardDetails, stripePaymentMethodId } = req.body;

    if (!orderId || !paymentType) {
      return res.status(400).json({ message: 'Order ID and payment type are required' });
    }

    if (!['cash', 'card'].includes(paymentType)) {
      return res.status(400).json({ message: 'Invalid payment type' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.user.role === 'customer' && String(order.customerId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Forbidden: You can only pay your own order' });
    }

    if (order.status === 'completed') {
      return res.status(400).json({ message: 'Order is already completed' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending orders can be paid' });
    }

    const received = Number(amountReceived ?? order.payableAmount);
    if (!Number.isFinite(received) || received < order.payableAmount) {
      return res.status(400).json({ message: 'Amount received is less than payable amount' });
    }

    let stripePaymentIntentId = null;
    if (paymentType === 'card' && process.env.STRIPE_SECRET_KEY) {
      if (!stripePaymentMethodId) {
        return res.status(400).json({ message: 'Stripe payment method ID is required for card payments' });
      }

      const stripeForm = new URLSearchParams();
      stripeForm.append('amount', String(Math.round(order.payableAmount * 100)));
      stripeForm.append('currency', process.env.STRIPE_CURRENCY || 'usd');
      stripeForm.append('payment_method', stripePaymentMethodId);
      stripeForm.append('confirm', 'true');

      const stripeRes = await axios.post('https://api.stripe.com/v1/payment_intents', stripeForm.toString(), {
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (stripeRes.data?.status !== 'succeeded') {
        return res.status(400).json({ message: `Card payment not completed. Stripe status: ${stripeRes.data?.status || 'unknown'}` });
      }

      stripePaymentIntentId = stripeRes.data.id;
    }

    await reduceStockFromOrder(order);

    const transactionId = await generateTransactionId();
    const transaction = new Transaction({
      transactionId,
      orderId: order._id,
      customerId: order.customerId,
      paymentType,
      subtotal: order.subtotal,
      totalDiscount: order.totalDiscount,
      payableAmount: order.payableAmount,
      itemsSummary: order.items.map((item) => ({
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal
      })),
      amountReceived: received,
      change: Number((received - order.payableAmount).toFixed(2)),
      cardDetails: paymentType === 'card' ? cardDetails || null : null,
      stripePaymentIntentId,
      status: 'complete'
    });

    await transaction.save();

    order.status = 'completed';
    order.completedAt = new Date();
    await order.save();

    res.status(201).json({
      message: 'Payment completed and transaction recorded',
      transaction,
      order
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.refundTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.status === 'refund') {
      return res.status(400).json({ message: 'Transaction already refunded' });
    }

    const order = await Order.findById(transaction.orderId);
    if (!order) {
      return res.status(404).json({ message: 'Related order not found' });
    }

    await restoreStockFromOrder(order);

    transaction.status = 'refund';
    transaction.refundedAt = new Date();
    await transaction.save();

    order.status = 'refunded';
    order.refundedAt = new Date();
    await order.save();

    res.json({ message: 'Transaction refunded and stock restored', transaction, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const order = await Order.findById(transaction.orderId);

    // Keep stock accurate when deleting a completed non-refunded sale.
    if (order && transaction.status === 'complete') {
      await restoreStockFromOrder(order);
    }

    await Transaction.findByIdAndDelete(transaction._id);

    if (order) {
      await Order.findByIdAndDelete(order._id);
    }

    res.json({ message: 'Transaction and related order deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfile = profileHandlers.getProfile;
exports.updateProfile = profileHandlers.updateProfile;
exports.changePassword = profileHandlers.changePassword;
exports.uploadProfilePhoto = profileHandlers.uploadProfilePhoto;
exports.deleteProfilePhoto = profileHandlers.deleteProfilePhoto;
