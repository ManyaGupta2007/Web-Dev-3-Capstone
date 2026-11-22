const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');

// Sellers only see figures for THEIR items; admins see everything.
const sellerMatch = (user) => (user.role === 'seller' ? { 'items.seller': user._id } : {});

/**
 * AGGREGATION 1: Daily sales summary.
 * $match (not cancelled, optional date range) -> $unwind items -> (seller filter) -> $group by day.
 * GET /api/reports/sales?from=2025-01-01&to=2025-12-31
 */
exports.salesSummary = asyncHandler(async (req, res) => {
  const match = { status: { $ne: 'cancelled' } };
  if (req.query.from || req.query.to) {
    match.createdAt = {};
    if (req.query.from) match.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) match.createdAt.$lte = new Date(req.query.to);
  }
  const data = await Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    ...(req.user.role === 'seller' ? [{ $match: { 'items.seller': req.user._id } }] : []),
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        unitsSold: { $sum: '$items.quantity' },
        orders: { $addToSet: '$_id' },
      },
    },
    { $project: { _id: 0, date: '$_id', revenue: 1, unitsSold: 1, orderCount: { $size: '$orders' } } },
    { $sort: { date: 1 } },
  ]);
  res.json({ success: true, data });
});

/**
 * AGGREGATION 2: Best-selling products.
 * $unwind items -> $group by product -> $sort by units -> $limit.
 * GET /api/reports/best-sellers?limit=5
 */
exports.bestSellers = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 5, 20);
  const data = await Order.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    ...(req.user.role === 'seller' ? [{ $match: { 'items.seller': req.user._id } }] : []),
    {
      $group: {
        _id: '$items.product',
        name: { $first: '$items.name' },
        unitsSold: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
    { $sort: { unitsSold: -1 } },
    { $limit: limit },
  ]);
  res.json({ success: true, data });
});

/**
 * AGGREGATION 3: Inventory summary per category.
 * $lookup joins categories -> $group totals, stock value and low-stock count.
 * GET /api/reports/inventory
 */
exports.inventorySummary = asyncHandler(async (req, res) => {
  const match = req.user.role === 'seller' ? { seller: new mongoose.Types.ObjectId(req.user._id) } : {};
  const data = await Product.aggregate([
    { $match: match },
    { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'cat' } },
    { $unwind: '$cat' },
    {
      $group: {
        _id: '$cat.name',
        products: { $sum: 1 },
        totalUnits: { $sum: '$stock' },
        stockValue: { $sum: { $multiply: ['$price', '$stock'] } },
        lowStockCount: { $sum: { $cond: [{ $lte: ['$stock', '$lowStockThreshold'] }, 1, 0] } },
      },
    },
    { $project: { _id: 0, category: '$_id', products: 1, totalUnits: 1, stockValue: 1, lowStockCount: 1 } },
    { $sort: { stockValue: -1 } },
  ]);
  res.json({ success: true, data });
});

// GET /api/reports/low-stock  (simple query version)
exports.lowStock = asyncHandler(async (req, res) => {
  const filter = { $expr: { $lte: ['$stock', '$lowStockThreshold'] } };
  if (req.user.role === 'seller') filter.seller = req.user._id;
  res.json({ success: true, data: await Product.find(filter).select('name stock lowStockThreshold seller') });
});
