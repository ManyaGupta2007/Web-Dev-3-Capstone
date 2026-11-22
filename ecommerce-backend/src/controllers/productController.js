const Product = require('../models/Product');
const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const eventBus = require('../events/eventBus');

// Seller can touch only their own products; admin can touch all.
const assertOwnership = (product, user) => {
  if (user.role !== 'admin' && String(product.seller) !== String(user._id)) {
    throw new ApiError(403, 'You can only modify your own products');
  }
};

const emitIfLow = (product) => {
  if (product.stock <= product.lowStockThreshold) {
    eventBus.emit('stock.low', { productId: product._id, name: product.name, stock: product.stock, seller: product.seller });
  }
};

// GET /api/products?q=&category=&minPrice=&maxPrice=&sort=price|-price|-createdAt&page=&limit=
exports.list = asyncHandler(async (req, res) => {
  const { q, category, minPrice, maxPrice, sort = '-createdAt' } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);

  const filter = { isActive: true };
  if (q) filter.$text = { $search: q };
  if (category) filter.category = category;
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  const [items, total] = await Promise.all([
    Product.find(filter).populate('category', 'name').populate('seller', 'name').sort(sort).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ success: true, page, limit, total, pages: Math.ceil(total / limit), data: items });
});

exports.getOne = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category', 'name').populate('seller', 'name');
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ success: true, data: product });
});

// GET /api/products/mine  (seller's own listing, includes inactive)
exports.mine = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Product.find({ seller: req.user._id }) });
});

exports.create = asyncHandler(async (req, res) => {
  const { name, description, price, stock, lowStockThreshold, category } = req.body;
  if (!(await Category.exists({ _id: category }))) throw new ApiError(400, 'Category does not exist');
  // Sellers always own what they create. Admin may create on behalf of a seller via body.seller.
  const seller = req.user.role === 'admin' && req.body.seller ? req.body.seller : req.user._id;
  const product = await Product.create({ name, description, price, stock, lowStockThreshold, category, seller });
  emitIfLow(product);
  res.status(201).json({ success: true, data: product });
});

exports.update = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  assertOwnership(product, req.user);
  ['name', 'description', 'price', 'stock', 'lowStockThreshold', 'isActive'].forEach((f) => {
    if (req.body[f] !== undefined) product[f] = req.body[f];
  });
  await product.save(); // runs schema validation
  emitIfLow(product);
  res.json({ success: true, data: product });
});

exports.remove = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  assertOwnership(product, req.user);
  await product.deleteOne();
  res.json({ success: true, message: 'Product deleted' });
});
