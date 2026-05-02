const startOfDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const calculateDiscountedPrice = (originalPrice, discountPercentage) => {
  const price = Number(originalPrice);
  const discount = Number(discountPercentage);
  return roundCurrency(price - (price * discount) / 100);
};

const calculateDailyDiscountAmount = (unitPrice, discountPercentage, quantity) => {
  const amount = ((Number(unitPrice) * Number(discountPercentage)) / 100) * Number(quantity);
  return roundCurrency(amount);
};

const isDailyDiscountExpired = (discount, currentDate = new Date()) => {
  return startOfDay(discount.validDate || discount.createdAt) < startOfDay(currentDate);
};

const deriveSeasonalStatus = (promo, currentDate = new Date()) => {
  const today = startOfDay(currentDate);
  const start = startOfDay(promo.startDate);
  const end = endOfDay(promo.endDate);

  if (today > end) {
    return 'expired';
  }

  if (today < start) {
    return 'scheduled';
  }

  if (promo.status === 'paused') {
    return 'paused';
  }

  return 'active';
};

module.exports = {
  startOfDay,
  endOfDay,
  roundCurrency,
  calculateDiscountedPrice,
  calculateDailyDiscountAmount,
  isDailyDiscountExpired,
  deriveSeasonalStatus
};