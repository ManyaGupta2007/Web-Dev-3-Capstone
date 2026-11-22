require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Category = require('./models/Category');
const Product = require('./models/Product');
const Cart = require('./models/Cart');
const Order = require('./models/Order');
const Coupon = require('./models/Coupon');
const Review = require('./models/Review');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.deleteMany(), Category.deleteMany(), Product.deleteMany(), Cart.deleteMany(), Order.deleteMany(), Coupon.deleteMany(), Review.deleteMany()]);

  const admin = await User.create({ name: 'Admin', email: 'admin@shop.com', password: 'admin123', role: 'admin' });
  const seller = await User.create({ name: 'Seller One', email: 'seller@shop.com', password: 'seller123', role: 'seller' });
  const seller2 = await User.create({ name: 'Seller Two', email: 'seller2@shop.com', password: 'seller123', role: 'seller' });
  const customer = await User.create({ name: 'Customer One', email: 'customer@shop.com', password: 'customer123', role: 'customer' });

  const [electronics, books] = await Category.create([
    { name: 'Electronics', description: 'Gadgets and devices' },
    { name: 'Books', description: 'Printed books' },
  ]);

  await Product.create([
    { name: 'Wireless Mouse', description: 'Ergonomic wireless mouse', price: 699, stock: 50, category: electronics._id, seller: seller._id },
    { name: 'Mechanical Keyboard', description: 'RGB mechanical keyboard', price: 2999, stock: 8, category: electronics._id, seller: seller._id },
    { name: 'USB-C Cable', description: '1m fast charging cable', price: 299, stock: 3, category: electronics._id, seller: seller._id }, // low stock
    { name: 'Node.js Handbook', description: 'Learn backend development', price: 499, stock: 20, category: books._id, seller: seller2._id },
  ]);

  const year = new Date(Date.now() + 365 * 864e5);
  await Coupon.create([
    { code: 'WELCOME10', discountPercent: 10, maxUses: 100, expiresAt: year },
    { code: 'BIG20', discountPercent: 20, minOrder: 2000, maxUses: 5, expiresAt: year },
  ]);

  console.log('Seed complete.\nCoupons: WELCOME10 (10%), BIG20 (20% on orders >= 2000)\nLogins:\n  admin@shop.com / admin123\n  seller@shop.com / seller123\n  seller2@shop.com / seller123\n  customer@shop.com / customer123');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
