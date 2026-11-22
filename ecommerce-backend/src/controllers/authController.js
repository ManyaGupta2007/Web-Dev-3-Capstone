const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signAccessToken, signRefreshToken, hashToken } = require('../utils/tokens');

// Issue a fresh access + refresh pair and store the refresh token's hash on the user.
const issueTokens = async (user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });
  return { accessToken, refreshToken };
};

// POST /api/auth/register  (public: only customer or seller; admins are created via seed)
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const user = await User.create({ name, email, password, role: role === 'seller' ? 'seller' : 'customer' });
  const tokens = await issueTokens(user);
  res.status(201).json({ success: true, data: { user: { id: user._id, name, email, role: user.role }, ...tokens } });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) throw new ApiError(401, 'Invalid email or password');
  const tokens = await issueTokens(user);
  res.json({ success: true, data: { user: { id: user._id, name: user.name, email: user.email, role: user.role }, ...tokens } });
});

// POST /api/auth/refresh  (refresh-token rotation: old token becomes invalid after use)
exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(400, 'refreshToken is required');
  const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const user = await User.findById(payload.id).select('+refreshTokenHash');
  if (!user || user.refreshTokenHash !== hashToken(refreshToken)) throw new ApiError(401, 'Refresh token is invalid or already used');
  const tokens = await issueTokens(user);
  res.json({ success: true, data: tokens });
});

// POST /api/auth/logout  (invalidates the stored refresh token)
exports.logout = asyncHandler(async (req, res) => {
  req.user.refreshTokenHash = undefined;
  await req.user.save({ validateBeforeSave: false });
  res.json({ success: true, message: 'Logged out' });
});

// GET /api/users/me
exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

// PATCH /api/users/me  (only name can be changed here)
exports.updateMe = asyncHandler(async (req, res) => {
  if (req.body.name) req.user.name = req.body.name;
  await req.user.save({ validateBeforeSave: false });
  res.json({ success: true, data: req.user });
});
