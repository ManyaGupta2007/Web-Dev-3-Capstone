const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: [true, 'Coupon code is required'], unique: true, uppercase: true, trim: true },
    discountPercent: { type: Number, required: true, min: [1, 'Minimum discount is 1%'], max: [90, 'Maximum discount is 90%'] },
    minOrder: { type: Number, default: 0, min: 0 },
    maxUses: { type: Number, default: 100, min: 1 },
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date, required: [true, 'Expiry date is required'] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Coupon', couponSchema);
