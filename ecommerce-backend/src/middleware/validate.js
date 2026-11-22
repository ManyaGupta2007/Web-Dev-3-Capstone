const ApiError = require('../utils/ApiError');

/**
 * Tiny request-body validator.
 * rules = { field: { required: true, type: 'string'|'number', min: 1, enum: [...] } }
 */
module.exports = (rules) => (req, res, next) => {
  const errors = [];
  for (const [field, rule] of Object.entries(rules)) {
    const value = req.body[field];
    if (value === undefined || value === null || value === '') {
      if (rule.required) errors.push(`${field} is required`);
      continue;
    }
    if (rule.type && typeof value !== rule.type) errors.push(`${field} must be a ${rule.type}`);
    if (rule.min !== undefined && typeof value === 'number' && value < rule.min) errors.push(`${field} must be >= ${rule.min}`);
    if (rule.enum && !rule.enum.includes(value)) errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
  }
  if (errors.length) return next(new ApiError(400, errors.join('; ')));
  next();
};
