const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const data = await Review.find({ product: req.params.id }).populate('user', 'name').sort('-createdAt');
  res.json({ success: true, data });
});

// POST /api/products/:id/reviews  { rating, comment }
// Rule: only customers whose order containing this product was DELIVERED may review (verified buyers). One review each.
exports.add = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  const bought = await Order.exists({ customer: req.user._id, status: 'delivered', 'items.product': product._id });
  if (!bought) throw new ApiError(403, 'Only customers with a delivered order for this product can review it');

  const review = await Review.create({ product: product._id, user: req.user._id, rating: req.body.rating, comment: req.body.comment });

  // AGGREGATION: recompute average rating and count for the product
  const [s] = await Review.aggregate([
    { $match: { product: product._id } },
    { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
  ]);
  await Product.updateOne({ _id: product._id }, { ratingAvg: Math.round(s.avg * 10) / 10, ratingCount: s.n });
  res.status(201).json({ success: true, data: review });
});
