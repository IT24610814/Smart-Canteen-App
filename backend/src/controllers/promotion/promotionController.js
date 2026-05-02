const Promo = require('../../models/Promo');
const DailyDiscount = require('../../models/DailyDiscount');
const MenuItem = require('../../models/MenuItem');
const User = require('../../models/User');
const Counter = require('../../models/Counter');
const fs = require('fs');
const path = require('path');
const { createProfileHandlers } = require('../../utils/profileHandlers');
const {
  startOfDay,
  calculateDiscountedPrice,
  isDailyDiscountExpired,
  deriveSeasonalStatus
} = require('../../utils/promotionEngine');

const profileHandlers = createProfileHandlers({ minAge: 16 });

const DAILY_DISCOUNT_SEQUENCE_KEY = 'daily-discount-sequence';
const SEASONAL_PROMO_SEQUENCE_KEY = 'seasonal-promo-sequence';

const ensureSequenceCounter = async (key) => {
  await Counter.findByIdAndUpdate(
    key,
    { $setOnInsert: { seq: 0 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const getNextSequenceId = async (key, prefix, width) => {
  await ensureSequenceCounter(key);

  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true }
  );

  return `${prefix}${String(counter.seq).padStart(width, '0')}`;
};

const refreshDailyDiscountStatuses = async () => {
  const discounts = await DailyDiscount.find({ status: { $ne: 'expired' } });
  for (const discount of discounts) {
    if (isDailyDiscountExpired(discount)) {
      discount.status = 'expired';
      await discount.save();
    }
  }
};

const refreshSeasonalPromoStatuses = async () => {
  const promos = await Promo.find({});
  for (const promo of promos) {
    const nextStatus = deriveSeasonalStatus(promo);
    if (promo.status !== nextStatus) {
      promo.status = nextStatus;
      await promo.save();
    }
  }
};

// Get active menu items for daily discount dropdown
exports.getPromotionMenuItems = async (req, res) => {
  try {
    const menuItems = await MenuItem.find({ isActive: true })
      .select('_id name price')
      .sort({ name: 1 });

    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all seasonal promotions
exports.getSeasonalPromos = async (req, res) => {
  try {
    await refreshSeasonalPromoStatuses();

    const { search, status } = req.query;
    let query = {};

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    if (status) {
      query.status = status;
    }

    const promos = await Promo.find(query).sort({ startDate: -1 });
    res.json(promos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single seasonal promo
exports.getSeasonalPromoById = async (req, res) => {
  try {
    const promo = await Promo.findById(req.params.id);
    if (!promo) {
      return res.status(404).json({ message: 'Promo not found' });
    }
    res.json(promo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create seasonal promo
exports.createSeasonalPromo = async (req, res) => {
  try {
    const { title, discountPercentage, startDate, endDate } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ message: 'Title is required' });
    }

    if (!discountPercentage || isNaN(discountPercentage) || discountPercentage < 1 || discountPercentage > 99) {
      return res.status(400).json({ message: 'Discount percentage must be between 1-99' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start and end dates are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = startOfDay(new Date());

    if (end <= start) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    if (startOfDay(start) < today) {
      return res.status(400).json({ message: 'Start date cannot be in the past' });
    }

    const promoId = await getNextSequenceId(SEASONAL_PROMO_SEQUENCE_KEY, 'PROMO', 4);
    const status = deriveSeasonalStatus({ startDate: start, endDate: end, status: 'scheduled' });

    const newPromo = new Promo({
      promoId,
      title,
      discountPercentage: parseInt(discountPercentage),
      startDate: start,
      endDate: end,
      status
    });

    await newPromo.save();
    res.status(201).json({
      message: 'Seasonal promo created successfully',
      promo: newPromo
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update seasonal promo
exports.updateSeasonalPromo = async (req, res) => {
  try {
    const { title, discountPercentage, startDate, endDate, status } = req.body;
    const promo = await Promo.findById(req.params.id);

    if (!promo) {
      return res.status(404).json({ message: 'Promo not found' });
    }

    if (title) promo.title = title;
    if (discountPercentage !== undefined) {
      if (isNaN(discountPercentage) || Number(discountPercentage) < 1 || Number(discountPercentage) > 99) {
        return res.status(400).json({ message: 'Discount percentage must be between 1-99' });
      }
      promo.discountPercentage = parseInt(discountPercentage, 10);
    }

    if (startDate) promo.startDate = new Date(startDate);
    if (endDate) promo.endDate = new Date(endDate);

    if (promo.endDate <= promo.startDate) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    const derivedStatus = deriveSeasonalStatus(promo);

    if (status !== undefined) {
      if (!['active', 'paused'].includes(status)) {
        return res.status(400).json({ message: 'Only active and paused statuses can be toggled manually' });
      }

      if (!['active', 'paused'].includes(derivedStatus)) {
        return res.status(400).json({ message: 'Only active or paused promotions can be toggled' });
      }

      promo.status = status;
    } else {
      promo.status = derivedStatus;
    }

    await promo.save();
    res.json({
      message: 'Promo updated successfully',
      promo
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete seasonal promo
exports.deleteSeasonalPromo = async (req, res) => {
  try {
    const promo = await Promo.findById(req.params.id);

    if (!promo) {
      return res.status(404).json({ message: 'Promo not found' });
    }

    await promo.deleteOne();
    res.json({ message: 'Promo deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all daily discounts
exports.getDailyDiscounts = async (req, res) => {
  try {
    await refreshDailyDiscountStatuses();

    const { search, itemName, status } = req.query;
    let query = {};

    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }

    if (itemName) {
      query.productName = itemName;
    }

    if (status) {
      query.status = status;
    }

    const discounts = await DailyDiscount.find(query).sort({ createdAt: -1 });
    res.json(discounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single daily discount
exports.getDailyDiscountById = async (req, res) => {
  try {
    const discount = await DailyDiscount.findById(req.params.id);
    if (!discount) {
      return res.status(404).json({ message: 'Daily discount not found' });
    }
    res.json(discount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create daily discount
exports.createDailyDiscount = async (req, res) => {
  try {
    await refreshDailyDiscountStatuses();

    const { menuItemId, discountPercentage } = req.body;

    if (!menuItemId) {
      return res.status(400).json({ message: 'Menu item is required' });
    }

    if (!discountPercentage || isNaN(discountPercentage) || Number(discountPercentage) <= 0 || Number(discountPercentage) >= 100) {
      return res.status(400).json({ message: 'Discount percentage must be between 1 and 99' });
    }

    const menuItem = await MenuItem.findById(menuItemId).select('_id name price isActive');
    if (!menuItem || !menuItem.isActive) {
      return res.status(404).json({ message: 'Selected menu item is not available' });
    }

    const existingDiscount = await DailyDiscount.findOne({
      menuItemId,
      validDate: { $gte: startOfDay(new Date()) },
      status: { $in: ['active', 'paused'] }
    });

    if (existingDiscount) {
      return res.status(409).json({ message: 'A daily discount already exists for this item today' });
    }

    const normalizedDiscount = parseInt(discountPercentage, 10);
    const discountId = await getNextSequenceId(DAILY_DISCOUNT_SEQUENCE_KEY, 'DD', 4);
    const newPrice = calculateDiscountedPrice(menuItem.price, normalizedDiscount);

    const newDiscount = new DailyDiscount({
      discountId,
      menuItemId: menuItem._id,
      productName: menuItem.name,
      originalPrice: menuItem.price,
      discountPercentage: normalizedDiscount,
      newPrice,
      status: 'active',
      validDate: new Date()
    });

    await newDiscount.save();
    res.status(201).json({
      message: 'Daily discount created successfully',
      discount: newDiscount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update daily discount
exports.updateDailyDiscount = async (req, res) => {
  try {
    await refreshDailyDiscountStatuses();

    const { menuItemId, discountPercentage, status } = req.body;
    const discount = await DailyDiscount.findById(req.params.id);

    if (!discount) {
      return res.status(404).json({ message: 'Daily discount not found' });
    }

    if (discount.status === 'expired' && status && status !== 'expired') {
      return res.status(400).json({ message: 'Expired discounts cannot be resumed' });
    }

    if (menuItemId && String(menuItemId) !== String(discount.menuItemId)) {
      const menuItem = await MenuItem.findById(menuItemId).select('_id name price isActive');
      if (!menuItem || !menuItem.isActive) {
        return res.status(404).json({ message: 'Selected menu item is not available' });
      }

      discount.menuItemId = menuItem._id;
      discount.productName = menuItem.name;
      discount.originalPrice = menuItem.price;
    }

    if (discountPercentage !== undefined) {
      if (isNaN(discountPercentage) || Number(discountPercentage) <= 0 || Number(discountPercentage) >= 100) {
        return res.status(400).json({ message: 'Discount percentage must be between 1 and 99' });
      }
      discount.discountPercentage = parseInt(discountPercentage, 10);
    }

    if (status !== undefined) {
      if (!['active', 'paused', 'expired'].includes(status)) {
        return res.status(400).json({ message: 'Invalid daily discount status' });
      }
      if (discount.status === 'expired' && status !== 'expired') {
        return res.status(400).json({ message: 'Expired discounts cannot be resumed' });
      }
      discount.status = status;
    }

    discount.newPrice = calculateDiscountedPrice(discount.originalPrice, discount.discountPercentage);

    await discount.save();
    res.json({
      message: 'Daily discount updated successfully',
      discount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete daily discount
exports.deleteDailyDiscount = async (req, res) => {
  try {
    const discount = await DailyDiscount.findById(req.params.id);

    if (!discount) {
      return res.status(404).json({ message: 'Daily discount not found' });
    }

    await discount.deleteOne();
    res.json({ message: 'Daily discount deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getActivePromotionSummary = async (req, res) => {
  try {
    await refreshDailyDiscountStatuses();
    await refreshSeasonalPromoStatuses();

    const activeDailyDiscounts = await DailyDiscount.find({ status: 'active' })
      .select('discountId menuItemId productName discountPercentage newPrice originalPrice');
    const activeSeasonalPromo = await Promo.findOne({ status: 'active' })
      .sort({ createdAt: -1 })
      .select('promoId title discountPercentage startDate endDate status');

    res.json({
      activeDailyDiscounts,
      activeSeasonalPromo
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfile = profileHandlers.getProfile;
exports.updateProfile = profileHandlers.updateProfile;
exports.changePassword = profileHandlers.changePassword;
exports.uploadProfilePhoto = profileHandlers.uploadProfilePhoto;
exports.deleteProfilePhoto = profileHandlers.deleteProfilePhoto;
