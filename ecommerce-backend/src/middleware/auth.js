const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// 1) Authentication: verify the JWT access token and attach the user to req.
exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new ApiError(401, 'Authentication token missing');
  const payload = jwt.verify(header.split(' ')[1], process.env.JWT_ACCESS_SECRET);
  const user = await User.findById(payload.id);
  if (!user) throw new ApiError(401, 'User no longer exists');
  req.user = user;
  next();
});

// 2) Authorization (RBAC): allow only the listed roles.
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new ApiError(403, `Role '${req.user.role}' is not allowed to perform this action`));
  }
  next();
};
