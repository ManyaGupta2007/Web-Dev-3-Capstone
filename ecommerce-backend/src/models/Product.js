const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true },
    description: { type: String, trim: true, default: '' },
    price: { type: Number, required: [true, 'Price is required'], min: [0, 'Price cannot be negative'] },
    stock: { type: Number, required: true, min: [0, 'Stock cannot be negative'], default: 0, validate: Number.isInteger },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: [true, 'Category is required'] },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// INDEXES
productSchema.index({ name: 'text', description: 'text' }); // 1) full-text search
productSchema.index({ category: 1, price: 1 });             // 2) category filter + price sort
productSchema.index({ seller: 1 });                         // 3) seller's own products

module.exports = mongoose.model('Product', productSchema);
