const mongoose = require('mongoose');

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

// Allowed status transitions (business rule)
const TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        _id: false,
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        name: String,                            // snapshot: product name at purchase time
        price: { type: Number, required: true }, // snapshot: price at purchase time
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    subtotal: Number,
    discount: { type: Number, default: 0 },
    couponCode: String,
    totalAmount: { type: Number, required: true },
    shippingAddress: {
      line1: { type: String, required: [true, 'Address line is required'] },
      city: { type: String, required: [true, 'City is required'] },
      postalCode: { type: String, required: [true, 'Postal code is required'] },
      country: { type: String, default: 'India' },
    },
    payment: {
      method: { type: String, default: 'SIMULATED' },
      status: { type: String, default: 'SIMULATED_PAID' }, // no real payment gateway is used
    },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
    statusHistory: [{ _id: false, status: String, at: { type: Date, default: Date.now }, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }],
  },
  { timestamps: true }
);

orderSchema.index({ customer: 1, createdAt: -1 });   // customer's order history
orderSchema.index({ 'items.seller': 1, status: 1 }); // seller's orders

const Order = mongoose.model('Order', orderSchema);
Order.TRANSITIONS = TRANSITIONS;
module.exports = Order;
