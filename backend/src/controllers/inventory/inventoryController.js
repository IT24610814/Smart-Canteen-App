const StockItem = require('../../models/StockItem');
const MenuItem = require('../../models/MenuItem');
const Counter = require('../../models/Counter');
const User = require('../../models/User');
const fs = require('fs');
const path = require('path');
const { createProfileHandlers } = require('../../utils/profileHandlers');

const profileHandlers = createProfileHandlers({ minAge: 16 });

const resolveStockStatus = (currentQty, minQty, maxQty) => {
  if (currentQty < minQty) return 'low_stock';
  if (currentQty > maxQty) return 'over_stock';
  return 'good';
};

const STOCK_SEQUENCE_KEY = 'stock-sequence';

const formatStockId = (sequence) => `ST${String(sequence).padStart(3, '0')}`;

const parseStockId = (value = '') => {
  const match = /^ST(\d+)$/.exec(value);
  return match ? Number(match[1]) : 0;
};

const getCurrentMaxStockSequence = async () => {
  const stockItems = await StockItem.find({ stockId: /^ST\d+$/ }).select('stockId').lean();
  return stockItems.reduce((max, item) => Math.max(max, parseStockId(item.stockId)), 0);
};

const ensureStockCounter = async () => {
  const existingCounter = await Counter.findById(STOCK_SEQUENCE_KEY).lean();
  if (existingCounter) {
    return existingCounter;
  }

  const currentMaxSequence = await getCurrentMaxStockSequence();
  return Counter.findByIdAndUpdate(
    STOCK_SEQUENCE_KEY,
    { $setOnInsert: { seq: currentMaxSequence } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const generateNextStockId = async () => {
  await ensureStockCounter();

  const counter = await Counter.findByIdAndUpdate(
    STOCK_SEQUENCE_KEY,
    { $inc: { seq: 1 } },
    { new: true }
  );

  return formatStockId(counter.seq);
};

// Get stock dashboard
exports.getDashboard = async (req, res) => {
  try {
    const totalItems = await StockItem.countDocuments();
    const lowStockItems = await StockItem.countDocuments({ status: 'low_stock' });
    const overStockItems = await StockItem.countDocuments({ status: 'over_stock' });
    
    const totalValue = await StockItem.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ['$currentQty', '$unitPrice'] } }
        }
      }
    ]);

    const lowStockList = await StockItem.find({ status: 'low_stock' }).limit(5);

    res.json({
      totalItems,
      lowStockItems,
      overStockItems,
      totalInventoryValue: totalValue[0]?.total || 0,
      lowStockList
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all stock items with search/filter
exports.getStock = async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { stockId: { $regex: search, $options: 'i' } },
        { itemName: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    const items = await StockItem.find(query).sort({ createdAt: -1 });

    // Backfill IDs for legacy stock records that were created before stockId existed.
    for (const item of items) {
      if (!item.stockId) {
        item.stockId = await generateNextStockId();
        await item.save();
      }
    }

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single stock item
exports.getStockItem = async (req, res) => {
  try {
    const item = await StockItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Stock item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get menu items for stock form dropdown
exports.getMenuItems = async (req, res) => {
  try {
    const menuItems = await MenuItem.find({ isActive: true })
      .select('_id name')
      .sort({ name: 1 });

    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new stock item
exports.createStockItem = async (req, res) => {
  try {
    const { menuItemId, currentQty, minQty, maxQty, unitPrice } = req.body;

    // Validation
    if (!menuItemId) {
      return res.status(400).json({ message: 'Menu item is required' });
    }

    const menuItem = await MenuItem.findById(menuItemId).select('_id name');
    if (!menuItem) {
      return res.status(404).json({ message: 'Selected menu item not found' });
    }

    const alreadyExists = await StockItem.findOne({ itemId: menuItem._id });
    if (alreadyExists) {
      return res.status(409).json({ message: 'Stock record already exists for this menu item' });
    }

    if (currentQty === undefined || isNaN(currentQty) || Number(currentQty) <= 0) {
      return res.status(400).json({ message: 'Current quantity must be greater than 0' });
    }

    if (minQty === undefined || isNaN(minQty) || minQty < 0) {
      return res.status(400).json({ message: 'Valid minimum quantity is required' });
    }

    if (maxQty === undefined || isNaN(maxQty) || maxQty < 0) {
      return res.status(400).json({ message: 'Valid maximum quantity is required' });
    }

    if (!unitPrice || isNaN(unitPrice) || unitPrice < 0) {
      return res.status(400).json({ message: 'Valid unit price is required' });
    }

    const parsedCurrentQty = parseInt(currentQty, 10);
    const parsedMinQty = parseInt(minQty, 10);
    const parsedMaxQty = parseInt(maxQty, 10);
    const status = resolveStockStatus(parsedCurrentQty, parsedMinQty, parsedMaxQty);

    const newItem = new StockItem({
      stockId: await generateNextStockId(),
      itemId: menuItem._id,
      itemName: menuItem.name,
      currentQty: parsedCurrentQty,
      minQty: parsedMinQty,
      maxQty: parsedMaxQty,
      unitPrice: parseFloat(unitPrice),
      status
    });

    await newItem.save();
    res.status(201).json({
      message: 'Stock item created successfully',
      item: newItem
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update stock item
exports.updateStockItem = async (req, res) => {
  try {
    const { itemName, currentQty, minQty, maxQty, unitPrice } = req.body;
    const item = await StockItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Stock item not found' });
    }

    if (itemName) item.itemName = itemName;
    if (currentQty !== undefined) item.currentQty = parseInt(currentQty);
    if (minQty !== undefined) item.minQty = parseInt(minQty);
    if (maxQty !== undefined) item.maxQty = parseInt(maxQty);
    if (unitPrice !== undefined) item.unitPrice = parseFloat(unitPrice);

    // Auto-update status
    item.status = resolveStockStatus(item.currentQty, item.minQty, item.maxQty);

    await item.save();
    res.json({
      message: 'Stock item updated successfully',
      item
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete stock item
exports.deleteStockItem = async (req, res) => {
  try {
    const item = await StockItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Stock item not found' });
    }

    await item.deleteOne();
    res.json({ message: 'Stock item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfile = profileHandlers.getProfile;
exports.updateProfile = profileHandlers.updateProfile;
exports.changePassword = profileHandlers.changePassword;
exports.uploadProfilePhoto = profileHandlers.uploadProfilePhoto;
exports.deleteProfilePhoto = profileHandlers.deleteProfilePhoto;
