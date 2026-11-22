const Cart = require('../models/Cart');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const getOrCreateCart = async (userId) => (await Cart.findOne({ user: userId })) || (await Cart.create({ user: userId, items: [] }));

// Totals are ALWAYS computed on the server from current DB prices.
const buildCartView = async (cart) => {
  await cart.populate('items.product', 'name price stock isActive');
  const items = cart.items
    .filter((i) => i.product)
    .map((i) => ({
      productId: i.product._id,
      name: i.product.name,
      price: i.product.price,
      quantity: i.quantity,
      inStock: i.product.isActive && i.product.stock >= i.quantity,
      lineTotal: i.product.price * i.quantity,
    }));
  return { items, totalAmount: items.reduce((s, i) => s + i.lineTotal, 0) };
};

exports.getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  res.json({ success: true, data: await buildCartView(cart) });
});

// POST /api/cart/items  { productId, quantity }
exports.addItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw new ApiError(404, 'Product not found');

  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((i) => String(i.product) === String(productId));
  const newQty = (existing ? existing.quantity : 0) + quantity;
  if (newQty > product.stock) throw new ApiError(400, `Only ${product.stock} unit(s) available`);

  if (existing) existing.quantity = newQty;
  else cart.items.push({ product: productId, quantity });
  await cart.save();
  res.status(201).json({ success: true, data: await buildCartView(cart) });
});

// PATCH /api/cart/items/:productId  { quantity }
exports.updateItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.find((i) => String(i.product) === req.params.productId);
  if (!item) throw new ApiError(404, 'Item not in cart');
  const product = await Product.findById(req.params.productId);
  if (!product || quantity > product.stock) throw new ApiError(400, `Only ${product ? product.stock : 0} unit(s) available`);
  item.quantity = quantity;
  await cart.save();
  res.json({ success: true, data: await buildCartView(cart) });
});

exports.removeItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const before = cart.items.length;
  cart.items = cart.items.filter((i) => String(i.product) !== req.params.productId);
  if (cart.items.length === before) throw new ApiError(404, 'Item not in cart');
  await cart.save();
  res.json({ success: true, data: await buildCartView(cart) });
});

exports.clear = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = [];
  await cart.save();
  res.json({ success: true, message: 'Cart cleared' });
});
