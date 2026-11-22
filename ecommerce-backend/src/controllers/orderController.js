const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const eventBus = require('../events/eventBus');

// Restore stock for a list of {product, quantity} (used on cancellation and checkout rollback).
const restoreStock = (items) =>
  Promise.all(items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity } })));

/**
 * POST /api/orders  (customer)
 * Checkout flow:
 *  1. Load the cart.
 *  2. For EACH item do an ATOMIC conditional update:
 *       findOneAndUpdate({_id, stock >= qty}, {$inc: {stock: -qty}})
 *     MongoDB applies this atomically on one document, so two customers buying the last unit
 *     cannot both succeed -> stock never goes negative (no overselling).
 *  3. If any item fails, roll back the ones already reserved and return 409.
 *  4. Create the order with price SNAPSHOTS and a server-calculated total.
 *  5. Clear the cart, emit events (order.placed, stock.low).
 */
exports.placeOrder = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || cart.items.length === 0) throw new ApiError(400, 'Cart is empty');

  const reserved = [];
  const orderItems = [];
  try {
    for (const item of cart.items) {
      const product = await Product.findOneAndUpdate(
        { _id: item.product, isActive: true, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (!product) {
        const p = await Product.findById(item.product);
        throw new ApiError(409, `Insufficient stock for ${p ? p.name : 'a product in your cart'}`);
      }
      reserved.push(item);
      orderItems.push({ product: product._id, seller: product.seller, name: product.name, price: product.price, quantity: item.quantity, _p: product });
    }
  } catch (err) {
    await restoreStock(reserved); // rollback
    throw err;
  }

  const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);

  // Optional coupon: redeemed ATOMICALLY (valid + not expired + min order + uses left) so a limited coupon can't be over-used.
  let discount = 0, couponCode;
  if (req.body.couponCode) {
    const code = String(req.body.couponCode).toUpperCase().trim();
    const coupon = await Coupon.findOneAndUpdate(
      { code, isActive: true, expiresAt: { $gt: new Date() }, minOrder: { $lte: subtotal }, $expr: { $lt: ['$usedCount', '$maxUses'] } },
      { $inc: { usedCount: 1 } }, { new: true }
    );
    if (!coupon) {
      await restoreStock(reserved);
      throw new ApiError(400, 'Coupon is invalid, expired, fully used, or the minimum order amount is not met');
    }
    discount = Math.round(subtotal * coupon.discountPercent) / 100;
    couponCode = code;
  }
  const totalAmount = subtotal - discount;

  const order = await Order.create({
    customer: req.user._id,
    items: orderItems.map(({ _p, ...i }) => i),
    subtotal, discount, couponCode, totalAmount,
    shippingAddress: req.body.shippingAddress,
    statusHistory: [{ status: 'pending', by: req.user._id }],
  }).catch(async (err) => {
    await restoreStock(reserved); // e.g. address validation failed -> release stock and coupon use
    if (couponCode) await Coupon.updateOne({ code: couponCode }, { $inc: { usedCount: -1 } });
    throw err;
  });

  cart.items = [];
  await cart.save();

  eventBus.emit('order.placed', {
    orderId: order._id,
    customer: req.user._id,
    total: totalAmount,
    sellers: [...new Set(order.items.map((i) => String(i.seller)))],
    items: order.items.map((i) => ({ name: i.name, quantity: i.quantity })),
  });
  orderItems.forEach(({ _p }) => {
    if (_p.stock <= _p.lowStockThreshold) {
      eventBus.emit('stock.low', { productId: _p._id, name: _p.name, stock: _p.stock, seller: _p.seller });
    }
  });

  res.status(201).json({ success: true, data: order });
});

// GET /api/orders  -> customer: own orders | seller: orders containing their products | admin: all
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role === 'customer') filter.customer = req.user._id;
  if (req.user.role === 'seller') filter['items.seller'] = req.user._id;
  if (req.query.status) filter.status = req.query.status;

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const [orders, total] = await Promise.all([
    Order.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, page, limit, total, data: orders });
});

const loadOrderWithAccess = async (id, user) => {
  const order = await Order.findById(id);
  if (!order) throw new ApiError(404, 'Order not found');
  const isOwner = String(order.customer) === String(user._id);
  const isSeller = order.items.some((i) => String(i.seller) === String(user._id));
  if (!(user.role === 'admin' || isOwner || isSeller)) throw new ApiError(403, 'You do not have access to this order');
  return { order, isOwner, isSeller };
};

exports.getOne = asyncHandler(async (req, res) => {
  const { order } = await loadOrderWithAccess(req.params.id, req.user);
  res.json({ success: true, data: order });
});

const changeStatus = async (order, newStatus, userId) => {
  if (!Order.TRANSITIONS[order.status].includes(newStatus)) {
    throw new ApiError(400, `Cannot change status from '${order.status}' to '${newStatus}'`);
  }
  if (newStatus === 'cancelled') await restoreStock(order.items); // return stock to inventory
  order.status = newStatus;
  order.statusHistory.push({ status: newStatus, by: userId });
  await order.save();
  eventBus.emit('order.statusChanged', { orderId: order._id, customer: order.customer, status: newStatus });
};

// PATCH /api/orders/:id/status  (seller of the order / admin)  { status }
exports.updateStatus = asyncHandler(async (req, res) => {
  const { order, isSeller } = await loadOrderWithAccess(req.params.id, req.user);
  if (req.user.role !== 'admin' && !isSeller) throw new ApiError(403, 'Only the seller or an admin can update order status');
  await changeStatus(order, req.body.status, req.user._id);
  res.json({ success: true, data: order });
});

// POST /api/orders/:id/cancel  (customer, only own order)
exports.cancel = asyncHandler(async (req, res) => {
  const { order, isOwner } = await loadOrderWithAccess(req.params.id, req.user);
  if (!isOwner) throw new ApiError(403, 'You can only cancel your own orders');
  await changeStatus(order, 'cancelled', req.user._id);
  res.json({ success: true, data: order });
});
