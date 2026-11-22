const Coupon = require('../models/Coupon');
const Cart = require('../models/Cart');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => res.json({ success: true, data: await Coupon.find().sort('-createdAt') }));

exports.create = asyncHandler(async (req, res) => {
  const { code, discountPercent, minOrder, maxUses, expiresAt } = req.body;
  res.status(201).json({ success: true, data: await Coupon.create({ code, discountPercent, minOrder, maxUses, expiresAt }) });
});

exports.remove = asyncHandler(async (req, res) => {
  if (!(await Coupon.findByIdAndDelete(req.params.id))) throw new ApiError(404, 'Coupon not found');
  res.json({ success: true, message: 'Coupon deleted' });
});

// POST /api/coupons/validate { code } -> preview discount on the customer's current cart (does NOT consume the coupon)
exports.validate = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findOne({ code: String(req.body.code).toUpperCase().trim(), isActive: true, expiresAt: { $gt: new Date() } });
  if (!coupon || coupon.usedCount >= coupon.maxUses) throw new ApiError(400, 'Coupon is invalid, expired or fully used');
  const cart = await Cart.findOne({ user: req.user._id }).populate('items.product', 'price');
  const subtotal = cart ? cart.items.reduce((s, i) => s + i.product.price * i.quantity, 0) : 0;
  if (subtotal < coupon.minOrder) throw new ApiError(400, `Minimum order amount is ${coupon.minOrder}`);
  const discount = Math.round(subtotal * coupon.discountPercent) / 100;
  res.json({ success: true, data: { code: coupon.code, subtotal, discount, payable: subtotal - discount } });
});
