const Order = require('../../models/Order');
const MenuItem = require('../../models/MenuItem');
const DailyDiscount = require('../../models/DailyDiscount');
const Promo = require('../../models/Promo');
const StockItem = require('../../models/StockItem');
const Counter = require('../../models/Counter');
const { createProfileHandlers } = require('../../utils/profileHandlers');
const {
    roundCurrency,
    calculateDailyDiscountAmount,
    calculateDiscountedPrice,
    isDailyDiscountExpired,
    deriveSeasonalStatus
} = require('../../utils/promotionEngine');

const profileHandlers = createProfileHandlers({ minAge: 16 });
const ORDER_SEQUENCE_KEY = 'order-sequence';

const resolveStockStatus = (currentQty, minQty, maxQty) => {
    if (currentQty < minQty) return 'low_stock';
    if (currentQty > maxQty) return 'over_stock';
    return 'good';
};

const ensureOrderCounter = async () => {
    await Counter.findByIdAndUpdate(
        ORDER_SEQUENCE_KEY,
        { $setOnInsert: { seq: 0 } },
        { new: true, upsert: true }
    );
};

const generateOrderId = async () => {
    await ensureOrderCounter();
    const counter = await Counter.findByIdAndUpdate(
        ORDER_SEQUENCE_KEY,
        { $inc: { seq: 1 } },
        { new: true }
    );

    return `ORD${String(counter.seq).padStart(3, '0')}`;
};

const getStockForMenuItem = async (menuItem) => {
    let stockItem = await StockItem.findOne({ itemId: menuItem._id });
    if (!stockItem) {
        stockItem = await StockItem.findOne({ itemName: menuItem.name });
    }
    return stockItem;
};

const validateAndBuildItems = async (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Order must have at least one item');
    }

    const itemIds = items.map((item) => item.menuItemId).filter(Boolean);
    const menuItems = await MenuItem.find({ _id: { $in: itemIds }, isActive: true }).select('_id name price');
    const menuMap = new Map(menuItems.map((item) => [String(item._id), item]));

    const dailyDiscounts = await DailyDiscount.find({
        menuItemId: { $in: itemIds },
        status: { $in: ['active', 'paused', 'expired'] }
    });

    const activeDailyDiscountMap = new Map();
    for (const discount of dailyDiscounts) {
        if (discount.status === 'active' && !isDailyDiscountExpired(discount)) {
            activeDailyDiscountMap.set(String(discount.menuItemId), discount);
        }
    }

    const promos = await Promo.find({});
    const activeSeasonalPromo = promos
        .map((promo) => ({ promo, derivedStatus: deriveSeasonalStatus(promo) }))
        .find(({ derivedStatus }) => derivedStatus === 'active')?.promo || null;

    let subtotal = 0;
    let dailyDiscountTotal = 0;

    const normalizedItems = [];
    for (const item of items) {
        const menuItem = menuMap.get(String(item.menuItemId));
        if (!menuItem) {
            throw new Error(`Menu item not found for ${item.menuItemId}`);
        }

        const quantity = Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error(`Invalid quantity for ${menuItem.name}`);
        }

        const stockItem = await getStockForMenuItem(menuItem);
        if (!stockItem) {
            throw new Error(`Stock record not found for ${menuItem.name}`);
        }

        if (quantity > stockItem.currentQty) {
            throw new Error(`Insufficient stock for ${menuItem.name}. Available: ${stockItem.currentQty}`);
        }

        const unitPrice = roundCurrency(menuItem.price);
        const lineSubtotal = roundCurrency(unitPrice * quantity);
        const dailyDiscount = activeDailyDiscountMap.get(String(menuItem._id));
        const dailyDiscountPercentage = dailyDiscount?.discountPercentage || 0;
        const discountedUnitPrice = dailyDiscount
            ? calculateDiscountedPrice(unitPrice, dailyDiscountPercentage)
            : unitPrice;
        const dailyDiscountAmount = dailyDiscount
            ? calculateDailyDiscountAmount(unitPrice, dailyDiscountPercentage, quantity)
            : 0;
        const lineTotal = roundCurrency(lineSubtotal - dailyDiscountAmount);

        subtotal += lineSubtotal;
        dailyDiscountTotal += dailyDiscountAmount;

        normalizedItems.push({
            menuItemId: menuItem._id,
            itemName: menuItem.name,
            quantity,
            unitPrice,
            discountedUnitPrice,
            dailyDiscountPercentage,
            dailyDiscountAmount,
            lineSubtotal,
            lineTotal
        });
    }

    subtotal = roundCurrency(subtotal);
    dailyDiscountTotal = roundCurrency(dailyDiscountTotal);
    const subtotalAfterDaily = roundCurrency(subtotal - dailyDiscountTotal);
    const seasonalPromoDiscountPercentage = activeSeasonalPromo?.discountPercentage || 0;
    const seasonalPromoDiscount = activeSeasonalPromo
        ? roundCurrency((subtotalAfterDaily * seasonalPromoDiscountPercentage) / 100)
        : 0;
    const totalDiscountAmount = roundCurrency(dailyDiscountTotal + seasonalPromoDiscount);
    const payableAmount = roundCurrency(subtotal - totalDiscountAmount);

    return {
        normalizedItems,
        subtotal,
        dailyDiscountTotal,
        subtotalAfterDaily,
        seasonalPromoId: activeSeasonalPromo?.promoId,
        seasonalPromoTitle: activeSeasonalPromo?.title,
        seasonalPromoDiscountPercentage,
        seasonalPromoDiscount,
        totalDiscount: totalDiscountAmount,
        payableAmount
    };
};

const applyOrderCompletionStockDeduction = async (order) => {
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
            throw new Error(`Insufficient stock while completing order for ${item.itemName}`);
        }

        stockItem.currentQty -= item.quantity;
        stockItem.status = resolveStockStatus(stockItem.currentQty, stockItem.minQty, stockItem.maxQty);
        await stockItem.save();
    }
};

// Staff list endpoint
exports.getOrders = async (req, res) => {
    try {
        const { status, search } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { orderId: { $regex: search, $options: 'i' } },
                { 'items.itemName': { $regex: search, $options: 'i' } }
            ];
        }

        const orders = await Order.find(query)
            .populate('customerId', 'userId fullName username')
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Customer-only list endpoint
exports.getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ customerId: req.user.id }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMyPendingOrder = async (req, res) => {
    try {
        const pendingOrder = await Order.findOne({ customerId: req.user.id, status: 'pending' }).sort({ createdAt: -1 });
        res.json(pendingOrder || null);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('customerId', 'userId fullName username');
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (req.user.role === 'customer' && String(order.customerId?._id || order.customerId) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Forbidden: You can only view your own orders' });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createOrder = async (req, res) => {
    try {
        const { items } = req.body;
        const calculation = await validateAndBuildItems(items);

        const orderId = await generateOrderId();
        const newOrder = new Order({
            orderId,
            customerId: req.user.id,
            items: calculation.normalizedItems,
            subtotal: calculation.subtotal,
            dailyDiscountTotal: calculation.dailyDiscountTotal,
            subtotalAfterDaily: calculation.subtotalAfterDaily,
            seasonalPromoId: calculation.seasonalPromoId,
            seasonalPromoTitle: calculation.seasonalPromoTitle,
            seasonalPromoDiscountPercentage: calculation.seasonalPromoDiscountPercentage,
            seasonalPromoDiscount: calculation.seasonalPromoDiscount,
            totalDiscount: calculation.totalDiscount,
            payableAmount: calculation.payableAmount,
            status: 'pending'
        });

        await newOrder.save();

        res.status(201).json({
            message: 'Pending order created successfully',
            order: newOrder
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updatePendingOrder = async (req, res) => {
    try {
        const { items } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (String(order.customerId) !== String(req.user.id) && req.user.role === 'customer') {
            return res.status(403).json({ message: 'Forbidden: You can only update your own order' });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({ message: 'Only pending orders can be updated' });
        }

        const calculation = await validateAndBuildItems(items);

        order.items = calculation.normalizedItems;
        order.subtotal = calculation.subtotal;
        order.dailyDiscountTotal = calculation.dailyDiscountTotal;
        order.subtotalAfterDaily = calculation.subtotalAfterDaily;
        order.seasonalPromoId = calculation.seasonalPromoId;
        order.seasonalPromoTitle = calculation.seasonalPromoTitle;
        order.seasonalPromoDiscountPercentage = calculation.seasonalPromoDiscountPercentage;
        order.seasonalPromoDiscount = calculation.seasonalPromoDiscount;
        order.totalDiscount = calculation.totalDiscount;
        order.payableAmount = calculation.payableAmount;

        await order.save();

        res.json({
            message: 'Pending order updated successfully',
            order
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.voidOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (String(order.customerId) !== String(req.user.id) && req.user.role === 'customer') {
            return res.status(403).json({ message: 'Forbidden: You can only void your own order' });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({ message: 'Only pending orders can be voided' });
        }

        order.status = 'void';
        order.voidedAt = new Date();
        await order.save();

        res.json({ message: 'Order marked as void', order });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (!['pending', 'completed', 'void', 'refunded'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        if (status === 'completed' && order.status !== 'completed') {
            await applyOrderCompletionStockDeduction(order);
            order.completedAt = new Date();
        }

        if (status === 'void') {
            order.voidedAt = new Date();
        }

        if (status === 'refunded') {
            order.refundedAt = new Date();
        }

        order.status = status;
        await order.save();

        res.json({
            message: 'Order status updated',
            order
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getKitchenDisplay = async (req, res) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : { status: { $in: ['pending', 'completed', 'void', 'refunded'] } };

        const orders = await Order.find(query)
            .select('orderId items payableAmount status createdAt')
            .sort({ createdAt: -1 })
            .limit(100);

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getProfile = profileHandlers.getProfile;
exports.updateProfile = profileHandlers.updateProfile;
exports.changePassword = profileHandlers.changePassword;
exports.uploadProfilePhoto = profileHandlers.uploadProfilePhoto;
exports.deleteProfilePhoto = profileHandlers.deleteProfilePhoto;
