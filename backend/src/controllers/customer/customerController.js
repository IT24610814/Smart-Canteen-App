const User = require('../../models/User');
const Order = require('../../models/Order');
const MenuItem = require('../../models/MenuItem');
const StockItem = require('../../models/StockItem');
const DailyDiscount = require('../../models/DailyDiscount');
const Promo = require('../../models/Promo');
const { createProfileHandlers } = require('../../utils/profileHandlers');
const {
  calculateDiscountedPrice,
  isDailyDiscountExpired,
  deriveSeasonalStatus
} = require('../../utils/promotionEngine');

const profileHandlers = createProfileHandlers({ minAge: 17 });

exports.getProfile = profileHandlers.getProfile;
exports.updateProfile = profileHandlers.updateProfile;
exports.changePassword = profileHandlers.changePassword;
exports.uploadProfilePhoto = profileHandlers.uploadProfilePhoto;
exports.deleteProfilePhoto = profileHandlers.deleteProfilePhoto;

// Browse menu
exports.browseMenu = async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (category) {
      query.category = category;
    }

    const menuItems = await MenuItem.find(query).sort({ createdAt: -1 });
    const stockItems = await StockItem.find({}).select('itemId itemName currentQty');
    const dailyDiscounts = await DailyDiscount.find({ status: 'active' })
      .select('menuItemId productName discountPercentage newPrice originalPrice validDate');

    const stockByItemId = new Map(
      stockItems
        .filter((stock) => stock.itemId)
        .map((stock) => [String(stock.itemId), stock.currentQty])
    );

    const stockByItemName = new Map(
      stockItems
        .filter((stock) => stock.itemName)
        .map((stock) => [String(stock.itemName).toLowerCase(), stock.currentQty])
    );

    const activeDailyDiscounts = new Map(
      dailyDiscounts
        .filter((discount) => !isDailyDiscountExpired(discount))
        .map((discount) => [String(discount.menuItemId), discount])
    );

    const menuWithStock = menuItems.map((menu) => {
      const itemIdQty = stockByItemId.get(String(menu._id));
      const nameQty = stockByItemName.get(String(menu.name).toLowerCase());
      const quantity = Number.isFinite(itemIdQty) ? itemIdQty : (Number.isFinite(nameQty) ? nameQty : 0);
      const dailyDiscount = activeDailyDiscounts.get(String(menu._id));
      const effectivePrice = dailyDiscount
        ? calculateDiscountedPrice(menu.price, dailyDiscount.discountPercentage)
        : menu.price;

      return {
        ...menu.toObject(),
        quantity,
        isOutOfStock: quantity <= 0,
        effectivePrice,
        dailyDiscount: dailyDiscount ? {
          discountId: dailyDiscount.discountId,
          discountPercentage: dailyDiscount.discountPercentage,
          newPrice: effectivePrice,
          originalPrice: menu.price
        } : null
      };
    });

    res.json(menuWithStock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getActivePromotions = async (req, res) => {
  try {
    const promos = await Promo.find({});
    const activeSeasonalPromo = promos
      .map((promo) => ({ promo, derivedStatus: deriveSeasonalStatus(promo) }))
      .find(({ derivedStatus }) => derivedStatus === 'active')?.promo || null;

    res.json({
      activeSeasonalPromo: activeSeasonalPromo ? {
        promoId: activeSeasonalPromo.promoId,
        title: activeSeasonalPromo.title,
        discountPercentage: activeSeasonalPromo.discountPercentage,
        startDate: activeSeasonalPromo.startDate,
        endDate: activeSeasonalPromo.endDate,
        status: 'active'
      } : null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get my orders
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.user.id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
