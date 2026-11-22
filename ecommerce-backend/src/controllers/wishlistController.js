const User = require('../models/User');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.get = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('wishlist', 'name price stock ratingAvg');
  res.json({ success: true, data: user.wishlist });
});

// $addToSet prevents duplicates
exports.add = asyncHandler(async (req, res) => {
  if (!(await Product.exists({ _id: req.params.productId }))) throw new ApiError(404, 'Product not found');
  await User.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: req.params.productId } });
  res.status(201).json({ success: true, message: 'Added to wishlist' });
});

exports.remove = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: req.params.productId } });
  res.json({ success: true, message: 'Removed from wishlist' });
});
